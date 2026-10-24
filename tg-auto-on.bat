@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Синхронизация с Телеграмом сама каждые 30 минут, без окна (задача Windows «EGE-TG-sync»)
if not exist tg\ege.session (echo Сначала один раз запусти tg-sync.bat и войди в Телеграм.& pause & exit /b 1)
schtasks /create /f /tn "EGE-TG-sync" /sc minute /mo 30 /tr "\"%~dp0tg\.venv\Scripts\pythonw.exe\" \"%~dp0tg\sync.py\" --auto"
if errorlevel 1 (pause & exit /b 1)
schtasks /run /tn "EGE-TG-sync" >nul
echo.
echo Готово: ДЗ, файлы и видео подтягиваются сами каждые 30 минут, пока включён компьютер.
echo Что было при последнем запуске — tg\sync.log. Выключить — tg-auto-off.bat.
pause
