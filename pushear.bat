@echo off
setlocal enabledelayedexpansion
cd /d "C:\crm-app"
echo ============================================
echo  Subiendo cambios a GitHub (push)
echo ============================================
echo.
echo --- Trayendo estado de GitHub (fetch) ---
git fetch origin
echo.
echo --- Divergencia  (izquierda = en GitHub y NO local / derecha = en local y NO en GitHub) ---
git rev-list --left-right --count origin/main...main
echo.
echo --- Push (fija upstream, SIN force) ---
git push -u origin main
echo errorlevel push: !errorlevel!
echo.
echo ============================================
echo  Si arriba dice "rejected" o "non-fast-forward",
echo  NO hagas nada mas y avisame. Si dice "main -> main"
echo  o "Everything up-to-date", quedo subido.
echo ============================================
pause
