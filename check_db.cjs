const db = require('better-sqlite3')('database.sqlite');
console.log(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all());
try {
  console.log("Count in BASE_NOVA: ", db.prepare("SELECT count(*) as c FROM BASE_NOVA").get());
} catch(e) {
  console.log("Error querying BASE_NOVA:", e.message);
}
