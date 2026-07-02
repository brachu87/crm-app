@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Fix: login del portal (token no provisto)
echo ============================================
echo.
copy /Y "%~dp0fix-portal-auth.patch" "%TEMP%\fix-portal-auth.patch" >nul
if not exist "%TEMP%\fix-portal-auth.patch" ( echo [ERROR] No encontre el .patch. & pause & exit /b 1 )
git fetch origin
git reset --hard origin/main
if errorlevel 1 ( echo [ERROR] reset fallo. & pause & exit /b 1 )
git apply "%TEMP%\fix-portal-auth.patch"
if errorlevel 1 ( echo [ERROR] El patch no aplico. avisame. & pause & exit /b 1 )
git add -A
git commit -m "fix: exceptuar /api/portal del auth global y subscription check (login del portal)"
git push -u origin main
echo errorlevel push: !errorlevel!
pause
