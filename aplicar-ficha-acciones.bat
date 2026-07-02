@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Ficha cliente: inscribir / turno / servicio
echo ============================================
echo.
copy /Y "%~dp0ficha-acciones.patch" "%TEMP%\ficha-acciones.patch" >nul
if not exist "%TEMP%\ficha-acciones.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\ficha-acciones.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: ficha de cliente con inscribir/agendar turno/ofrecer servicio + asignar actividad en el alta"
git push -u origin main
echo errorlevel push: !errorlevel!
pause
