import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';

const API_BASE_URL = 'https://lepta-backend.bit-unltd.com.br';
const INITIAL_DATE = '2021-01-01T00:00:00.000Z';
const REQUEST_CONCURRENCY = 2;
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;
const TECHNICAL_COLUMNS = new Set(['_syncKey', '_hash', '_jsonOriginal', '_sincronizadoEm', '_parentSyncKey', '_itemIndex']);

export const SYNC_RESOURCES = [
  { name: 'TITULOS', endpoint: '/recebiveis/titulos', dateType: 'Cadastro' },
  { name: 'OPERACOES', endpoint: '/recebiveis/operacoes', dateType: 'Cadastro' },
  { name: 'RECOMPRAS', endpoint: '/recebiveis/recompras', dateType: 'Cadastro' },
  { name: 'LIQUIDACOES', endpoint: '/recebiveis/liquidacoes', dateType: 'Cadastro' },
  { name: 'PAGAMENTOS_OPERACIONAIS', endpoint: '/recebiveis/pagamentosOperacionais', dateType: 'Cadastro' }
];

function quoteIdentifier(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function sanitizeIdentifier(value, uppercase = false) {
  const source = uppercase
    ? String(value || '').replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    : String(value || '');
  let result = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!result) result = 'campo';
  if (/^\d/.test(result)) result = `_${result}`;
  if (uppercase) result = result.toUpperCase();
  return result.slice(0, 120);
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function normalizeDocument(value) {
  return String(value || '').replace(/\D/g, '');
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function isoNow() {
  return new Date().toISOString();
}

function parseStoredJson(value, fallback = null) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function ensureSyncMetadata(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS API_SYNC_EXECUCOES (
      id TEXT PRIMARY KEY,
      origem TEXT NOT NULL,
      solicitadoPor TEXT,
      status TEXT NOT NULL,
      etapa TEXT,
      progresso INTEGER NOT NULL DEFAULT 0,
      registrosRecebidos INTEGER NOT NULL DEFAULT 0,
      registrosGravados INTEGER NOT NULL DEFAULT 0,
      iniciadoEm TEXT,
      finalizadoEm TEXT,
      mensagem TEXT,
      erro TEXT,
      criadoEm TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS API_SYNC_RECURSOS (
      execucaoId TEXT NOT NULL,
      recurso TEXT NOT NULL,
      status TEXT NOT NULL,
      janelasConcluidas INTEGER NOT NULL DEFAULT 0,
      janelasTotal INTEGER NOT NULL DEFAULT 0,
      registrosRecebidos INTEGER NOT NULL DEFAULT 0,
      registrosGravados INTEGER NOT NULL DEFAULT 0,
      mensagem TEXT,
      atualizadoEm TEXT NOT NULL,
      PRIMARY KEY (execucaoId, recurso)
    );

    CREATE TABLE IF NOT EXISTS API_SYNC_TABELAS (
      nome TEXT PRIMARY KEY,
      recurso TEXT NOT NULL,
      tipo TEXT NOT NULL,
      registros INTEGER NOT NULL DEFAULT 0,
      colunas INTEGER NOT NULL DEFAULT 0,
      ultimaSincronizacao TEXT,
      ultimaExecucaoId TEXT
    );

    CREATE TABLE IF NOT EXISTS API_SYNC_COLUNAS (
      tabela TEXT NOT NULL,
      chaveApi TEXT NOT NULL,
      coluna TEXT NOT NULL,
      PRIMARY KEY (tabela, chaveApi),
      UNIQUE (tabela, coluna)
    );

    CREATE INDEX IF NOT EXISTS idx_api_sync_execucoes_status
      ON API_SYNC_EXECUCOES (status, criadoEm DESC);
  `);
}

function markStaleExecutions(db) {
  const staleLimit = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    UPDATE API_SYNC_EXECUCOES
    SET status = 'ERRO', finalizadoEm = ?, erro = 'Execução interrompida antes da conclusão.'
    WHERE status IN ('PENDENTE', 'EXECUTANDO') AND criadoEm < ?
  `).run(isoNow(), staleLimit);
}

export function getActiveExecution(db) {
  ensureSyncMetadata(db);
  markStaleExecutions(db);
  return db.prepare(`
    SELECT * FROM API_SYNC_EXECUCOES
    WHERE status IN ('PENDENTE', 'EXECUTANDO')
    ORDER BY criadoEm DESC LIMIT 1
  `).get() || null;
}

export function createQueuedExecution(db, { source = 'MANUAL', requestedBy = 'sistema', executionId = randomUUID() } = {}) {
  ensureSyncMetadata(db);
  if (getActiveExecution(db)) throw new Error('Já existe uma sincronização em andamento.');
  const now = isoNow();
  db.prepare(`
    INSERT INTO API_SYNC_EXECUCOES (
      id, origem, solicitadoPor, status, etapa, progresso, mensagem, criadoEm
    ) VALUES (?, ?, ?, 'PENDENTE', 'Aguardando início', 0, 'Sincronização adicionada à fila.', ?)
  `).run(executionId, source, requestedBy, now);
  return executionId;
}

function updateExecution(db, executionId, fields) {
  const entries = Object.entries(fields).filter(([, value]) => value !== undefined);
  if (!entries.length) return;
  const sql = entries.map(([key]) => `${quoteIdentifier(key)} = ?`).join(', ');
  db.prepare(`UPDATE API_SYNC_EXECUCOES SET ${sql} WHERE id = ?`)
    .run(...entries.map(([, value]) => value), executionId);
}

function updateResource(db, executionId, resource, fields) {
  const existing = db.prepare(`
    SELECT * FROM API_SYNC_RECURSOS WHERE execucaoId = ? AND recurso = ?
  `).get(executionId, resource);
  const row = {
    status: 'PENDENTE',
    janelasConcluidas: 0,
    janelasTotal: 0,
    registrosRecebidos: 0,
    registrosGravados: 0,
    mensagem: '',
    ...existing,
    ...fields,
    execucaoId: executionId,
    recurso: resource,
    atualizadoEm: isoNow()
  };
  db.prepare(`
    INSERT INTO API_SYNC_RECURSOS (
      execucaoId, recurso, status, janelasConcluidas, janelasTotal,
      registrosRecebidos, registrosGravados, mensagem, atualizadoEm
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(execucaoId, recurso) DO UPDATE SET
      status = excluded.status,
      janelasConcluidas = excluded.janelasConcluidas,
      janelasTotal = excluded.janelasTotal,
      registrosRecebidos = excluded.registrosRecebidos,
      registrosGravados = excluded.registrosGravados,
      mensagem = excluded.mensagem,
      atualizadoEm = excluded.atualizadoEm
  `).run(
    row.execucaoId, row.recurso, row.status, row.janelasConcluidas, row.janelasTotal,
    row.registrosRecebidos, row.registrosGravados, row.mensagem, row.atualizadoEm
  );
}

function resolveApiColumn(db, targetTable, apiKey) {
  const stored = db.prepare(`
    SELECT coluna FROM API_SYNC_COLUNAS WHERE tabela = ? AND chaveApi = ?
  `).get(targetTable, apiKey);
  if (stored) return stored.coluna;

  let candidate = sanitizeIdentifier(apiKey);
  if (TECHNICAL_COLUMNS.has(candidate)) candidate = `${candidate}_api`;
  const collision = db.prepare(`
    SELECT chaveApi FROM API_SYNC_COLUNAS WHERE tabela = ? AND coluna = ?
  `).get(targetTable, candidate);
  if (collision && collision.chaveApi !== apiKey) {
    candidate = `${candidate}_${createHash('sha1').update(apiKey).digest('hex').slice(0, 6)}`;
  }
  db.prepare(`
    INSERT OR IGNORE INTO API_SYNC_COLUNAS (tabela, chaveApi, coluna) VALUES (?, ?, ?)
  `).run(targetTable, apiKey, candidate);
  return candidate;
}

function sqliteType(values) {
  const meaningful = values.filter(value => value !== null && value !== undefined);
  if (!meaningful.length) return 'TEXT';
  if (meaningful.every(value => typeof value === 'boolean' || Number.isInteger(value))) return 'INTEGER';
  if (meaningful.every(value => typeof value === 'number')) return 'REAL';
  return 'TEXT';
}

function serializeValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function tableColumns(db, tableName) {
  return db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
}

function ensureDynamicTable(db, tableName, columnTypes) {
  db.exec(`CREATE TABLE IF NOT EXISTS ${quoteIdentifier(tableName)} (${quoteIdentifier('_syncKey')} TEXT PRIMARY KEY)`);
  const existing = new Set(tableColumns(db, tableName).map(column => column.name.toLowerCase()));
  for (const [column, type] of Object.entries(columnTypes)) {
    if (existing.has(column.toLowerCase())) continue;
    db.exec(`ALTER TABLE ${quoteIdentifier(tableName)} ADD COLUMN ${quoteIdentifier(column)} ${type}`);
  }
  const indexName = `idx_api_sync_${createHash('sha1').update(tableName).digest('hex').slice(0, 18)}`;
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdentifier(indexName)} ON ${quoteIdentifier(tableName)} (${quoteIdentifier('_syncKey')})`);
}

function prepareRows(db, targetTable, entries, synchronizedAt) {
  const apiKeys = [...new Set(entries.flatMap(entry => Object.keys(entry.record || {})))];
  const mapping = new Map(apiKeys.map(key => [key, resolveApiColumn(db, targetTable, key)]));
  const rows = entries.map(entry => {
    const original = entry.record || {};
    const originalJson = JSON.stringify(original);
    const row = {
      _syncKey: entry.syncKey,
      _hash: hashValue(original),
      _jsonOriginal: originalJson,
      _sincronizadoEm: synchronizedAt
    };
    if (entry.parentSyncKey !== undefined) row._parentSyncKey = entry.parentSyncKey;
    if (entry.itemIndex !== undefined) row._itemIndex = entry.itemIndex;
    for (const [key, value] of Object.entries(original)) row[mapping.get(key)] = serializeValue(value);
    return row;
  });

  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const columnTypes = Object.fromEntries(columns.map(column => [column, sqliteType(rows.map(row => row[column]))]));
  columnTypes._syncKey = 'TEXT';
  return { rows, columnTypes };
}

function upsertRows(db, tableName, rows, columnTypes) {
  if (!rows.length) return 0;
  ensureDynamicTable(db, tableName, columnTypes);
  const columns = Object.keys(columnTypes);
  const updates = columns
    .filter(column => column !== '_syncKey')
    .map(column => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
    .join(', ');
  const statement = db.prepare(`
    INSERT INTO ${quoteIdentifier(tableName)} (${columns.map(quoteIdentifier).join(', ')})
    VALUES (${columns.map(() => '?').join(', ')})
    ON CONFLICT(${quoteIdentifier('_syncKey')}) DO UPDATE SET ${updates}
  `);
  const write = db.transaction(batch => {
    for (const row of batch) statement.run(...columns.map(column => row[column] ?? null));
  });
  write(rows);
  return rows.length;
}

function stageName(targetTable, executionId) {
  return `_STG_${sanitizeIdentifier(targetTable, true)}_${executionId.replace(/-/g, '').slice(0, 12)}`;
}

function stageEntries(db, stagingTables, targetTable, resource, entries, synchronizedAt, type = 'PRINCIPAL') {
  if (!entries.length) return 0;
  const stagingTable = stagingTables.get(targetTable) || stageName(targetTable, stagingTables.executionId);
  stagingTables.set(targetTable, stagingTable);
  stagingTables.metadata.set(targetTable, { resource, type });
  const { rows, columnTypes } = prepareRows(db, targetTable, entries, synchronizedAt);
  return upsertRows(db, stagingTable, rows, columnTypes);
}

function stageApiRecords(db, stagingTables, targetTable, records, synchronizedAt) {
  const mainEntries = records.map(record => {
    const recordHash = hashValue(record);
    return {
      record,
      syncKey: record?.id === null || record?.id === undefined
        ? `${targetTable}:hash:${recordHash}`
        : `${targetTable}:id:${record.id}`
    };
  });
  let written = stageEntries(db, stagingTables, targetTable, targetTable, mainEntries, synchronizedAt);

  for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
    const record = records[recordIndex] || {};
    const parentSyncKey = mainEntries[recordIndex].syncKey;
    for (const [key, value] of Object.entries(record)) {
      if (!Array.isArray(value) || !value.length) continue;
      const childTarget = `${targetTable}_${sanitizeIdentifier(key, true)}`;
      const childEntries = value.map((item, itemIndex) => {
        const itemRecord = item && typeof item === 'object' ? item : { valor: item };
        const itemIdentity = itemRecord.id ?? `${itemIndex}:${hashValue(itemRecord).slice(0, 16)}`;
        return {
          record: itemRecord,
          syncKey: `${parentSyncKey}:${key}:${itemIdentity}`,
          parentSyncKey,
          itemIndex
        };
      });
      written += stageEntries(db, stagingTables, childTarget, targetTable, childEntries, synchronizedAt, 'FILHA');
    }
  }
  return written;
}

function mergeStagingTable(db, stagingTable, targetTable, metadata, executionId, synchronizedAt) {
  const stagingColumns = tableColumns(db, stagingTable);
  const columnTypes = Object.fromEntries(stagingColumns.map(column => [column.name, column.type || 'TEXT']));
  ensureDynamicTable(db, targetTable, columnTypes);
  const columns = stagingColumns.map(column => column.name);
  const updates = columns
    .filter(column => column !== '_syncKey')
    .map(column => `${quoteIdentifier(column)} = excluded.${quoteIdentifier(column)}`)
    .join(', ');
  db.exec(`
    INSERT INTO ${quoteIdentifier(targetTable)} (${columns.map(quoteIdentifier).join(', ')})
    SELECT ${columns.map(quoteIdentifier).join(', ')} FROM ${quoteIdentifier(stagingTable)} WHERE 1 = 1
    ON CONFLICT(${quoteIdentifier('_syncKey')}) DO UPDATE SET ${updates}
  `);
  const records = db.prepare(`SELECT COUNT(*) AS total FROM ${quoteIdentifier(targetTable)}`).get().total;
  db.prepare(`
    INSERT INTO API_SYNC_TABELAS (
      nome, recurso, tipo, registros, colunas, ultimaSincronizacao, ultimaExecucaoId
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(nome) DO UPDATE SET
      recurso = excluded.recurso,
      tipo = excluded.tipo,
      registros = excluded.registros,
      colunas = excluded.colunas,
      ultimaSincronizacao = excluded.ultimaSincronizacao,
      ultimaExecucaoId = excluded.ultimaExecucaoId
  `).run(targetTable, metadata.resource, metadata.type, records, columns.length, synchronizedAt, executionId);
  db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(stagingTable)}`);
  return records;
}

function commitStagedTables(db, stagingTables, executionId, synchronizedAt) {
  let total = 0;
  const merge = db.transaction(() => {
    for (const [targetTable, stagingTable] of stagingTables.entries()) {
      total += mergeStagingTable(
        db,
        stagingTable,
        targetTable,
        stagingTables.metadata.get(targetTable),
        executionId,
        synchronizedAt
      );
    }
  });
  merge();
  return total;
}

function cleanupStagingTables(db, stagingTables) {
  for (const stagingTable of stagingTables.values()) {
    try {
      db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(stagingTable)}`);
    } catch {
      // A limpeza é de melhor esforço; o próximo processo usa nomes exclusivos.
    }
  }
}

function cleanupOrphanedStagingTables(db) {
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_STG\\_%' ESCAPE '\\'
  `).all();
  for (const table of tables) db.exec(`DROP TABLE IF EXISTS ${quoteIdentifier(table.name)}`);
}

function buildDateWindows(initialIso, finalIso, maxDays = 25) {
  const start = new Date(initialIso);
  const finish = new Date(finalIso);
  const windows = [];
  const chunkSizeMs = maxDays * 24 * 60 * 60 * 1000;
  let cursor = new Date(start);
  while (cursor <= finish) {
    const nextCursor = new Date(cursor.getTime() + chunkSizeMs);
    const windowStart = cursor;
    const windowEnd = new Date(Math.min(nextCursor.getTime() - 1, finish.getTime()));
    windows.push({ dataInicial: windowStart.toISOString(), dataFinal: windowEnd.toISOString() });
    cursor = nextCursor;
  }
  return windows;
}


async function fetchJson(url, options, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (response.ok) {
      if (response.status === 204) return [];
      const responseBody = await response.text();
      return responseBody ? JSON.parse(responseBody) : [];
    }
    const body = (await response.text()).slice(0, 500);
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('retry-after')) || attempt * 3;
      await sleep(retryAfter * 1000);
      return fetchJson(url, options, attempt + 1);
    }
    throw new Error(`UNLTD respondeu ${response.status}: ${body || response.statusText}`);
  } catch (error) {
    if (attempt < MAX_RETRIES && (error.name === 'AbortError' || error.cause || /fetch/i.test(error.message))) {
      await sleep(attempt * 3000);
      return fetchJson(url, options, attempt + 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapConcurrent(items, concurrency, handler) {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await handler(items[index], index);
    }
  });
  await Promise.all(workers);
}

