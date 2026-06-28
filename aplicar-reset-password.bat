@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Restablecer contrasena (olvido) ===
echo.
if not exist gestumio-reset-password.patch ( echo Falta gestumio-reset-password.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-reset-password.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "feat: restablecer contrasena (forgot/reset por email) + paginas recuperar/restablecer"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO. Necesita GMAIL_USER y GMAIL_APP_PASSWORD en Railway para que llegue el mail.
pause
