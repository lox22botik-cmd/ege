@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Без api_id: посты из экспорта канала (Телеграм для ПК: канал - три точки - Экспорт истории - JSON).
rem Сам берёт свежий экспорт из Загрузок; можно перетащить result.json на этот файл.
if exist tg\.venv\Scripts\python.exe (tg\.venv\Scripts\python.exe tg\from_export.py %*) else (python tg\from_export.py %*)
pause
