@echo off
cd /d "%~dp0"
echo Starting Tickolas local server...
echo.
echo Keep this window open while using http://localhost:3000
echo If the server stops, the error will show here.
echo.
npm.cmd start
echo.
echo Server stopped. Press any key to close this window.
pause >nul
