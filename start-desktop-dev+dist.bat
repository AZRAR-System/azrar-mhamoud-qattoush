@echo off
setlocal

REM Launch Electron desktop dev mode + auto rebuild installer artifacts
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo npm not found. Please install Node.js first.
  pause
  exit /b 1
)

echo Starting Desktop Dev + Auto-Installer Build...
echo (Runs app dev mode + rebuilds release2_build on changes)

npm run desktop:dev+dist

pause
