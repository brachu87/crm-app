@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Portal: navbar por secciones + logo Gestumio
echo ============================================
echo.
copy /Y "%~dp0portal-ui.patch" "%TEMP%\portal-ui.patch" >nul
if not exist "%TEMP%\portal-ui.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\portal-ui.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: portal con navbar por secciones (Inicio/Turnos/Clases/Perfil) + logo de Gestumio en login y web"
git push -u origin main
echo errorlevel push: !errorlevel!
pause
