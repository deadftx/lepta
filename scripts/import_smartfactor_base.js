import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Database from 'better-sqlite3';

const dbPath = process.env.DATABASE_PATH || './database.sqlite';
const db = new Database(dbPath);

console.log(`[IMPORT SMARTFACTOR] Conectando ao banco SQLite: ${dbPath}`);

// 1. Criar Tabela BASE_SMARTFACTOR com Schema compatível da BASE_NOVA
db.exec(`
  DROP TABLE IF EXISTS BASE_SMARTFACTOR;

  CREATE TABLE BASE_SMARTFACTOR (
    ID TEXT PRIMARY KEY,
    OPERACAO TEXT,
    PAGTO TEXT,
    CLIENTE TEXT,
    DOCUMENTO TEXT,
    SACADO TEXT,
    DOCUMENTO_SACADO TEXT,
    UA TEXT DEFAULT 'SmartFactor',
    PRODUTO TEXT,
    SIGLA TEXT,
    NUMERO TEXT,
    CADASTRO TEXT,
    EMISSAO TEXT,
    VENCIMENTO TEXT,
    VENCIMENTO_EFETIVO TEXT,
    VENCIDO TEXT,
    SITUACAO TEXT,
    DATA_SITUACAO TEXT,
    VALOR_NOMINAL REAL DEFAULT 0,
    DESCONTO_ABATIMENTO REAL DEFAULT 0,
    VALOR_LIQUIDO REAL DEFAULT 0,
    VALOR_PAGO REAL DEFAULT 0,
    SALDO_DEVEDOR REAL DEFAULT 0,
    TAXA REAL DEFAULT 0,
    DESAGIO REAL DEFAULT 0,
    TARIFAS_OPERACAO REAL DEFAULT 0,
    PRAZO_REAL REAL DEFAULT 0,
    PRAZO_COBRADO REAL DEFAULT 0,
    BANCO_COBRADOR TEXT,
    SETOR_CEDENTE TEXT,
    GRUPO_ECONOMICO TEXT,
    CIDADE_SACADO TEXT,
    UF_SACADO TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sf_cliente ON BASE_SMARTFACTOR (CLIENTE);
  CREATE INDEX IF NOT EXISTS idx_sf_documento ON BASE_SMARTFACTOR (DOCUMENTO);
  CREATE INDEX IF NOT EXISTS idx_sf_sacado ON BASE_SMARTFACTOR (SACADO);
  CREATE INDEX IF NOT EXISTS idx_sf_vencimento ON BASE_SMARTFACTOR (VENCIMENTO);
  CREATE INDEX IF NOT EXISTS idx_sf_situacao ON BASE_SMARTFACTOR (SITUACAO);
  CREATE INDEX IF NOT EXISTS idx_sf_data_situacao ON BASE_SMARTFACTOR (DATA_SITUACAO);
`);

console.log('[IMPORT SMARTFACTOR] Tabela BASE_SMARTFACTOR e índices criados com sucesso.');

// Localizar os arquivos CSV
const candidates = [
  './SmartFactor/backup_4055_270826',
  'C:/Users/ArthurFeltrinDeco/OneDrive - Lepta/Tecnologia/LeptaSys/lepta/SmartFactor/backup_4055_270826'
];
const basePath = candidates.find(p => fs.existsSync(p));
if (!basePath) {
  throw new Error('Pasta do SmartFactor não encontrada.');
}

