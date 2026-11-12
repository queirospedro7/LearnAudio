@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instala o Node.js LTS em https://nodejs.org e volta a abrir este ficheiro.
 pause
 exit /b 1
)
if not exist node_modules (
 call npm install
 if errorlevel 1 (
  pause
  exit /b 1
 )
)
start "" http://127.0.0.1:3210
call npm start
pause
