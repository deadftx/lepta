const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { readonly: true });

const snapCount = db.prepare("SELECT count(*) as c, min(data_posicao) as min_dt, max(data_posicao) as max_dt FROM estoque_snapshots").get();
console.log("Snapshots:", snapCount);

const titulosSummary = db.prepare(`
  SELECT fundo_id, min(data_posicao) as min_pos, max(data_posicao) as max_pos, count(*) as count 
  FROM estoque_titulos 
  GROUP BY fundo_id
`).all();
console.log("Titulos por fundo:", titulosSummary);

// Tamanho estimado de cada tabela usando dbstat se disponível
try {
  const tableSizes = db.prepare(`
    SELECT name, sum(pgsize) / (1024*1024) as size_mb
    FROM dbstat
    GROUP BY name
    ORDER BY size_mb DESC
    LIMIT 10
  `).all();
  console.log("Maiores tabelas em MB:", tableSizes);
} catch(e) {
  console.log("dbstat não disponível:", e.message);
}

db.close();
