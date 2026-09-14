@echo off
title Liberando Acesso Mobile - Mesa de Operações
echo ======================================================================
echo    MESA DE OPERAÇÕES - LIBERAR ACESSO NO CELULAR / REDE LOCAL
echo ======================================================================
echo.
echo Liberando a porta 3500 no Firewall do Windows...
echo.

netsh advfirewall firewall delete rule name="Mesa de Operacoes (Porta 3500)" >nul 2>&1
netsh advfirewall firewall add rule name="Mesa de Operacoes (Porta 3500)" dir=in action=allow protocol=TCP localport=3500 profile=any

if %errorlevel% neq 0 (
    echo [ATENÇÃO] Não foi possível alterar as regras do Firewall.
    echo Por favor, clique com o botão direito neste arquivo e selecione:
    echo "EXECUTAR COMO ADMINISTRADOR".
    echo.
) else (
    echo [SUCESSO] Porta 3500 liberada com sucesso no Firewall!
    echo.
    echo ======================================================================
    echo Agora acesse no navegador do seu celular:
    echo.
    echo       http://192.168.0.137:3500
    echo.
    echo OBS: O celular deve estar conectado na MESMA rede Wi-Fi do computador.
    echo ======================================================================
)

echo.
pause
