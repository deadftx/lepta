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
    CREATE TABLE IF NOT EXISTS fidc_cedentes (
      cnpj_raiz TEXT PRIMARY KEY,
      nome TEXT NOT NULL,
      estado TEXT,
      setor_id INTEGER,
      gerente_id INTEGER,
      criado_em TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS fidc_cedentes_cnpjs (
      cnpj TEXT PRIMARY KEY,
      cnpj_raiz TEXT NOT NULL,
      nome TEXT
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
    CREATE TABLE IF NOT EXISTS receita_mensal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fundo_id TEXT NOT NULL,
      mes TEXT NOT NULL,
      vop REAL NOT NULL,
      receita REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS feriados (
      data TEXT PRIMARY KEY
    );
    CREATE TABLE IF NOT EXISTS importacoes_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fundo_id TEXT NOT NULL,
      tipo TEXT NOT NULL,
      data_referencia TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'IMPORTADO',
      registros_importados INTEGER DEFAULT 0,
      arquivo_origem TEXT,
      atualizado_em TEXT DEFAULT (datetime('now')),
      UNIQUE(fundo_id, tipo, data_referencia)
    );
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT,
      acao TEXT,
      detalhe TEXT,
      data TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS confirmacao_nao_cobraveis (
      id TEXT PRIMARY KEY,
      tipo TEXT NOT NULL,
      documento TEXT NOT NULL,
      documento_formatado TEXT,
      nome TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_by TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_conf_nc_tipo_doc ON confirmacao_nao_cobraveis(tipo, documento);
  `);
}

/**
 * Retorna todos os clientes não cobráveis cadastrados
 */
export function getNaoCobraveisList(db) {
  const targetDb = db || getFidcDb();
  return targetDb.prepare(`
    SELECT id, tipo, documento, documento_formatado, nome, created_at, created_by
    FROM confirmacao_nao_cobraveis
    ORDER BY nome ASC
  `).all();
}

/**
 * Retorna Sets de documentos e nomes de cedentes e sacados isentos para filtragem ultra rápida
 */
export function getNaoCobraveisSets(db) {
  const list = getNaoCobraveisList(db);
  const exemptCedentesDocs = new Set();
  const exemptCedentesNames = new Set();
  const exemptSacadosDocs = new Set();
  const exemptSacadosNames = new Set();

  for (const item of list) {
    const docClean = String(item.documento || '').replace(/\D/g, '');
    const nomeClean = String(item.nome || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

    if (item.tipo === 'CEDENTE') {
      if (docClean) exemptCedentesDocs.add(docClean);
      if (nomeClean) exemptCedentesNames.add(nomeClean);
    } else if (item.tipo === 'SACADO') {
      if (docClean) exemptSacadosDocs.add(docClean);
      if (nomeClean) exemptSacadosNames.add(nomeClean);
    }
  }

  return {
    exemptCedentesDocs,
    exemptCedentesNames,
    exemptSacadosDocs,
    exemptSacadosNames,
    totalExempt: list.length
  };
}

/**
 * Salva a lista de clientes não cobráveis em lote
 */
export function saveNaoCobraveisBatch(db, items, user = null) {
  const targetDb = db || getFidcDb();
  const insertStmt = targetDb.prepare(`
    INSERT INTO confirmacao_nao_cobraveis (id, tipo, documento, documento_formatado, nome, created_at, created_by)
    VALUES (@id, @tipo, @documento, @documento_formatado, @nome, @created_at, @created_by)
    ON CONFLICT(tipo, documento) DO UPDATE SET
      nome = excluded.nome,
      documento_formatado = excluded.documento_formatado
  `);

  const deleteNotIn = (tipo, allowedIds) => {
    if (!allowedIds || allowedIds.length === 0) {
      targetDb.prepare(`DELETE FROM confirmacao_nao_cobraveis WHERE tipo = ?`).run(tipo);
    } else {
      const placeholders = allowedIds.map(() => '?').join(',');
      targetDb.prepare(`DELETE FROM confirmacao_nao_cobraveis WHERE tipo = ? AND id NOT IN (${placeholders})`).run(tipo, ...allowedIds);
    }
  };

  const runBatch = targetDb.transaction(() => {
    const cedenteIds = [];
    const sacadoIds = [];
    const now = new Date().toISOString();

    for (const raw of items) {
      const tipo = (raw.tipo || '').toUpperCase() === 'SACADO' ? 'SACADO' : 'CEDENTE';
      const documento = String(raw.documento || '').replace(/\D/g, '');
      if (!documento) continue;

      const nome = String(raw.nome || '').trim();
      const id = raw.id || `${tipo}_${documento}`;
      const documento_formatado = raw.documento_formatado || documento;

      insertStmt.run({
        id,
        tipo,
        documento,
        documento_formatado,
        nome,
        created_at: raw.created_at || now,
        created_by: raw.created_by || user || 'SISTEMA'
      });

      if (tipo === 'CEDENTE') cedenteIds.push(id);
      else sacadoIds.push(id);
    }

    // Se a requisição veio especificando a lista completa de um tipo ou de ambos, sincroniza
    deleteNotIn('CEDENTE', cedenteIds);
    deleteNotIn('SACADO', sacadoIds);
  });

  runBatch();
  return getNaoCobraveisList(targetDb);
}

/**
 * Deleta um cliente não cobrável pelo ID
 */
export function deleteNaoCobravelById(db, id) {
  const targetDb = db || getFidcDb();
  targetDb.prepare(`DELETE FROM confirmacao_nao_cobraveis WHERE id = ?`).run(id);
  return getNaoCobraveisList(targetDb);
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
      'fidc_cedentes',
      'fidc_cedentes_cnpjs',
      'cedentes',
      'cedentes_cnpjs',
      'receita_lancamentos',
      'receita_mensal',
      'feriados',
      'logs'
    ];

    const results = {};

    // Pragmas temporários para acelerar inserção em massa de milhões de linhas
    try {
      db.pragma('synchronous = OFF');
      db.pragma('temp_store = MEMORY');
    } catch (_) {}

    db.exec('BEGIN TRANSACTION;');

    try {
      for (const table of tablesToImport) {
        try {
          // Determina a tabela correspondente na fonte de backup
          let sourceTable = table;
          if (table === 'fidc_cedentes') {
            const hasFidc = db.prepare(`SELECT 1 FROM backup_source.sqlite_master WHERE type='table' AND name='fidc_cedentes'`).get();
            sourceTable = hasFidc ? 'fidc_cedentes' : 'cedentes';
          } else if (table === 'fidc_cedentes_cnpjs') {
            const hasFidc = db.prepare(`SELECT 1 FROM backup_source.sqlite_master WHERE type='table' AND name='fidc_cedentes_cnpjs'`).get();
            sourceTable = hasFidc ? 'fidc_cedentes_cnpjs' : 'cedentes_cnpjs';
          }

          // Verifica se a tabela fonte existe na fonte de backup
          const hasTable = db.prepare(`SELECT 1 FROM backup_source.sqlite_master WHERE type='table' AND name=?`).get(sourceTable);
          if (!hasTable) continue;

          // Obtém colunas comuns entre o banco destino e a tabela de backup
          const targetCols = db.prepare(`PRAGMA table_info("${table}")`).all().map(c => c.name);
          const sourceCols = db.prepare(`PRAGMA backup_source.table_info("${sourceTable}")`).all().map(c => c.name);
          const commonCols = targetCols.filter(col => sourceCols.includes(col));

          if (commonCols.length > 0) {
            const colList = commonCols.map(c => `"${c}"`).join(', ');
            // Para tabelas massivas como estoque_titulos, truncar e fazer INSERT direto é 10x mais rápido que INSERT OR REPLACE
            if (table === 'estoque_titulos' || table === 'estoque_snapshots') {
              db.exec(`DELETE FROM "${table}"`);
              db.exec(`INSERT INTO "${table}" (${colList}) SELECT ${colList} FROM backup_source."${sourceTable}"`);
            } else {
              db.exec(`INSERT OR REPLACE INTO "${table}" (${colList}) SELECT ${colList} FROM backup_source."${sourceTable}"`);
            }
            const count = db.prepare(`SELECT COUNT(*) as c FROM "${table}"`).get()?.c || 0;
            results[table] = count;
          }
        } catch (tableErr) {
          console.warn(`Aviso ao importar tabela ${table}:`, tableErr.message);
        }
      }

      db.exec('COMMIT;');
    } catch (txErr) {
      try { db.exec('ROLLBACK;'); } catch (_) {}
      throw txErr;
    } finally {
      try {
        db.pragma('synchronous = NORMAL');
      } catch (_) {}
    }

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
