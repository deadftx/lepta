# Documentação de Engenharia de Software: Validação de CEPs (CNAB)

> **Módulo do Sistema:** Validação de CEPs (CNAB)  
> **Rota no Sistema:** `/mesa-operacoes/validar-ceps`  
> **Nível de Acesso:** `Permissão 14.2 (Mesa - Validar CEPs)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Varre os cadastros de sacados e cedentes contidos em lotes de títulos para detectar CEPs zerados, incompletos ou inexistentes nos Correios antes do envio ao banco.

**Resumo Executivo:** Saneamento cadastral de endereços e CEPs para evitar rejeição de remessas bancárias.

## 2. Regras de Negócio e Políticas Operacionais

- **Formato Obrigatório:** O CEP deve conter exatamente 8 dígitos numéricos válidos.
- **Higienização Automática:** Remove pontos, traços e espaços.
- **Bloqueio Preventivo:** Alerta os operadores para corrigir o CEP no cadastro antes de gerar a remessa.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `clientes_cadastro` | Consulta e atualização de CEPs dos clientes. |
| `operacoes_titulos` | Verificação dos endereços dos sacados nos títulos. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/operations/validate-ceps` | Identifica títulos ou sacados com inconsistência de CEP. |
| `PUT` | `/api/operations/update-cep` | Permite retificar o CEP diretamente pela interface operacional. |

## 5. Especificações de UI/UX & Usabilidade

Painel de alertas com visualizador de CEPs divergentes e botão de correção inline sem necessidade de navegar até o cadastro geral.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Integração opcional com serviços de busca de logradouro por CEP com fallback local.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
