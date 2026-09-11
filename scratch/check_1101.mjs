import Database from 'better-sqlite3';
const db = new Database('database.sqlite');

const rows = db.prepare("SELECT * FROM estoque_titulos WHERE numero_titulo LIKE '1101/%' AND cedente_cnpj LIKE '%54615431%'").all();
console.log('Found 1101 in estoque_titulos count:', rows.length);
if (rows.length > 0) {
  console.log('Sample row:', JSON.stringify(rows[0], null, 2));
  console.log('All numbers:', rows.map(r => `${r.numero_titulo} - ${r.valor_nominal_original} - ${r.sacado_nome}`));
}
