const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { readonly: true });
try {
  const errs = db.prepare("SELECT * FROM monitor_system_errors ORDER BY id DESC LIMIT 10").all();
  console.log('Errors:', errs);
} catch (e) {
  console.log('Error querying monitor_system_errors:', e.message);
}
