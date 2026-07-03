@echo off
setlocal
cd /d "C:\crm-app" || (echo No se encontro C:\crm-app & pause & exit /b 1)
echo === Sincronizando con GitHub ===
git fetch origin || (echo Fallo git fetch & pause & exit /b 1)
git reset --hard origin/main || (echo Fallo git reset & pause & exit /b 1)
echo === Aplicando arreglos QA ===
git apply --whitespace=nowarn "%~dp0arreglos-qa.patch" || (echo Fallo git apply & pause & exit /b 1)
git add -A
git commit -m "fix: bloquear clientes duplicados, validar monto de gasto, evitar turnos solapados, modal de confirmacion estilizado" || (echo Nada para commitear & pause & exit /b 1)
echo === Pusheando a main ===
git push origin HEAD:main || (echo Fallo git push & pause & exit /b 1)
echo.
echo LISTO. Railway va a redeployar en 1-2 minutos.
pause
