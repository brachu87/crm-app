# CRM - Script de instalacion
# Extrae el zip, instala dependencias y crea los scripts de arranque

$ErrorActionPreference = "Stop"
$zipPath = "C:\Users\braia\Downloads\crm-app.zip"
$destDir = "C:\crm-app"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  Instalacion del CRM" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# 1. Extraer ZIP
Write-Host "`n[1/5] Extrayendo archivos en $destDir ..." -ForegroundColor Yellow
if (Test-Path $destDir) {
    Remove-Item $destDir -Recurse -Force
}
Expand-Archive -Path $zipPath -DestinationPath $destDir -Force
Write-Host "      OK" -ForegroundColor Green

# 2. Instalar dependencias del backend
Write-Host "`n[2/5] Instalando dependencias del backend ..." -ForegroundColor Yellow
Set-Location "$destDir\backend"
& npm install
Write-Host "      OK" -ForegroundColor Green

# 3. Generar cliente Prisma y migrar base de datos
Write-Host "`n[3/5] Creando base de datos SQLite ..." -ForegroundColor Yellow
& npx prisma generate
& npx prisma migrate dev --name init
Write-Host "      OK" -ForegroundColor Green

# 4. Instalar dependencias del frontend
Write-Host "`n[4/5] Instalando dependencias del frontend ..." -ForegroundColor Yellow
Set-Location "$destDir\frontend"
& npm install
Write-Host "      OK" -ForegroundColor Green

# 5. Crear scripts de arranque
Write-Host "`n[5/5] Creando scripts de arranque ..." -ForegroundColor Yellow

$iniciarBat = @"
@echo off
title Iniciando CRM...
start "CRM Backend" cmd /k "cd /d C:\crm-app\backend && node src\index.js"
timeout /t 2 /nobreak > nul
start "CRM Frontend" cmd /k "cd /d C:\crm-app\frontend && npx vite"
timeout /t 3 /nobreak > nul
start http://localhost:5173
"@

Set-Content -Path "C:\crm-app\iniciar-crm.bat" -Value $iniciarBat -Encoding ASCII

# Crear acceso directo en el Escritorio
$desktopPath = [System.Environment]::GetFolderPath('Desktop')
Copy-Item "C:\crm-app\iniciar-crm.bat" "$desktopPath\Iniciar CRM.bat" -Force

Write-Host "      OK" -ForegroundColor Green

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host "  Instalacion completada!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para arrancar el CRM:" -ForegroundColor White
Write-Host "  - Doble click en 'Iniciar CRM.bat' en el Escritorio" -ForegroundColor White
Write-Host "  - O ejecuta: C:\crm-app\iniciar-crm.bat" -ForegroundColor White
Write-Host ""
Write-Host "Presiona ENTER para cerrar..." -ForegroundColor Gray
Read-Host
