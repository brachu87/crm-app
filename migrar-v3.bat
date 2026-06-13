@echo off
echo Ejecutando migracion v3 (campos extendidos de cliente y descuento en inscripcion)...
cd /d C:\crm-app\backend
call npx prisma migrate dev --name add_client_extended_fields_and_discount
echo.
echo Migracion completada.
pause
