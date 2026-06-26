@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Fix migraciones Prisma (SQLite) ===
echo.
if not exist gestumio-fix-migraciones.patch ( echo Falta gestumio-fix-migraciones.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin
git reset --hard origin/main
git apply gestumio-fix-migraciones.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "fix(prisma): migracion google_auth valida en SQLite + baseline de migraciones en start.js"
git push origin main
if errorlevel 1 ( echo ERROR al subir a GitHub. & pause & exit /b 1 )
echo.
echo LISTO. Railway redeploya y el arranque ya no deberia tirar el error de migracion.
pause
