@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Fix: trial-sweep (boolean/datetime en Postgres)
echo ============================================
echo.
copy /Y "%~dp0fix-trial-sweep.patch" "%TEMP%\fix-trial-sweep.patch" >nul
if not exist "%TEMP%\fix-trial-sweep.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\fix-trial-sweep.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "fix: trial-sweep con Prisma (booleanos y fecha, FK-safe en Postgres)"
git push -u origin main
echo errorlevel push: !errorlevel!
pause
