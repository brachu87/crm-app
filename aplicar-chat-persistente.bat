@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Chat de soporte: no borrar al cambiar seccion
echo ============================================
echo.
copy /Y "%~dp0chat-persistente.patch" "%TEMP%\chat-persistente.patch" >nul
if not exist "%TEMP%\chat-persistente.patch" ( echo [ERROR] No encontre chat-persistente.patch junto al .bat. & pause & exit /b 1 )

echo --- Trayendo lo ultimo de GitHub ---
git fetch origin
echo --- Alineando local con GitHub ---
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )

echo --- Aplicando cambio ---
git apply "%TEMP%\chat-persistente.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. NO sigas, avisame. & pause & exit /b 1 )

echo --- Commit + push ---
git add -u
git commit -m "fix: el chat de soporte mantiene el historial al cambiar de seccion (se borra al cerrar sesion)"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si dice "main -> main" quedo subido y Railway
echo  redeploya solo.
echo ============================================
pause
