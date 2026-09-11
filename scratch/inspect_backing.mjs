import Database from 'better-sqlite3';
const db = new Database('database.sqlite');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Total tables:', tables.length);
const relevant = tables.filter(t => /unltd|titul|doc|lastro|smart|receb/i.test(t.name));
console.log('Relevant tables:', relevant.map(t => t.name));

for (const t of relevant) {
  try {
    const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get();
    console.log(`Table ${t.name}: ${count.c} rows`);
  } catch (e) {
    console.log(`Table ${t.name}: error ${e.message}`);
  }
}
