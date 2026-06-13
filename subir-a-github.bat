@echo off
echo ============================================
echo   Preparar CRM para subir a GitHub
echo ============================================
echo.
echo Este script inicializa el repositorio Git.
echo Despues tenes que crear el repo en github.com
echo y seguir las instrucciones en pantalla.
echo.
pause

cd /d C:\crm-app

echo Inicializando repositorio Git...
git init
git add .
git commit -m "CRM inicial - listo para deploy"

echo.
echo ============================================
echo PASO SIGUIENTE - Hacer en el navegador:
echo ============================================
echo.
echo 1. Ir a https://github.com/new
echo 2. Crear un repo llamado: crm-app
echo 3. NO marcar "Initialize this repository"
echo 4. Copiar el comando que dice:
echo    "git remote add origin https://github.com/..."
echo 5. Pegarlo aqui abajo y presionar Enter
echo.
echo ============================================
echo Pega el comando "git remote add origin ..." y presiona Enter:
echo ============================================
set /p CMD="> "
%CMD%

echo.
echo Subiendo codigo a GitHub...
git branch -M main
git push -u origin main

echo.
echo ============================================
echo CODIGO SUBIDO A GITHUB
echo ============================================
echo.
echo Ahora ir a https://railway.app y seguir
echo las instrucciones del archivo DEPLOY.md
echo.
pause
