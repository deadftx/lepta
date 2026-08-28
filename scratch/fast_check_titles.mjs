import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Database from 'better-sqlite3';

const basePath = path.resolve('SmartFactor/backup_4055_270826');
const dbPath = path.resolve('database.sqlite');
const db = new Database(dbPath);

console.log('=== TESTE RÁPIDO OTIMIZADO DE TÍTULOS ===\n');

// Pegar amostra de 30 números de títulos do SmartFactor
const titPath = path.join(basePath, 'titulos.csv');
const titStream = fs.createReadStream(titPath, { encoding: 'latin1' });
const titRl = readline.createInterface({ input: titStream, crlfDelay: Infinity });

const sampleTitles = [];
let lineCount = 0;

for await (const line of titRl) {
  lineCount++;
  if (lineCount === 1) continue;
  if (sampleTitles.length >= 30) break;
  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  const numDoc = c[9];
  const nossoNum = c[10];
  const vFace = c[12];
  if (numDoc) sampleTitles.push({ numDoc, nossoNum, vFace });
}

console.log(`Amostra coletada: ${sampleTitles.length} títulos do SmartFactor`);

// Query rápida usando IN
const docs = sampleTitles.map(t => t.numDoc).filter(Boolean);
const placeholders = docs.map(() => '?').join(',');

const matches = db.prepare(`
  SELECT id, numero_titulo, valor_nominal_atual, data_vencimento, cedente_nome
  FROM estoque_titulos 
  WHERE numero_titulo IN (${placeholders})
`).all(...docs);

console.log(`Títulos encontrados no BitFin estoque_titulos: ${matches.length} de ${docs.length}`);
if (matches.length > 0) {
  matches.forEach(m => console.log(`  - Match Bitfin: ${m.numero_titulo} | Cedente: ${m.cedente_nome} | Valor: ${m.valor_nominal_atual}`));
} else {
  console.log(`Nenhum título dessa amostra está presente na tabela de estoque atual do BitFin.`);
}
