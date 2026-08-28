import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

console.log('=== INSPEÇÃO DOS CEDENTES EM BASE_NPL ===\n');

const rows = db.prepare(`
  SELECT id, cedente, credores_de_interesse, estado, tipo_registro, fase_pipeline
  FROM BASE_NPL
  LIMIT 30
`).all();

rows.forEach(r => {
  console.log(`[ID ${r.id}] cedente: "${r.cedente}" | credores: "${r.credores_de_interesse}" | estado: "${r.estado}" | tipo: ${r.tipo_registro}`);
});

console.log('\n--- Casos onde cedente parece ser estado ---');
const badRows = db.prepare(`
  SELECT id, cedente, credores_de_interesse, estado, observacoes
  FROM BASE_NPL
  WHERE LOWER(cedente) LIKE '%goias%' OR LOWER(cedente) LIKE '%mato grosso%' OR LOWER(cedente) LIKE '%minas%' OR LOWER(cedente) LIKE '%são paulo%'
`).all();

badRows.forEach(r => {
  console.log(`[BAD ID ${r.id}] cedente: "${r.cedente}" | credores: "${r.credores_de_interesse}" | estado: "${r.estado}"`);
});
