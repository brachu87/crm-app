@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo ============================================
echo   Zentric - Enviar recibo PDF por WhatsApp
echo ============================================
echo.
pause
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
echo [1/4] Sincronizando...
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo ERROR. & pause & exit /b 1 )
echo [2/4] Aplicando cambios...
git apply zentric-wa-pdf.patch
if errorlevel 1 ( echo ERROR al aplicar. & pause & exit /b 1 )
echo [3/4] Commit...
git add -A
git commit -m "feat(whatsapp): enviar recibo en PDF como documento (pdfkit + Baileys sendDocument)"
echo [4/4] Subiendo...
git push origin main
if errorlevel 1 ( echo ERROR al subir. Entra como brachu87. & pause & exit /b 1 )
del /f /q zentric-wa-pdf.patch 2>nul
echo.
echo ============================================
echo   LISTO. Railway buildea en 2-3 min
echo   (instala pdfkit en el build).
echo ============================================
pause
