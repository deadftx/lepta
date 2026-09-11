import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');
try {
  const tabs = db.prepare("SELECT * FROM API_SYNC_TABELAS").all();
  console.log('Tabs:', tabs);
} catch (e) {
  console.log(e.message);
}
