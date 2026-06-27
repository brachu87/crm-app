@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Fix CORS + trust proxy ===
echo.
if not exist gestumio-fix-cors.patch ( echo Falta gestumio-fix-cors.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin
git reset --hard origin/main
git apply gestumio-fix-cors.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "fix: CORS acepta dominio propio railway.app/gestumio.com + trust proxy (Railway)"
git push origin main
if errorlevel 1 ( echo ERROR al subir a GitHub. & pause & exit /b 1 )
echo.
echo LISTO. Ademas revisa las variables en Railway (APP_URL, JWT_SECRET, GOOGLE_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI).
pause
