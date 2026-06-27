@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Fix pantalla en blanco al abrir evento (Agenda) ===
echo.
if not exist gestumio-fix-agenda-evento.patch ( echo Falta gestumio-fix-agenda-evento.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin
git reset --hard origin/main
git apply gestumio-fix-agenda-evento.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "fix(agenda): definir permisos (can) en EventModal y ApptDetailModal (evita pantalla en blanco al abrir evento)"
git push origin main
if errorlevel 1 ( echo ERROR al subir a GitHub. & pause & exit /b 1 )
echo.
echo LISTO. Al abrir un evento ya no se pone en blanco.
pause
