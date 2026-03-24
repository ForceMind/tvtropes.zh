@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 (
  echo.
  echo Start failed. Check the error output above.
  pause
  exit /b 1
)

echo.
echo Services started. You can close this window.
pause
