# Documentação de Engenharia de Software: Análise de Vencidos (Cobrança)

> **Módulo do Sistema:** Análise de Vencidos (Cobrança)  
> **Rota no Sistema:** `/cobranca/analise-vencidos`  
> **Nível de Acesso:** `Permissão 12.1 (Cobrança - Análise de Vencidos)`  
> **Data de Atualização:** Março/2026 | Versão 2.4.0

---

## 1. Visão Geral & Finalidade

Permite ao time de cobrança contatar sacados de títulos em atraso, registrando acordos, promessas de pagamento e emitindo boletos com atualização de encargos moratórios.

**Resumo Executivo:** Régua de cobrança ativa, acompanhamento de títulos em aberto e relatórios operacionais.

## 2. Regras de Negócio e Políticas Operacionais

- **Cálculo de Juros e Multa:** Aplicação diária da taxa de permanência contratual e multa sobre o principal.
- **Agendamento de Retorno:** Permite agendar data para novo contato caso o sacado solicite prazo.
- **Exportação Operacional:** Geração de planilhas para envio a escritórios de cobrança terceirizados.

## 3. Engenharia de Banco de Dados (SQLite)

O módulo interage diretamente com as seguintes tabelas estruturadas na base de dados:

| Tabela | Descrição e Finalidade no Módulo |
|---|---|
| `cobranca_titulos` | Títulos vencidos em cobrança. |
| `cobranca_ocorrencias` | Registro de contatos e promessas de pagamento. |

## 4. Endpoints de API & Integrações Backend

Rotas consumidas e expostas pelo backend Node.js / Express para este módulo:

| Método | Endpoint | Descrição da Operação |
|---|---|---|
| `GET` | `/api/cobranca/overdue` | Lista títulos vencidos agrupados por sacado ou cedente. |
| `POST` | `/api/cobranca/occurrence` | Registra ocorrência de contato telefônico ou por e-mail. |

## 5. Especificações de UI/UX & Usabilidade

Visão resumida com valor total em atraso, número de sacados inadimplentes e filtros por faixa de dias de mora.

## 6. Arquitetura Técnica & Detalhes de Engenharia

Uso de rotinas em lote para recalcular o valor atualizado da dívida em frações de segundo.

---
*Documentação técnica confidencial - Lepta Capital © 2026. Todos os direitos reservados.*
