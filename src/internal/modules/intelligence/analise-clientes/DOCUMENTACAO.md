# Documentação de Engenharia de Software: Análise de Clientes (Lepta Intelligence)

> **Módulo do Sistema:** Análise de Clientes (Lepta Intelligence)  
> **Rota no Sistema:** `/intelligence/analise-clientes`  
> **Nível de Acesso:** `Permissão 8.1 (Intelligence - Análise de Clientes)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Módulo central de análise cadastral e financeira da carteira de clientes. Permite que a mesa de crédito visualize faturamento, limites aprovados, histórico de duplicatas operadas e nível de risco.

**Resumo Executivo:** Avaliação profunda de cedentes e sacados, histórico de operações, concentração e limites.

## 2. Regras de Negócio e Políticas Operacionais

- **Regra de Concentração:** Alerta quando um único sacado ultrapassa o percentual máximo seguro da carteira do cedente.
- **Atualização de Score:** Combina dados históricos do banco SQLite com informações da API Unltd / SmartFactor.
- **Verificação de Restrições:** Identifica apontamentos cadastrais antes da concessão de novo limite.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `clientes_cadastro` | Cadastro detalhado do cliente com dados societários, CNPJ e limite. |
| `operacoes` | Histórico de operações de crédito e antecipação de recebíveis. |
| `cedentes` | Relação de cedentes e fundos vinculados. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/intelligence/clients` | Lista clientes com suporte a busca textual, CNPJ e status. |
| `GET` | `/api/intelligence/clients/:id` | Retorna ficha cadastral completa com sócios e limites. |
| `GET` | `/api/intelligence/clients/:id/concentration` | Calcula índices de concentração da carteira. |

## 5. Especificações de UI/UX & Usabilidade

Dashboard com KPIs de limite total vs. tomado, gráfico de distribuição de sacados (Recharts) e abas para dados cadastrais, operações ativas e garantias.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Consultas otimizadas com agregações diretas no banco de dados para rápida renderização em clientes com milhares de títulos.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
