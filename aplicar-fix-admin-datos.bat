@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Fix datos del panel admin (usuarios/acceso)
echo ============================================
echo.
copy /Y "%~dp0fix-admin-datos.patch" "%TEMP%\fix-admin-datos.patch" >nul
if not exist "%TEMP%\fix-admin-datos.patch" ( echo [ERROR] No encontre fix-admin-datos.patch junto al .bat. & pause & exit /b 1 )

echo --- Trayendo lo ultimo de GitHub ---
git fetch origin
echo --- Alineando local con GitHub ---
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )

echo --- Aplicando fix ---
git apply "%TEMP%\fix-admin-datos.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. NO sigas, avisame. & pause & exit /b 1 )

echo --- Commit + push ---
git add -u
git commit -m "fix: panel admin usa Prisma (arregla usuarios, ultimo acceso y datos del negocio en Postgres)"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si dice "main -> main" quedo subido. Espera
echo  que Railway redeploye y recarga /admin.
echo ============================================
pause
