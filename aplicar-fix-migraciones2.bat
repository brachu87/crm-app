@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Fix migraciones DEFINITIVO (baseline auto) ===
echo.
if not exist gestumio-fix-migraciones2.patch ( echo Falta gestumio-fix-migraciones2.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin
git reset --hard origin/main
git apply gestumio-fix-migraciones2.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "fix(prisma): start.js auto-baseline del historial cuando migrate deploy falla (SQLite)"
git push origin main
if errorlevel 1 ( echo ERROR al subir a GitHub. & pause & exit /b 1 )
echo.
echo LISTO. En el proximo arranque, si migrate deploy falla, se normaliza solo y no vuelve a fallar.
pause
