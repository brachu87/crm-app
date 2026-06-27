@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Fix bonificaciones (becas con fecha de vencimiento) ===
echo.
if not exist gestumio-fix-bonificaciones.patch ( echo Falta gestumio-fix-bonificaciones.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-fix-bonificaciones.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "fix(becas): respetar bonificadaHasta (gratis durante la vigencia, cobra al vencer) sin perder el precio"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO. Las becas con fecha vuelven a cobrar al vencer; las sin limite siguen gratis.
pause
