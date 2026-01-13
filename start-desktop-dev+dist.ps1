$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "AZRAR Real Estate Management System" -ForegroundColor Cyan
Write-Host "Starting Desktop Dev + Auto-Installer Build..." -ForegroundColor Cyan
Write-Host "(Runs app dev mode + rebuilds release2_build on changes)" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor DarkCyan

npm run desktop:dev+dist
