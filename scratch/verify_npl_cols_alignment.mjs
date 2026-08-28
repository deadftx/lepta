import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

console.log('=== VERIFICAÇÃO DE ALINHAMENTO DE COLUNAS EM BASE_NPL ===\n');

const sampleFechado = db.prepare(`
  SELECT * FROM BASE_NPL WHERE tipo_registro = 'FECHADO' LIMIT 3
`).all();

console.log('--- AMOSTRA CASOS FECHADOS ---');
console.log(JSON.stringify(sampleFechado, null, 2));

const samplePipeline = db.prepare(`
  SELECT * FROM BASE_NPL WHERE tipo_registro = 'PIPELINE' LIMIT 3
`).all();

console.log('\n--- AMOSTRA PIPELINE ---');
console.log(JSON.stringify(samplePipeline, null, 2));
