@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Filtros (Liquidaciones, Cobranzas, Gastos) ===
echo.
if not exist gestumio-filtros.patch ( echo No se encuentra gestumio-filtros.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin
git reset --hard origin/main
git apply gestumio-filtros.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "feat: filtro por fecha en Liquidaciones y Cobranzas; busqueda y filtros en Gastos"
git push origin main
if errorlevel 1 ( echo ERROR al subir a GitHub. & pause & exit /b 1 )
echo.
echo LISTO. Railway buildea en 1-2 min.
pause
