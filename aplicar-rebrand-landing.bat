@echo off
chcp 65001 >nul
echo === Gestumio - Logo y colores nuevos (LANDING) ===
pause
cd /d C:\
if exist _gestumio_landing_tmp rmdir /s /q _gestumio_landing_tmp
git clone https://github.com/brachu87/-zentric-landing.git _gestumio_landing_tmp
if errorlevel 1 ( echo ERROR al clonar. & pause & exit /b 1 )
cd _gestumio_landing_tmp
git apply "C:\crm-app\gestumio-rebrand-landing.patch"
if errorlevel 1 ( echo ERROR al aplicar. & pause & exit /b 1 )
git add -A
git commit -m "rebrand visual: logo G nuevo + paleta verde/navy (landing)"
git push origin main
if errorlevel 1 ( echo ERROR al subir. Entra como brachu87. & pause & exit /b 1 )
cd /d C:\
rmdir /s /q _gestumio_landing_tmp
echo LISTO. GitHub Pages se actualiza en 1-2 min.
pause
