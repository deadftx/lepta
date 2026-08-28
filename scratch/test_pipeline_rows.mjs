import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

console.log('=== TESTE DE REGISTROS PIPELINE EM BASE_NPL ===\n');

const pipelineRows = db.prepare(`
  SELECT id, cedente, credores_de_interesse, estado, tipo_registro, fase_pipeline, valor_considerado, credito_rj
  FROM BASE_NPL
  WHERE tipo_registro = 'PIPELINE'
  LIMIT 25
`).all();

pipelineRows.forEach(r => {
  console.log(`[ID ${r.id}] cedente: "${r.cedente}" | credor: "${r.credores_de_interesse}" | estado: "${r.estado}" | valor: ${r.valor_considerado}`);
});
