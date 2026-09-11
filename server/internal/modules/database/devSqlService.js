import { createHash } from 'crypto';

/**
 * Validador estrito de SQL Somente-Leitura (Read-Only)
 * Bloqueia qualquer instrução DDL, DML de escrita, injeção de múltiplos statements ou comandos perigosos.
 */
export function sanitizeAndValidateReadOnlySql(rawQuery) {
  if (!rawQuery || typeof rawQuery !== 'string') {
    throw new Error('A consulta SQL não foi informada.');
  }

  const query = rawQuery.trim();
  if (!query) {
    throw new Error('A consulta SQL está vazia.');
  }

  // Remove comentários SQL (-- comentário e /* comentário */) para análise segura
  const stripped = query
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();

  if (!stripped) {
    throw new Error('A consulta SQL contém apenas comentários.');
  }

  // Divide por ponto e vírgula ignorando strings para checar múltiplos statements
  const statements = stripped
    .split(/;(?=(?:[^'"]*['"][^'"]*['"])*[^'"]*$)/)
    .map(s => s.trim())
    .filter(Boolean);

  if (statements.length > 1) {
    throw new Error('Execução de múltiplos comandos encadeados por ponto e vírgula não é permitida por segurança.');
  }

  const singleStatement = statements[0];

  // Verifica se a instrução começa com comandos permitidos de leitura
  const startsWithRead = /^(SELECT|WITH|EXPLAIN|PRAGMA\s+table_info)\b/i.test(singleStatement);
  if (!startsWithRead) {
    throw new Error('Comando não permitido. Apenas consultas de leitura (SELECT, WITH ... SELECT) são autorizadas.');
  }

  // Palavras-chave estritamente proibidas (escrita, mutação de schema, anexos de arquivos externos)
  const forbiddenKeywords = [
    /\bINSERT\b/i,
    /\bUPDATE\b/i,
    /\bDELETE\b/i,
    /\bDROP\b/i,
    /\bALTER\b/i,
    /\bCREATE\b/i,
    /\bTRUNCATE\b/i,
    /\bREPLACE\b/i,
    /\bATTACH\b/i,
    /\bDETACH\b/i,
    /\bVACUUM\b/i,
    /\bREINDEX\b/i,
    /\bPRAGMA\s+writable_schema\b/i,
    /\bPRAGMA\s+encoding\b/i,
    /\bPRAGMA\s+default_cache_size\b/i
  ];

  for (const regex of forbiddenKeywords) {
    if (regex.test(singleStatement)) {
      throw new Error(`Instrução bloqueada: o comando contém palavras-chave de modificação ou risco ao banco de dados.`);
    }
  }

  // Se for PRAGMA, permite apenas table_info
  if (/^PRAGMA\b/i.test(singleStatement)) {
    if (!/^PRAGMA\s+table_info\s*\(/i.test(singleStatement)) {
      throw new Error('Apenas PRAGMA table_info(tabela) é permitido para inspeção de schema.');
    }
  }

  // Adiciona LIMIT de proteção se for SELECT direto sem LIMIT
  let finalQuery = singleStatement;
  if (/^SELECT\b/i.test(finalQuery) && !/\bLIMIT\b/i.test(finalQuery)) {
    finalQuery = `${finalQuery} LIMIT 1000`;
  }

  return finalQuery;
}

/**
 * Retorna o schema estruturado de todas as tabelas e suas colunas (estilo SSMS Object Explorer)
 */
export function getDatabaseSchemaTree(db) {
  const tables = db.prepare(`
    SELECT name, type 
    FROM sqlite_master 
    WHERE type IN ('table', 'view') 
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name ASC
  `).all();

  const schema = [];

  for (const table of tables) {
    let rowCount = 0;
    try {
      const countRes = db.prepare(`SELECT COUNT(*) as total FROM "${table.name}"`).get();
      rowCount = countRes ? Number(countRes.total) : 0;
    } catch {
      rowCount = -1;
    }

    let columns = [];
    try {
      const colInfo = db.prepare(`PRAGMA table_info("${table.name}")`).all();
      columns = colInfo.map(c => ({
        cid: c.cid,
        name: c.name,
        type: c.type || 'TEXT',
        notnull: Boolean(c.notnull),
        dflt_value: c.dflt_value,
        pk: Boolean(c.pk)
      }));
    } catch {
      columns = [];
    }

    schema.push({
      tableName: table.name,
      type: table.type, // 'table' ou 'view'
      rowCount,
      columnsCount: columns.length,
      columns
    });
  }

  return schema;
}

/**
 * Executa a query de leitura com medição de tempo e limites de segurança
 */
export function executeReadOnlyQuery(db, rawQuery, { maxRows = 2000 } = {}) {
  const startTime = process.hrtime.bigint();
  const safeQuery = sanitizeAndValidateReadOnlySql(rawQuery);

  const stmt = db.prepare(safeQuery);
  const rows = stmt.all();

  const endTime = process.hrtime.bigint();
  const durationMs = Number((endTime - startTime) / 1000000n);

  let columns = [];
  if (rows.length > 0) {
    columns = Object.keys(rows[0]);
  } else if (stmt.columns) {
    columns = stmt.columns().map(c => c.name);
  }

  // Limita tamanho para segurança de memória se exceder
  const limitedRows = rows.slice(0, maxRows);

  return {
    success: true,
    query: safeQuery,
    columns,
    rows: limitedRows,
    rowCount: limitedRows.length,
    totalFetched: rows.length,
    truncated: rows.length > maxRows,
    durationMs
  };
}
