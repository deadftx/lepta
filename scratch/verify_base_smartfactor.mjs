import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

console.log('=== VALIDAÇÃO DA TABELA BASE_SMARTFACTOR ===\n');

const topCedentes = db.prepare(`
  SELECT 
    CLIENTE,
    DOCUMENTO,
    COUNT(*) as qtdTitulos,
    SUM(VALOR_NOMINAL) as totalNominal,
    SUM(VALOR_LIQUIDO) as totalLiquido,
    SUM(VALOR_PAGO) as totalPago,
    MIN(EMISSAO) as primeiraOp,
    MAX(VENCIMENTO) as ultimoVenc
  FROM BASE_SMARTFACTOR
  GROUP BY CLIENTE
  ORDER BY totalNominal DESC
  LIMIT 10
`).all();

console.log('Top 10 Cedentes por Volume na BASE_SMARTFACTOR:');
topCedentes.forEach((c, i) => {
  console.log(`[${i + 1}] ${c.CLIENTE} (${c.DOCUMENTO})`);
  console.log(`     Títulos: ${c.qtdTitulos.toLocaleString('pt-BR')} | Total Face: R$ ${c.totalNominal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Período: ${c.primeiraOp} a ${c.ultimoVenc}\n`);
});

const sample = db.prepare('SELECT * FROM BASE_SMARTFACTOR LIMIT 2').all();
console.log('Amostra de registros na BASE_SMARTFACTOR:');
console.log(JSON.stringify(sample, null, 2));
