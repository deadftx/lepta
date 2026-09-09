# Documentação de Engenharia de Software: Central de Pagamentos & Despesas

> **Módulo do Sistema:** Central de Pagamentos & Despesas  
> **Rota no Sistema:** `/financeiro/reembolsos-despesas`  
> **Nível de Acesso:** `Permissão 7.4 (Financeiro - Central de Pagamentos)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Etapa final da esteira de compras e pagamentos. Recebe as solicitações de compras e reembolsos que já foram integralmente aprovadas pelos diretores ou pelo jurídico e disponibiliza as informações bancárias (PIX, boleto, transferência) para liquidação pelo time de tesouraria.

**Resumo Executivo:** Execução financeira de requisições, reembolsos e boletos corporativos aprovados.

## 2. Regras de Negócio e Políticas Operacionais

- **Garantia de Aprovação Prévia:** Somente requisições no status APROVADO são elegíveis para pagamento na esteira.
- **Comprovante Obrigatório:** A liquidação exige o anexo do comprovante bancário ou confirmação de ID de transação.
- **Notificação ao Solicitante:** O colaborador que solicitou o reembolso recebe aviso imediato via push e e-mail no momento do pagamento.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `compras_requisicoes` | Atualização do status de pagamento (PAGO, PENDENTE_PAGAMENTO). |
| `compras_requisicoes_itens` | Itens individuais com dados bancários e chaves PIX. |
| `compras_anexos` | Comprovantes de pagamento anexados pela tesouraria. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/purchases/requests/approved` | Retorna requisições aprovadas prontas para pagamento. |
| `POST` | `/api/purchases/requests/:id/pay` | Marca a requisição como paga com data e comprovante. |
| `POST` | `/api/purchases/requests/:id/attachments` | Upload do comprovante de transferência bancária. |

## 5. Especificações de UI/UX & Usabilidade

Lista de pagamentos agrupados por data de vencimento. Botão com um clique para "Copiar Chave PIX". Exibição de valores totais e modais para confirmação de pagamento.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Atualizações atômicas em transações do SQLite para evitar que duas pessoas do financeiro marquem o mesmo pagamento simultaneamente.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
