@echo off
setlocal

set "DB_PATH=C:\crm-app\backend\prisma\dev.db"
set "BACKUP_DIR=C:\crm-app\backups"

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=1-3 delims=/ " %%a in ("%date%") do set "D=%%c%%a%%b"
for /f "tokens=1-3 delims=:." %%a in ("%time: =0%") do set "T=%%a%%b%%c"
set "T=%T:~0,6%"

set "DEST=%BACKUP_DIR%\dev_%D%_%T%.db"
copy "%DB_PATH%" "%DEST%" >nul
echo Backup creado: %DEST%

:: Keep last 30 backups only
set COUNT=0
for /f "tokens=*" %%f in ('dir /b /o-d "%BACKUP_DIR%\dev_*.db" 2^>nul') do (
  set /a COUNT+=1
  if !COUNT! gtr 30 del "%BACKUP_DIR%\%%f"
)

echo Listo.
endlocal
