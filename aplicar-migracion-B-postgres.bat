@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Migracion PASO B: cambiar a PostgreSQL ===
echo IMPORTANTE: hace esto SOLO despues de exportar los datos (paso A) y de crear
echo la base PostgreSQL en Railway con su DATABASE_URL.
echo.
if not exist gestumio-migracion-B-postgres.patch ( echo Falta gestumio-migracion-B-postgres.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-migracion-B-postgres.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "migracion: cambiar provider a postgresql + db push en start.js (paso B)"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO. Al deployar, la app crea el esquema en Postgres. Despues importa los datos.
pause
