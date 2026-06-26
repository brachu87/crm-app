@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Fix DATABASE_URL (evita pantalla en blanco / 503) ===
echo.
if not exist gestumio-fix-dburl.patch ( echo Falta gestumio-fix-dburl.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin
git reset --hard origin/main
git apply gestumio-fix-dburl.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "fix: default DATABASE_URL al volumen /data si falta la variable (evita 503/blank)"
git push origin main
if errorlevel 1 ( echo ERROR al subir a GitHub. & pause & exit /b 1 )
echo.
echo LISTO. Igual conviene definir las variables en Railway (sobre todo JWT_SECRET).
pause
