@echo off
chcp 65001 >nul
schtasks /delete /f /tn "EGE-TG-sync"
pause
