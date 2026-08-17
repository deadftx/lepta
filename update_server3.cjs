const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

// Clientes Query
const wrongQueryClientes = `SELECT 
           CLIENTE as cedente,
           COUNT(ID) as qtdTitulos,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN 1 ELSE 0 END) as qtdLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' THEN 1 ELSE 0 END) as qtdAberto,
           SUM(CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL)) as valorGeral,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN CAST(REPLACE(REPLACE(VALOR_LIQUIDO, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' AND VENCIDO = 'Nao' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorAberto
        FROM "BASE_NOVA"
        WHERE CLIENTE IS NOT NULL AND CLIENTE != '' \${dateFilter}
      GROUP BY CLIENTE`;

const correctQueryClientes = `SELECT 
            CLIENTE as cedente,
            COUNT(ID) as qtdTitulos,
            SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
            SUM(CASE WHEN SITUACAO LIKE '%liquidado%' THEN 1 ELSE 0 END) as qtdLiquidado,
            SUM(CASE WHEN SITUACAO LIKE '%ABERTO%' AND VENCIDO = 'Nao' THEN 1 ELSE 0 END) as qtdAberto,
            SUM(VALOR_NOMINAL) as valorGeral,
            SUM(CASE WHEN VENCIDO = 'Sim' THEN VALOR_NOMINAL ELSE 0 END) as valorVencido,
            SUM(CASE WHEN SITUACAO LIKE '%liquidado%' THEN VALOR_LIQUIDO ELSE 0 END) as valorLiquidado,
            SUM(CASE WHEN SITUACAO LIKE '%ABERTO%' AND VENCIDO = 'Nao' THEN VALOR_NOMINAL ELSE 0 END) as valorAberto
          FROM "BASE_NOVA"
          WHERE CLIENTE IS NOT NULL AND CLIENTE != '' \${dateFilter}
        GROUP BY CLIENTE`;

// Sacados Query
const wrongQuerySacados = `SELECT 
           SACADO as sacado,
           COUNT(ID) as qtdTitulos,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN 1 ELSE 0 END) as qtdLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' THEN 1 ELSE 0 END) as qtdAberto,
           SUM(CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL)) as valorGeral,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN CAST(REPLACE(REPLACE(VALOR_LIQUIDO, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' AND VENCIDO = 'Nao' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorAberto
        FROM "BASE_NOVA"
        WHERE CLIENTE = ? AND SACADO IS NOT NULL AND SACADO != '' \${dateFilter}
      GROUP BY SACADO
      ORDER BY valorGeral DESC`;

const correctQuerySacados = `SELECT 
            SACADO as sacado,
            COUNT(ID) as qtdTitulos,
            SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
            SUM(CASE WHEN SITUACAO LIKE '%liquidado%' THEN 1 ELSE 0 END) as qtdLiquidado,
            SUM(CASE WHEN SITUACAO LIKE '%ABERTO%' AND VENCIDO = 'Nao' THEN 1 ELSE 0 END) as qtdAberto,
            SUM(VALOR_NOMINAL) as valorGeral,
            SUM(CASE WHEN VENCIDO = 'Sim' THEN VALOR_NOMINAL ELSE 0 END) as valorVencido,
            SUM(CASE WHEN SITUACAO LIKE '%liquidado%' THEN VALOR_LIQUIDO ELSE 0 END) as valorLiquidado,
            SUM(CASE WHEN SITUACAO LIKE '%ABERTO%' AND VENCIDO = 'Nao' THEN VALOR_NOMINAL ELSE 0 END) as valorAberto
          FROM "BASE_NOVA"
          WHERE CLIENTE = ? AND SACADO IS NOT NULL AND SACADO != '' \${dateFilter}
        GROUP BY SACADO
        ORDER BY valorGeral DESC`;

// UA Query
const wrongQueryUA = `SELECT 
           UA as ua,
           COUNT(ID) as qtdTitulos,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN 1 ELSE 0 END) as qtdLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' THEN 1 ELSE 0 END) as qtdAberto,
           SUM(CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL)) as valorGeral,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN CAST(REPLACE(REPLACE(VALOR_LIQUIDO, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' AND VENCIDO = 'Nao' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorAberto
        FROM "BASE_NOVA"
        WHERE CLIENTE = ? AND UA IS NOT NULL AND UA != '' \${dateFilter}
      GROUP BY UA
      ORDER BY valorGeral DESC`;

const correctQueryUA = `SELECT 
            UA as ua,
            COUNT(ID) as qtdTitulos,
            SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
            SUM(CASE WHEN SITUACAO LIKE '%liquidado%' THEN 1 ELSE 0 END) as qtdLiquidado,
            SUM(CASE WHEN SITUACAO LIKE '%ABERTO%' AND VENCIDO = 'Nao' THEN 1 ELSE 0 END) as qtdAberto,
            SUM(VALOR_NOMINAL) as valorGeral,
            SUM(CASE WHEN VENCIDO = 'Sim' THEN VALOR_NOMINAL ELSE 0 END) as valorVencido,
            SUM(CASE WHEN SITUACAO LIKE '%liquidado%' THEN VALOR_LIQUIDO ELSE 0 END) as valorLiquidado,
            SUM(CASE WHEN SITUACAO LIKE '%ABERTO%' AND VENCIDO = 'Nao' THEN VALOR_NOMINAL ELSE 0 END) as valorAberto
          FROM "BASE_NOVA"
          WHERE CLIENTE = ? AND UA IS NOT NULL AND UA != '' \${dateFilter}
        GROUP BY UA
        ORDER BY valorGeral DESC`;

code = code.replace(wrongQueryClientes, correctQueryClientes);
code = code.replace(wrongQuerySacados, correctQuerySacados);
code = code.replace(wrongQueryUA, correctQueryUA);

fs.writeFileSync('server.js', code);
