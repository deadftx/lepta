# Documentação de Engenharia de Software: Aprovação de Pagamentos Jurídicos

> **Módulo do Sistema:** Aprovação de Pagamentos Jurídicos  
> **Rota no Sistema:** `/juridico/aprovacao-pagamentos`  
> **Nível de Acesso:** `Permissão 13.1 (Jurídico - Aprovação)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Módulo especializado para o departamento Jurídico avaliar e aprovar solicitações de pagamento relacionadas a processos, perícias, custas judiciais e honorários, garantindo conformidade com a estratégia do contencioso.

**Resumo Executivo:** Parecer e deliberação de despesas jurídicas, custas processuais e honorários advocatícios.

## 2. Regras de Negócio e Políticas Operacionais

- **Acesso Segmentado:** Aprovadores jurídicos enxergam apenas requisições cabíveis ao jurídico e suas próprias requisições.
- **Validação de Guia:** Exige conferência do código de barras da guia de custas ou dados da sociedade de advogados.
- **Parecer Fundamentado:** Em caso de negativa ou devolução para revisão, é obrigatória a justificativa legal.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `compras_requisicoes` | Consulta e atualização de solicitações sob alçada jurídica. |
| `compras_papeis_juridico` | Tabela de aprovadores autorizados do jurídico. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/purchases/requests/legal` | Retorna requisições destinadas à esteira jurídica. |
| `POST` | `/api/purchases/requests/:id/approve` | Aprova despesa jurídica encaminhando à tesouraria. |

## 5. Especificações de UI/UX & Usabilidade

Interface corporativa sóbria com destaques para anexos de guias processuais, número do processo e status da decisão.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Garantia de isolamento de dados: usuários sem permissão 13.1 não conseguem interceptar as requisições jurídicas.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
