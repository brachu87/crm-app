@echo off
chcp 65001 >nul
echo ============================================
echo   Gestumio - Rebrand + logo en la LANDING
echo ============================================
echo.
pause
cd /d C:\
if exist _gestumio_landing_tmp rmdir /s /q _gestumio_landing_tmp
echo [1/4] Clonando la landing...
git clone https://github.com/brachu87/-zentric-landing.git _gestumio_landing_tmp
if errorlevel 1 ( echo ERROR al clonar. & pause & exit /b 1 )
cd _gestumio_landing_tmp
echo [2/4] Aplicando cambios...
git apply "C:\crm-app\gestumio-landing.patch"
if errorlevel 1 ( echo ERROR al aplicar. & pause & exit /b 1 )
echo [3/4] Commit...
git add -A
git commit -m "rebrand: Zentric -> Gestumio + logo G (landing)"
echo [4/4] Subiendo...
git push origin main
if errorlevel 1 ( echo ERROR al subir. Entra como brachu87. & pause & exit /b 1 )
cd /d C:\
rmdir /s /q _gestumio_landing_tmp
echo.
echo ============================================
echo   LISTO. GitHub Pages se actualiza en 1-2 min.
echo ============================================
pause
