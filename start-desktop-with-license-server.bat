@echo off
setlocal

REM Launch Desktop dev mode (Vite + Electron) AND the License Server
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo npm not found. Please install Node.js first.
  pause
  exit /b 1
)

echo ========================================
echo AZRAR Real Estate Management System
echo Starting Desktop App + License Server...
echo Desktop: Vite + Electron (port 3000)
echo License: http://127.0.0.1:5056
echo ========================================
echo.

REM Start license server in a separate minimized window
start "AZRAR License Server" /min powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\license-server-dev.ps1" -HostAddr 127.0.0.1 -Port 5056 -AdminToken dev-admin-token

REM Wait for license server to be ready, then start desktop dev
npx --no-install wait-on http://127.0.0.1:5056 --timeout 30000 >nul
npm run desktop:dev

pause
