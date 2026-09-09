# Documentação de Engenharia de Software: Esteira de Comitê de Crédito

> **Módulo do Sistema:** Esteira de Comitê de Crédito  
> **Rota no Sistema:** `/intelligence/esteira-comite`  
> **Nível de Acesso:** `Permissão 8.5 (Intelligence - Esteira de Comitê)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Automatiza as reuniões de comitê de crédito da Lepta Capital. Os analistas submetem propostas de aumento de limite ou novas operações, e os membros do comitê registram seus votos com parecer fundamentado.

**Resumo Executivo:** Deliberação colegiada de limites de crédito com votos e pareceres de membros do comitê.

## 2. Regras de Negócio e Políticas Operacionais

- **Quórum Mínimo:** Propostas exigem quantidade mínima de votos favoráveis para aprovação automática.
- **Poder de Veto:** Membros executivos têm poder de veto fundamentado.
- **Imutabilidade dos Pareceres:** Uma vez registrado o voto, não pode ser alterado para fins de governança e auditoria.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `comite_propostas` | Propostas de crédito com valor solicitado, cliente, garantias e status. |
| `comite_votos` | Registro de cada voto individual (Favorável, Desfavorável, Abstenção) e parecer. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/intelligence/committee/pipeline` | Retorna propostas em pauta na esteira. |
| `POST` | `/api/intelligence/committee/vote` | Submete voto do membro autenticado. |
| `POST` | `/api/intelligence/committee/finalize` | Encerra a deliberação gerando ata assinada. |

## 5. Especificações de UI/UX & Usabilidade

Quadro estilo Kanban ou lista de pautas. Indicador visual do progresso de votos de cada membro. Modal para digitação do parecer técnico.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Controle de concorrência com travas otimistas para encerramento de pauta.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
