import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Database from 'better-sqlite3';

const basePath = path.resolve('SmartFactor/backup_4055_270826');
const dbPath = path.resolve('database.sqlite');
const db = new Database(dbPath);

console.log('=== VERIFICAÇÃO DE TÍTULOS DO SMARTFACTOR CONTRA ESTOQUE_TITULOS (BITFIN) ===\n');

// 1. Ver colunas de estoque_titulos
const cols = db.prepare("PRAGMA table_info(estoque_titulos)").all();
console.log('Colunas em estoque_titulos:', cols.map(c => c.name).join(', '));

// 2. Testar cruzamento por documento / nosso número
const titPath = path.join(basePath, 'titulos.csv');
const titStream = fs.createReadStream(titPath, { encoding: 'latin1' });
const titRl = readline.createInterface({ input: titStream, crlfDelay: Infinity });

let lineCount = 0;
let checked = 0;
let foundInEstoque = 0;
let sampleMatches = [];
let sampleNotMatches = [];

// Prepare query
const checkStmt = db.prepare(`
  SELECT id, numero_titulo, valor_nominal_atual, data_vencimento, cedente_nome
  FROM estoque_titulos 
  WHERE numero_titulo = ?
  LIMIT 1
`);

for await (const line of titRl) {
  lineCount++;
  if (lineCount === 1) continue;
  if (checked >= 1000) break; // Amostra de 1.000 títulos para teste rápido

  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  const numDoc = c[9];
  const nossoNum = c[10];
  const vFace = c[12];
  const dtVenc = c[11];

  if (numDoc || nossoNum) {
    checked++;
    const row = checkStmt.get(numDoc) || (nossoNum ? checkStmt.get(nossoNum) : null);
    if (row) {
      foundInEstoque++;
      if (sampleMatches.length < 5) {
        sampleMatches.push({ sfNum: numDoc, sfNosso: nossoNum, dbRow: row });
      }
    } else {
      if (sampleNotMatches.length < 5) {
        sampleNotMatches.push({ sfNum: numDoc, sfNosso: nossoNum, vFace, dtVenc });
      }
    }
  }
}

console.log(`\nResultado da Amostra (${checked} títulos testados do SmartFactor):`);
console.log(`  -> Títulos ENCONTRADOS no estoque BitFin: ${foundInEstoque} (${((foundInEstoque / checked) * 100).toFixed(1)}%)`);
console.log(`  -> Títulos NÃO ENCONTRADOS (Legados exclusivos SF): ${checked - foundInEstoque} (${(((checked - foundInEstoque) / checked) * 100).toFixed(1)}%)`);

if (sampleMatches.length > 0) {
  console.log(`\nExemplos de Títulos Encontrados em Ambas as Bases:`);
  sampleMatches.forEach(m => console.log(`  - Doc: ${m.sfNum} | NossoNum: ${m.sfNosso} | BitFin ID: ${m.dbRow.id}`));
}

if (sampleNotMatches.length > 0) {
  console.log(`\nExemplos de Títulos Exclusivos do SmartFactor (Não constam no estoque BitFin):`);
  sampleNotMatches.forEach(m => console.log(`  - Doc: ${m.sfNum} | NossoNum: ${m.sfNosso} | Venc: ${m.dtVenc} | Valor: ${m.vFace}`));
}