function collectRelatedData(value, entities, clients, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) collectRelatedData(item, entities, clients, seen);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'entidade' && child && typeof child === 'object' && child.documento) {
      entities.set(normalizeDocument(child.documento), child);
    }
    if (key === 'cliente' && child && typeof child === 'object' && child.entidade?.documento) {
      clients.set(normalizeDocument(child.entidade.documento), child);
      entities.set(normalizeDocument(child.entidade.documento), child.entidade);
    }
    collectRelatedData(child, entities, clients, seen);
  }
}

function normalizeApiObject(payload) {
  if (Array.isArray(payload)) return payload.find(item => item && typeof item === 'object') || null;
  return payload && typeof payload === 'object' ? payload : null;
}

async function enrichClients(token, clients, entities, onProgress) {
  const documents = [...clients.keys()].filter(Boolean);
  let completed = 0;
  let warnings = 0;
  await mapConcurrent(documents, REQUEST_CONCURRENCY, async document => {
    const headers = { Authorization: `UNLTD-BackEnd ${token}` };
    try {
      const [entityResult, clientResult] = await Promise.allSettled([
        fetchJson(`${API_BASE_URL}/entidades/${document}`, { headers }),
        fetchJson(`${API_BASE_URL}/entidades/cliente/${document}`, { headers })
      ]);
      if (entityResult.status === 'fulfilled') {
        const entity = normalizeApiObject(entityResult.value);
        if (entity?.documento) entities.set(normalizeDocument(entity.documento), entity);
      } else warnings += 1;
      if (clientResult.status === 'fulfilled') {
        const client = normalizeApiObject(clientResult.value);
        if (client?.entidade?.documento) {
          clients.set(normalizeDocument(client.entidade.documento), client);
          entities.set(normalizeDocument(client.entidade.documento), client.entidade);
        }
      } else warnings += 1;
    } finally {
      completed += 1;
      onProgress(completed, documents.length);
    }
  });
  return warnings;
}

