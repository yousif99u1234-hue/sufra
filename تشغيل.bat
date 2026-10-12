@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Sufra Order
echo.
echo   Starting Sufra... keep this window open while using the system.
echo   To stop the server, close this window.
echo.
start "" http://localhost:3000
node --no-warnings server.js
pause
