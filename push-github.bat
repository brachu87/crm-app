@echo off
echo ============================================
echo   Subir CRM a GitHub
echo ============================================
echo.
echo Se va a abrir una ventana para ingresar
echo tu contrasena o token de GitHub.
echo.
echo Si te pide usuario: brachu87
echo Si te pide contrasena: usa un token de GitHub
echo (GitHub ya no acepta contrasenas normales)
echo.
echo Para crear el token:
echo 1. Ir a: github.com/settings/tokens
echo 2. Generate new token (classic)
echo 3. Marcar "repo" y generar
echo 4. Copiar el token y pegarlo como contrasena
echo.
pause

cd /d C:\crm-app

:: Limpiar credenciales guardadas de otras cuentas
cmdkey /delete:LegacyGeneric:target=git:https://github.com >nul 2>&1
git config --global --unset credential.helper >nul 2>&1

:: Configurar usuario correcto
git config user.email "brachu.bf@gmail.com"
git config user.name "brachu87"

:: Setear remote con usuario en la URL para forzar auth correcta
git remote set-url origin https://brachu87@github.com/brachu87/crm-app.git

echo.
echo Subiendo codigo... (ingresa tu token cuando se pida la contrasena)
echo.
git push -u origin main

echo.
if %ERRORLEVEL% == 0 (
  echo ============================================
  echo EXITO - Codigo subido a GitHub
  echo ============================================
  echo.
  echo Ahora Railway va a detectar el cambio
  echo y hacer el deploy automaticamente.
) else (
  echo ERROR al subir - revisa el token e intentá de nuevo
)
echo.
pause
