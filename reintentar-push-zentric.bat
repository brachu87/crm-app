@echo off
chcp 65001 >nul
cd /d C:\crm-app

echo ============================================
echo   Zentric - Reintentar push (cuenta correcta)
echo ============================================
echo.
echo Tu PC tiene guardada la credencial de GitHub de la cuenta "Nodumapp",
echo que NO puede subir al repo brachu87/crm-app.
echo Vamos a borrarla y volver a loguear con la cuenta correcta.
echo.
pause

echo.
echo [1/2] Borrando credencial de GitHub guardada...
cmdkey /delete:git:https://github.com >nul 2>&1
cmdkey /delete:LegacyGeneric:target=git:https://github.com >nul 2>&1
(echo protocol=https& echo host=github.com& echo.) | git credential reject 2>nul
(echo protocol=https& echo host=github.com& echo username=Nodumapp& echo.) | git credential reject 2>nul

echo [2/2] Subiendo a GitHub...
echo.
echo  IMPORTANTE: cuando se abra el login de GitHub,
echo  inicia sesion con la cuenta  brachu87  (la duena del repo),
echo  NO con Nodumapp.
echo.
pause
git push origin main
if errorlevel 1 (
  echo.
  echo No se pudo subir. Opciones:
  echo  - Asegurate de loguear como brachu87, o
  echo  - Agrega a Nodumapp como colaborador del repo en GitHub.
  pause
  exit /b 1
)

echo.
echo ============================================
echo   LISTO. Railway va a buildear en 1-2 min.
echo ============================================
pause
