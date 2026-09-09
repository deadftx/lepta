# Documentação de Engenharia de Software: Análise de Operação (Mesa de Operações)

> **Módulo do Sistema:** Análise de Operação (Mesa de Operações)  
> **Rota no Sistema:** `/mesa-operacoes/analise`  
> **Nível de Acesso:** `Permissão 14.1 (Mesa - Análise de Operação)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Coração operacional da Lepta Capital. Permite que os operadores da mesa analisem propostas de borderô, auditem número bancário via integração direta com a API da Bitfin, verifiquem limites e exportem arquivos de remessa bancária no padrão CNAB 400 posições.

**Resumo Executivo:** Análise técnica de borderôs, consulta de número bancário via Bitfin e exportação CNAB 400.

## 2. Regras de Negócio e Políticas Operacionais

- **Consulta Bitfin:** Extrai detalhes dos títulos (nosso número, vencimento, valor, número bancário) para homologação com o banco.
- **Exportação CNAB 400:** Gera arquivo de remessa padronizado de 400 posições para Bradesco e bancos parceiros com modal de confirmação.
- **Aprovação da Mesa:** Bloqueia exportação se existirem títulos com CEP inválido ou divergência de valor.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `operacoes` | Tabela de operações de crédito e borderôs em análise. |
| `operacoes_titulos` | Detalhamento de cada duplicata/título pertencente ao borderô. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/operations/analysis` | Carrega borderôs e títulos pendentes de processamento. |
| `POST` | `/api/operations/bitfin/query` | Consulta externa à API Bitfin para obtenção do número bancário. |
| `POST` | `/api/operations/export-cnab` | Gera e baixa o arquivo CNAB 400 posições. |

## 5. Especificações de UI/UX & Usabilidade

Modal de exportação CNAB que se sobrepõe com prioridade à tela de detalhes, badges de status de conferência e botões de ação rápida.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Parser e formatador de texto posicional com preenchimento exato de 400 caracteres por linha, cálculo de DV e zeros à esquerda.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
