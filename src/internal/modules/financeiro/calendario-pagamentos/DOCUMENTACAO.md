# Documentação de Engenharia de Software: Calendário de Pagamentos

> **Módulo do Sistema:** Calendário de Pagamentos  
> **Rota no Sistema:** `/financeiro/calendario-pagamentos`  
> **Nível de Acesso:** `Permissão 7.5 (Financeiro - Calendário de Pagamentos)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Fornece previsibilidade de fluxo de caixa para a diretoria financeira, exibindo todos os pagamentos e parcelas de compras agrupados nos dias do mês em que ocorrerá o débito.

**Resumo Executivo:** Visão cronológica de despesas fixas, parcelamentos e vencimentos programados.

## 2. Regras de Negócio e Políticas Operacionais

- **Agrupamento por Vencimento:** Compras parceladas são desmembradas em suas respectivas datas futuras.
- **Visão de Desembolso:** Totalização diária do montante financeiro exigido para cobrir os compromissos.
- **Alerta de Vencimento no Dia:** Destaque visual para pagamentos que vencem na data de hoje.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `compras_requisicoes_parcelas` | Tabela de parcelas com data de vencimento, número da parcela e valor. |
| `compras_requisicoes` | Dados do fornecedor, centro de custo e solicitante. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/purchases/calendar` | Retorna parcelas e requisições agendadas no mês/ano selecionado. |

## 5. Especificações de UI/UX & Usabilidade

Visualização em calendário clássico com badges de valor total por dia. Ao clicar no dia, abre drawer lateral listando fornecedor, valor, forma de pagamento e status de cada item.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Filtragem performática indexada por data_vencimento no SQLite.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
