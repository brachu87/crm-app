@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Reparar divergencia + subir fix a GitHub
echo ============================================
echo.

echo --- Guardando el patch en un temporal (para que no se pierda) ---
copy /Y "%~dp0fix-admin-precio.patch" "%TEMP%\fix-admin-precio.patch" >nul
if not exist "%TEMP%\fix-admin-precio.patch" (
  echo [ERROR] No encontre fix-admin-precio.patch junto a este .bat. Avisame.
  pause
  exit /b 1
)

echo --- Trayendo lo ultimo de GitHub ---
git fetch origin
if errorlevel 1 ( echo [ERROR] fetch fallo. & pause & exit /b 1 )

echo --- Alineando tu local con GitHub (conserva "portal del socio") ---
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )

echo --- Re-aplicando el fix (admin approved + precio 50 mil) ---
git apply "%TEMP%\fix-admin-precio.patch"
if errorlevel 1 (
  echo [ERROR] El patch no aplico. NO sigas, avisame.
  pause
  exit /b 1
)

echo --- Commit (solo archivos modificados) ---
git add -u
git commit -m "fix: admin approved en Postgres + precio suscripcion 50 mil"

echo --- Push ---
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si dice "main -> main" -> quedo subido y
echo  Railway va a redeployar solo. Sino, avisame.
echo ============================================
pause
