# Documentação de Engenharia de Software: Dashboards Executivos

> **Módulo do Sistema:** Dashboards Executivos  
> **Rota no Sistema:** `/dashboards`  
> **Nível de Acesso:** `Permissão 5 (Dashboards)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Ambiente de inteligência visual para a alta gestão e investidores acompanharem os principais indicadores de desempenho da operação da Lepta Capital.

**Resumo Executivo:** Visualização analítica integrada de KPIs, relatórios de Power BI e gráficos de performance.

## 2. Regras de Negócio e Políticas Operacionais

- **Segurança de Embed:** Integração segura com relatórios de Power BI via tokens temporários.
- **Filtros Globais:** Capacidade de selecionar períodos e fundos para ajuste de todos os gráficos.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `power_bi_dashboards` | Configuração dos dashboards integrados, links e permissões. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/dashboards/list` | Retorna lista de dashboards disponíveis para o perfil do usuário. |

## 5. Especificações de UI/UX & Usabilidade

Layout imersivo com opções de tela cheia, seleção de abas de dashboards e transições suaves de carregamento.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Carregamento assíncrono de iframes com sandbox seguro e tratamento de erros de conexão.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
