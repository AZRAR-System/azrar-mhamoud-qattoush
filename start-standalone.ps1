$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

param(
	[string]$DbDir = '',
	[ValidateSet('WAL','DELETE')][string]$JournalMode = 'WAL'
)

Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "AZRAR Real Estate Management System" -ForegroundColor Cyan
Write-Host "Starting Standalone Desktop App (Offline)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor DarkCyan

if ($DbDir) {
	$env:AZRAR_DESKTOP_DB_DIR = $DbDir
}
$env:AZRAR_DESKTOP_JOURNAL_MODE = $JournalMode

npm run desktop:run
