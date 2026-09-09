# Documentação de Engenharia de Software: Calendário Corporativo & Marketing

> **Módulo do Sistema:** Calendário Corporativo & Marketing  
> **Rota no Sistema:** `/marketing`  
> **Nível de Acesso:** `Permissão 6 (Marketing / Calendário)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Permite ao time de Marketing e Comunicação organizar a grade de publicações, campanhas institucionais e cronogramas de disparos de comunicados da Lepta Capital. Evita sobreposição de postagens e oferece controle visual de datas e temas.

**Resumo Executivo:** Agendamento e acompanhamento de postagens, campanhas e eventos de comunicação institucional.

## 2. Regras de Negócio e Políticas Operacionais

- **Status de Publicação:** Eventos transitam entre Planejado, Em Produção, Aprovado e Publicado.
- **Bloqueio de Edição Passada:** Eventos com mais de 30 dias passados são marcados como somente-leitura.
- **Filtro por Canal:** Permite separar por canais de veiculação (LinkedIn, Instagram, Comunicado Interno, E-mail Marketing).

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `marketing_events` | Tabela de eventos, datas de agendamento, títulos, canais e responsáveis. |
| `usuarios_lepta` | Vínculo do responsável pela publicação. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/marketing/events` | Retorna a lista de eventos com filtro por mês e ano. |
| `POST` | `/api/marketing/events` | Cadastra um novo evento no cronograma com data e canal. |
| `PUT` | `/api/marketing/events/:id` | Edita status ou remarca data de postagem. |
| `DELETE` | `/api/marketing/events/:id` | Remove evento cancelado. |

## 5. Especificações de UI/UX & Usabilidade

Visão mensal interativa com grade de dias e destaque para o dia corrente. Cores diferenciadas por canal (LinkedIn = azul, Instagram = gradiente roxo, etc.). Modal para inserção rápida com validação de campos obrigatórios.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Cálculo puramente em memória no frontend do calendário gregoriano sem bibliotecas pesadas, reduzindo o bundle. Sincronização via API REST.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
