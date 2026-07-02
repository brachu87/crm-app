@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Migracion WhatsApp -> API oficial (Meta)
echo ============================================
echo.
copy /Y "%~dp0whatsapp-meta.patch" "%TEMP%\whatsapp-meta.patch" >nul
if not exist "%TEMP%\whatsapp-meta.patch" ( echo [ERROR] No encontre whatsapp-meta.patch junto al .bat. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\whatsapp-meta.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. NO sigas, avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: WhatsApp via Meta Cloud API (por negocio, plantillas, envio de PDF); baja Baileys"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si dice "main -> main" quedo subido. Falta
echo  configurar Meta y las variables en Railway
echo  (ver instrucciones en el chat).
echo ============================================
pause
