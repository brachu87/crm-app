@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  WhatsApp via Evolution API
echo ============================================
echo.
copy /Y "%~dp0wa-evolution.patch" "%TEMP%\wa-evolution.patch" >nul
if not exist "%TEMP%\wa-evolution.patch" ( echo [ERROR] No encontre el .patch junto al .bat. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\wa-evolution.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. NO sigas, avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: WhatsApp via Evolution API (QR por negocio, recordatorios y recibos por texto/documento)"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si dice "main -> main" quedo subido. Falta
echo  desplegar Evolution API y cargar 2 variables
echo  en Railway (ver el chat).
echo ============================================
pause
