@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Sacar WhatsApp masivo (queda solo manual) ===
echo.
if not exist gestumio-sacar-wa-masivo.patch ( echo Falta gestumio-sacar-wa-masivo.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-sacar-wa-masivo.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "feat: sacar envio masivo de WhatsApp (boton + cron diario); queda solo envio manual"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO. WhatsApp queda solo para envios manuales (Cobranza y comprobantes).
pause
