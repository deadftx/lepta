const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '..', 'database.sqlite');
const initialSize = fs.statSync(dbPath).size;

console.log(`Starting database maintenance...`);
console.log(`Initial database size: ${(initialSize / 1024 / 1024).toFixed(2)} MB`);

const db = new Database(dbPath);

console.log('Running PRAGMA optimize...');
db.pragma('optimize');

console.log('Running VACUUM (this may take a few seconds)...');
const start = Date.now();
db.exec('VACUUM');
const elapsed = ((Date.now() - start) / 1000).toFixed(2);

db.close();

const finalSize = fs.statSync(dbPath).size;
const savedMb = ((initialSize - finalSize) / 1024 / 1024).toFixed(2);
console.log(`VACUUM completed in ${elapsed}s.`);
console.log(`Final database size: ${(finalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`Space reclaimed: ${savedMb} MB!`);
