import fs from 'fs';

let mainDbInstance = null;

export function setFidcDb(db) {
  mainDbInstance = db;
  ensureFidcSchema(db);
  return mainDbInstance;
}

export function getFidcDb() {
  if (!mainDbInstance) {
    throw new Error('Banco de dados principal do LeptaSys não foi inicializado.');
  }
  return mainDbInstance;
}

/**
 * Garante que todas as tabelas do Sistema de Confirmação & FIDCs existam dentro do database.sqlite principal
 */
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

/**
 * Importa/Copia todas as tabelas de um arquivo de backup (.db) diretamente para dentro do database.sqlite principal
 */
export function importBackupIntoMainDb(db, backupFilePath) {
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Arquivo de backup não encontrado: ${backupFilePath}`);
  }

  ensureFidcSchema(db);

  // Normaliza o caminho do arquivo para SQLite (barras normais)
  const normalizedPath = backupFilePath.replace(/\\/g, '/');

  // Faz o ATTACH do arquivo de backup no banco principal
  db.exec(`ATTACH DATABASE '${normalizedPath}' AS backup_source;`);

  try {
    const tablesToImport = [
      'config',
      'fundos',
      'classes',
      'limites_sub',
      'historico_cotas',
      'cdi',
      'carteira_dc',
      'estoque_snapshots',
      'estoque_titulos',
      'limites_conc',
      'gerentes',
      'setores',
      'cedentes',
      'cedentes_cnpjs',
      'receita_lancamentos',
      'feriados'
    ];

    const results = {};

    db.transaction(() => {
      for (const table of tablesToImport) {
        try {
          db.exec(`INSERT OR REPLACE INTO "${table}" SELECT * FROM backup_source."${table}"`);
          const count = db.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get()?.c || 0;
          results[table] = count;
        } catch (tableErr) {
          console.warn(`Aviso ao importar tabela ${table}:`, tableErr.message);
        }
      }
    })();

    return {
      success: true,
      message: 'Dados do FIDC importados com sucesso para o banco principal!',
      counts: results
    };
  } finally {
    try {
      db.exec('DETACH DATABASE backup_source;');
    } catch (detachErr) {
      console.warn('Aviso ao desanexar backup_source:', detachErr.message);
    }
  }
}
