@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Один раз: отдельное окружение Python для синхронизации с Телеграмом
if not exist tg\.venv\Scripts\python.exe python -m venv tg\.venv
tg\.venv\Scripts\python.exe -m pip install --upgrade telethon
if not exist tg\config.json copy tg\config.example.json tg\config.json >nul
echo.
echo Готово. Теперь открой tg\config.json и впиши api_id и api_hash с https://my.telegram.org
echo Потом запусти tg-chats.bat, чтобы увидеть свои каналы, и tg-sync.bat для синхронизации.
pause
