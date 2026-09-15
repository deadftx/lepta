const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { readonly: true });

try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  const results = [];
  for (const t of tables) {
    try {
      const count = db.prepare(`SELECT count(*) as cnt FROM "${t.name}"`).get().cnt;
      results.push({ name: t.name, count });
    } catch (err) {
      results.push({ name: t.name, count: 'error: ' + err.message });
    }
  }
  results.sort((a, b) => (typeof b.count === 'number' ? b.count : 0) - (typeof a.count === 'number' ? a.count : 0));
  console.log("=== TABELAS NO DATABASE.SQLITE ===");
  console.table(results);
  
  // Pragmas
  const journalMode = db.prepare("PRAGMA journal_mode").get();
  const synchronous = db.prepare("PRAGMA synchronous").get();
  const cacheSize = db.prepare("PRAGMA cache_size").get();
  const pageCount = db.prepare("PRAGMA page_count").get();
  const pageSize = db.prepare("PRAGMA page_size").get();
  const freelistCount = db.prepare("PRAGMA freelist_count").get();
  console.log("\n=== PRAGMAS ATUAIS ===");
  console.log({ journalMode, synchronous, cacheSize, pageCount, pageSize, freelistCount });

  // Indexes
  const indexes = db.prepare("SELECT tbl_name, name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'").all();
  console.log("\n=== TOTAL DE ÍNDICES MANUAIS ===", indexes.length);

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
