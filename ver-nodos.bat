@echo off
setlocal enabledelayedexpansion
set "OUT=%~dp0nodos-proyecto.txt"
where codebase-memory-mcp >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No encontre codebase-memory-mcp en el PATH.
  pause
  exit /b 1
)
echo ====== PROYECTOS INDEXADOS ====== > "%OUT%"
codebase-memory-mcp cli list_projects >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo ====== ARQUITECTURA (lenguajes, paquetes, rutas, hotspots) ====== >> "%OUT%"
codebase-memory-mcp cli get_architecture "{}" >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo ====== NODOS: FUNCIONES ====== >> "%OUT%"
codebase-memory-mcp cli search_graph "{\"label\":\"Function\"}" >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo ====== NODOS: CLASES ====== >> "%OUT%"
codebase-memory-mcp cli search_graph "{\"label\":\"Class\"}" >> "%OUT%" 2>&1
echo. >> "%OUT%"
echo ====== NODOS: RUTAS (endpoints) ====== >> "%OUT%"
codebase-memory-mcp cli search_graph "{\"label\":\"Route\"}" >> "%OUT%" 2>&1
echo.
echo Listo. Se genero: nodos-proyecto.txt
notepad "%OUT%"
pause
