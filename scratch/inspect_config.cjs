const Database = require('better-sqlite3');
const db = new Database('database.sqlite', { readonly: true });
const configs = db.prepare("SELECT * FROM config").all();
console.log('Configs in database:', configs);
