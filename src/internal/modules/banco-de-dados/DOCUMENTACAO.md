# Documentação de Engenharia de Software: Gestão do Banco de Dados SQLite

> **Módulo do Sistema:** Gestão do Banco de Dados SQLite  
> **Rota no Sistema:** `/banco-de-dados`  
> **Nível de Acesso:** `Permissão 9 (Banco de Dados / Master)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Painel de administração técnica da infraestrutura de dados da Lepta. Permite monitorar o tamanho do arquivo SQLite, quantidade de linhas por tabela, status do job de sincronização periódica e disparo de backups.

**Resumo Executivo:** Auditoria de integridade, volumetria de tabelas, execução de backups e sincronização com a API Unltd.

## 2. Regras de Negócio e Políticas Operacionais

- **Acesso Restrito:** Exclusivo para usuários com permissão 9 ou role MASTER.
- **Integridade Referencial:** Execução de comandos PRAGMA foreign_keys e integrity_check.
- **Sincronização Unltd:** Histórico de execuções com log de registros inseridos e atualizados.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `API_SYNC_EXECUCOES` | Histórico de sincronizações de dados da API externa Unltd. |
| `databaseTables` | Metadados e contagens estruturais de tabelas do banco de dados. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/database/status` | Retorna tamanho do arquivo .sqlite, contagem de tabelas e status. |
| `POST` | `/api/database/sync-now` | Dispara sincronização manual com a API Unltd. |
| `POST` | `/api/database/backup` | Gera cópia consistente do banco de dados. |

## 5. Especificações de UI/UX & Usabilidade

Cards com indicadores de saúde do banco, tabela com lista de todas as tabelas e quantidade de registros, e log em tempo real do sync.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Execução segura do driver better-sqlite3 em modo WAL (Write-Ahead Logging) para alta performance de leitura e concorrência.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
