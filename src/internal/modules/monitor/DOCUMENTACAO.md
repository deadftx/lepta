# Documentação de Engenharia de Software: Monitor de Presença & Telemetria

> **Módulo do Sistema:** Monitor de Presença & Telemetria  
> **Rota no Sistema:** `/monitor`  
> **Nível de Acesso:** `Role MASTER`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Painel de telemetria operacional em tempo real para a equipe de tecnologia. Permite visualizar quais colaboradores estão online neste instante, em qual tela estão trabalhando, tempo de inatividade e eventuais erros de runtime capturados.

**Resumo Executivo:** Auditoria de usuários conectados em tempo real, tempo de sessão, rotas navegadas e erros do sistema.

## 2. Regras de Negócio e Políticas Operacionais

- **Critério de Presença:** O usuário é considerado "Online" se enviou heartbeat nos últimos 60 segundos; "Ausente" entre 60s e 5 minutos; "Offline" após 5 minutos.
- **Privacidade & Auditoria:** Registra unicamente a rota (/administrativo/compras, /mesa-operacoes/analise) e timestamp para auditoria de segurança.
- **Registro de Erros:** Falhas de JavaScript e rejeições de promises não tratadas são capturadas e exibidas no log do monitor.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `monitor_user_sessions` | Último heartbeat de cada usuário, rota ativa e timestamp. |
| `site_analytics_hits` | Contagem de acessos por módulo para análise de volumetria. |
| `monitor_system_errors` | Logs de erros capturados pelo SystemErrorBoundary. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/monitor/sessions` | Retorna lista de colaboradores online, status e módulo ativo. |
| `GET` | `/api/monitor/analytics` | Estatísticas de uso e distribuição de acessos por rota. |
| `POST` | `/api/monitor/heartbeat` | Endpoint de recepção do ping periódico de presença (30s). |

## 5. Especificações de UI/UX & Usabilidade

Grid de status com pulso verde para usuários online em tempo real, avatar, módulo atual e tempo de sessão ativa. Painel de erros com stack trace recolhível.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Otimização de escrita no banco de dados através de upsert (INSERT OR REPLACE) para suportar dezenas de heartbeats simultâneos sem overhead de I/O.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
