# Documentação de Engenharia de Software: Home & Dashboard Intranet

> **Módulo do Sistema:** Home & Dashboard Intranet  
> **Rota no Sistema:** `/dashboard`  
> **Nível de Acesso:** `Autenticado (Todos os Usuários)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

O módulo Home (/dashboard) consolida a visão operacional do usuário autenticado no sistema. Atua como um cockpit operacional que exibe métricas diárias, atalhos rápidos de navegação personalizada de acordo com os grupos/alçadas do usuário, alertas pendentes de aprovação e indicadores do mercado financeiro em tempo real.

**Resumo Executivo:** Central unificada e ponto de entrada operacional dos colaboradores da Lepta Capital.

## 2. Regras de Negócio e Políticas Operacionais

- **Personalização por Perfil:** A visualização de cards de atalho obedece rigorosamente às permissões cadastradas para o usuário ou grupos aos quais pertence.
- **Sinalização de Pendências:** Notifica colaboradores se existirem solicitações de pagamento pendentes sob sua alçada ou solicitações rejeitadas para revisão.
- **Auditoria de Conexão:** Registra evento de login e envia heartbeat de presença a cada 30 segundos enquanto a aba estiver ativa.
- **Acesso Rápido aos Módulos:** Redirecionamento direto para telas de esteira de crédito, compras, jurídico e financeiro.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `usuarios_lepta` | Dados do usuário autenticado, alçadas e grupos. |
| `compras_requisicoes` | Contagem e status de solicitações financeiras pendentes/em aberto. |
| `monitor_user_sessions` | Registro de sessão ativa, telemetria e heartbeat. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/auth/me` | Valida token JWT e carrega permissões e dados cadastrais do usuário. |
| `GET` | `/api/purchases/requests/stats` | Obtém estatísticas de requisições financeiras para cards de alerta. |
| `POST` | `/api/monitor/heartbeat` | Envia ping periódico de presença (pathname e timestamp). |

## 5. Especificações de UI/UX & Usabilidade

Design baseado em cards translúcidos (glassmorphism) sobre fundo escuro (#0a0e1a). Cabeçalho com ticker de cotações financeiras, avatar do usuário, sino de notificações Web Push e atalho global Ctrl+K para busca instantânea de qualquer tela do sistema. Responsivo para celulares e tablets sem quebra de grid.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Comunicação com service worker para notificações em segundo plano. Validação de atualização de chunk em caso de novo deploy no servidor.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
