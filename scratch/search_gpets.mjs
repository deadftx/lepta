import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

try {
  const row = db.prepare("SELECT documento, api_snapshot_json FROM clientes_cadastro WHERE documento LIKE '%54615431%' OR api_snapshot_json LIKE '%GPETS%' LIMIT 1").get();
  if (row) {
    console.log('Documento:', row.documento);
    console.log('Snapshot (500 chars):', row.api_snapshot_json.substring(0, 500));
    const parsed = JSON.parse(row.api_snapshot_json);
    console.log('Endereco:', parsed?.entidade?.endereco || parsed?.endereco);
  } else {
    console.log('GPETS não encontrado em clientes_cadastro');
  }
} catch (e) {
  console.error(e.message);
}
