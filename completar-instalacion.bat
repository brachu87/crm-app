@echo off
title Instalando CRM - Por favor espera...
echo =====================================
echo   Instalando dependencias del CRM
echo =====================================

echo.
echo [1/4] npm install backend (Prisma v6)...
cd /d C:\crm-app\backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR en npm install backend
    pause
    exit /b 1
)

echo.
echo [2/4] Generando Prisma Client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR en prisma generate
    pause
    exit /b 1
)

echo.
echo [3/4] Creando base de datos SQLite...
call npx prisma migrate dev --name init
if %errorlevel% neq 0 (
    echo ERROR en prisma migrate
    pause
    exit /b 1
)

echo.
echo [4/4] npm install frontend...
cd /d C:\crm-app\frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR en npm install frontend
    pause
    exit /b 1
)

echo.
echo =====================================
echo   Instalacion COMPLETADA!
echo =====================================
echo.
echo Para arrancar el CRM haz doble click en:
echo   C:\crm-app\iniciar-crm.bat
echo.
pause
