@echo off
setlocal
cd /d "C:\crm-app" || (echo No se encontro C:\crm-app & pause & exit /b 1)
echo === Sincronizando con GitHub ===
git fetch origin || (echo Fallo git fetch & pause & exit /b 1)
git reset --hard origin/main || (echo Fallo git reset & pause & exit /b 1)
echo === Aplicando Bloque 1: validacion (Zod) ===
git apply --whitespace=nowarn "%~dp0bloque1-validacion.patch" || (echo Fallo git apply & pause & exit /b 1)
git add -A
git commit -m "chore: capa de validacion sistematica con Zod en endpoints clave" || (echo Nada para commitear & pause & exit /b 1)
echo === Pusheando a main ===
git push origin HEAD:main || (echo Fallo git push & pause & exit /b 1)
echo.
echo LISTO. Railway va a instalar zod y redeployar en 1-2 minutos.
pause
