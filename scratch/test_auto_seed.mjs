import Database from 'better-sqlite3';
import fs from 'fs';
import zlib from 'zlib';
import path from 'path';

const testDb = new Database(':memory:');

// Test auto-seed
console.log('--- Testando auto-seed em banco de dados em memória ---');

testDb.exec(`
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
`);

const seedPath = path.resolve('server/internal/modules/intelligence/smartfactor/smartfactor_seed.json.gz');
const buf = fs.readFileSync(seedPath);
const unzipped = zlib.gunzipSync(buf);
const records = JSON.parse(unzipped.toString('utf-8'));

console.log(`Registros descompactados: ${records.length}`);

const insertStmt = testDb.prepare(`
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

const insertMany = testDb.transaction((rows) => {
  for (const r of rows) insertStmt.run(r);
});

const t0 = Date.now();
insertMany(records);
console.log(`Inserção concluída em ${Date.now() - t0}ms!`);

const count = testDb.prepare('SELECT COUNT(*) as c, SUM(VALOR_NOMINAL) as total FROM BASE_SMARTFACTOR').get();
console.log(`Total inserido: ${count.c} títulos | R$ ${count.total.toLocaleString('pt-BR')}`);
