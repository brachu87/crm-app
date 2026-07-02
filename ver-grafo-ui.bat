@echo off
setlocal
echo ============================================
echo  Visualizador 3D del grafo (codebase-memory)
echo ============================================
echo.
where codebase-memory-mcp >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No encontre codebase-memory-mcp en el PATH.
  pause
  exit /b 1
)
echo Abriendo el navegador en http://localhost:9749 ...
start "" http://localhost:9749
echo.
echo Levantando el servidor de visualizacion.
echo (Dejalo abierto mientras mires el grafo. Cerra esta ventana para apagarlo.)
echo Si dice que --ui no existe, tenes la variante SIN interfaz: hay que
echo reinstalar con la variante UI (codebase-memory-mcp-ui).
echo.
codebase-memory-mcp --ui=true --port=9749
pause
