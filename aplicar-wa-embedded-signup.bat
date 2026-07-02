@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  WhatsApp Embedded Signup + Coexistence
echo ============================================
echo.
copy /Y "%~dp0wa-embedded-signup.patch" "%TEMP%\wa-embedded-signup.patch" >nul
if not exist "%TEMP%\wa-embedded-signup.patch" ( echo [ERROR] No encontre el .patch junto al .bat. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\wa-embedded-signup.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. NO sigas, avisame. & pause & exit /b 1 )
git add -A
git commit -m "feat: WhatsApp Embedded Signup + Coexistence (token por negocio, boton Conectar en Ajustes)"
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si dice "main -> main" quedo subido. Falta
echo  la config en Meta + variables en Railway
echo  (ver el paso a paso en el chat).
echo ============================================
pause
