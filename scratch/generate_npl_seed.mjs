import Database from 'better-sqlite3';
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

const db = new Database('./database.sqlite');
const rows = db.prepare('SELECT * FROM BASE_NPL').all();
console.log(`Carregadas ${rows.length} linhas de BASE_NPL`);

const jsonStr = JSON.stringify(rows);
const compressed = zlib.gzipSync(jsonStr, { level: 9 });

const outPath = path.resolve('server/internal/modules/intelligence/npl/npl_seed.json.gz');
fs.writeFileSync(outPath, compressed);

console.log(`Arquivo seed gerado com sucesso: ${outPath} (${(compressed.length / 1024).toFixed(0)} KB)`);
