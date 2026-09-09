# Documentação de Engenharia de Software: Relatório Diário de Operações

> **Módulo do Sistema:** Relatório Diário de Operações  
> **Rota no Sistema:** `/mesa-operacoes/relatorio-diario`  
> **Nível de Acesso:** `Permissão 14.3 (Mesa - Relatório Diário)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Gera a fotografia diária das operações concluídas pela mesa para envio aos gestores e comitê de investimentos ao final do expediente.

**Resumo Executivo:** Consolidação diária de volumes operados, taxas médias, deságio e títulos liquidados.

## 2. Regras de Negócio e Políticas Operacionais

- **Totalização Diária:** Somatório de volume nominal, valor líquido liberado, taxa média ponderada e deságio retido.
- **Agrupamento por Fundo:** Segregação entre os fundos FIDC operados pela gestora.
- **Fechamento de Caixa:** Registro do horário de fechamento do relatório diário.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `operacoes` | Agregação das operações finalizadas na data corrente. |
| `fundos` | Parâmetros dos fundos de investimento envolvidos. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/operations/daily-report` | Retorna consolidação do dia com suporte a filtros de data e fundo. |
| `POST` | `/api/operations/daily-report/export` | Exporta relatório formatado em planilha Excel (.xlsx). |

## 5. Especificações de UI/UX & Usabilidade

Gráficos de volumetria diária, cards com taxas médias e tabela analítica de borderôs com botão para download imediato do relatório.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Uso do exceljs com formatação corporativa de células, cabeçalhos Lepta e fórmulas automáticas de soma e média ponderada.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
