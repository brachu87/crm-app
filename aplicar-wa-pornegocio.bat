@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo ============================================
echo   Zentric - WhatsApp por negocio (multi-tenant)
echo ============================================
echo.
echo IMPORTANTE: cada negocio tendra su propia conexion.
echo Despues del deploy, cada uno debe re-escanear su QR
echo (la sesion anterior compartida queda descartada).
echo.
pause
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
echo [1/4] Sincronizando...
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo ERROR. & pause & exit /b 1 )
echo [2/4] Aplicando cambios...
git apply zentric-wa-pornegocio.patch
if errorlevel 1 ( echo ERROR al aplicar. & pause & exit /b 1 )
echo [3/4] Commit...
git add -A
git commit -m "fix(whatsapp): conexion por negocio (multi-tenant) - sesion/socket/QR por businessId + cron por negocio"
echo [4/4] Subiendo...
git push origin main
if errorlevel 1 ( echo ERROR al subir. Entra como brachu87. & pause & exit /b 1 )
del /f /q zentric-wa-pornegocio.patch 2>nul
echo.
echo ============================================
echo   LISTO. Railway buildea en 1-2 min.
echo   Despues: Ajustes - WhatsApp - escanea tu QR.
echo ============================================
pause
