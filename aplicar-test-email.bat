@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Boton "Probar mail" en el panel admin
echo ============================================
echo.
copy /Y "%~dp0test-email.patch" "%TEMP%\test-email.patch" >nul
if not exist "%TEMP%\test-email.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\test-email.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: boton Probar mail en admin (diagnostico SMTP)"
git push -u origin main
echo errorlevel push: !errorlevel!
pause
