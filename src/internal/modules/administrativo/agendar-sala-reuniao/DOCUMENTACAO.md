# Documentação de Engenharia de Software: Agendamento de Salas de Reunião

> **Módulo do Sistema:** Agendamento de Salas de Reunião  
> **Rota no Sistema:** `/administrativo/salas-reuniao`  
> **Nível de Acesso:** `Permissão 11.3 (Administrativo - Salas de Reunião)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Organiza a utilização das salas de reunião da sede da Lepta Capital. Garante que duas equipes não reservem a mesma sala no mesmo horário e dispara alertas via Web Push quando faltar 10 minutos para o início do agendamento.

**Resumo Executivo:** Reserva de salas físicas, controle de conflitos de horário e alertas automáticos.

## 2. Regras de Negócio e Políticas Operacionais

- **Detecção de Conflito:** O sistema rejeita reservas que apresentem sobreposição de horário na mesma sala.
- **Cancelamento Antecipado:** O organizador ou Master pode liberar o horário da sala.
- **Alerta de 10 Minutos:** Um serviço em segundo plano roda a cada minuto no backend e envia push notification quando o relógio atinge T-10 min do início do agendamento.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `salas_reuniao_agendamentos` | Reservas contendo sala_id, data, horario_inicio, horario_fim, titulo e usuario_id. |
| `salas_reuniao_alertas_10min` | Tabela de controle para evitar disparo duplicado de alertas. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/administrative/meeting-rooms/bookings` | Retorna agendamentos por data selecionada. |
| `POST` | `/api/administrative/meeting-rooms/bookings` | Cria reserva após checar ausência de conflito. |
| `DELETE` | `/api/administrative/meeting-rooms/bookings/:id` | Cancela a reserva liberando o horário. |

## 5. Especificações de UI/UX & Usabilidade

Visualizador de salas com grade temporal de 30 em 30 minutos. Cores de disponibilidade (Verde = Livre, Vermelho = Ocupada). Modal para inclusão de pauta e participantes.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Rotina cron no Node.js que avalia alertas pendentes a cada 60s com garantia de envio único.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
