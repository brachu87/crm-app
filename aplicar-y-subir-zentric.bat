@echo off
chcp 65001 >nul
cd /d C:\crm-app

echo ============================================
echo   Zentric - Aplicar mejoras y desplegar
echo ============================================
echo.
echo Este script va a:
echo  1) Sincronizar tu carpeta con la version de GitHub (descarta cambios locales viejos)
echo  2) Aplicar los fixes (rendimiento + bugs)
echo  3) Subir a GitHub (Railway buildea solo)
echo.
pause

echo.
echo [1/5] Limpiando locks de git...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

echo [2/5] Sincronizando con GitHub...
git fetch origin
git checkout main
git reset --hard origin/main
if errorlevel 1 ( echo ERROR al sincronizar. & pause & exit /b 1 )

echo [3/5] Aplicando mejoras...
git apply zentric-fixes.patch
if errorlevel 1 ( echo ERROR al aplicar el parche. & pause & exit /b 1 )

echo [4/5] Commit...
git add backend/src/middleware/auth.js backend/src/routes/admin.js backend/src/routes/billing.js backend/src/routes/notes.js frontend/src/pages/Clients.jsx frontend/src/pages/Dashboard.jsx
git commit -m "fix+perf: token foto en listado, formato moneda, trial 15d unificado, conexion SQLite unica + cache de suscripcion"

echo [5/5] Subiendo a GitHub (puede pedirte login de GitHub la primera vez)...
git push origin main
if errorlevel 1 ( echo ERROR al hacer push. Revisa tu login de GitHub. & pause & exit /b 1 )

del /f /q zentric-fixes.patch 2>nul
echo.
echo ============================================
echo   LISTO. Railway va a buildear en 1-2 min.
echo   Revisa el deploy en railway.app
echo ============================================
pause
