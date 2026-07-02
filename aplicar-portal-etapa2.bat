@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Portal del socio - Etapa 2 (reservar turnos)
echo ============================================
echo.
copy /Y "%~dp0portal-etapa2.patch" "%TEMP%\portal-etapa2.patch" >nul
if not exist "%TEMP%\portal-etapa2.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\portal-etapa2.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: portal etapa 2 - reservar y cancelar turnos de servicios desde el portal"
git push -u origin main
echo errorlevel push: !errorlevel!
pause
