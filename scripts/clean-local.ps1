param(
  [switch]$Preview = $true,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath ".git")) {
  throw "Run this script from the repository root (where .git exists)."
}

$excluded = @(
  "secrets/",
  "server/data/"
)

$argsList = @("clean", "-fdX")
foreach ($e in $excluded) {
  $argsList += @("-e", $e)
}

if ($Preview -and -not $Force) {
  $argsList += "-n"
  Write-Host "[Preview] Showing what would be deleted..."
} else {
  Write-Host "[Clean] Deleting ignored build artifacts and dependencies..."
}

& git @argsList

if ($LASTEXITCODE -ne 0) {
  throw "git clean failed with exit code $LASTEXITCODE"
}

if ($Preview -and -not $Force) {
  Write-Host ""
  Write-Host "To actually delete, re-run with:"
  Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -Force -Preview:$false"
}
