@echo off
chcp 65001 >nul
cd /d C:\crm-app

echo ============================================
echo   Zentric - Punto 2: token fuera de las URLs
echo ============================================
echo.
pause

del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo [1/4] Sincronizando con GitHub...
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo ERROR al sincronizar. & pause & exit /b 1 )

echo [2/4] Aplicando mejoras...
git apply zentric-punto2.patch
if errorlevel 1 ( echo ERROR al aplicar el parche. & pause & exit /b 1 )

echo [3/4] Commit...
git add -A
git commit -m "sec: servir fotos/logo via header Authorization (sin token en la URL) + componente AuthImage"

echo [4/4] Subiendo a GitHub...
git push origin main
if errorlevel 1 ( echo ERROR al subir. Si pide login, entra como brachu87. & pause & exit /b 1 )

del /f /q zentric-punto2.patch 2>nul
echo.
echo ============================================
echo   LISTO. Railway buildea en 1-2 min.
echo ============================================
pause
