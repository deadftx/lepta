@echo off
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
)
if not exist .env copy .env.example .env
call npm run dev
pause
