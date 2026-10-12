@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Sufra - Telegram token
echo.
echo   Paste the bot token you got from @BotFather, then press Enter.
echo   (The token is saved securely on Cloudflare - it will not be shown.)
echo.
call npx wrangler secret put TELEGRAM_BOT_TOKEN
echo.
echo   Done. You can close this window.
pause
