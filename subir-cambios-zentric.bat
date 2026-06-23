@echo off
chcp 65001 >nul
cd /d C:\crm-app

echo ============================================
echo   Zentric - Subir cambios a GitHub
echo ============================================
echo.

REM Limpiar locks por si quedo alguno
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul

REM Mostrar que cambio
echo Archivos modificados:
git status --short
echo.

set /p msg="Descripcion del cambio (Enter = generica): "
if "%msg%"=="" set msg=Actualizacion de Zentric

echo.
echo Subiendo...
git add -A
git commit -m "%msg%"
if errorlevel 1 (
  echo.
  echo No habia cambios para subir, o fallo el commit.
  pause
  exit /b 0
)

git push origin main
if errorlevel 1 (
  echo.
  echo ERROR al subir. Si pide login, entra como  brachu87.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   LISTO. Railway buildea en 1-2 min.
echo ============================================
pause
