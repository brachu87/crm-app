@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Paleta acorde al logo (APP): coral -> navy ===
echo.
if not exist gestumio-paleta-app.patch ( echo Falta gestumio-paleta-app.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-paleta-app.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "style: paleta acorde al logo (acento navy, neutros mas frios, verde dark)"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO.
pause
