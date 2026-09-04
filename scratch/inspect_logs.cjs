const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { readonly: true });
try {
  const logs = db.prepare("SELECT * FROM logs ORDER BY id DESC LIMIT 20").all();
  console.log('Recent logs:', logs);
} catch (e) {
  console.log('Error querying logs:', e.message);
}
