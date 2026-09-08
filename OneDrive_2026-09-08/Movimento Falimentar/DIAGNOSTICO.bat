@echo off
setlocal
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"
echo ==============================================
echo MOVIMENTO RJ - DIAGNOSTICO DATAJUD
 echo ==============================================
echo.
if not exist node_modules (
  echo Instalando dependencias...
  call npm install
  if errorlevel 1 goto erro
)
call npm run build
if errorlevel 1 goto erro
call npm run scan
echo.
echo Diagnostico salvo em data\reports\last-scan.json
pause
exit /b 0
:erro
echo.
echo ERRO durante o diagnostico.
pause
exit /b 1
