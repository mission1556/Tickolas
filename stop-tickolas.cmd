@echo off
cd /d "%~dp0"
type nul > ".tickolas-stop"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
echo Tickolas local server stopped.
timeout /t 2 >nul
