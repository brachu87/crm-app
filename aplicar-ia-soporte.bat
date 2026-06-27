@echo off
chcp 65001 >nul
cd /d C:\crm-app
echo === Gestumio - Sacar onboarding + Chat de soporte con IA (Groq) ===
echo.
if not exist gestumio-ia-soporte.patch ( echo Falta gestumio-ia-soporte.patch en C:\crm-app & pause & exit /b 1 )
pause
del /f /q ".git\index.lock" 2>nul
git fetch origin & git reset --hard origin/main
git apply gestumio-ia-soporte.patch
if errorlevel 1 ( echo ERROR aplicando patch. & pause & exit /b 1 )
git add -A & git commit -m "feat: sacar onboarding al crear cuenta + chat de soporte con IA (Groq) con fallback a FAQ"
git push origin main
if errorlevel 1 ( echo ERROR al subir. & pause & exit /b 1 )
echo LISTO. Falta cargar GROQ_API_KEY en Railway para que el chat use IA.
pause