function acquireProcessLock(lockPath, executionId) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  try {
    const descriptor = fs.openSync(lockPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, executionId, createdAt: isoNow() }));
    return descriptor;
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const lock = parseStoredJson(fs.readFileSync(lockPath, 'utf8'), {});
    let alive = false;
    if (lock.pid) {
      try {
        process.kill(Number(lock.pid), 0);
        alive = true;
      } catch {
        alive = false;
      }
    }
    const age = Date.now() - fs.statSync(lockPath).mtimeMs;
    if (alive && age < 8 * 60 * 60 * 1000) throw new Error('Já existe uma sincronização da API em andamento.');
    fs.unlinkSync(lockPath);
    return acquireProcessLock(lockPath, executionId);
  }
}

function releaseProcessLock(lockPath, descriptor) {
  try {
    fs.closeSync(descriptor);
  } catch {
    // noop
  }
  try {
    fs.unlinkSync(lockPath);
  } catch {
    // noop
  }
}

function createStagingRegistry(executionId) {
  const map = new Map();
  map.executionId = executionId;
  map.metadata = new Map();
  return map;
}

export async function runUnltdSync({ db, token, projectRoot, source = 'AGENDADO', requestedBy = 'sistema', executionId } = {}) {
  if (!db) throw new Error('Banco SQLite não informado.');
  ensureSyncMetadata(db);
  const id = executionId || createQueuedExecution(db, { source, requestedBy });
  if (!token) {
    const error = new Error('UNLTD_API_TOKEN não configurado.');
    updateExecution(db, id, {
      status: 'ERRO', etapa: 'Configuração incompleta', finalizadoEm: isoNow(), erro: error.message
    });
    throw error;
  }
  const lockPath = path.join(projectRoot || process.cwd(), '.unltd-sync.lock');
  let lockDescriptor;
  let receivedTotal = 0;
  let writtenTotal = 0;
  const entities = new Map();
  const clients = new Map();
  const finalDate = isoNow();
  const windows = buildDateWindows(INITIAL_DATE, finalDate, 25);

  try {
    lockDescriptor = acquireProcessLock(lockPath, id);
    cleanupOrphanedStagingTables(db);
    updateExecution(db, id, {
      status: 'EXECUTANDO',
      etapa: 'Preparando sincronização',
      progresso: 1,
      iniciadoEm: isoNow(),
      mensagem: `Consultando ${SYNC_RESOURCES.length} bases da API UNLTD.`
    });

    for (let resourceIndex = 0; resourceIndex < SYNC_RESOURCES.length; resourceIndex += 1) {
      const resource = SYNC_RESOURCES[resourceIndex];
      const synchronizedAt = isoNow();
      const stagingTables = createStagingRegistry(id);
      let resourceReceived = 0;
      let completedWindows = 0;
      updateResource(db, id, resource.name, {
        status: 'EXECUTANDO',
        janelasTotal: windows.length,
        mensagem: 'Consultando períodos de 25 dias.'
      });
      updateExecution(db, id, {
        etapa: `Consultando ${resource.name}`,
        mensagem: `Carregando ${resource.name} desde 01/01/2021.`
      });

      try {
        await mapConcurrent(windows, REQUEST_CONCURRENCY, async window => {
          const payload = await fetchJson(`${API_BASE_URL}${resource.endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `UNLTD-BackEnd ${token}`
            },
            body: JSON.stringify({ tipoDeData: resource.dateType, ...window })
          });
          const records = Array.isArray(payload) ? payload : [];
          resourceReceived += records.length;
          receivedTotal += records.length;
          stageApiRecords(db, stagingTables, resource.name, records, synchronizedAt);
          for (const record of records) collectRelatedData(record, entities, clients);
          completedWindows += 1;
          const baseProgress = resourceIndex / (SYNC_RESOURCES.length + 1);
          const windowProgress = (completedWindows / windows.length) / (SYNC_RESOURCES.length + 1);
          const progress = Math.min(88, Math.round((baseProgress + windowProgress) * 100));
          updateResource(db, id, resource.name, {
            status: 'EXECUTANDO',
            janelasConcluidas: completedWindows,
            janelasTotal: windows.length,
            registrosRecebidos: resourceReceived,
            mensagem: `${completedWindows} de ${windows.length} períodos concluídos.`
          });
          updateExecution(db, id, {
            progresso: progress,
            registrosRecebidos: receivedTotal,
            etapa: `Consultando ${resource.name}`
          });
        });

        const resourceWritten = commitStagedTables(db, stagingTables, id, synchronizedAt);
        writtenTotal += resourceWritten;
        updateResource(db, id, resource.name, {
          status: 'SUCESSO',
          janelasConcluidas: windows.length,
          janelasTotal: windows.length,
          registrosRecebidos: resourceReceived,
          registrosGravados: resourceWritten,
          mensagem: 'Base consolidada no SQLite.'
        });
      } catch (error) {
        cleanupStagingTables(db, stagingTables);
        updateResource(db, id, resource.name, { status: 'ERRO', mensagem: error.message });
        throw error;
      }
    }

    updateExecution(db, id, {
      etapa: 'Atualizando entidades e clientes',
      progresso: 89,
      mensagem: `${clients.size} clientes identificados nas bases operacionais.`
    });
    const detailWarnings = await enrichClients(token, clients, entities, (completed, total) => {
      const progress = total ? 89 + Math.round((completed / total) * 7) : 96;
      updateExecution(db, id, {
        progresso: Math.min(96, progress),
        etapa: 'Atualizando entidades e clientes',
        mensagem: `${completed} de ${total} cadastros detalhados consultados.`
      });
    });

    for (const [name, values] of [['ENTIDADES', [...entities.values()]], ['CLIENTES', [...clients.values()]]]) {
      const synchronizedAt = isoNow();
      const stagingTables = createStagingRegistry(id);
      stageApiRecords(db, stagingTables, name, values, synchronizedAt);
      const resourceWritten = commitStagedTables(db, stagingTables, id, synchronizedAt);
      writtenTotal += resourceWritten;
      receivedTotal += values.length;
      updateResource(db, id, name, {
        status: 'SUCESSO',
        janelasConcluidas: 1,
        janelasTotal: 1,
        registrosRecebidos: values.length,
        registrosGravados: resourceWritten,
        mensagem: 'Cadastros compostos a partir das bases e dos detalhes da API.'
      });
    }

    // Consolidação da tabela plana e completa de CEDENTES com endereços, telefones e agregados operacionais
    const cedentesCount = consolidateCedentesTable(db, clients, entities, isoNow());
    db.prepare(`
      INSERT INTO API_SYNC_TABELAS (
        nome, recurso, tipo, registros, colunas, ultimaSincronizacao, ultimaExecucaoId
      ) VALUES ('CEDENTES', 'CLIENTES', 'CONSOLIDADO', ?, 29, ?, ?)
      ON CONFLICT(nome) DO UPDATE SET
        recurso = excluded.recurso,
        tipo = excluded.tipo,
        registros = excluded.registros,
        colunas = excluded.colunas,
        ultimaSincronizacao = excluded.ultimaSincronizacao,
        ultimaExecucaoId = excluded.ultimaExecucaoId
    `).run(cedentesCount, isoNow(), id);

    updateExecution(db, id, {
      status: 'SUCESSO',
      etapa: 'Concluído',
      progresso: 100,
      registrosRecebidos: receivedTotal,
      registrosGravados: writtenTotal,
      finalizadoEm: isoNow(),
      mensagem: detailWarnings
        ? `Sincronização concluída com ${detailWarnings} consultas cadastrais indisponíveis; os dados incorporados nas bases foram preservados.`
        : 'Sincronização completa concluída com sucesso.',
      erro: null
    });
    return { executionId: id, receivedTotal, writtenTotal, detailWarnings };
  } catch (error) {
    updateExecution(db, id, {
      status: 'ERRO',
      etapa: 'Falha na sincronização',
      finalizadoEm: isoNow(),
      erro: String(error.message || error),
      mensagem: 'Os dados consolidados anteriormente foram mantidos.'
    });
    throw error;
  } finally {
    if (lockDescriptor !== undefined) releaseProcessLock(lockPath, lockDescriptor);
  }
}

export function getSyncDashboard(db, { databasePath, projectRoot } = {}) {
  ensureSyncMetadata(db);
  markStaleExecutions(db);
  const active = getActiveExecution(db);
  const executions = db.prepare(`
    SELECT * FROM API_SYNC_EXECUCOES ORDER BY criadoEm DESC LIMIT 12
  `).all();
  const resources = active
    ? db.prepare(`SELECT * FROM API_SYNC_RECURSOS WHERE execucaoId = ? ORDER BY recurso`).all(active.id)
    : [];
  const tables = db.prepare(`
    SELECT * FROM API_SYNC_TABELAS ORDER BY tipo, nome
  `).all().map(table => ({
    ...table,
    columns: db.prepare(`PRAGMA table_info(${quoteIdentifier(table.nome)})`).all()
      .filter(column => !column.name.startsWith('_'))
      .map(column => column.name)
  }));
  const lastSuccess = db.prepare(`
    SELECT * FROM API_SYNC_EXECUCOES WHERE status = 'SUCESSO' ORDER BY finalizadoEm DESC LIMIT 1
  `).get() || null;
  let databaseSizeBytes = 0;
  try {
    databaseSizeBytes = fs.statSync(databasePath).size;
  } catch {
    // Banco em memória ou caminho ainda indisponível.
  }
  const normalizedRoot = String(projectRoot || '').replaceAll('\\', '/').replace(/\/$/, '');
  return {
    schedule: 'Todos os dias às 07:30 (America/Sao_Paulo)',
    automaticEnabled: normalizedRoot === '/var/www/lepta',
    initialDate: INITIAL_DATE,
    databasePath,
    databaseSizeBytes,
    active: active ? { ...active, resources } : null,
    lastSuccess,
    executions,
    tables,
    totalRecords: tables.reduce((total, table) => total + Number(table.registros || 0), 0)
  };
}

export function consolidateCedentesTable(db, clientsMap = new Map(), entitiesMap = new Map(), synchronizedAt = isoNow()) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS CEDENTES (
      documento TEXT PRIMARY KEY,
      razao_social TEXT NOT NULL,
      nome_fantasia TEXT,
      tipo_pessoa TEXT,
      telefone_principal TEXT,
      telefones_adicionais TEXT,
      email_principal TEXT,
      emails_adicionais TEXT,
      logradouro TEXT,
      numero TEXT,
      complemento TEXT,
      bairro TEXT,
      cidade TEXT,
      uf TEXT,
      cep TEXT,
      endereco_completo TEXT,
      grupo_economico TEXT,
      ramo_atividade TEXT,
      cnae TEXT,
      data_cadastro TEXT,
      limite_credito REAL DEFAULT 0,
      qtd_titulos_operados INTEGER DEFAULT 0,
      valor_total_operado REAL DEFAULT 0,
      valor_em_aberto REAL DEFAULT 0,
      valor_vencido REAL DEFAULT 0,
      valor_liquidado REAL DEFAULT 0,
      socios_json TEXT,
      contatos_json TEXT,
      contas_bancarias_json TEXT,
      ultima_atualizacao TEXT NOT NULL
    )
  `);

  const hasTable = (tableName) => Boolean(
    db.prepare("SELECT 1 FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?").get(tableName)
  );

  const allDocs = new Set([...clientsMap.keys(), ...entitiesMap.keys()]);

  // Se o mapa estiver vazio, consulta a tabela ENTIDADES
  if (hasTable('ENTIDADES')) {
    try {
      const dbEntities = db.prepare(`SELECT * FROM ENTIDADES`).all();
      for (const row of dbEntities) {
        if (row.documento) allDocs.add(normalizeDocument(row.documento));
      }
    } catch {}
  }

  // Agrega métricas operacionais se TITULOS existir
  const operationalStats = new Map();
  if (hasTable('TITULOS')) {
    try {
      const pragma = db.prepare(`PRAGMA table_info("TITULOS")`).all().map(c => c.name);
      let docCol = pragma.find(c => /documento.*cedente|contaOperacional.*cliente.*documento/i.test(c)) || 'documento';
      let valNominalCol = pragma.find(c => /valornominal|valor_nominal|valor/i.test(c)) || 'valorNominal';
      let situacaoCol = pragma.find(c => /situacao/i.test(c)) || 'situacao';
      let vencCol = pragma.find(c => /vencimento/i.test(c)) || 'dataDeVencimento';

      if (pragma.includes(docCol)) {
        const rows = db.prepare(`
          SELECT 
            ${quoteIdentifier(docCol)} AS doc,
            COUNT(*) AS qtd,
            SUM(COALESCE(CAST(${quoteIdentifier(valNominalCol)} AS REAL), 0)) AS totalOperado,
            SUM(CASE WHEN lower(COALESCE(${quoteIdentifier(situacaoCol)}, '')) LIKE '%aberto%' THEN COALESCE(CAST(${quoteIdentifier(valNominalCol)} AS REAL), 0) ELSE 0 END) AS emAberto,
            SUM(CASE WHEN lower(COALESCE(${quoteIdentifier(situacaoCol)}, '')) LIKE '%vencido%' OR (lower(COALESCE(${quoteIdentifier(situacaoCol)}, '')) LIKE '%aberto%' AND ${quoteIdentifier(vencCol)} < date('now')) THEN COALESCE(CAST(${quoteIdentifier(valNominalCol)} AS REAL), 0) ELSE 0 END) AS vencido,
            SUM(CASE WHEN lower(COALESCE(${quoteIdentifier(situacaoCol)}, '')) LIKE '%liquidado%' THEN COALESCE(CAST(${quoteIdentifier(valNominalCol)} AS REAL), 0) ELSE 0 END) AS liquidado
          FROM "TITULOS"
          WHERE ${quoteIdentifier(docCol)} IS NOT NULL AND trim(${quoteIdentifier(docCol)}) != ''
          GROUP BY ${quoteIdentifier(docCol)}
        `).all();

        for (const r of rows) {
          const d = normalizeDocument(r.doc);
          if (d) {
            operationalStats.set(d, {
              qtd: r.qtd || 0,
              totalOperado: r.totalOperado || 0,
              emAberto: r.emAberto || 0,
              vencido: r.vencido || 0,
              liquidado: r.liquidado || 0
            });
            allDocs.add(d);
          }
        }
      }
    } catch (err) {
      console.log('Aviso ao agregar TITULOS para CEDENTES:', err.message);
    }
  }

  const upsertStmt = db.prepare(`
    INSERT INTO CEDENTES (
      documento, razao_social, nome_fantasia, tipo_pessoa,
      telefone_principal, telefones_adicionais, email_principal, emails_adicionais,
      logradouro, numero, complemento, bairro, cidade, uf, cep, endereco_completo,
      grupo_economico, ramo_atividade, cnae, data_cadastro, limite_credito,
      qtd_titulos_operados, valor_total_operado, valor_em_aberto, valor_vencido, valor_liquidado,
      socios_json, contatos_json, contas_bancarias_json, ultima_atualizacao
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?
    )
    ON CONFLICT(documento) DO UPDATE SET
      razao_social = excluded.razao_social,
      nome_fantasia = excluded.nome_fantasia,
      tipo_pessoa = excluded.tipo_pessoa,
      telefone_principal = excluded.telefone_principal,
      telefones_adicionais = excluded.telefones_adicionais,
      email_principal = excluded.email_principal,
      emails_adicionais = excluded.emails_adicionais,
      logradouro = excluded.logradouro,
      numero = excluded.numero,
      complemento = excluded.complemento,
      bairro = excluded.bairro,
      cidade = excluded.cidade,
      uf = excluded.uf,
      cep = excluded.cep,
      endereco_completo = excluded.endereco_completo,
      grupo_economico = excluded.grupo_economico,
      ramo_atividade = excluded.ramo_atividade,
      cnae = excluded.cnae,
      data_cadastro = excluded.data_cadastro,
      limite_credito = excluded.limite_credito,
      qtd_titulos_operados = excluded.qtd_titulos_operados,
      valor_total_operado = excluded.valor_total_operado,
      valor_em_aberto = excluded.valor_em_aberto,
      valor_vencido = excluded.valor_vencido,
      valor_liquidado = excluded.valor_liquidado,
      socios_json = excluded.socios_json,
      contatos_json = excluded.contatos_json,
      contas_bancarias_json = excluded.contas_bancarias_json,
      ultima_atualizacao = excluded.ultima_atualizacao
  `);

  const runConsolidation = db.transaction(() => {
    for (const doc of allDocs) {
      if (!doc) continue;
      const clientObj = clientsMap.get(doc) || {};
      const entityObj = entitiesMap.get(doc) || clientObj.entidade || {};

      const razaoSocial = entityObj.nome || clientObj.nome || entityObj.razaoSocial || 'Cliente sem nome';
      const nomeFantasia = entityObj.nomeFantasia || clientObj.nomeFantasia || '';
      const tipoPessoa = (entityObj.tipo || (doc.length === 11 ? 'FISICA' : 'JURIDICA')).toUpperCase();

      // Endereços
      const enderecos = Array.isArray(entityObj.enderecos) ? entityObj.enderecos : (Array.isArray(clientObj.enderecos) ? clientObj.enderecos : []);
      const primaryAddress = enderecos[0] || {};
      const logradouro = primaryAddress.logradouro || primaryAddress.rua || primaryAddress.endereco || '';
      const numero = primaryAddress.numero || '';
      const complemento = primaryAddress.complemento || '';
      const bairro = primaryAddress.bairro || '';
      const cidade = primaryAddress.cidade || primaryAddress.municipio || '';
      const uf = primaryAddress.uf || primaryAddress.estado || '';
      const cep = primaryAddress.cep || '';

      const addressParts = [
        logradouro ? `${logradouro}${numero ? `, ${numero}` : ''}${complemento ? ` - ${complemento}` : ''}` : '',
        bairro ? `Bairro ${bairro}` : '',
        cidade ? `${cidade}${uf ? `/${uf}` : ''}` : '',
        cep ? `CEP: ${cep}` : ''
      ].filter(Boolean);
      const enderecoCompleto = addressParts.join(' - ');

      // Contatos e Telefones
      const contatos = Array.isArray(entityObj.contatos) ? entityObj.contatos : (Array.isArray(clientObj.contatos) ? clientObj.contatos : []);
      const primaryPhone = entityObj.telefone || entityObj.celular || clientObj.telefone || (contatos[0]?.telefone || contatos[0]?.celular) || '';
      const allPhones = [...new Set([
        primaryPhone,
        ...(contatos.map(c => c.telefone || c.celular).filter(Boolean)),
        ...(Array.isArray(entityObj.telefones) ? entityObj.telefones.map(t => typeof t === 'object' ? t.numero || t.telefone : t) : [])
      ])].filter(Boolean);

      const primaryEmail = entityObj.email || clientObj.email || contatos[0]?.email || '';
      const allEmails = [...new Set([
        primaryEmail,
        ...(contatos.map(c => c.email).filter(Boolean)),
        ...(Array.isArray(entityObj.emails) ? entityObj.emails.map(e => typeof e === 'object' ? e.email || e.endereco : e) : [])
      ])].filter(Boolean);

      // Grupo Econômico, CNAE, Ramo
      const grupoEconomico = typeof entityObj.grupoEconomico === 'object' ? entityObj.grupoEconomico?.nome || '' : String(entityObj.grupoEconomico || '');
      const ramoAtividade = entityObj.ramoDeAtividade || entityObj.ramoAtividade || entityObj.atividadePrincipal || '';
      const cnae = entityObj.cnae || entityObj.codigoCnae || '';
      const dataCadastro = entityObj.dataCadastro || entityObj.dataDeCadastro || clientObj.dataCadastro || '';
      const limiteCredito = Number(clientObj.limiteCredito || clientObj.limite || entityObj.limiteCredito || 0);

      // Estatísticas operacionais
      const stats = operationalStats.get(doc) || { qtd: 0, totalOperado: 0, emAberto: 0, vencido: 0, liquidado: 0 };

      // Sócios e Contas
      const socios = Array.isArray(entityObj.socios) ? entityObj.socios : (Array.isArray(clientObj.socios) ? clientObj.socios : []);
      const contas = Array.isArray(clientObj.contasOperacionais) ? clientObj.contasOperacionais : (Array.isArray(clientObj.contasBancarias) ? clientObj.contasBancarias : []);

      upsertStmt.run(
        doc,
        razaoSocial,
        nomeFantasia,
        tipoPessoa,
        primaryPhone,
        allPhones.join(', '),
        primaryEmail,
        allEmails.join(', '),
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        cep,
        enderecoCompleto,
        grupoEconomico,
        ramoAtividade,
        cnae,
        dataCadastro,
        limiteCredito,
        stats.qtd,
        stats.totalOperado,
        stats.emAberto,
        stats.vencido,
        stats.liquidado,
        JSON.stringify(socios),
        JSON.stringify(contatos),
        JSON.stringify(contas),
        synchronizedAt
      );
    }
  });

  runConsolidation();
  return allDocs.size;
}
