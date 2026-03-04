# fix-supabase-migrations.ps1
# Runs Supabase CLI recovery flow: repair migrations, pull, push.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/fix-supabase-migrations.ps1

# Don't treat stderr from npx as script-stopping (Supabase CLI writes progress to stderr)
$ErrorActionPreference = "Continue"

# Resolve project root (directory containing supabase folder)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")

function Log { param($Msg) Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Msg" }
function Fail { param($Msg, $Code = 1) Write-Host "ERROR: $Msg" -ForegroundColor Red; exit $Code }

Log "Project root: $ProjectRoot"
Set-Location $ProjectRoot

# 1) Verify project root
if (-not (Test-Path "supabase")) {
    Fail "supabase folder not found. Run this script from the project root (where supabase/ exists)."
}
if (-not (Test-Path "supabase/migrations")) {
    Fail "supabase/migrations folder not found."
}
Log "Step 1 OK: Project root verified"

# 2a) Run migration repair REVERTED (for versions on remote that are NOT in local folder)
$VersionsToRevert = @(
    "20251226112634",
    "20251226115006",
    "20251226115027",
    "20260212120000"
)
Log "Step 2a: Migration repair (reverted) for remote-only versions..."
foreach ($ver in $VersionsToRevert) {
    Log "  Reverting $ver..."
    $out = & npx supabase migration repair --status reverted $ver --workdir $ProjectRoot 2>&1
    $out | ForEach-Object { Log "    $_" }
    if ($LASTEXITCODE -ne 0) { Log "  (Version may not exist in remote - continuing)" }
}
Log "Step 2a OK"

# 2b) Run migration repair APPLIED (for local files that remote history lacks after revert)
#     This marks migrations as applied without re-running them (schema already exists).
Log "Step 2b: Migration repair (applied) to sync history for local-only..."
foreach ($ver in $VersionsToRevert) {
    Log "  Marking applied $ver..."
    $out = & npx supabase migration repair --status applied $ver --workdir $ProjectRoot 2>&1
    $out | ForEach-Object { Log "    $_" }
    if ($LASTEXITCODE -ne 0) { Log "  (Version may already be applied - continuing)" }
}
Log "Step 2 OK: Migration repair completed"

# 3) Run migration list and print
Log "Step 3: Migration list (before pull)..."
$listOut = & npx supabase migration list --workdir $ProjectRoot 2>&1
$listOut | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) {
    Fail "Migration list failed:`n$($listOut | Out-String)"
}
Log "Step 3 OK"

# 4) Run db pull (sync schema; skip if history still mismatches - push will apply any pending)
Log "Step 4: Running supabase db pull..."
$pullOut = & npx supabase db pull --workdir $ProjectRoot 2>&1
$pullOut | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) {
    Log "Step 4 WARN: db pull failed (history mismatch) - continuing to push..."
} else {
    Log "Step 4 OK: Schema synced"
}

# 5) Run migration list again
Log "Step 5: Migration list (after pull)..."
$listOut2 = & npx supabase migration list --workdir $ProjectRoot 2>&1
$listOut2 | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) {
    Fail "Migration list failed:`n$($listOut2 | Out-String)"
}
Log "Step 5 OK"

# 6) Run db push
Log "Step 6: Running supabase db push..."
$pushOut = & npx supabase db push --yes --workdir $ProjectRoot 2>&1
$pushOut | ForEach-Object { Log "  $_" }
if ($LASTEXITCODE -ne 0) {
    Fail "db push failed:`n$($pushOut | Out-String)"
}
Log "Step 6 OK: Migrations pushed"

Log ""
Log "SUCCESS: Supabase migration recovery completed."
exit 0
