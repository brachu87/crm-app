@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Mail de bienvenida al crear cuenta
echo ============================================
echo.
copy /Y "%~dp0mail-bienvenida.patch" "%TEMP%\mail-bienvenida.patch" >nul
if not exist "%TEMP%\mail-bienvenida.patch" ( echo [ERROR] No encontre mail-bienvenida.patch junto al .bat. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\mail-bienvenida.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. NO sigas, avisame. & pause & exit /b 1 )
git add -u
git commit -m "feat: mail de bienvenida al registrarse (que es Gestumio + canales de contacto)"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si dice "main -> main" quedo subido. El mail
echo  se envia recien cuando esten cargadas las
echo  variables SMTP de Zoho en Railway.
echo ============================================
pause
