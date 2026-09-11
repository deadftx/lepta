import Database from 'better-sqlite3';

const db = new Database('./database.sqlite', { readonly: true });
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

for (const t of ['titulos_importados', 'BASE_SMARTFACTOR', 'configuracoes']) {
  try {
    const count = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get();
    console.log(`${t} count:`, count.c);
    const sample = db.prepare(`SELECT * FROM ${t} LIMIT 1`).get();
    console.log(`${t} sample keys:`, Object.keys(sample || {}));
  } catch (e) {
    console.log(`${t} err:`, e.message);
  }
}
