import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

const rows = db.prepare(`
  SELECT id, cedente, credores_de_interesse, estado, tipo_registro, fase_pipeline, valor_considerado
  FROM BASE_NPL
  WHERE cedente IS NULL OR TRIM(cedente) = '' OR LENGTH(TRIM(cedente)) <= 1
`).all();

console.log(`Linhas com cedente vazio/espaço em branco: ${rows.length}`);
rows.forEach(r => {
  console.log(`[ID ${r.id}] tipo: ${r.tipo_registro} | estado: "${r.estado}" | credor: "${r.credores_de_interesse}" | valor: ${r.valor_considerado}`);
});
