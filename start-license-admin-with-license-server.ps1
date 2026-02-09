param(
  [string]$LicenseHost = "127.0.0.1",
  [int]$LicensePort = 5056,
  [string]$AdminToken = "dev-admin-token"
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "AZRAR License Admin" -ForegroundColor Cyan
Write-Host "Starting License Admin + License Server..." -ForegroundColor Cyan
Write-Host "Admin UI: Electron (AZRAR_APP_MODE=license-admin)" -ForegroundColor DarkGray
Write-Host "License: http://$LicenseHost`:$LicensePort" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor DarkCyan

$env:AZRAR_APP_MODE = 'license-admin'

npm run desktop:dev:withLicense -- -LicenseHost $LicenseHost -LicensePort $LicensePort -AdminToken $AdminToken
