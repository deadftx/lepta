# Documentação de Engenharia de Software: Cadastro de Clientes

> **Módulo do Sistema:** Cadastro de Clientes  
> **Rota no Sistema:** `/intelligence/cadastro-clientes`  
> **Nível de Acesso:** `Permissão 8.2 (Intelligence - Cadastro de Clientes)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Gerencia o ciclo de vida do cadastro de novos proponentes a operações de crédito na Lepta Capital, registrando dados societários, fiscais, bancários e documentações constitutivas.

**Resumo Executivo:** Inserção, atualização e manutenção cadastral de clientes PJ e PF.

## 2. Regras de Negócio e Políticas Operacionais

- **Validação de CNPJ/CPF:** Validação algorítmica estrita de dígitos verificadores.
- **Campos Obrigatórios:** Razão social, CNPJ, faturamento anual e endereço completo com CEP.
- **Auditoria de Alteração:** Gravação de quem modificou o cadastro e data da última alteração.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `clientes_cadastro` | Registro cadastral completo com colunas estruturadas. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `POST` | `/api/intelligence/clients` | Insere novo cliente após validação de duplicidade de CNPJ. |
| `PUT` | `/api/intelligence/clients/:id` | Atualiza dados cadastrais existentes. |

## 5. Especificações de UI/UX & Usabilidade

Formulário em steps com validação em tempo real e máscaras de CNPJ, CEP e telefone. Feedback imediato em caso de CNPJ já existente.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Prevenção contra SQL Injection com parâmetros preparados em todas as queries.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
