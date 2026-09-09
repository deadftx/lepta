# Documentação de Engenharia de Software: Gestão de NPL (Non-Performing Loans)

> **Módulo do Sistema:** Gestão de NPL (Non-Performing Loans)  
> **Rota no Sistema:** `/intelligence/npl`  
> **Nível de Acesso:** `Permissão 8.4 (Intelligence - NPL)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Monitora a inadimplência ativa da Lepta Capital. Classifica os títulos vencidos por faixas de atraso (Aging: 1-30, 31-60, 61-90, 90+ dias) e direciona os casos para cobrança administrativa ou judicial.

**Resumo Executivo:** Controle de títulos inadimplentes, carteiras em atraso e esteira de cobrança contenciosa.

## 2. Regras de Negócio e Políticas Operacionais

- **Classificação por Aging:** Atualização diária das faixas com base na data de vencimento x data corrente.
- **Provisão para Devedores Duvidosos (PDD):** Percentual de provisão escalonado conforme a faixa de atraso.
- **Histórico de Acordos:** Registro de renegociações e termos de confissão de dívida.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `BASE_NPL` | Tabela principal com todos os títulos em atraso, sacado, cedente e dias de mora. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/intelligence/npl/summary` | Totalizadores e KPIs por faixa de aging. |
| `GET` | `/api/intelligence/npl/items` | Lista detalhada de títulos com filtros de cedente, sacado e valor. |

## 5. Especificações de UI/UX & Usabilidade

Filtros rápidos no topo, cards com volume financeiro em cada faixa de dias de atraso e tabela com ações rápidas para abrir ocorrência.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Job noturno que sincroniza a base de atrasados e recalcula juros e multas contratuais automaticamente.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
