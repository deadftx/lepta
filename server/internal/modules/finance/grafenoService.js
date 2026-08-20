import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Garante a criação das tabelas necessárias para o módulo Grafeno no SQLite
 */
export function ensureGrafenoSchema(db) {
  // 1. Tabela de Log de Webhooks e Notificações recebidas da Grafeno
  db.exec(`
    CREATE TABLE IF NOT EXISTS grafeno_webhooks (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      event_id TEXT,
      transaction_id TEXT,
      amount REAL,
      document TEXT,
      name TEXT,
      status TEXT,
      raw_payload TEXT NOT NULL,
      headers TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // 2. Tabela de Transações e Movimentações da Grafeno
  db.exec(`
    CREATE TABLE IF NOT EXISTS grafeno_transacoes (
      id TEXT PRIMARY KEY,
      grafeno_id TEXT UNIQUE,
      tipo TEXT NOT NULL,
      descricao TEXT,
      valor REAL NOT NULL DEFAULT 0,
      data_movimento TEXT NOT NULL,
      documento_favorecido TEXT,
      nome_favorecido TEXT,
      documento_pagador TEXT,
      nome_pagador TEXT,
      status TEXT NOT NULL DEFAULT 'CONFIRMADA',
      conta_origem TEXT,
      conta_destino TEXT,
      raw_json TEXT,
      sincronizado_em TEXT NOT NULL
    )
  `);

  // 3. Tabela de Configurações e Chaves da API Grafeno
  db.exec(`
    CREATE TABLE IF NOT EXISTS grafeno_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}

/**
 * Salva uma configuração ou chave da API Grafeno
 */
export function setGrafenoConfig(db, key, value) {
  ensureGrafenoSchema(db);
  db.prepare(`
    INSERT INTO grafeno_config (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `).run(key, typeof value === 'object' ? JSON.stringify(value) : String(value || ''), new Date().toISOString());
}

/**
 * Obtém uma configuração da API Grafeno
 */
export function getGrafenoConfig(db, key) {
  ensureGrafenoSchema(db);
  const row = db.prepare(`SELECT value FROM grafeno_config WHERE key = ?`).get(key);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

/**
 * Obtém todas as configurações públicas / seguras da Grafeno
 */
export function getGrafenoSettings(db) {
  ensureGrafenoSchema(db);
  const rows = db.prepare(`SELECT key, value, updated_at FROM grafeno_config`).all();
  const settings = {
    environment: 'production', // 'sandbox' | 'production'
    clientId: '',
    clientSecretMasked: '',
    webhookSecretConfigured: false,
    hasCredentials: false,
    updatedAt: null
  };

  for (const row of rows) {
    if (row.key === 'environment') settings.environment = row.value;
    if (row.key === 'clientId') settings.clientId = row.value;
    if (row.key === 'clientSecret' && row.value) {
      settings.clientSecretMasked = row.value.length > 8
        ? `${row.value.substring(0, 4)}...${row.value.substring(row.value.length - 4)}`
        : '••••••••';
      settings.hasCredentials = true;
    }
    if (row.key === 'webhookSecret' && row.value) settings.webhookSecretConfigured = true;
    if (row.updated_at) settings.updatedAt = row.updated_at;
  }

  return settings;
}

/**
 * Salva e normaliza um evento recebido pelo Webhook da Grafeno
 */
export function saveWebhookEvent(db, {
  eventType = 'notification',
  eventId = null,
  transactionId = null,
  amount = null,
  document = null,
  name = null,
  status = 'RECEBIDO',
  rawPayload = {},
  headers = {},
  ipAddress = ''
}) {
  ensureGrafenoSchema(db);
  const id = `gw_${Date.now()}_${randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  // Tenta inferir campos caso não venham explícitos
  const payload = typeof rawPayload === 'object' && rawPayload !== null ? rawPayload : {};
  const inferredEventType = eventType || payload.event || payload.type || payload.evento || payload.action || 'evento_grafeno';
  const inferredEventId = eventId || payload.id || payload.event_id || payload.eventId || null;
  const inferredTxId = transactionId || payload.transaction_id || payload.transactionId || payload.transacao_id || payload.nsu || null;
  const inferredAmount = amount !== null ? amount : (payload.amount || payload.valor || payload.value || null);
  const inferredDoc = document || payload.document || payload.cpf_cnpj || payload.cnpj || payload.cpf || payload.tax_id || null;
  const inferredName = name || payload.name || payload.nome || payload.favorecido || payload.razao_social || payload.payer_name || null;
  const inferredStatus = status || payload.status || payload.state || 'PROCESSADO';

  db.prepare(`
    INSERT INTO grafeno_webhooks (
      id, event_type, event_id, transaction_id,
      amount, document, name, status,
      raw_payload, headers, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    String(inferredEventType),
    inferredEventId ? String(inferredEventId) : null,
    inferredTxId ? String(inferredTxId) : null,
    inferredAmount ? Number(inferredAmount) : null,
    inferredDoc ? String(inferredDoc) : null,
    inferredName ? String(inferredName) : null,
    String(inferredStatus),
    JSON.stringify(payload),
    JSON.stringify(headers || {}),
    String(ipAddress || ''),
    now
  );

  // Se o payload contiver uma transação financeira, sincroniza na tabela de transações
  if (inferredAmount || inferredTxId) {
    try {
      const txId = inferredTxId || id;
      db.prepare(`
        INSERT INTO grafeno_transacoes (
          id, grafeno_id, tipo, descricao, valor,
          data_movimento, documento_favorecido, nome_favorecido,
          documento_pagador, nome_pagador, status, raw_json, sincronizado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(grafeno_id) DO UPDATE SET
          status = excluded.status,
          valor = excluded.valor,
          raw_json = excluded.raw_json,
          sincronizado_em = excluded.sincronizado_em
      `).run(
        `gtx_${Date.now()}_${randomBytes(3).toString('hex')}`,
        String(txId),
        String(inferredEventType),
        payload.description || payload.descricao || `Transação Grafeno (${inferredEventType})`,
        inferredAmount ? Number(inferredAmount) : 0,
        payload.date || payload.data || now,
        inferredDoc ? String(inferredDoc) : null,
        inferredName ? String(inferredName) : null,
        payload.payer_document || payload.pagador_documento || null,
        payload.payer_name || payload.pagador_nome || null,
        String(inferredStatus),
        JSON.stringify(payload),
        now
      );
    } catch (err) {
      console.error('Erro ao sincronizar transação derivada do webhook Grafeno:', err.message);
    }
  }

  return { id, eventType: inferredEventType, createdAt: now };
}

/**
 * Consulta histórico de eventos de Webhook com paginação e filtros
 */
export function getWebhookEvents(db, { limit = 50, offset = 0, eventType = null, search = null } = {}) {
  ensureGrafenoSchema(db);
  let sql = `SELECT * FROM grafeno_webhooks`;
  const conditions = [];
  const params = [];

  if (eventType) {
    conditions.push(`event_type = ?`);
    params.push(eventType);
  }

  if (search) {
    conditions.push(`(
      event_type LIKE ? OR
      name LIKE ? OR
      document LIKE ? OR
      transaction_id LIKE ? OR
      raw_payload LIKE ?
    )`);
    const term = `%${search}%`;
    params.push(term, term, term, term, term);
  }

  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Math.min(limit, 200), Math.max(offset, 0));

  const rows = db.prepare(sql).all(...params);

  const totalCountRow = db.prepare(`SELECT count(*) as count FROM grafeno_webhooks`).get();

  return {
    total: totalCountRow ? totalCountRow.count : 0,
    items: rows.map(r => ({
      ...r,
      raw_payload: r.raw_payload ? JSON.parse(r.raw_payload) : {},
      headers: r.headers ? JSON.parse(r.headers) : {}
    }))
  };
}

/**
 * Métricas gerais do módulo Grafeno
 */
export function getGrafenoMetrics(db) {
  ensureGrafenoSchema(db);
  const totalEvents = db.prepare(`SELECT count(*) as c FROM grafeno_webhooks`).get()?.c || 0;
  
  const today = new Date().toISOString().substring(0, 10);
  const todayEvents = db.prepare(`SELECT count(*) as c FROM grafeno_webhooks WHERE created_at LIKE ?`).get(`${today}%`)?.c || 0;
  
  const totalTransactions = db.prepare(`SELECT count(*) as c, SUM(valor) as totalAmount FROM grafeno_transacoes`).get() || { c: 0, totalAmount: 0 };
  
  const lastEvent = db.prepare(`SELECT event_type, created_at, status FROM grafeno_webhooks ORDER BY created_at DESC LIMIT 1`).get();

  return {
    totalEvents,
    todayEvents,
    totalTransactions: totalTransactions.c || 0,
    totalAmountNotified: totalTransactions.totalAmount || 0,
    lastEventTime: lastEvent ? lastEvent.created_at : null,
    lastEventType: lastEvent ? lastEvent.event_type : null,
    status: totalEvents > 0 ? 'ATIVO' : 'AGUARDANDO_PRIMEIRA_MENSAGEM'
  };
}
