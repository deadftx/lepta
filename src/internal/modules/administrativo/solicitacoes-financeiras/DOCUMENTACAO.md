# Documentação de Engenharia de Software: Solicitações Financeiras & Compras

> **Módulo do Sistema:** Solicitações Financeiras & Compras  
> **Rota no Sistema:** `/administrativo/compras`  
> **Nível de Acesso:** `Permissão 11.1 (Compras - Solicitações)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Esteira corporativa de aquisições e despesas da Lepta Capital. Permite que qualquer colaborador submeta pedidos de compra ou reembolsos, anexando notas fiscais, orçamentos e dados bancários. O pedido passa automaticamente pela alçada de aprovação configurada (Diretoria / Master / Jurídico) antes de seguir para pagamento.

**Resumo Executivo:** Workflow completo de requisições de compras, reembolsos, contratação de serviços e alçadas de aprovação.

## 2. Regras de Negócio e Políticas Operacionais

- **Multi-Itens em Solicitação Única:** Uma requisição pode agregar múltiplos itens com diferentes categorias, fornecedores e formas de pagamento.
- **Alçadas de Decisão:** Apenas usuários cadastrados como Aprovadores enxergam e decidem solicitações de outros colaboradores; usuários comuns visualizam apenas as suas.
- **Segurança de Alçadas:** Aprovadores jurídicos decidem exclusivamente requisições cabíveis ao jurídico.
- **Categorias e Alocação:** Destino configurável entre Centro de Custo, Empresa e Cliente (com exclusão do legado Departamento).
- **Campos de Observação Formatáveis:** Observações adicionais preservam parágrafos, quebras de linha e dados bancários/PIX para clareza da tesouraria.
- **Auditoria de Ciclo de Vida:** Gravação de quem aprovou, negou ou retornou para revisão com justificativa obrigatória.
- **Notificações Instantâneas:** Envio de Web Push e e-mail em cada mudança de status.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `compras_requisicoes` | Registro master da requisição (código, solicitante, status, total, observações, aprovador). |
| `compras_requisicoes_itens` | Itens discriminados com fornecedor, valor, quantidade, tipo de destino e chave PIX. |
| `compras_anexos` | Notas fiscais, boletos e cotações anexadas. |
| `compras_mensagens` | Histórico de mensagens e chat interno sobre a requisição. |
| `compras_papeis_usuarios` | Controle de alçada de aprovadores. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/purchases/requests` | Lista solicitações com paginação, busca e filtros de status. |
| `POST` | `/api/purchases/requests` | Criação de nova solicitação com suporte a múltiplos itens e anexos. |
| `POST` | `/api/purchases/requests/:id/approve` | Aprova solicitação avançando para o financeiro. |
| `POST` | `/api/purchases/requests/:id/reject` | Nega solicitação com justificativa obrigatória. |
| `POST` | `/api/purchases/requests/:id/revision` | Retorna solicitação ao solicitante para correção. |
| `POST` | `/api/purchases/requests/:id/archive` | Arquiva manualmente solicitações (exclusivo Master). |

## 5. Especificações de UI/UX & Usabilidade

Layout 100% responsivo estilo aplicação mobile/desktop. Abas dedicadas: Fila de Aprovação, Solicitações Revisadas, Nova Solicitação, Minhas Solicitações e Arquivadas. Modais ricos para visualização detalhada de anexos e cópia rápida de chave PIX.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Validação dupla de permissões no backend (JWT payload e checagem de banco em tempo real). Sanitização de arquivos no upload com multer.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
