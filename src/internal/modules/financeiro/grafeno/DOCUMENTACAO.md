# Documentação de Engenharia de Software: Integração LEPTA x Grafeno

> **Módulo do Sistema:** Integração LEPTA x Grafeno  
> **Rota no Sistema:** `/financeiro/grafeno`  
> **Nível de Acesso:** `Permissão 7.2 (Financeiro - Grafeno)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Conecta os sistemas da Lepta diretamente à infraestrutura de pagamentos e contas gráficas da Grafeno. Permite auditar saldos, transações em tempo real e processar webhooks de liquidações instantâneas.

**Resumo Executivo:** Monitoramento de contas escrow e conciliação em tempo real com a API da Grafeno.

## 2. Regras de Negócio e Políticas Operacionais

- **Assinatura de Webhooks:** Todos os payloads recebidos da Grafeno são validados com secret HMAC antes da persistência.
- **Idempotência Operacional:** IDs de transação da Grafeno são únicos; eventos repetidos são descartados com log de auditoria.
- **Sincronização Forçada:** Permite solicitar via interface um sync sob demanda para obter o saldo pontual.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `grafeno_transacoes` | Espelho de todas as movimentações recebidas via API/Webhooks da Grafeno. |
| `grafeno_webhooks` | Log de todos os payloads recebidos com status de processamento. |
| `grafeno_config` | Tokens e chaves de integração da conta escrow. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/finance/grafeno/balance` | Consulta saldo consolidado e disponível na Grafeno. |
| `GET` | `/api/finance/grafeno/transactions` | Lista transações filtradas por data e tipo (Crédito/Débito). |
| `POST` | `/api/finance/grafeno/sync` | Dispara sincronização manual contra a API Grafeno. |
| `POST` | `/api/finance/grafeno/webhook` | Endpoint receptor de eventos da Grafeno. |

## 5. Especificações de UI/UX & Usabilidade

Cards com saldo em tempo real, status do webhook (Online/Offline) e tabela com filtro rápido por tipo de movimentação. Botão de exportação em planilha.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Armazenamento de logs de auditoria em SQLite para rastreabilidade jurídica de cada centavo movimentado na conta escrow.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
