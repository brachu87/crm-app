@echo off
chcp 65001 >nul
echo === Gestumio - Favicon nuevo (LANDING) ===
pause
cd /d C:\
if exist _gl rmdir /s /q _gl
git clone https://github.com/brachu87/-zentric-landing.git _gl
cd _gl
git apply "C:\crm-app\gestumio-favicon-landing.patch"
if errorlevel 1 ( echo ERROR. & pause & exit /b 1 )
git add -A & git commit -m "favicon: badge verde con G"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
cd /d C:\ & rmdir /s /q _gl
echo LISTO. GitHub Pages 1-2 min.
pause
