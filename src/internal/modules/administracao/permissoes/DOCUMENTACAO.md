# Documentação de Engenharia de Software: Gestão de Permissões e Acessos

> **Módulo do Sistema:** Gestão de Permissões e Acessos  
> **Rota no Sistema:** `/permissions`  
> **Nível de Acesso:** `Role MASTER`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Central de governança de segurança do LeptaSys. Permite ao usuário MASTER habilitar ou revogar permissões granulares para cada usuário ou grupo do sistema, controlando a visibilidade de menus e execução de endpoints.

**Resumo Executivo:** Matriz granular de controle de acesso (RBAC) por funcionalidade e código numérico.

## 2. Regras de Negócio e Políticas Operacionais

- **Controle Baseado em Códigos (RBAC):** Cada módulo possui código específico (ex: 11.1 = Compras, 7.1 = Extratos, 13.1 = Jurídico).
- **Precedência de Master:** Usuários com role MASTER possuem acesso total irrestrito.
- **Herança de Permissões:** O usuário herda todas as permissões concedidas aos grupos dos quais faz parte.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `usuarios_lepta` | Coluna permissions_json armazenando array de permissões atribuídas. |
| `grupos_usuarios` | Permissões atribuídas no nível de grupo corporativo. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/permissions/matrix` | Carrega matriz de todos os usuários x permissões cadastradas. |
| `POST` | `/api/permissions/update` | Salva novas permissões atribuídas a determinado usuário. |

## 5. Especificações de UI/UX & Usabilidade

Matriz interativa com checkboxes rápidos por grupo funcional, busca de usuários e salvamento em lote.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Middleware de autenticação no backend (requirePermission) que checa a existência do código de permissão no array do usuário antes de processar qualquer rota protegida.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
