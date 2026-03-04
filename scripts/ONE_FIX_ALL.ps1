# ONE_FIX_ALL.ps1
# One-command: auto-detect Supabase root, fix migration history mismatches, then push.
# Usage:
#   powershell -ExecutionPolicy Bypass -File project/scripts/ONE_FIX_ALL.ps1

# Supabase CLI frequently writes progress to stderr; don't treat that as terminating.
$ErrorActionPreference = "Continue"

# Will be set in main after locating supabase root
$script:OneFixLogDir = $null

function Log { param([string]$Msg) Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Msg" }
function Warn { param([string]$Msg) Write-Host "WARN: $Msg" -ForegroundColor Yellow }
function Fail { param([string]$Msg, [int]$Code = 1) Write-Host "ERROR: $Msg" -ForegroundColor Red; exit $Code }

function Run-Cmd {
  param(
    [string]$Title,
    [string[]]$Command,
    [switch]$AllowFailure
  )
  Log $Title
  if (-not $Command -or $Command.Length -lt 1) {
    Fail "Internal error: empty command for '$Title'"
  }
  $exe = $Command[0]
  $argv = @()
  if ($Command.Length -gt 1) { $argv = @($Command[1..($Command.Length-1)]) }
  $out = & $exe @argv 2>&1

  # Log to console
  $out | ForEach-Object { Log "  $_" }

  # Also persist raw stdout/stderr to a log file for debugging SQLSTATE / line errors
  if ($script:OneFixLogDir) {
    $logPath = Join-Path $script:OneFixLogDir "one_fix_all.log"
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logPath -Value "[$ts] $Title"
    $out | ForEach-Object { Add-Content -Path $logPath -Value "  $_" }
    Add-Content -Path $logPath -Value ""
  }
  if (-not $AllowFailure -and $LASTEXITCODE -ne 0) {
    Fail "$Title failed (exit $LASTEXITCODE)."
  }
  return ,$out
}

function Find-SupabaseRoot {
  param([string]$StartDir)

  # Prefer directories containing "supabase/migrations"
  $candidates = Get-ChildItem -Path $StartDir -Directory -Recurse -Force -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -eq "supabase" } |
    ForEach-Object {
      $supabaseDir = $_.FullName
      $migrationsDir = Join-Path $supabaseDir "migrations"
      if (Test-Path $migrationsDir) {
        [PSCustomObject]@{
          SupabaseDir = $supabaseDir
          RootDir = Split-Path -Parent $supabaseDir
          HasConfig = Test-Path (Join-Path $supabaseDir "config.toml")
          MigrationCount = (Get-ChildItem -Path $migrationsDir -Filter "*.sql" -File -ErrorAction SilentlyContinue | Measure-Object).Count
        }
      }
    } | Where-Object { $_ -ne $null }

  if (-not $candidates -or $candidates.Count -eq 0) {
    Fail "Could not find any supabase/migrations directory under: $StartDir"
  }

  # Pick the one with the most migration files (best signal)
  $selected = $candidates | Sort-Object -Property MigrationCount -Descending | Select-Object -First 1
  return $selected
}

function Ensure-ConfigToml {
  param(
    [string]$SupabaseDir,
    [string]$ProjectRef
  )
  $cfgPath = Join-Path $SupabaseDir "config.toml"
  $content = "project_id = `"$ProjectRef`"`n"

  if (Test-Path $cfgPath) {
    # Ensure it is parseable TOML (most common failure: UTF-8 BOM)
    $raw = Get-Content -Path $cfgPath -Raw -ErrorAction SilentlyContinue
    if ($raw -and ($raw -match 'project_id\s*=\s*\"[^\"]+\"')) {
      Log "supabase/config.toml exists"
      return
    }
    Warn "supabase/config.toml exists but looks invalid. Rewriting it..."
  } else {
    Warn "supabase/config.toml is missing. Creating a minimal config.toml..."
  }

  # Write UTF-8 WITHOUT BOM (Supabase TOML parser rejects BOM)
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($cfgPath, $content, $utf8NoBom)
  Log "Wrote $cfgPath (utf8-no-bom)"
}

