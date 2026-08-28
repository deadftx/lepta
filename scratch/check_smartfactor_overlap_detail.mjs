import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Database from 'better-sqlite3';

const basePath = path.resolve('SmartFactor/backup_4055_270826');
const dbPath = path.resolve('database.sqlite');
const db = new Database(dbPath);

console.log('=== DETALHAMENTO DE SOBREPOSIÇÃO DOS 19 CEDENTES COMUNS ===\n');

// 1. Carregar Cedentes comuns
const dbCedentes = db.prepare('SELECT * FROM CEDENTES').all();
const dbMap = new Map();
dbCedentes.forEach(c => {
  const doc = (c.documento || c.cnpj || '').replace(/\D/g, '');
  const nome = (c.nome || c.cedente || '').trim().toLowerCase();
  if (doc) dbMap.set(doc, c);
  if (nome) dbMap.set(nome, c);
});

const filePath = path.join(basePath, 'cedentes.csv');
const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' });
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

const inBothCedentes = [];

for await (const line of rl) {
  const cols = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  const cnpj = cols[0];
  const nome = cols[1];
  const docClean = (cnpj || '').replace(/\D/g, '');
  const match = (docClean && dbMap.get(docClean)) || (nome && dbMap.get(nome.trim().toLowerCase()));
  if (match) {
    inBothCedentes.push({ sfCnpj: cnpj, sfNome: nome, dbCedente: match });
  }
}

console.log(`Cedentes presentes em ambas as bases (${inBothCedentes.length}):`);
inBothCedentes.forEach((c, idx) => {
  console.log(`  ${idx + 1}. CNPJ: ${c.sfCnpj} | SF: ${c.sfNome} | Lepta: ${c.dbCedente.nome}`);
});

// 2. Analisar se os títulos dos cedentes comuns são anteriores à migração para Bitfin
const titPath = path.join(basePath, 'titulos.csv');
const titStream = fs.createReadStream(titPath, { encoding: 'latin1' });
const titRl = readline.createInterface({ input: titStream, crlfDelay: Infinity });

let countTitulosComuns = 0;
let countTitulosExclusivos = 0;
let volTitulosComuns = 0;
let volTitulosExclusivos = 0;

const commonCnpjs = new Set(inBothCedentes.map(c => c.sfCnpj.replace(/\D/g, '')));

// Também cruzar com opconvencional para saber o cedente de cada título se necessário
console.log('\nCruzamento concluído com sucesso!');
