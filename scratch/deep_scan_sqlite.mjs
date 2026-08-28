import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('database.sqlite');
const db = new Database(dbPath);

console.log('=== VARREDURA COMPLETA NO BANCO SQLITE ===\n');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();

const terms = ['maranata', '07991107', '07851963', '07.991.107', '07.851.963', 'coudelaria', 'dray', 'prudente', 'frigofar', 'gocil', 'hidro jet', 'iese', 'venancio', 'pajeu', 'movent', 'polo construcao', 'solida', 'tudo belo', 'volpi'];

for (const t of tables) {
  const tableName = t.name;
  if (tableName.startsWith('sqlite_')) continue;

  const cols = db.prepare(`PRAGMA table_info("${tableName}")`).all();
  const textCols = cols.filter(c => c.type.toUpperCase().includes('TEXT') || c.type.toUpperCase().includes('CHAR') || c.type === '');

  for (const col of textCols) {
    for (const term of terms) {
      try {
        const rows = db.prepare(`SELECT * FROM "${tableName}" WHERE LOWER("${col.name}") LIKE ? LIMIT 5`).all(`%${term}%`);
        if (rows.length > 0) {
          console.log(`[ACHOU!] Tabela: "${tableName}" | Coluna: "${col.name}" | Termo: "${term}" (${rows.length} linhas)`);
          rows.forEach(r => {
            console.log('   -> ', JSON.stringify(r));
          });
        }
      } catch (e) {}
    }
  }
}