function Ensure-Linked {
  param(
    [string]$RootDir,
    [string]$SupabaseDir,
    [string]$ProjectRef
  )

  $tempDir = Join-Path $SupabaseDir ".temp"
  $refPath = Join-Path $tempDir "project-ref"
  if (Test-Path $refPath) {
    $current = (Get-Content -Path $refPath -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    if ($current -eq $ProjectRef) {
      Log "Supabase already linked to project-ref $ProjectRef"
      return
    }
    Warn "Supabase link mismatch. Found $current, expected $ProjectRef. Re-linking..."
  } else {
    Warn "Supabase project not linked yet. Linking now..."
  }

  # This may prompt for DB password. That's OK (interactive).
  Run-Cmd "Linking Supabase project" @("npx","supabase","link","--project-ref",$ProjectRef,"--workdir",$RootDir)
}

function Repair-From-Output {
  param(
    [string[]]$OutputLines,
    [string]$RootDir
  )

  $text = ($OutputLines | Out-String)

  # Case 1: remote versions not found locally
  $m1 = [regex]::Match($text, "Remote migration versions not found in local migrations directory:\s*([0-9,\s]+)")
  if ($m1.Success) {
    $versions = $m1.Groups[1].Value -split "[,\s]+" | Where-Object { $_ -match "^\d{14}$" } | Select-Object -Unique
    if ($versions.Count -gt 0) {
      Warn "Repairing: marking remote-only versions as reverted: $($versions -join ', ')"
      foreach ($v in $versions) {
        Run-Cmd "migration repair reverted $v" @("npx","supabase","migration","repair","--status","reverted",$v,"--workdir",$RootDir) -AllowFailure
      }
      return $true
    }
  }

  # Case 2: duplicate key in schema_migrations (version already exists)
  $m2 = [regex]::Match($text, "Key \(version\)=\((\d{14})\) already exists")
  if ($m2.Success) {
    $v = $m2.Groups[1].Value
    Warn "Repairing: duplicate migration version $v; marking as applied."
    Run-Cmd "migration repair applied $v" @("npx","supabase","migration","repair","--status","applied",$v,"--workdir",$RootDir) -AllowFailure
    return $true
  }

  # Case 3: function return type change (SQLSTATE 42P13)
  if ($text -match "cannot change return type of existing function") {
    Warn "Detected function return type conflict (42P13). Preparing corrective migration..."

    # Try to locate the function name in the failing SQL
    $fnMatch = [regex]::Match($text, "CREATE OR REPLACE FUNCTION\s+([a-zA-Z0-9_.\""]+)\s*\(")
    if ($fnMatch.Success) {
      $fnName = $fnMatch.Groups[1].Value.Trim('"')
      Warn "Function identified as: $fnName"

      if ($fnName -like "public.get_or_create_planning_sheet*") {
        Ensure-GetOrCreatePlanningSheetFix -RootDir $RootDir
        return $true
      } else {
        Warn "Unhandled function name for 42P13: $fnName (no specific auto-fix available)."
      }
    } else {
      Warn "Could not parse function name from output for 42P13."
    }
  }

  # Case 4: policy already exists. Usually means the migration ran (or partially ran) already.
  $mPolicy = [regex]::Match($text, "policy\s+`"([^`"]+)`"\s+for table\s+`"([^`"]+)`"\s+already exists")
  if ($mPolicy.Success) {
    $policyName = $mPolicy.Groups[1].Value
    $tableName  = $mPolicy.Groups[2].Value
    Warn "Detected policy '$policyName' already exists on table '$tableName'. Ensuring idempotent patch migration exists."
    Ensure-PolicyPatchMigration -RootDir $RootDir -TableName $tableName -PolicyName $policyName
    return $true
  }

  # Last resort: if we reach here, we did not find a specific repair rule.
  # Do NOT silently continue; instruct the user via Fail in the caller.
  return $false
}

function Ensure-GetOrCreatePlanningSheetFix {
  param(
    [string]$RootDir
  )

  $migrationsDir = Join-Path $RootDir "supabase\migrations"
  if (-not (Test-Path $migrationsDir)) {
    Warn "Migrations directory not found at $migrationsDir; cannot write corrective migration."
    return
  }

  # If a corrective migration for this function already exists, do nothing (idempotent)
  $existing = Get-ChildItem -Path $migrationsDir -Filter "*get_or_create_planning_sheet_fix*.sql" -ErrorAction SilentlyContinue
  if ($existing -and $existing.Count -gt 0) {
    Log "Corrective migration for get_or_create_planning_sheet already present: $($existing[0].Name)"
    return
  }

  $timestamp = Get-Date -Format "yyyyMMddHHmmss"
  $fileName = "${timestamp}_get_or_create_planning_sheet_fix.sql"
  $filePath = Join-Path $migrationsDir $fileName

  $sql = @"
/*
  Auto-generated fix: drop & recreate public.get_or_create_planning_sheet()
  to avoid 'cannot change return type of existing function' (SQLSTATE 42P13).
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'get_or_create_planning_sheet'
  ) THEN
    -- Safe drop with explicit signature if it exists in this form
    DROP FUNCTION IF EXISTS public.get_or_create_planning_sheet(uuid, uuid);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_planning_sheet(
  p_project_id UUID,
  p_created_by UUID DEFAULT auth.uid()
)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  created_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.planning_sheets AS ps (project_id, created_by, updated_at)
  VALUES (p_project_id, COALESCE(p_created_by, auth.uid()), NOW())
  ON CONFLICT (project_id, created_by)
  DO UPDATE SET updated_at = NOW()
  RETURNING
    ps.id,
    ps.project_id,
    ps.created_by;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_planning_sheet(UUID, UUID) TO authenticated;

"@

  Log "Writing corrective migration for get_or_create_planning_sheet to $filePath"
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($filePath, $sql, $utf8NoBom)
}

function Ensure-PolicyPatchMigration {
  param(
    [string]$RootDir,
    [string]$TableName,
    [string]$PolicyName
  )

  $migrationsDir = Join-Path $RootDir "supabase\migrations"
  if (-not (Test-Path $migrationsDir)) {
    Warn "Migrations directory not found at $migrationsDir; cannot write policy patch migration."
    return
  }

  # For now we only auto-generate a patch for planning_sheets policies;
  # others can be handled manually or by adding more cases here.
  if ($TableName -ne "planning_sheets") {
    Warn "No automatic policy patch generator registered for table '$TableName'."
    return
  }

  # If our explicit planning_policies_idempotent_patch migration already exists, do nothing.
  $existing = Get-ChildItem -Path $migrationsDir -Filter "*planning_policies_idempotent_patch.sql" -ErrorAction SilentlyContinue
  if ($existing -and $existing.Count -gt 0) {
    Log "Idempotent planning policies patch migration already present: $($existing[0].Name)"
    return
  }

  $timestamp = Get-Date -Format "yyyyMMddHHmmss"
  $fileName = "${timestamp}_planning_policies_idempotent_patch.sql"
  $filePath = Join-Path $migrationsDir $fileName

  $sql = @"
/*
  Auto-generated planning policies idempotent patch
  - Ensures planning_sheets_* policies can be applied repeatedly without errors
*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  IF to_regclass('public.planning_sheets') IS NOT NULL THEN
    ALTER TABLE public.planning_sheets ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "planning_sheets_select_members" ON public.planning_sheets;
    CREATE POLICY "planning_sheets_select_members" ON public.planning_sheets
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.projects p
          JOIN public.project_members pm ON pm.project_id = p.id
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE p.id = planning_sheets.project_id
            AND (
              pm.user_id = auth.uid()
              OR pr.role = 'admin'
            )
        )
      );

    DROP POLICY IF EXISTS "planning_sheets_owner_write" ON public.planning_sheets;
    CREATE POLICY "planning_sheets_owner_write" ON public.planning_sheets
      FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = planning_sheets.project_id
            AND (
              (pm.user_id = auth.uid() AND pm.role_in_project = 'owner')
              OR pr.role = 'admin'
            )
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.project_members pm
          LEFT JOIN public.profiles pr ON pr.id = auth.uid()
          WHERE pm.project_id = planning_sheets.project_id
            AND (
              (pm.user_id = auth.uid() AND pm.role_in_project = 'owner')
              OR pr.role = 'admin'
            )
        )
      );
  END IF;
END;
$$;

"@

  Log "Writing automatic policy patch migration for planning_sheets to $filePath"
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($filePath, $sql, $utf8NoBom)
}

# -------------------- main --------------------

$ProjectRef = "ukbbifwoziozivconhtj"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
Log "Starting from repo root: $RepoRoot"

$found = Find-SupabaseRoot -StartDir $RepoRoot
Log "Selected Supabase root: $($found.RootDir)"
Log "Selected supabase dir: $($found.SupabaseDir)"
Log "Migrations found: $($found.MigrationCount)"

# Prepare log directory alongside supabase config for full stdout/stderr capture
$script:OneFixLogDir = Join-Path $found.SupabaseDir ".logs"
if (-not (Test-Path $script:OneFixLogDir)) {
  New-Item -ItemType Directory -Path $script:OneFixLogDir -Force | Out-Null
}

Set-Location $found.RootDir

Ensure-ConfigToml -SupabaseDir $found.SupabaseDir -ProjectRef $ProjectRef
Ensure-Linked -RootDir $found.RootDir -SupabaseDir $found.SupabaseDir -ProjectRef $ProjectRef

# Optional migration list (for visibility only)
$list = Run-Cmd "supabase migration list" @("npx","supabase","migration","list","--debug","--workdir",$found.RootDir) -AllowFailure

# Push loop with auto-repair attempts (no db pull, so no Docker dependency)
$maxAttempts = 5
for ($i = 1; $i -le $maxAttempts; $i++) {
  Log "db push attempt $i/$maxAttempts"
  $pushOut = Run-Cmd "supabase db push --include-all --yes" @("npx","supabase","db","push","--include-all","--yes","--debug","--workdir",$found.RootDir) -AllowFailure
  if ($LASTEXITCODE -eq 0) {
    Log "DONE: Remote database is up to date."
    exit 0
  }

  Warn "db push failed; analyzing output for automatic repair..."
  $repaired = Repair-From-Output -OutputLines $pushOut -RootDir $found.RootDir
  if (-not $repaired) {
    Fail "db push failed and no automatic automatic-repair rule could be applied. See the full supabase output above and in supabase/.logs/one_fix_all.log."
  }
}

Fail "db push still failing after $maxAttempts attempts."

