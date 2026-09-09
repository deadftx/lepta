# Documentação de Engenharia de Software: Análise de Riscos

> **Módulo do Sistema:** Análise de Riscos  
> **Rota no Sistema:** `/intelligence/analise-riscos`  
> **Nível de Acesso:** `Permissão 8.3 (Intelligence - Análise de Riscos)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Auxilia os analistas de risco a determinar o rating de crédito (de AAA até D) de cada operação e empresa, ponderando garantias reais, histórico de liquidação e saúde financeira.

**Resumo Executivo:** Matriz de risco de crédito, ratings e cálculo de perda esperada.

## 2. Regras de Negócio e Políticas Operacionais

- **Matriz de Classificação:** Cruzamento de tempo de fundação, faturamento comprovado e histórico de pontualidade.
- **Sinalização de Risco Crítico:** Bloqueio automático de limite caso ocorra protesto de valor expressivo.
- **Revisão Periódica:** Alerta para revisão de risco a cada 6 meses.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `clientes_cadastro` | Leitura de limites e faturamento. |
| `BASE_NPL` | Consulta a atrasos históricos de títulos. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/intelligence/risk-matrix` | Retorna parâmetros da matriz e distribuição de risco da carteira. |
| `POST` | `/api/intelligence/risk-rating` | Registra novo parecer de rating emitido por analista. |

## 5. Especificações de UI/UX & Usabilidade

Indicadores coloridos de rating (Verde, Amarelo, Vermelho). Gráficos de dispersão de risco x retorno.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Cálculos probabilísticos executados no backend para garantir consistência de regras entre web e relatórios.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
