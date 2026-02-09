@echo off
setlocal

REM Launch License Admin UI (Vite + Electron)
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo npm not found. Please install Node.js first.
  pause
  exit /b 1
)

echo ========================================
echo AZRAR License Admin (Desktop)
echo Starting License Admin UI (Vite + Electron)
echo ========================================
echo.

set "AZRAR_APP_MODE=license-admin"

REM Required (do not commit real secrets):
REM set "AZRAR_LICENSE_SERVER_ADMIN_TOKEN=CHANGE_ME"

if "%AZRAR_LICENSE_SERVER_ADMIN_TOKEN%"=="" (
  echo WARNING: AZRAR_LICENSE_SERVER_ADMIN_TOKEN is not set.
  echo You can start without it and set it inside the License Admin UI (توكن السيرفر).
  echo.
)

npm run desktop:dev

pause
