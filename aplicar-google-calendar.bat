@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Integracion Google Calendar (Fase 1) ===
echo.
if not exist gestumio-google-calendar.patch ( echo Falta gestumio-google-calendar.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin
git reset --hard origin/main
git apply gestumio-google-calendar.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "feat: integracion Google Calendar (conectar + toggles + sync Gestumio->Google: turnos/agenda/clases)"
git push origin main
if errorlevel 1 ( echo ERROR al subir a GitHub. & pause & exit /b 1 )
echo.
echo LISTO. Falta cargar en Railway: GOOGLE_CLIENT_SECRET y GOOGLE_CALENDAR_REDIRECT_URI.
pause
