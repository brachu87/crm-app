@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Fix: eliminar cuentas en el panel admin
echo ============================================
echo.
copy /Y "%~dp0fix-delete-cuenta.patch" "%TEMP%\fix-delete-cuenta.patch" >nul
if not exist "%TEMP%\fix-delete-cuenta.patch" ( echo [ERROR] No encontre el .patch junto al .bat. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\fix-delete-cuenta.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. NO sigas, avisame. & pause & exit /b 1 )
git add -A
git commit -m "fix: eliminar cuenta en admin (transaccion Prisma, orden FK-safe en Postgres)"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo Si dice "main -> main" quedo subido. Espera el redeploy y proba eliminar.
pause
