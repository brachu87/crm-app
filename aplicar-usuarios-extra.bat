@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Usuarios extra en panel admin (+20 mil c/u)
echo ============================================
echo.
copy /Y "%~dp0usuarios-extra.patch" "%TEMP%\usuarios-extra.patch" >nul
if not exist "%TEMP%\usuarios-extra.patch" ( echo [ERROR] No encontre usuarios-extra.patch junto al .bat. & pause & exit /b 1 )

echo --- Trayendo lo ultimo de GitHub ---
git fetch origin
echo --- Alineando local con GitHub ---
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )

echo --- Aplicando cambios ---
git apply "%TEMP%\usuarios-extra.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. NO sigas, avisame. & pause & exit /b 1 )

echo --- Commit + push ---
git add -u
git commit -m "feat: usuarios extra en panel admin (+20 mil c/u) con ajuste de cuota"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si dice "main -> main" quedo subido y Railway
echo  redeploya solo. El deploy corre prisma db push
echo  que crea la columna extraUsers. Sino, avisame.
echo ============================================
pause