const numVal = (v) => {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    let s = v.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

// 2. Carregar Cedentes em Memória
console.log('[IMPORT SMARTFACTOR] Carregando cedentes.csv...');
const cedMap = new Map();
const cedStream = fs.createReadStream(path.join(basePath, 'cedentes.csv'), { encoding: 'latin1' });
const cedRl = readline.createInterface({ input: cedStream, crlfDelay: Infinity });

for await (const line of cedRl) {
  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  if (c[0] && c[0] !== 'CPF/CNPJ') {
    const docClean = c[0].replace(/\D/g, '');
    cedMap.set(docClean, {
      cnpj: c[0],
      nome: c[1],
      setor: c[10] || '',
      grupo: c[12] || ''
    });
  }
}
console.log(`[IMPORT SMARTFACTOR] ${cedMap.size} cedentes indexados.`);

// 3. Carregar Sacados em Memória
console.log('[IMPORT SMARTFACTOR] Carregando sacados.csv...');
const sacMap = new Map();
const sacStream = fs.createReadStream(path.join(basePath, 'sacados.csv'), { encoding: 'latin1' });
const sacRl = readline.createInterface({ input: sacStream, crlfDelay: Infinity });

for await (const line of sacRl) {
  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  if (c[0] && c[0] !== 'CPF/CNPJ') {
    const docClean = c[0].replace(/\D/g, '');
    sacMap.set(docClean, {
      cnpj: c[0],
      nome: c[1],
      cidade: c[6] || '',
      uf: c[7] || ''
    });
  }
}
console.log(`[IMPORT SMARTFACTOR] ${sacMap.size} sacados indexados.`);

// 4. Carregar Operações em Memória
console.log('[IMPORT SMARTFACTOR] Carregando opconvencional.csv...');
const opMap = new Map();
const opStream = fs.createReadStream(path.join(basePath, 'opconvencional.csv'), { encoding: 'latin1' });
const opRl = readline.createInterface({ input: opStream, crlfDelay: Infinity });

for await (const line of opRl) {
  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  if (c[0] && c[0] !== 'Operação') {
    opMap.set(c[0], {
      dataOp: c[2],
      fator: numVal(c[3]),
      adValorem: numVal(c[4]),
      valorFator: numVal(c[5]),
      valorLiquido: numVal(c[17])
    });
  }
}
console.log(`[IMPORT SMARTFACTOR] ${opMap.size} operações indexadas.`);

// 5. Preparar Inserção em Lote de Títulos
const insertStmt = db.prepare(`
  INSERT INTO BASE_SMARTFACTOR (
    ID, OPERACAO, PAGTO, CLIENTE, DOCUMENTO, SACADO, DOCUMENTO_SACADO,
    UA, PRODUTO, SIGLA, NUMERO, CADASTRO, EMISSAO, VENCIMENTO,
    VENCIMENTO_EFETIVO, VENCIDO, SITUACAO, DATA_SITUACAO, VALOR_NOMINAL,
    DESCONTO_ABATIMENTO, VALOR_LIQUIDO, VALOR_PAGO, SALDO_DEVEDOR,
    TAXA, DESAGIO, TARIFAS_OPERACAO, PRAZO_REAL, PRAZO_COBRADO,
    BANCO_COBRADOR, SETOR_CEDENTE, GRUPO_ECONOMICO, CIDADE_SACADO, UF_SACADO
  ) VALUES (
    @ID, @OPERACAO, @PAGTO, @CLIENTE, @DOCUMENTO, @SACADO, @DOCUMENTO_SACADO,
    @UA, @PRODUTO, @SIGLA, @NUMERO, @CADASTRO, @EMISSAO, @VENCIMENTO,
    @VENCIMENTO_EFETIVO, @VENCIDO, @SITUACAO, @DATA_SITUACAO, @VALOR_NOMINAL,
    @DESCONTO_ABATIMENTO, @VALOR_LIQUIDO, @VALOR_PAGO, @SALDO_DEVEDOR,
    @TAXA, @DESAGIO, @TARIFAS_OPERACAO, @PRAZO_REAL, @PRAZO_COBRADO,
    @BANCO_COBRADOR, @SETOR_CEDENTE, @GRUPO_ECONOMICO, @CIDADE_SACADO, @UF_SACADO
  )
`);

const insertMany = db.transaction((rows) => {
  for (const row of rows) {
    insertStmt.run(row);
  }
});

console.log('[IMPORT SMARTFACTOR] Processando e inserindo titulos.csv...');
const titStream = fs.createReadStream(path.join(basePath, 'titulos.csv'), { encoding: 'latin1' });
const titRl = readline.createInterface({ input: titStream, crlfDelay: Infinity });

let totalCount = 0;
let batch = [];
const today = new Date().toISOString().split('T')[0];

for await (const line of titRl) {
  totalCount++;
  if (totalCount === 1) continue;

  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  const idTitulo = c[0];
  const idOp = c[22];
  const cnpjCedClean = (c[21] || '').replace(/\D/g, '');
  const cnpjSacClean = (c[6] || '').replace(/\D/g, '');
  const numDoc = c[9];
  const dtVenc = c[11];
  const dtVencEf = c[30] || dtVenc;
  const dtLiq = c[18];
  const status = c[19] || 'Quitado';

  const vFace = numVal(c[12]);
  const vOperado = numVal(c[13]);
  const vDesconto = numVal(c[17]);
  const vRecebido = numVal(c[29]) || (status.toLowerCase().includes('quit') ? vFace : 0);
  const saldoDev = Math.max(0, vFace - vRecebido);

  const cedInfo = cedMap.get(cnpjCedClean) || { nome: 'Cedente ' + c[21], cnpj: c[21], setor: '', grupo: '' };
  const sacInfo = sacMap.get(cnpjSacClean) || { nome: 'Sacado ' + c[6], cnpj: c[6], cidade: '', uf: '' };
  const opInfo = opMap.get(idOp) || {};

  // Formatação de data vencimento ISO para conferência de vencido
  let isVencido = 'Nao';
  if (dtVenc && dtVenc.includes('/')) {
    const parts = dtVenc.split('/');
    if (parts.length === 3) {
      const isoVenc = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      if (isoVenc < today && !status.toLowerCase().includes('quit') && !status.toLowerCase().includes('liquid')) {
        isVencido = 'Sim';
      }
    }
  }

  const row = {
    ID: idTitulo,
    OPERACAO: idOp,
    PAGTO: c[8] || '',
    CLIENTE: cedInfo.nome,
    DOCUMENTO: c[21] || cedInfo.cnpj || '',
    SACADO: sacInfo.nome,
    DOCUMENTO_SACADO: c[6] || sacInfo.cnpj || '',
    UA: 'SmartFactor',
    PRODUTO: c[5] || 'Convencional',
    SIGLA: c[7] || 'DM',
    NUMERO: numDoc || '',
    CADASTRO: opInfo.dataOp || c[23] || '',
    EMISSAO: opInfo.dataOp || c[23] || '',
    VENCIMENTO: dtVenc || '',
    VENCIMENTO_EFETIVO: dtVencEf || '',
    VENCIDO: isVencido,
    SITUACAO: status,
    DATA_SITUACAO: dtLiq || '',
    VALOR_NOMINAL: vFace,
    DESCONTO_ABATIMENTO: vDesconto,
    VALOR_LIQUIDO: vOperado,
    VALOR_PAGO: vRecebido,
    SALDO_DEVEDOR: saldoDev,
    TAXA: opInfo.fator || 0,
    DESAGIO: numVal(c[25]),
    TARIFAS_OPERACAO: numVal(c[24]),
    PRAZO_REAL: numVal(c[32]),
    PRAZO_COBRADO: numVal(c[31]),
    BANCO_COBRADOR: c[10] || '',
    SETOR_CEDENTE: cedInfo.setor,
    GRUPO_ECONOMICO: cedInfo.grupo,
    CIDADE_SACADO: sacInfo.cidade,
    UF_SACADO: sacInfo.uf
  };

  batch.push(row);

  if (batch.length >= 5000) {
    insertMany(batch);
    batch = [];
  }
}

if (batch.length > 0) {
  insertMany(batch);
  batch = [];
}

const finalCount = db.prepare('SELECT COUNT(*) as c, SUM(VALOR_NOMINAL) as totalVal FROM BASE_SMARTFACTOR').get();
console.log(`\n======================================================`);
console.log(`[IMPORT CONCLUÍDO COM SUCESSO!]`);
console.log(`Total de Registros Inseridos: ${finalCount.c.toLocaleString('pt-BR')}`);
console.log(`Volume Total de Face (VALOR_NOMINAL): R$ ${finalCount.totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
console.log(`======================================================\n`);
