# Documentação de Engenharia de Software: Configuração de Aprovadores

> **Módulo do Sistema:** Configuração de Aprovadores  
> **Rota no Sistema:** `/administrativo/configuracao-compras`  
> **Nível de Acesso:** `Permissão 11.2 (Compras - Configuração)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Permite aos administradores e Master configurar quem são os aprovadores das solicitações financeiras gerais. Um usuário sem papel de aprovador não visualiza solicitações alheias, garantindo total privacidade e segregação de funções.

**Resumo Executivo:** Definição de alçadas de aprovação, papéis e limites de compras corporativas.

## 2. Regras de Negócio e Políticas Operacionais

- **Segregação de Papéis:** O usuário pode ser configurado como "Aprovador" ou "Usuário Padrão".
- **Herança por Grupo:** Suporte a atribuição de alçada a grupos corporativos inteiros.
- **Acesso Restrito:** Apenas usuários Master ou com permissão 11.2 podem acessar esta tela de configuração.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `compras_papeis_usuarios` | Vínculo do ID do usuário com o papel de APROVADOR. |
| `compras_papeis_grupos` | Vínculo de grupos de usuários autorizados a aprovar. |
| `usuarios_lepta` | Listagem de usuários ativos para configuração. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/purchases/config/roles` | Lista usuários e seus papéis no fluxo de compras. |
| `POST` | `/api/purchases/config/roles` | Salva atribuição de aprovador para um usuário ou grupo. |
| `DELETE` | `/api/purchases/config/roles/:userId` | Revoga papel de aprovador de um usuário. |

## 5. Especificações de UI/UX & Usabilidade

Tabela moderna com busca instantânea de colaboradores. Toggle ou botão de alternância clara entre "Aprovador" e "Padrão". Feedback imediato por Toast.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Invalidação em tempo real do cache de alçadas no backend após cada atualização.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
