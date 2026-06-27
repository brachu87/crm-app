@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Contacto WhatsApp + sacar preguntas por defecto del chat ===
echo.
if not exist gestumio-contacto-wa-chat.patch ( echo Falta gestumio-contacto-wa-chat.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-contacto-wa-chat.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "feat: contacto por WhatsApp (5491178236708) + sacar menu de preguntas por defecto del chatbot"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO.
pause
