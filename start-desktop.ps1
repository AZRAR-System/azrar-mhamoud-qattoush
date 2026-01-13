$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "========================================" -ForegroundColor DarkCyan
Write-Host "AZRAR Real Estate Management System" -ForegroundColor Cyan
Write-Host "Starting Desktop App (Vite + Electron)..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor DarkCyan

npm run desktop:dev
