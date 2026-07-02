@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Mailer por API HTTP de Brevo (sin puertos SMTP)
echo ============================================
echo.
copy /Y "%~dp0mailer-brevo-api.patch" "%TEMP%\mailer-brevo-api.patch" >nul
if not exist "%TEMP%\mailer-brevo-api.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\mailer-brevo-api.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: envio de mails por API HTTP de Brevo (evita puertos SMTP bloqueados)"
git push -u origin main
echo errorlevel push: !errorlevel!
pause
