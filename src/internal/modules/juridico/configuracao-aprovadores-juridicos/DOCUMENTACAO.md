# Documentação de Engenharia de Software: Configuração de Aprovadores Jurídicos

> **Módulo do Sistema:** Configuração de Aprovadores Jurídicos  
> **Rota no Sistema:** `/juridico/configuracao-aprovadores`  
> **Nível de Acesso:** `Permissão 13.2 (Jurídico - Configuração de Aprovadores)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Painel de governança que permite selecionar quais advogados e membros do time jurídico possuem poder de aprovação sobre pagamentos jurídicos.

**Resumo Executivo:** Gestão de usuários autorizados a emitir deliberações em pagamentos do departamento jurídico.

## 2. Regras de Negócio e Políticas Operacionais

- **Filtro por Acesso Jurídico:** Apenas colaboradores que já possuem acesso ao módulo Jurídico são listados como elegíveis para aprovação jurídica.
- **Segregação de Alçadas:** Aprovadores jurídicos não aprovam solicitações gerais de compras, mantendo a autonomia departamental.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `compras_papeis_juridico` | Tabela com os IDs dos usuários aprovadores jurídicos. |
| `usuarios_lepta` | Relação de usuários com credencial jurídica. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/purchases/config/legal-roles` | Lista usuários elegíveis e status de aprovação jurídica. |
| `POST` | `/api/purchases/config/legal-roles` | Define ou remove o papel de aprovador jurídico. |

## 5. Especificações de UI/UX & Usabilidade

Grid simplificado com foto, e-mail e botão direto para alternar entre "Aprovador Jurídico" e "Membro Padrão".

## 6. Arquitetura Técnica & Detalhes de Engenharia

Persistência atômica com validação de permissão de administrador no backend.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
