# Documentação de Engenharia de Software: Consulta SmartFactor

> **Módulo do Sistema:** Consulta SmartFactor  
> **Rota no Sistema:** `/intelligence/consulta-smartfactor`  
> **Nível de Acesso:** `Permissão 8.6 (Intelligence - Consulta SmartFactor)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Permite consultar a base de dados histórica do ecossistema SmartFactor para verificar se determinado CNPJ já operou com outras empresas do grupo, qual o histórico de pontualidade e volumes transacionados.

**Resumo Executivo:** Cruzamento e pesquisa avançada de cedentes e sacados na base SmartFactor.

## 2. Regras de Negócio e Políticas Operacionais

- **Busca por Raiz de CNPJ:** Permite localizar matriz e filiais para verificar endividamento consolidado.
- **Limitação de Visualização:** Dados sensíveis de taxas praticadas são restritos aos perfis de liderança.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `BASE_SMARTFACTOR` | Tabela com registros agregados da base de inteligência SmartFactor. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/intelligence/smartfactor/query` | Executa pesquisa por CNPJ ou Razão Social com paginação. |

## 5. Especificações de UI/UX & Usabilidade

Barra de pesquisa rápida com histórico recente, chips de filtro rápido e cards de resultado com status operacional.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Índices textuais em SQLite para consultas instantâneas em centenas de milhares de linhas.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
