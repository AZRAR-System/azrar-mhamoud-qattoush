@echo off
setlocal

REM Launch Electron desktop dev mode (Vite + Electron)
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo npm not found. Please install Node.js first.
  pause
  exit /b 1
)

echo Starting Desktop App...
npm run desktop:dev

pause
