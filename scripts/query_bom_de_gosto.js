import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

console.log('--- BUSCANDO POR "BOM DE GOSTO" NO BANCO LOCAL ---');

// 1. Busca em estoque_titulos
try {
  const titulos = db.prepare(`
    SELECT DISTINCT cedente_cnpj, cedente_nome 
    FROM estoque_titulos 
    WHERE cedente_nome LIKE '%bom%gosto%'
  `).all();
  console.log('Resultados em estoque_titulos:', titulos);
} catch (e) {
  console.error('Erro estoque_titulos:', e.message);
}

// 2. Busca em clientes_cadastro
try {
  const cadastros = db.prepare(`
    SELECT documento, override_json, api_snapshot_json 
    FROM clientes_cadastro 
    WHERE api_snapshot_json LIKE '%bom%gosto%' OR override_json LIKE '%bom%gosto%'
  `).all();
  console.log('Resultados em clientes_cadastro:', cadastros.length);
  cadastros.forEach(c => {
    console.log(c.documento);
  });
} catch (e) {
  console.error('Erro clientes_cadastro:', e.message);
}
