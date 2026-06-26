@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Import/Export Excel-CSV-PDF (deploy final) ===
echo.
if not exist gestumio-import-export.patch ( echo Falta gestumio-import-export.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin
git reset --hard origin/main
git apply gestumio-import-export.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "feat: import/export Excel-CSV-PDF (Clientes, Proveedores, Empleados, Gastos, Asistencias)"
git push origin main
if errorlevel 1 ( echo ERROR al subir a GitHub. & pause & exit /b 1 )
echo.
echo LISTO. Railway va a buildear el commit nuevo (incluye filtros + import/export).
pause
