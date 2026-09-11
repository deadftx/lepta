import Database from 'better-sqlite3';
const db = new Database('database.sqlite');

const row = db.prepare("SELECT * FROM estoque_titulos WHERE numero_titulo LIKE '%1101%' LIMIT 5").all();
console.log('Found 1101 in estoque_titulos:', JSON.stringify(row, null, 2));

const byGpets = db.prepare("SELECT * FROM estoque_titulos WHERE cedente_nome LIKE '%GPETS%' OR sacado_nome LIKE '%GPETS%' LIMIT 3").all();
console.log('Found GPETS in estoque_titulos:', JSON.stringify(byGpets, null, 2));
