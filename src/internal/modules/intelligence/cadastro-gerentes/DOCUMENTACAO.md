# Documentação de Engenharia de Software: Cadastro de Gerentes de Contas

> **Módulo do Sistema:** Cadastro de Gerentes de Contas  
> **Rota no Sistema:** `/intelligence/cadastro-gerentes`  
> **Nível de Acesso:** `Permissão 8.7 (Intelligence - Cadastro de Gerentes)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Cadastra os gerentes comerciais e associa cada cedente da carteira ao respectivo gerente para fins de comissionamento, acompanhamento de metas e direcionamento de relatórios.

**Resumo Executivo:** Gestão da equipe comercial e vinculação de carteiras de cedentes a gerentes.

## 2. Regras de Negócio e Políticas Operacionais

- **Exclusividade de Carteira:** Cada cedente pode estar vinculado a um único gerente principal em determinado período.
- **Histórico de Atribuição:** Alterações de gerência registram log para auditoria de comissões.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `gerentes` | Cadastro de gerentes comerciais (nome, e-mail, telefone, meta). |
| `gerentes_contas` | Vínculo N:N entre gerentes e cedentes operados. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/intelligence/managers` | Lista gerentes e quantidade de clientes sob sua gestão. |
| `POST` | `/api/intelligence/managers` | Cadastra novo gerente comercial. |
| `POST` | `/api/intelligence/managers/assign` | Vincula clientes à carteira do gerente. |

## 5. Especificações de UI/UX & Usabilidade

Tabela com avatar do gerente, barra de meta atingida e botão de gestão de carteira que abre lista de clientes para seleção em lote.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Atualizações em lote dentro de transação SQLite para migração rápida de carteira entre gerentes.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
