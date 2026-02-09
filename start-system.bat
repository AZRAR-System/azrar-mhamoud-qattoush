@echo off
setlocal

REM Launch Web UI dev server (Vite)
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
	echo npm not found. Please install Node.js first.
	pause
	exit /b 1
)

echo ========================================
echo AZRAR Real Estate Management System
echo Starting Development Server (Vite)...
echo URL: http://127.0.0.1:5500/
echo ========================================
echo.

npm run dev -- --host 127.0.0.1 --port 5500

pause

