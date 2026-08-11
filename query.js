import Database from 'better-sqlite3';
const db = new Database('database.sqlite');
const res = db.prepare(`SELECT CLIENTE, SUM(VALOR) as s, COUNT(*) as c FROM "BASE" WHERE CLIENTE LIKE '%Sulina%' GROUP BY CLIENTE`).all();
console.log(res);
