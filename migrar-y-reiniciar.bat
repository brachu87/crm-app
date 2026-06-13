@echo off
echo ============================================
echo  Migrando base de datos y reiniciando CRM
echo ============================================

cd /d C:\crm-app\backend

echo.
echo [1/2] Ejecutando migracion de Prisma...
call npx prisma migrate dev --name add_employees_expenses

if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ERROR: La migracion fallo. Revisa los mensajes de arriba.
  pause
  exit /b 1
)

echo.
echo [2/2] Migracion exitosa!
echo.
echo Ahora cerras la ventana del backend que este abierta
echo y ejecutas iniciar-crm.bat para reiniciar todo.
echo.
pause
