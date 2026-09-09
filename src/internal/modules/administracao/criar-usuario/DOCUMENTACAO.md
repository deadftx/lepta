# Documentação de Engenharia de Software: Criar Usuário Corporativo

> **Módulo do Sistema:** Criar Usuário Corporativo  
> **Rota no Sistema:** `/permissions/create-user`  
> **Nível de Acesso:** `Role MASTER`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Permite cadastrar novos colaboradores no sistema, definindo nome de usuário, e-mail institucional @lepta.com.br, papel inicial e grupos de trabalho.

**Resumo Executivo:** Provisionamento de novas contas de colaboradores, definição de senhas e grupos iniciais.

## 2. Regras de Negócio e Políticas Operacionais

- **Unicidade de E-mail e Username:** Não é permitido duplicar logins no sistema.
- **Senha Segura:** Hash com bcrypt antes da persistência no banco.
- **Primeiro Acesso:** O usuário é compelido a alterar a senha inicial no primeiro login.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `usuarios_lepta` | Inserção de novos registros com status ATIVO. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `POST` | `/api/users/create` | Cria credencial do novo colaborador com validação de formato e hashing de senha. |

## 5. Especificações de UI/UX & Usabilidade

Formulário moderno com indicadores de força de senha e seleção de grupos iniciais.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Hash criptográfico SHA-256 e Bcrypt com salt para proteção contra vazamento de credenciais.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
