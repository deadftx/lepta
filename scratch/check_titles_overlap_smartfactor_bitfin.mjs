import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Database from 'better-sqlite3';

const basePath = path.resolve('SmartFactor/backup_4055_270826');
const dbPath = path.resolve('database.sqlite');
const db = new Database(dbPath);

console.log('=== ANÁLISE DE TÍTULOS E OPERAÇÕES: SMARTFACTOR vs BITFIN ===\n');

// 1. Verificar se no banco temos tabelas de títulos ou operações da API Bitfin
const estoqueTitulos = db.prepare("SELECT COUNT(*) as c FROM estoque_titulos").get()?.c || 0;
const carteiraDc = db.prepare("SELECT COUNT(*) as c FROM carteira_dc").get()?.c || 0;

console.log(`Estoque de Títulos no Banco Local BitFin: ${estoqueTitulos.toLocaleString('pt-BR')} registros`);
console.log(`Carteira DC no Banco Local BitFin: ${carteiraDc.toLocaleString('pt-BR')} registros`);

// 2. Analisar períodos das operações do SmartFactor por Cedente
const opPath = path.join(basePath, 'opconvencional.csv');
const opStream = fs.createReadStream(opPath, { encoding: 'latin1' });
const opRl = readline.createInterface({ input: opStream, crlfDelay: Infinity });

let totalOps = 0;
let totalValorBruto = 0;
let minDataOp = '9999-99-99';
let maxDataOp = '0000-00-00';

for await (const line of opRl) {
  totalOps++;
  if (totalOps === 1) continue;
  const cols = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  const data = cols[2]; // DD/MM/YYYY
  const vFator = parseFloat((cols[5] || '0').replace(/\./g, '').replace(',', '.')) || 0;
  totalValorBruto += vFator;

  if (data && data.includes('/')) {
    const parts = data.split('/');
    if (parts.length === 3) {
      const iso = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      if (iso < minDataOp) minDataOp = iso;
      if (iso > maxDataOp) maxDataOp = iso;
    }
  }
}

console.log(`\nResumo Geral de Operações SmartFactor:`);
console.log(`  - Total de Operações: ${(totalOps - 1).toLocaleString('pt-BR')}`);
console.log(`  - Período de Operações: de ${minDataOp} até ${maxDataOp}`);
console.log(`  - Valor Fator Bruto: R$ ${totalValorBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
