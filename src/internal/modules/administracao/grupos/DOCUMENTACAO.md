# Documentação de Engenharia de Software: Configurar Grupos Corporativos

> **Módulo do Sistema:** Configurar Grupos Corporativos  
> **Rota no Sistema:** `/permissions/groups`  
> **Nível de Acesso:** `Role MASTER`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Organiza os usuários em equipes funcionais para simplificar a concessão em lote de permissões e direcionamento de fluxos de aprovação.

**Resumo Executivo:** Criação de grupos funcionais (Mesa, Jurídico, Financeiro, Diretoria) e atribuição de membros.

## 2. Regras de Negócio e Políticas Operacionais

- **Vinculação Flexível:** Um colaborador pode pertencer a múltiplos grupos simultaneamente.
- **Auditoria de Membros:** Rastreia a data e o administrador que incluiu cada usuário no grupo.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `grupos` | Cadastro de grupos (nome, descrição, permissões padrão). |
| `grupos_membros` | Vínculo N:N entre usuários e grupos. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/groups` | Lista grupos cadastrados e total de membros em cada um. |
| `POST` | `/api/groups` | Cria novo grupo corporativo. |
| `POST` | `/api/groups/members` | Adiciona ou remove colaboradores do grupo. |

## 5. Especificações de UI/UX & Usabilidade

Cards de grupos com lista de avatares dos membros e gaveta lateral para seleção de colaboradores.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Atualizações transacionais no banco de dados com integridade referencial em cascata.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
