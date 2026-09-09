# Documentação de Engenharia de Software: Processar Extrato Bancário

> **Módulo do Sistema:** Processar Extrato Bancário  
> **Rota no Sistema:** `/financeiro/extratos`  
> **Nível de Acesso:** `Permissão 7.1 (Financeiro - Extratos)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Centraliza o upload e processamento de extratos bancários das contas correntes da Lepta Capital e fundos geridos. Realiza parser inteligente de lançamentos de crédito/débito, associando tarifas, liquidações de títulos e transferências aos devidos centros de custo e cedentes.

**Resumo Executivo:** Leitura, importação e conciliação automática de extratos bancários (OFX, Excel e PDF).

## 2. Regras de Negócio e Políticas Operacionais

- **Eliminação de Duplicidade:** Transações são identificadas por hash do banco + data + valor + documento (FITID) para impedir importação duplicada.
- **Classificação Automática:** Expressões regulares pré-configuradas identificam tarifas bancárias, juros, TED, PIX e repasses.
- **Conciliação com Títulos:** Localiza duplicatas liquidadas na data e abate dos saldos em aberto.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `finance_transactions` | Armazena cada lançamento individual do extrato com data, histórico e valor. |
| `finance_accounts` | Contas bancárias cadastradas (banco, agência, conta). |
| `finance_categories` | Plano de contas e categorias de receitas e despesas. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `POST` | `/api/finance/upload-statement` | Upload multipart/form-data do arquivo de extrato (OFX/XLSX). |
| `GET` | `/api/finance/statements` | Lista lançamentos importados com filtros de data e status de conciliação. |
| `POST` | `/api/finance/reconcile` | Executa conciliação manual ou aprovação em lote. |

## 5. Especificações de UI/UX & Usabilidade

Área de drag-and-drop de arquivos com barra de progresso. Grid de conferência comparando lançamento bancário x previsão do sistema com badges coloridos de conciliação (Conciliado, Divergente, Não Encontrado).

## 6. Arquitetura Técnica & Detalhes de Engenharia

Uso de exceljs e streams para processar arquivos com dezenas de milhares de linhas sem estourar o limite de memória do Node.js.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
