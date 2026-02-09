param(
  [string]$AdminToken = ''
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "AZRAR License Admin (Desktop)" -ForegroundColor Cyan
Write-Host "Starting License Admin UI (Vite + Electron)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor DarkCyan

$env:AZRAR_APP_MODE = 'license-admin'

if (-not $AdminToken) {
  $AdminToken = [string]$env:AZRAR_LICENSE_SERVER_ADMIN_TOKEN
}

if (-not $AdminToken) {
  Write-Host "Server admin token is not set (AZRAR_LICENSE_SERVER_ADMIN_TOKEN)." -ForegroundColor Yellow
  Write-Host "You can run without it and set it inside the License Admin UI (Server Token field)." -ForegroundColor Yellow
} else {
  $env:AZRAR_LICENSE_SERVER_ADMIN_TOKEN = $AdminToken
}

npm run desktop:dev
