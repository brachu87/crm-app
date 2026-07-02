@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  FIX URGENTE: db push (crea columnas faltantes)
echo ============================================
echo.
copy /Y "%~dp0fix-dbpush.patch" "%TEMP%\fix-dbpush.patch" >nul
if not exist "%TEMP%\fix-dbpush.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\fix-dbpush.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "fix: db push con --accept-data-loss (crea memberNumber/waToken/ClassReservation faltantes en Postgres)"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo Al redeployar, db push crea las columnas/tablas que faltaban y la app vuelve.
pause
