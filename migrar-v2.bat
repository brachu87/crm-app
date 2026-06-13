@echo off
echo ============================================
echo  Migrando BD: Proveedores, Notas, Caja
echo ============================================

cd /d C:\crm-app\backend

echo.
echo [1/2] Ejecutando migracion de Prisma...
call npx prisma migrate dev --name add_suppliers_notes_dailycash

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ERROR: La migracion fallo. Revisa los mensajes de arriba.
  pause
  exit /b 1
)

echo.
echo [2/2] Migracion exitosa!
echo.
echo Ahora ejecuta iniciar-crm.bat para reiniciar el servidor.
echo.
pause
