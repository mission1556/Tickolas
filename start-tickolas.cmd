@echo off
setlocal
cd /d "%~dp0"
title Tickolas Local Server
del /q ".tickolas-stop" >nul 2>&1

:start
if exist ".tickolas-stop" goto stopped
echo [%date% %time%] Starting Tickolas...>> server.log
node server.js >> server.log 2>&1
if exist ".tickolas-stop" goto stopped
echo [%date% %time%] Server stopped. Restarting in 2 seconds...>> server.log
timeout /t 2 /nobreak >nul
goto start

:stopped
del /q ".tickolas-stop" >nul 2>&1
echo [%date% %time%] Tickolas stopped by user.>> server.log
exit /b
