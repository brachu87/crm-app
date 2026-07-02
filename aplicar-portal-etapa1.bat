@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Portal del socio - Etapa 1 (login + cuenta)
echo ============================================
echo.
copy /Y "%~dp0portal-etapa1.patch" "%TEMP%\portal-etapa1.patch" >nul
if not exist "%TEMP%\portal-etapa1.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\portal-etapa1.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: portal del socio etapa 1 (numero de socio, login por N+DNI, resumen de cuenta y actividades)"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo Falta apuntar portal.gestumio.com al mismo servicio (Cloudflare + Railway).
pause
