@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Logo y colores nuevos (APP) ===
pause
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
git fetch origin
git reset --hard origin/main
git apply gestumio-rebrand-app.patch
if errorlevel 1 ( echo ERROR al aplicar. & pause & exit /b 1 )
git add -A
git commit -m "rebrand visual: logo G nuevo + paleta verde/navy (app)"
git push origin main
if errorlevel 1 ( echo ERROR al subir. Entra como brachu87. & pause & exit /b 1 )
del /f /q gestumio-rebrand-app.patch 2>nul
echo LISTO. Railway buildea en 1-2 min.
pause
