@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Este juego necesita Node.js. Instala la version LTS desde https://nodejs.org
  pause
  exit /b 1
)
node server.mjs --open
pause
