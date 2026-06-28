@echo off
chcp 65001 >nul
echo === Gestumio - Links Terminos y Privacidad en el footer (LANDING) ===
pause
cd /d C:\
if exist _gl rmdir /s /q _gl
git clone https://github.com/brachu87/-zentric-landing.git _gl
cd _gl
git apply "C:\crm-app\gestumio-legales-landing.patch"
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A
git commit -m "landing: links a Terminos y Politica de privacidad en el footer de la home"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
cd /d C:\ & rmdir /s /q _gl
echo LISTO.
pause
