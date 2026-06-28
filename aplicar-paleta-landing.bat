@echo off
chcp 65001 >nul
echo === Gestumio - Paleta acorde al logo (LANDING): coral -> navy ===
pause
cd /d C:\
if exist _gl rmdir /s /q _gl
git clone https://github.com/brachu87/-zentric-landing.git _gl
cd _gl
git apply "C:\crm-app\gestumio-paleta-landing.patch"
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "style: paleta acorde al logo (acento navy, neutros mas frios)"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
cd /d C:\ & rmdir /s /q _gl
echo LISTO.
pause
