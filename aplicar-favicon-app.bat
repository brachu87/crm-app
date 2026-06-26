@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Favicon nuevo (APP) ===
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-favicon-app.patch
if errorlevel 1 ( echo ERROR. & pause & exit /b 1 )
git add -A & git commit -m "favicon: badge verde con G (legible en tamano chico)"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
del /f /q gestumio-favicon-app.patch 2>nul
echo LISTO. Railway buildea en 1-2 min.
pause
