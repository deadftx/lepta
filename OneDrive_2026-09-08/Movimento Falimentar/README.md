# Movimento Falimentar 1.3

Monitor local de Movimento Falimentar utilizando a API Pública do CNJ DataJud, com histórico SQLite e dashboard web.

## Requisitos

- Windows 10/11
- Node.js LTS (22+)

## Instalação

1. Extraia o ZIP em uma pasta, por exemplo `C:\MovimentoRJ`.
2. Execute `INICIAR.bat`.
3. Acesse `http://localhost:3333`.

## Dashboard

- **Executar consulta**: inicia uma nova varredura nos tribunais configurados.
- **Extrair CSV**: baixa o relatório em CSV.
- O cabeçalho utiliza o tema visual da **Lepta Capital**, com o logotipo oficial carregado do site da marca.

## Configuração

Copie `.env.example` para `.env` quando precisar configurar porta, agendamento ou chave do DataJud manualmente.

## Diagnóstico

Use `DIAGNOSTICO.bat` para visualizar o resultado das consultas e eventuais erros por tribunal.
