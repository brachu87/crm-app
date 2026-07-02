@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Mailer generico (Zoho) para reset de contrasena
echo ============================================
echo.
copy /Y "%~dp0mailer-zoho.patch" "%TEMP%\mailer-zoho.patch" >nul
if not exist "%TEMP%\mailer-zoho.patch" ( echo [ERROR] No encontre mailer-zoho.patch junto al .bat. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\mailer-zoho.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. NO sigas, avisame. & pause & exit /b 1 )
git add -u
git commit -m "feat: mailer SMTP generico (Zoho) + remitente equipo@gestumio.com"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si dice "main -> main" quedo subido. Ahora
echo  falta cargar las variables SMTP en Railway.
echo ============================================
pause
