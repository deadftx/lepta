import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

console.log('--- Buscando tabelas e colunas com esses valores ---');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

for (const t of tables) {
  try {
    const rows = db.prepare(`SELECT * FROM ${t.name}`).all();
    for (const r of rows) {
      for (const [k, v] of Object.entries(r)) {
        if (typeof v === 'string' && (v.includes('GOIAS, GOIÁS') || v.includes('MINAS GERAIS, SÃO PAULO') || v.includes('RIO GRANDE DO SUL, PARÁ'))) {
          console.log(`Encontrado na tabela [${t.name}], coluna [${k}]: "${v}" | ID/Row:`, r);
        }
      }
    }
  } catch (err) {}
}
