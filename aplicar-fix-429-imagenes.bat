@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Fix 429 (imagenes/fotos/logo no cargan) ===
echo.
if not exist gestumio-fix-429-imagenes.patch ( echo Falta gestumio-fix-429-imagenes.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-fix-429-imagenes.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "fix: rate-limit no bloquea lectura de fotos/logo (429) + limite global mayor"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO. Las fotos y el logo deberian cargar sin 429.
pause
