@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop.ps1"
if errorlevel 1 (
  echo.
  echo Stop failed. Check the error output above.
  pause
  exit /b 1
)

echo.
echo Services stopped.
pause
