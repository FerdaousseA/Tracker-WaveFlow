# fix-and-push-supabase.ps1
# One-command Supabase recovery + push (Windows PowerShell)
# Usage:
#   powershell -ExecutionPolicy Bypass -File project/scripts/fix-and-push-supabase.ps1

$ErrorActionPreference = "Stop"

function Log { param([string]$Msg) Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $Msg" }
function Fail { param([string]$Msg, [int]$Code = 1) Write-Host "ERROR: $Msg" -ForegroundColor Red; exit $Code }

# Resolve project root (folder containing supabase/config.toml)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path (Join-Path $ScriptDir "..")
Set-Location $ProjectRoot

Log "Project root: $ProjectRoot"

# 1) Verify correct root
if (-not (Test-Path "supabase/config.toml")) {
    Fail "supabase/config.toml not found. Run from the repo where supabase/config.toml exists."
}
if (-not (Test-Path "supabase/migrations")) {
    Fail "supabase/migrations folder not found."
}
Log "Step 1 OK: supabase project detected"

# Helper to run commands and stop on errors
function Run {
    param(
        [string]$Title,
        [string[]]$Command
    )
    Log $Title
    $out = & $Command[0] @($Command[1..($Command.Length-1)]) 2>&1
    $out | ForEach-Object { Log "  $_" }
    if ($LASTEXITCODE -ne 0) {
        Fail "$Title failed with exit code $LASTEXITCODE"
    }
    return $out
}

# 2) Migration list (for visibility + to detect known-bad versions)
$listOut = Run "Step 2: supabase migration list" @("npx","supabase","migration","list","--workdir",$ProjectRoot)

# 3) Repair migration history mismatches (known problematic version)
# If remote already has 20260218170000 recorded, ensure it is marked applied.
if (($listOut | Out-String) -match "20260218170000") {
    try {
        Run "Step 3: migration repair (mark applied) 20260218170000" @("npx","supabase","migration","repair","--status","applied","20260218170000","--workdir",$ProjectRoot)
    } catch {
        Log "Step 3 WARN: repair for 20260218170000 failed or not needed; continuing"
    }
} else {
    Log "Step 3: 20260218170000 not found in list (no repair needed)"
}

# 4) Final push (include-all, non-interactive)
Run "Step 4: supabase db push --include-all --yes" @("npx","supabase","db","push","--include-all","--yes","--workdir",$ProjectRoot)

Log "SUCCESS: Supabase migrations repaired and pushed."
exit 0

