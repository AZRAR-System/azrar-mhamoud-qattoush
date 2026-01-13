@echo off
setlocal

REM Standalone Desktop App (Offline / Independent)
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo npm not found. Please install Node.js first.
  pause
  exit /b 1
)

echo ========================================
echo AZRAR Real Estate Management System
echo Starting Standalone Desktop App (Offline)
echo ========================================
echo.

REM Optional: put the desktop SQLite inside OneDrive for syncing
REM set "AZRAR_DESKTOP_DB_DIR=%USERPROFILE%\OneDrive\AZRAR-Data"
REM Recommended for OneDrive to avoid WAL sidecar files:
REM set "AZRAR_DESKTOP_JOURNAL_MODE=DELETE"

npm run desktop:run

pause
