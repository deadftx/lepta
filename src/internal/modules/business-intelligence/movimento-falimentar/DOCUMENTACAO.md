# Documentação de Engenharia de Software: Movimento Falimentar (Business Intelligence)

> **Módulo do Sistema:** Movimento Falimentar (Business Intelligence)  
> **Rota no Sistema:** `/bi/movimento-falimentar`  
> **Nível de Acesso:** `Permissão 4.1 (BI - Movimento Falimentar)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Módulo de inteligência jurídica preventiva. Realiza a varredura contínua de publicações judiciais em busca de processos de recuperação judicial, falência e autofalência envolvendo CNPJs de cedentes e sacados da carteira da Lepta.

**Resumo Executivo:** Varredura de diários de justiça e identificação de recuperações judiciais e falências de clientes.

## 2. Regras de Negócio e Políticas Operacionais

- **Alerta Crítico:** Emissão imediata de aviso à diretoria quando detectada publicação de deferimento de RJ.
- **Histórico de Eventos:** Armazenamento da data da publicação, vara cível, número do processo e teor do despacho.
- **Bloqueio Preventivo:** Marcação do cliente como "Em Recuperação" impedindo novas operações sem aprovação especial.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `rj_events` | Registro dos eventos falimentares capturados com processo e texto. |
| `scans` | Histórico de varreduras executadas pelo robô coletor. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/bi/movimento-falimentar/events` | Lista ocorrências falimentares com filtros por empresa e período. |
| `POST` | `/api/bi/movimento-falimentar/scan` | Dispara nova varredura nos diários oficiais. |

## 5. Especificações de UI/UX & Usabilidade

Tabela com badges de gravidade (Recuperação Judicial, Falência Decretada, Convocação de Credores) e modal para leitura da íntegra do despacho judicial.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Robô coletor com tratamento de regex para extração estruturada de número de processo CNJ e CNPJ.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
