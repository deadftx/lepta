const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
const startDate = '2026-08-01';
const endDate = '2026-08-24';
const dateFilter = ` AND (substr(VENCIMENTO, 7, 4) || '-' || substr(VENCIMENTO, 4, 2) || '-' || substr(VENCIMENTO, 1, 2)) BETWEEN '${startDate}' AND '${endDate}' `;
try {
const queryNova = `
        SELECT 
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
        WHERE CLIENTE IS NOT NULL AND CLIENTE != '' ${dateFilter}
      GROUP BY CLIENTE
      `;
      console.log('SUCCESS, length:', db.prepare(queryNova).all().length);
} catch (e) { console.error('SQL ERROR:', e.message); }
