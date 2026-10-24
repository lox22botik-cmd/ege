@echo off
chcp 65001 >nul
cd /d "%~dp0"
tg\.venv\Scripts\python.exe tg\sync.py --chats
pause
