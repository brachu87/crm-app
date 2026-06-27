@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Migracion PASO A: endpoints export/import (sigue en SQLite) ===
echo.
if not exist gestumio-migracion-A-export.patch ( echo Falta gestumio-migracion-A-export.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-migracion-A-export.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "migracion: endpoints admin export-db / import-db (paso A)"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO. La app sigue en SQLite. Ahora exporta los datos antes del paso B.
pause
