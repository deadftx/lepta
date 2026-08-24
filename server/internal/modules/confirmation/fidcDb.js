import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const projectRoot = path.resolve();

function resolveFidcDbPath() {
  if (process.env.FIDC_DATABASE_PATH && fs.existsSync(process.env.FIDC_DATABASE_PATH)) {
    return path.resolve(process.env.FIDC_DATABASE_PATH);
  }
  const localCopy = path.join(projectRoot, 'server', 'data', 'fidc.db');
  if (fs.existsSync(localCopy)) {
    return localCopy;
  }
  const originalBackup = 'C:/Users/ArthurFeltrinDeco/OneDrive - Lepta/Tecnologia/SISTEMA/SISTEMA/SistemaProdutos/BACKUPS/lepta_backup_2026-08-17.db';
  if (fs.existsSync(originalBackup)) {
    return originalBackup;
  }
  return localCopy;
}

const fidcDbPath = resolveFidcDbPath();

let fidcDb = null;

export function getFidcDb() {
  if (!fidcDb) {
    fidcDb = new Database(fidcDbPath, { fileMustExist: false, timeout: 60000 });
    fidcDb.pragma('journal_mode = WAL');
    fidcDb.pragma('busy_timeout = 60000');
    fidcDb.pragma('synchronous = NORMAL');
    fidcDb.pragma('temp_store = MEMORY');
    fidcDb.pragma('cache_size = -64000');
    ensureFidcSchema(fidcDb);
  }
  return fidcDb;
}

export function ensureFidcSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS fundos (id TEXT PRIMARY KEY, nome TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT NOT NULL,
      fundo_id TEXT NOT NULL,
      nome TEXT NOT NULL,
      tipo TEXT NOT NULL,
      cota_inicial REAL NOT NULL DEFAULT 1000,
      spread REAL,
      PRIMARY KEY (id, fundo_id)
    );
    CREATE TABLE IF NOT EXISTS limites_sub (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fundo_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      valor REAL NOT NULL,
      descricao TEXT NOT NULL,
      classes TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS historico_cotas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fundo_id TEXT NOT NULL,
      data TEXT NOT NULL,
      classe_id TEXT NOT NULL,
      cota REAL NOT NULL,
      pl REAL NOT NULL,
      UNIQUE(fundo_id, data, classe_id)
    );
    CREATE TABLE IF NOT EXISTS cdi (
      data TEXT PRIMARY KEY,
      taxa_anual REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS carteira_dc (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fundo_id TEXT NOT NULL,
      data TEXT NOT NULL,
      valor REAL NOT NULL,
      UNIQUE(fundo_id, data)
    );
    CREATE TABLE IF NOT EXISTS estoque_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fundo_id TEXT NOT NULL,
      data TEXT NOT NULL,
      importado_em TEXT NOT NULL DEFAULT (datetime('now')),
      total_titulos INTEGER,
      UNIQUE(fundo_id, data)
    );
    CREATE TABLE IF NOT EXISTS estoque_titulos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL,
      fundo_id TEXT NOT NULL,
      data_posicao TEXT NOT NULL,
      cedente_cnpj TEXT,
      cedente_nome TEXT,
      sacado_cnpj TEXT,
      sacado_nome TEXT,
      tipo_ativo TEXT,
      data_emissao TEXT,
      data_aquisicao TEXT,
      data_vencimento TEXT,
      numero_titulo TEXT,
      valor_aquisicao REAL,
      valor_nominal_original REAL,
      valor_nominal_atual REAL,
      valor_presente REAL,
      pdd_nota REAL,
      pdd_vencido REAL,
      nota_pdd TEXT,
      campo_chave TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_est_snap ON estoque_titulos(snapshot_id);
    CREATE INDEX IF NOT EXISTS idx_est_fd ON estoque_titulos(fundo_id, data_posicao);
    CREATE INDEX IF NOT EXISTS idx_est_ced ON estoque_titulos(cedente_cnpj);
    CREATE INDEX IF NOT EXISTS idx_est_sac ON estoque_titulos(sacado_cnpj);

    CREATE TABLE IF NOT EXISTS limites_conc (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fundo_id TEXT NOT NULL,
      regra_key TEXT NOT NULL,
      valor REAL NOT NULL,
      n INTEGER,
      descricao TEXT NOT NULL,
      UNIQUE(fundo_id, regra_key)
    );
    CREATE TABLE IF NOT EXISTS gerentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS setores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS cedentes (
      cnpj_raiz TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      estado TEXT,
      setor_id INTEGER,
      gerente_id INTEGER,
      criado_em TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cedentes_cnpjs (
      cnpj TEXT PRIMARY KEY,
      cnpj_raiz TEXT NOT NULL,
      nome TEXT
    );
    CREATE TABLE IF NOT EXISTS receita_lancamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fundo_id TEXT NOT NULL,
      data TEXT NOT NULL,
      cedente_nome TEXT NOT NULL,
      valor_bruto REAL NOT NULL,
      valor_liquido REAL NOT NULL,
      lancado_em TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS feriados (
      data TEXT PRIMARY KEY,
      descricao TEXT
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT,
      acao TEXT,
      detalhe TEXT,
      data TEXT DEFAULT (datetime('now'))
    );
  `);
}
