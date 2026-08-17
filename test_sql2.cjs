const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
try {
const queryNova = `SELECT SUM(CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL)) as val FROM BASE_NOVA`;
console.log(db.prepare(queryNova).get());
} catch (e) { console.error('SQL ERROR:', e.message); }
