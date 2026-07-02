@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Portal: reservar cupos en clases/actividades
echo ============================================
echo.
copy /Y "%~dp0portal-cupos.patch" "%TEMP%\portal-cupos.patch" >nul
if not exist "%TEMP%\portal-cupos.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\portal-cupos.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: reservar cupos en clases desde el portal (ClassReservation) + visibilidad en Horarios"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo El deploy corre prisma db push (crea la tabla ClassReservation).
pause
