@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Mostrar el error real de Google Calendar ===
echo.
if not exist gestumio-gcal-error-visible.patch ( echo Falta gestumio-gcal-error-visible.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-gcal-error-visible.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "fix(gcal): mostrar el mensaje de error real del callback en Ajustes"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO. Al reintentar Conectar, vas a ver el error exacto.
pause
