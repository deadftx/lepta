# Documentação de Engenharia de Software: Configuração de E-mail & Notificações

> **Módulo do Sistema:** Configuração de E-mail & Notificações  
> **Rota no Sistema:** `/permissions/email-config`  
> **Nível de Acesso:** `Role MASTER`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Controla a infraestrutura de comunicação por e-mail da Lepta Capital. Permite alternar entre o envio seguro via Microsoft Graph API (Microsoft 365 / Entra ID) ou servidor SMTP corporativo. Define para quais destinatários e usuários do sistema cada evento corporativo deve disparar notificações automáticas.

**Resumo Executivo:** Configuração de envio de e-mails corporativos via Microsoft Entra ID (OAuth) ou SMTP, e regras de disparo por evento.

## 2. Regras de Negócio e Políticas Operacionais

- **Métodos de Envio:** Suporte duplo a Microsoft Entra ID (Recomendado com OAuth 2.0 Client Credentials) e SMTP clássico com TLS.
- **Eventos Parametrizáveis:** Configuração individual por evento (ex: Nova Solicitação de Compra, Aprovação pela Diretoria, Negada pela Diretoria, Retorno para Revisão, Conclusão de Pagamento pelo Financeiro).
- **Destinatários Flexíveis:** Combina usuários cadastrados no sistema com e-mails avulsos e opção de notificar o solicitante da requisição.
- **Proteção contra Quebra de UI:** Elementos de seleção e inputs com largura controlada (min-width: 0) para perfeito alinhamento visual.
- **Validação de Conexão:** Botão para envio de e-mail de teste antes de ativar a configuração.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `configuracao_email` | Credenciais de conexão (Entra ID: tenant_id, client_id, client_secret / SMTP: host, port, user, pass). |
| `configuracao_email_fluxo` | Regras de quais e-mails e usuários recebem notificações de cada evento. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/email/config` | Retorna parâmetros atuais de conexão e fluxos de e-mail configurados. |
| `POST` | `/api/email/config` | Salva novas credenciais e regras de envio por evento. |
| `POST` | `/api/email/test` | Dispara e-mail de teste imediato para validar conectividade. |

## 5. Especificações de UI/UX & Usabilidade

Interface moderna com seletor de método de envio em cards destacados, visualizador de status de consentimento administrativo do Microsoft Entra ID, grid de eventos com chips de destinatários e botões de inclusão inline com contenção visual rigorosa.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Uso de nodemailer e biblioteca de autenticação da Microsoft (@azure/msal-node / fetch OAuth) com renovação automática de access token em segundo plano.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
