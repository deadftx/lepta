import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Database from 'better-sqlite3';

const basePath = path.resolve('SmartFactor/backup_4055_270826');
const dbPath = path.resolve('database.sqlite');
const db = new Database(dbPath);

console.log('=== ANÁLISE DETALHADA: SMARTFACTOR vs BITFIN/LEPTA ===\n');

// 1. Verificar tabelas no banco local
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tabelas no SQLite local:', tables.map(t => t.name).join(', '));

// 2. Analisar Cedentes SmartFactor
async function analyzeCedentes() {
  const filePath = path.join(basePath, 'cedentes.csv');
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const sfCedentes = [];
  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;
    const cols = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
    const cnpj = cols[0];
    const nome = cols[1];
    const setor = cols[10];
    const grupo = cols[12];
    const dataCad = cols[9];
    if (cnpj || nome) {
      sfCedentes.push({ cnpj, nome, setor, grupo, dataCad, docClean: (cnpj || '').replace(/\D/g, '') });
    }
  }

  console.log(`\n==============================================`);
  console.log(`[1. CEDENTES NO SMARTFACTOR]: ${sfCedentes.length} cedentes cadastrados`);

  // Cruzar com CEDENTES no SQLite
  const dbCedentesCols = db.prepare("PRAGMA table_info(CEDENTES)").all();
  console.log('Colunas CEDENTES:', dbCedentesCols.map(c => c.name).join(', '));

  const dbCedentes = db.prepare('SELECT * FROM CEDENTES').all();
  console.log(`[1. CEDENTES NO BITFIN / LEPTA]: ${dbCedentes.length} registros`);

  const dbMap = new Map();
  dbCedentes.forEach(c => {
    const doc = (c.documento || c.cnpj || '').replace(/\D/g, '');
    const nome = (c.nome || c.cedente || '').trim().toLowerCase();
    if (doc) dbMap.set(doc, c);
    if (nome) dbMap.set(nome, c);
  });

  let matchCount = 0;
  const onlyInSmartFactor = [];
  const inBoth = [];

  for (const sf of sfCedentes) {
    const match = (sf.docClean && dbMap.get(sf.docClean)) || (sf.nome && dbMap.get(sf.nome.trim().toLowerCase()));
    if (match) {
      matchCount++;
      inBoth.push({ sf, db: match });
    } else {
      onlyInSmartFactor.push(sf);
    }
  }

  console.log(`  -> Presentes em AMBOS (SmartFactor + BitFin): ${matchCount} (${((matchCount / sfCedentes.length) * 100).toFixed(1)}%)`);
  console.log(`  -> Exclusivos do SmartFactor (Legados não cadastrados no BitFin): ${onlyInSmartFactor.length} (${((onlyInSmartFactor.length / sfCedentes.length) * 100).toFixed(1)}%)`);

  console.log(`\nExemplos de Cedentes Exclusivos do SmartFactor:`);
  onlyInSmartFactor.slice(0, 10).forEach((c, idx) => {
    console.log(`  ${idx + 1}. CNPJ: ${c.cnpj} | Nome: ${c.nome} | Data Cad: ${c.dataCad}`);
  });

  return { sfCedentes, onlyInSmartFactor, inBoth };
}

// 3. Analisar Sacados SmartFactor
async function analyzeSacados() {
  const filePath = path.join(basePath, 'sacados.csv');
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  const sfSacados = new Map();

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;
    const cols = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
    const cnpj = cols[0];
    const nome = cols[1];
    const cidade = cols[6];
    const uf = cols[7];
    if (cnpj) {
      sfSacados.set(cnpj.replace(/\D/g, ''), { cnpj, nome, cidade, uf });
    }
  }

  console.log(`\n==============================================`);
  console.log(`[2. SACADOS NO SMARTFACTOR]: ${sfSacados.size} sacados únicos cadastrados`);
}

// 4. Analisar Operações SmartFactor (opconvencional.csv)
async function analyzeOperacoes() {
  const filePath = path.join(basePath, 'opconvencional.csv');
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  let minData = '99/99/9999';
  let maxData = '00/00/0000';
  const opPorCedente = new Map();
  const anosMap = new Map();

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;
    const cols = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
    const idOp = cols[0];
    const cnpjCedente = (cols[1] || '').replace(/\D/g, '');
    const data = cols[2]; // DD/MM/YYYY
    const valorFator = parseFloat((cols[5] || '0').replace(/\./g, '').replace(',', '.')) || 0;

    if (data && data.includes('/')) {
      const ano = data.split('/')[2];
      if (ano) anosMap.set(ano, (anosMap.get(ano) || 0) + 1);
    }

    opPorCedente.set(cnpjCedente, (opPorCedente.get(cnpjCedente) || 0) + 1);
  }

  console.log(`\n==============================================`);
  console.log(`[3. OPERAÇÕES CONVENCIONAIS NO SMARTFACTOR]: ${(lineCount - 1).toLocaleString('pt-BR')} operações`);
  console.log(`Distribuição de Operações por Ano no SmartFactor:`);
  const sortedAnos = Array.from(anosMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  sortedAnos.forEach(([ano, qtd]) => {
    console.log(`  - Ano ${ano}: ${qtd.toLocaleString('pt-BR')} operações`);
  });
}

// 5. Analisar Títulos SmartFactor (titulos.csv)
async function analyzeTitulos() {
  const filePath = path.join(basePath, 'titulos.csv');
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  let totalFace = 0;
  let totalOperado = 0;
  const statusMap = new Map();
  const anosVencMap = new Map();

  for await (const line of rl) {
    lineCount++;
    if (lineCount === 1) continue;
    const cols = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
    
    const vFace = parseFloat((cols[12] || '0').replace(/\./g, '').replace(',', '.')) || 0;
    const vOperado = parseFloat((cols[13] || '0').replace(/\./g, '').replace(',', '.')) || 0;
    const dtVenc = cols[11]; // DD/MM/YYYY ou similar
    const modalidade = cols[5];
    const tipoTitulo = cols[7];

    totalFace += vFace;
    totalOperado += vOperado;

    if (dtVenc && dtVenc.includes('/')) {
      const ano = dtVenc.split('/')[2];
      if (ano && ano.length === 4) anosVencMap.set(ano, (anosVencMap.get(ano) || 0) + 1);
    }
  }

  console.log(`\n==============================================`);
  console.log(`[4. TÍTULOS NO SMARTFACTOR]: ${(lineCount - 1).toLocaleString('pt-BR')} títulos`);
  console.log(`Volume Total de Face: R$ ${totalFace.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`Volume Total Operado: R$ ${totalOperado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  
  console.log(`Distribuição de Vencimento dos Títulos por Ano:`);
  const sortedAnosVenc = Array.from(anosVencMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  sortedAnosVenc.forEach(([ano, qtd]) => {
    console.log(`  - Vencimento ${ano}: ${qtd.toLocaleString('pt-BR')} títulos`);
  });
}

await analyzeCedentes();
await analyzeSacados();
await analyzeOperacoes();
await analyzeTitulos();

console.log('\n=== FIM DA ANÁLISE ===');
