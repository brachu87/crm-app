@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Bugs empleados/actividades/asistencias/recibo haberes ===
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-bugs-empleados.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "fix: asignar empleado a actividad (PUT), asistencias toman dias de actividades asignadas, recibo de haberes en PDF por WhatsApp"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
del /f /q gestumio-bugs-empleados.patch 2>nul
echo LISTO. Railway buildea en 1-2 min.
pause
