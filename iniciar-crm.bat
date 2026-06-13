@echo off
title Iniciando CRM...
start "CRM Backend" cmd /k "cd /d C:\crm-app\backend && node src\index.js"
timeout /t 2 /nobreak > nul
start "CRM Frontend" cmd /k "cd /d C:\crm-app\frontend && npx vite"
timeout /t 3 /nobreak > nul
start http://localhost:5173
