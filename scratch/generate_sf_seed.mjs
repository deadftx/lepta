import Database from 'better-sqlite3';
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

const db = new Database('./database.sqlite');
const rows = db.prepare('SELECT * FROM BASE_SMARTFACTOR').all();
console.log(`Carregadas ${rows.length} linhas de BASE_SMARTFACTOR`);

const jsonStr = JSON.stringify(rows);
const compressed = zlib.gzipSync(jsonStr, { level: 9 });

const outPath = path.resolve('server/internal/modules/intelligence/smartfactor/smartfactor_seed.json.gz');
fs.writeFileSync(outPath, compressed);

console.log(`Arquivo seed gerado com sucesso: ${outPath}`);
console.log(`Tamanho original: ${(jsonStr.length / 1024 / 1024).toFixed(2)} MB`);
console.log(`Tamanho compactado (.gz): ${(compressed.length / 1024 / 1024).toFixed(2)} MB (${(compressed.length / 1024).toFixed(0)} KB)`);
