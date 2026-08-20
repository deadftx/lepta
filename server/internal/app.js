import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';
import stringSimilarity from 'string-similarity';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { registerDatabaseSyncRoutes } from './modules/database/routes.js';
import { registerPowerBiRoutes } from './modules/database/biRoutes.js';
import { registerGrafenoRoutes } from './modules/finance/grafenoRoutes.js';
import { registerPurchaseRoutes } from './modules/purchases/routes.js';
import { ensureCedentesTableSchema, consolidateCedentesTable, syncAllCedentesFromUnltdApi } from './modules/database/unltdSync.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const configuredOrigins = String(process.env.LEPTA_ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  'https://lepta.com.br',
  'https://www.lepta.com.br',
  ...configuredOrigins
]);

function isAllowedOrigin(origin) {
  if (!origin || allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    const isDevelopmentPort = url.port === '5173';
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname)
      || /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(url.hostname);
    return isDevelopmentPort && isLocalHost;
  } catch {
    return false;
  }
}

app.use(cors({
  exposedHeaders: ['x-data-source'],
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  }
}));
app.use(express.json({ limit: '2mb', strict: true }));
app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Conteúdo enviado excede o limite permitido.' });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: 'JSON inválido.' });
  }
  next(error);
});
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src https://app.powerbi.com https://*.powerbi.com"
  ].join('; '));
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  if (req.path.startsWith('/api/auth/')) res.setHeader('Cache-Control', 'no-store');
  next();
});

// Load aliases globally
let globalAliases = {};
try {
  const aliasesPath = path.join(path.resolve(), 'aliases.json');
  if (fs.existsSync(aliasesPath)) {
    globalAliases = JSON.parse(fs.readFileSync(aliasesPath, 'utf8'));
  }
} catch(e) {
  console.log("Aviso: Falha ao ler aliases.json", e);
}

// Serve arquivos estáticos do frontend (pasta dist) em produção
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
app.use(express.static(path.join(projectRoot, 'dist')));

// Inicializa banco de dados
const configuredDbPath = String(process.env.LEPTA_DATABASE_PATH || '').trim();
const dbPath = configuredDbPath ? path.resolve(configuredDbPath) : path.join(projectRoot, 'database.sqlite');
const db = new Database(dbPath, { fileMustExist: false });
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 30000');

const authSecretPath = path.join(projectRoot, '.auth-secret');
if (!process.env.AUTH_ENCRYPTION_KEY && !fs.existsSync(authSecretPath)) {
  fs.writeFileSync(authSecretPath, randomBytes(32).toString('hex'), { mode: 0o600 });
}
const authEncryptionKey = createHash('sha256')
  .update(process.env.AUTH_ENCRYPTION_KEY || fs.readFileSync(authSecretPath, 'utf8').trim())
  .digest();

const PASSWORD_PREFIX = 'scrypt';
const authSessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const rateLimitBuckets = new Map();

function createRateLimiter({ windowMs, max, keyPrefix, includeLoginId = false }) {
  return (req, res, next) => {
    const now = Date.now();
    const loginId = String(req.body?.loginId || '').trim().toLowerCase();
    const key = `${keyPrefix}:${req.ip}${includeLoginId ? `:${loginId}` : ''}`;
    const current = rateLimitBuckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    bucket.count += 1;
    rateLimitBuckets.set(key, bucket);

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
    }
    next();
  };
}

const authIpRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60, keyPrefix: 'auth-ip' });
const loginRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: 'login', includeLoginId: true });
const recoveryRateLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 12, keyPrefix: 'recovery', includeLoginId: true });

function revokeSessionsForUser(userId) {
  for (const [token, session] of authSessions.entries()) {
    if (session.userId === userId) authSessions.delete(token);
  }
}

const sessionCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of authSessions.entries()) {
    if (session.expiresAt < now) authSessions.delete(token);
  }
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt < now) rateLimitBuckets.delete(key);
  }
}, 15 * 60 * 1000);
sessionCleanupTimer.unref();

function ensureUserSecurityColumns() {
  try {
    const columns = new Set(db.prepare(`PRAGMA table_info(usuarios_lepta)`).all().map(column => column.name));
    const additions = [
      ['secret_question', 'TEXT'],
      ['secret_answer', 'TEXT'],
      ['login_attempts', 'INTEGER NOT NULL DEFAULT 0'],
      ['secret_attempts', 'INTEGER NOT NULL DEFAULT 0'],
      ['access_locked', 'INTEGER NOT NULL DEFAULT 0'],
      ['fully_locked', 'INTEGER NOT NULL DEFAULT 0']
    ];
    for (const [name, definition] of additions) {
      if (!columns.has(name)) db.exec(`ALTER TABLE usuarios_lepta ADD COLUMN ${name} ${definition}`);
    }
    // Garante que o administrador Master nunca fique bloqueado por tentativas anteriores
    db.prepare(`UPDATE usuarios_lepta SET access_locked = 0, fully_locked = 0, login_attempts = 0 WHERE role = 'MASTER'`).run();
  } catch (error) {
    if (!String(error.message).includes('no such table')) throw error;
  }
}

function ensureAccessAreas() {
  const areas = [
    ['7.1', 'Financeiro > Processar Extrato'],
    ['7.2', 'Financeiro > LEPTA x GRAFENO'],
    ['8.1', 'Lepta Intelligence > Análise de Clientes'],
    ['8.2', 'Lepta Intelligence > Cadastro de Clientes'],
    ['8.3', 'Lepta Intelligence > Análise de Riscos'],
    ['10', 'Confirmação'],
    ['11', 'Administrativo'],
    ['11.1', 'Administrativo > Aprovação de Compras'],
    ['11.2', 'Administrativo > Configuração de Esteira de Compras']
  ];
  try {
    const insert = db.prepare(`INSERT OR IGNORE INTO areas (id, name) VALUES (?, ?)`);
    db.transaction(() => areas.forEach(area => insert.run(...area)))();
  } catch (error) {
    if (!String(error.message).includes('no such table')) throw error;
  }
}

function tableExists(tableName) {
  return Boolean(db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?
  `).get(tableName));
}

function ensurePowerBiDashboardsTableForWrite() {
  if (tableExists('power_bi_dashboards')) return false;

  db.exec(`
    CREATE TABLE power_bi_dashboards (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      embed_url TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      access_type TEXT NOT NULL DEFAULT 'ALL',
      allowed_groups TEXT NOT NULL DEFAULT '[]',
      allowed_users TEXT NOT NULL DEFAULT '[]',
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  if (!tableExists('dashboards')) return true;

  db.exec(`
    INSERT OR IGNORE INTO power_bi_dashboards (
      id, title, url, embed_url, description, access_type,
      allowed_groups, allowed_users, created_by, created_at, updated_at
    )
    SELECT
      id,
      COALESCE(title, ''),
      COALESCE(url, ''),
      COALESCE(embedUrl, url, ''),
      COALESCE(description, ''),
      COALESCE(accessType, 'ALL'),
      COALESCE(allowedGroups, '[]'),
      COALESCE(allowedUsers, '[]'),
      createdBy,
      COALESCE(createdAt, datetime('now')),
      COALESCE(createdAt, datetime('now'))
    FROM dashboards
    WHERE id IS NOT NULL AND title IS NOT NULL AND url IS NOT NULL
  `);
  return true;
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${PASSWORD_PREFIX}$${salt}$${hash}`;
}

function isPasswordHash(value) {
  return typeof value === 'string' && value.startsWith(`${PASSWORD_PREFIX}$`);
}

function verifyPassword(password, storedValue) {
  if (!isPasswordHash(storedValue)) return false;
  const [, salt, storedHash] = storedValue.split('$');
  if (!salt || !storedHash) return false;
  const suppliedHash = scryptSync(password, salt, 64);
  const expectedHash = Buffer.from(storedHash, 'hex');
  return suppliedHash.length === expectedHash.length && timingSafeEqual(suppliedHash, expectedHash);
}

const DUMMY_PASSWORD_HASH = hashPassword('invalid-login-timing-padding');

function encryptSecret(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', authEncryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `enc$${iv.toString('hex')}$${cipher.getAuthTag().toString('hex')}$${encrypted.toString('hex')}`;
}

function decryptSecret(value) {
  if (!String(value).startsWith('enc$')) return String(value || '');
  const [, iv, tag, encrypted] = String(value).split('$');
  const decipher = createDecipheriv('aes-256-gcm', authEncryptionKey, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
}

function sanitizeUser(row) {
  if (!row) return null;
  const parsed = parseRow(row);
  const {
    password, secret_question, secret_answer,
    login_attempts, secret_attempts,
    ...safeUser
  } = parsed;
  return {
    ...safeUser,
    accessLocked: Boolean(parsed.access_locked),
    fullyLocked: Boolean(parsed.fully_locked),
    requiresSecuritySetup: !parsed.secret_question || !parsed.secret_answer
  };
}

function createAuthSession(user, purpose = 'auth') {
  const existingSessions = [...authSessions.entries()]
    .filter(([, session]) => session.userId === user.id)
    .sort((left, right) => left[1].createdAt - right[1].createdAt);
  while (existingSessions.length >= 5) {
    const [oldestToken] = existingSessions.shift();
    authSessions.delete(oldestToken);
  }
  const token = randomBytes(32).toString('hex');
  const createdAt = Date.now();
  authSessions.set(token, { userId: user.id, purpose, createdAt, expiresAt: createdAt + SESSION_TTL_MS });
  return token;
}

function readSession(req) {
  const authorization = String(req.headers.authorization || '');
  if (!/^Bearer\s+[a-f0-9]{64}$/i.test(authorization)) return null;
  const token = authorization.replace(/^Bearer\s+/i, '');
  const session = authSessions.get(token);
  if (session && session.expiresAt >= Date.now()) return session;
  if (token) authSessions.delete(token);
  return null;
}

function requireSessionPurpose(allowedPurposes = ['auth']) {
  return (req, res, next) => {
    const session = readSession(req);
    if (!session || !allowedPurposes.includes(session.purpose)) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
    }
    const user = db.prepare(`SELECT * FROM usuarios_lepta WHERE id = ?`).get(session.userId);
    if (!user || user.fully_locked || user.access_locked) {
      revokeSessionsForUser(session.userId);
      return res.status(423).json({ error: 'Acesso bloqueado.' });
    }
    req.authSession = { ...session, role: user.role };
    req.authUser = user;
    next();
  };
}

const requireSession = requireSessionPurpose(['auth']);
const requireSecuritySetupSession = requireSessionPurpose(['auth', 'security-setup']);

function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.authUser || !hasPermission(req.authUser, permission)) {
      return res.status(403).json({ error: 'Usuário sem permissão para acessar este recurso.' });
    }
    next();
  };
}

function requireMaster(req, res, next) {
  if (req.authSession?.role !== 'MASTER') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  next();
}

ensureUserSecurityColumns();
ensureAccessAreas();

function migratePlaintextPasswords() {
  try {
    const users = db.prepare(`SELECT id, password FROM usuarios_lepta WHERE password IS NOT NULL AND password != ''`).all();
    const update = db.prepare(`UPDATE usuarios_lepta SET password = ? WHERE id = ?`);
    const migrate = db.transaction(rows => {
      for (const user of rows) {
        if (!isPasswordHash(user.password)) update.run(hashPassword(String(user.password)), user.id);
      }
    });
    migrate(users);
  } catch (error) {
    if (!String(error.message).includes('no such table')) {
      console.error('Falha ao proteger senhas existentes:', error.message);
    }
  }
}

migratePlaintextPasswords();

/**
 * Helper to parse row from SQLite.
 * Se o valor for um JSON string (como array de permissões), ele faz o parse.
 */
function parseRow(row) {
  if (!row) return null;
  const parsed = { ...row };
  for (const key in parsed) {
    if (typeof parsed[key] === 'string') {
      try {
        if (parsed[key].startsWith('[') || parsed[key].startsWith('{')) {
          parsed[key] = JSON.parse(parsed[key]);
        }
      } catch (e) {
        // Not a JSON string, ignore
      }
    }
  }
  return parsed;
}

/**
 * Tenta encontrar a tabela no banco.
 */
function getActualTableName(reqTable) {
  if (reqTable === 'users') return 'usuarios_lepta';
  return reqTable;
}

// -------------------------------------------------------------
// HELPER PARA BUSCAR TÍTULOS DA API UNLTD
// -------------------------------------------------------------
const UNLTD_TOKEN = String(process.env.UNLTD_API_TOKEN || '').trim();
if (!UNLTD_TOKEN) {
  console.warn('Aviso: UNLTD_API_TOKEN não configurado no ambiente do servidor.');
}
const UNLTD_INITIAL_YEAR = 2021;
const UNLTD_FINAL_YEAR_LIMIT = 2099;
const UNLTD_CONCURRENCY = 3;
const UNLTD_CACHE_TTL_MS = 60 * 60 * 1000;
const UNLTD_SITUACOES = [
  'Em Aberto',
  'Liquidado',
  'Liquidado em Cartório',
  'Baixado',
  'Recomprado',
  'Recuperação de Crédito',
  'Pró-Solvendo',
  'Perda'
];
let unltdFullHistoryCache = { data: null, updatedAt: 0, pending: null };
let unltdLiquidacoesCache = { data: null, updatedAt: 0, pending: null };
const unltdEconomicGroupCache = new Map();
const unltdClientDetailsCache = new Map();

function normalizeEntityDocument(document) {
  let digits = String(document || '').replace(/\D/g, '');
  while (![11, 14].includes(digits.length) && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

async function fetchEconomicGroupByDocument(document) {
  const normalizedDocument = normalizeEntityDocument(document);
  if (![11, 14].includes(normalizedDocument.length)) return null;

  const cached = unltdEconomicGroupCache.get(normalizedDocument);
  if (cached?.data !== undefined && Date.now() - cached.updatedAt < UNLTD_CACHE_TTL_MS) {
    return cached.data;
  }
  if (cached?.pending) return cached.pending;

  const pending = fetch(`https://lepta-backend.bit-unltd.com.br/entidades/${normalizedDocument}`, {
    headers: { 'Authorization': `UNLTD-BackEnd ${UNLTD_TOKEN}` }
  })
    .then(async response => {
      if (!response.ok) throw new Error(`UNLTD (entidade) respondeu ${response.status}`);
      const entidade = await response.json();
      return entidade?.grupoEconomico?.valido === false ? null : (entidade?.grupoEconomico || null);
    })
    .catch(error => {
      console.log(`Aviso: grupo econômico indisponível para ${normalizedDocument}:`, error.message);
      return null;
    })
    .then(data => {
      unltdEconomicGroupCache.set(normalizedDocument, { data, updatedAt: Date.now(), pending: null });
      return data;
    });

  unltdEconomicGroupCache.set(normalizedDocument, { data: undefined, updatedAt: 0, pending });
  return pending;
}

async function fetchEconomicGroupsForRecords(records) {
  const documents = Array.from(new Set(records
    .map(record => record?.contaOperacional?.cliente?.entidade?.documento)
    .map(normalizeEntityDocument)
    .filter(document => [11, 14].includes(document.length))));

  const groups = await mapWithConcurrency(documents, 5, async document => ({
    document,
    group: await fetchEconomicGroupByDocument(document)
  }));
  return new Map(groups.map(({ document, group }) => [document, group]));
}

function buildDateWindows(startDate, endDate) {
  const windows = [];
  let cursor = new Date(`${startDate}T00:00:00.000Z`);
  const limit = new Date(`${endDate}T23:59:59.999Z`);

  while (cursor <= limit) {
    const windowStart = new Date(cursor);
    const windowEnd = new Date(cursor);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 29);
    windowEnd.setUTCHours(23, 59, 59, 999);
    if (windowEnd > limit) windowEnd.setTime(limit.getTime());

    windows.push({
      dataInicial: windowStart.toISOString(),
      dataFinal: windowEnd.toISOString()
    });

    cursor = new Date(windowEnd.getTime() + 1);
    cursor.setUTCHours(0, 0, 0, 0);
  }

  return windows;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function fetchTitulosPeriod(period) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch('https://lepta-backend.bit-unltd.com.br/recebiveis/titulos', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `UNLTD-BackEnd ${UNLTD_TOKEN}`
        },
        body: JSON.stringify({ tipoDeData: 'Vencimento', situacoes: UNLTD_SITUACOES, ...period })
      });

      if (response.ok) {
        const titulos = await response.json();
        return Array.isArray(titulos) ? titulos : [];
      }

      const errorText = await response.text();
      lastError = new Error(`UNLTD respondeu ${response.status}: ${errorText}`);
      if (response.status < 500 && response.status !== 429) throw lastError;
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
    } finally {
      clearTimeout(timeout);
    }

    await new Promise(resolve => setTimeout(resolve, attempt * 750));
  }
  throw lastError || new Error('A API UNLTD não respondeu à consulta de títulos.');
}

async function fetchLiquidacoesPeriod(period) {
  const response = await fetch('https://lepta-backend.bit-unltd.com.br/recebiveis/liquidacoes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `UNLTD-BackEnd ${UNLTD_TOKEN}`
    },
    body: JSON.stringify({ tipoDeData: 'Efetivacao', ...period })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`UNLTD (liquidacoes) respondeu ${response.status}: ${errorText}`);
  }

  const liquidacoes = await response.json();
  return Array.isArray(liquidacoes) ? liquidacoes : [];
}

async function fetchTitulosRange(startDate, endDate) {
  const windows = buildDateWindows(startDate, endDate);
  const batches = await mapWithConcurrency(windows, UNLTD_CONCURRENCY, fetchTitulosPeriod);
  return batches.flat();
}

async function fetchLiquidacoesRange(startDate, endDate) {
  const windows = buildDateWindows(startDate, endDate);
  const batches = await mapWithConcurrency(windows, UNLTD_CONCURRENCY, fetchLiquidacoesPeriod);
  const unique = new Map();
  for (const liquidacao of batches.flat()) {
    const key = liquidacao.id ?? `${liquidacao.dataDeEfetivacao}-${liquidacao.totalLiquido}-${unique.size}`;
    unique.set(String(key), liquidacao);
  }
  return Array.from(unique.values());
}

function deduplicateTitulos(titulos) {
  const unique = new Map();
  for (const titulo of titulos) {
    const key = titulo.id ?? titulo.numero ?? `${titulo.dataDeVencimento}-${titulo.valorNominal}-${unique.size}`;
    unique.set(String(key), titulo);
  }
  return Array.from(unique.values());
}

async function fetchFullTitulosHistory() {
  const currentYear = new Date().getUTCFullYear();
  const allTitulos = [];

  for (let year = UNLTD_INITIAL_YEAR; year <= UNLTD_FINAL_YEAR_LIMIT; year++) {
    const yearTitulos = await fetchTitulosRange(`${year}-01-01`, `${year}-12-31`);
    allTitulos.push(...yearTitulos);

    // Só encerra depois do ano atual para não confundir lacunas históricas com fim da base.
    if (year > currentYear && yearTitulos.length === 0) break;
  }

  return deduplicateTitulos(allTitulos);
}

async function fetchTitulosDaAPI(req) {
  const { startDate, endDate } = req.query;

  if (startDate && endDate) {
    return deduplicateTitulos(await fetchTitulosRange(startDate, endDate));
  }

  const cacheIsFresh = unltdFullHistoryCache.data
    && Date.now() - unltdFullHistoryCache.updatedAt < UNLTD_CACHE_TTL_MS;
  if (cacheIsFresh) return unltdFullHistoryCache.data;

  if (!unltdFullHistoryCache.pending) {
    unltdFullHistoryCache.pending = fetchFullTitulosHistory()
      .then(data => {
        unltdFullHistoryCache.data = data;
        unltdFullHistoryCache.updatedAt = Date.now();
        return data;
      })
      .finally(() => {
        unltdFullHistoryCache.pending = null;
      });
  }

  return unltdFullHistoryCache.pending;
}

async function fetchLiquidacoesDaAPI(req) {
  const { startDate, endDate } = req.query;
  if (startDate && endDate) return fetchLiquidacoesRange(startDate, endDate);

  const cacheIsFresh = unltdLiquidacoesCache.data
    && Date.now() - unltdLiquidacoesCache.updatedAt < UNLTD_CACHE_TTL_MS;
  if (cacheIsFresh) return unltdLiquidacoesCache.data;

  if (!unltdLiquidacoesCache.pending) {
    const currentYear = new Date().getUTCFullYear();
    unltdLiquidacoesCache.pending = fetchLiquidacoesRange(
      `${UNLTD_INITIAL_YEAR}-01-01`,
      `${currentYear}-12-31`
    )
      .then(data => {
        unltdLiquidacoesCache.data = data;
        unltdLiquidacoesCache.updatedAt = Date.now();
        return data;
      })
      .finally(() => {
        unltdLiquidacoesCache.pending = null;
      });
  }

  return unltdLiquidacoesCache.pending;
}

async function fetchUnltdClientDetails(document, forceRefresh = false) {
  const normalizedDocument = normalizeEntityDocument(document);
  if (![11, 14].includes(normalizedDocument.length)) return null;

  const cached = unltdClientDetailsCache.get(normalizedDocument);
  if (!forceRefresh && cached?.data !== undefined && Date.now() - cached.updatedAt < UNLTD_CACHE_TTL_MS) {
    return cached.data;
  }
  if (!forceRefresh && cached?.pending) return cached.pending;

  const pending = fetch(`https://lepta-backend.bit-unltd.com.br/entidades/cliente/${normalizedDocument}`, {
    headers: { 'Authorization': `UNLTD-BackEnd ${UNLTD_TOKEN}` }
  }).then(async response => {
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`UNLTD (cliente) respondeu ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload) ? (payload[0] || null) : payload;
  }).then(data => {
    unltdClientDetailsCache.set(normalizedDocument, { data, updatedAt: Date.now(), pending: null });
    return data;
  }).finally(() => {
    const current = unltdClientDetailsCache.get(normalizedDocument);
    if (current?.pending) current.pending = null;
  });

  unltdClientDetailsCache.set(normalizedDocument, {
    data: cached?.data,
    updatedAt: cached?.updatedAt || 0,
    pending
  });
  return pending;
}

function ensureClientRegistrationTableForWrite() {
  if (tableExists('clientes_cadastro')) return false;
  db.exec(`
    CREATE TABLE clientes_cadastro (
      documento TEXT PRIMARY KEY,
      api_snapshot_json TEXT,
      override_json TEXT NOT NULL DEFAULT '{}',
      local_only INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT
    )
  `);
  return true;
}

function parseJsonObject(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function deepMerge(base, override) {
  if (override === undefined) return base;
  if (override === null || Array.isArray(override) || typeof override !== 'object') return override;
  const result = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [key, value] of Object.entries(override)) {
    result[key] = deepMerge(result[key], value);
  }
  return result;
}

function deepDifference(base, edited) {
  if (Array.isArray(edited)) {
    return JSON.stringify(base) === JSON.stringify(edited) ? undefined : edited;
  }
  if (edited && typeof edited === 'object') {
    const difference = {};
    for (const [key, value] of Object.entries(edited)) {
      const childDifference = deepDifference(base?.[key], value);
      if (childDifference !== undefined) difference[key] = childDifference;
    }
    return Object.keys(difference).length ? difference : undefined;
  }
  return Object.is(base, edited) ? undefined : edited;
}

function normalizeClientContacts(entity, source) {
  if (!entity || typeof entity !== 'object') return [];
  const rawContacts = Array.isArray(entity.contatos) ? entity.contatos : [];
  const contacts = rawContacts.map(contact => ({
    nome: String(contact?.nome || contact?.nomeContato || contact?.contato || '').trim(),
    telefone: String(contact?.telefone || contact?.celular || contact?.fone || '').trim(),
    fonte: source === 'api' ? 'api' : (contact?.fonte === 'api' ? 'api' : 'local')
  }));
  const primaryPhone = String(entity.telefone || '').trim();
  if (primaryPhone) {
    contacts.push({
      nome: String(entity.nomeContato || entity.contato?.nome || '').trim(),
      telefone: primaryPhone,
      fonte: source
    });
  }
  return contacts.filter(contact => contact.nome || contact.telefone);
}

function mergeClientContacts(localContacts, apiContacts) {
  const contacts = [];
  const seen = new Set();
  for (const contact of [...localContacts, ...apiContacts]) {
    const phoneKey = normalizeEntityDocument(contact.telefone);
    const key = phoneKey || `${normalizeStr(contact.nome)}|${normalizeStr(contact.telefone)}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    contacts.push(contact);
  }
  return contacts;
}

function getLocalClientRow(document) {
  if (!tableExists('clientes_cadastro')) return null;
  return db.prepare(`SELECT * FROM clientes_cadastro WHERE documento = ?`).get(normalizeEntityDocument(document)) || null;
}

function getAllLocalClientRows() {
  if (!tableExists('clientes_cadastro')) return [];
  return db.prepare(`SELECT * FROM clientes_cadastro ORDER BY updated_at DESC`).all();
}

function composeClientRegistration(apiData, localRow) {
  const snapshot = parseJsonObject(localRow?.api_snapshot_json, null);
  const override = parseJsonObject(localRow?.override_json, {});
  const base = apiData || snapshot || {};
  const mergedData = deepMerge(base, override);
  const localContacts = normalizeClientContacts(override?.entidade, 'local')
    .filter(contact => contact.fonte === 'local');
  const apiContacts = normalizeClientContacts(base?.entidade, 'api');
  const contacts = mergeClientContacts(localContacts, apiContacts);
  const data = mergedData?.entidade ? {
    ...mergedData,
    entidade: {
      ...mergedData.entidade,
      documento: normalizeEntityDocument(mergedData.entidade.documento || localRow?.documento),
      telefone: contacts[0]?.telefone || mergedData.entidade.telefone || '',
      contatos: contacts
    }
  } : mergedData;
  return {
    data,
    source: apiData ? (localRow ? 'api+local' : 'api') : 'local',
    hasLocalData: Boolean(localRow),
    localOnly: Boolean(localRow?.local_only),
    apiAvailable: Boolean(apiData),
    updatedAt: localRow?.updated_at || null,
    updatedBy: localRow?.updated_by || null
  };
}

function clientRegistrationSummary(composed) {
  const entidade = composed.data?.entidade || {};
  return {
    documento: normalizeEntityDocument(entidade.documento),
    nome: entidade.nome || 'Cliente sem nome',
    telefone: entidade.telefone || '',
    email: entidade.email || '',
    tipo: entidade.tipo || '',
    grupoEconomico: entidade.grupoEconomico?.nome || '',
    source: composed.source,
    hasLocalData: composed.hasLocalData,
    localOnly: composed.localOnly,
    apiAvailable: composed.apiAvailable,
    updatedAt: composed.updatedAt
  };
}

function requireClientRegistrationAccess(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user || !hasPermission(user, '8.2')) {
    return res.status(403).json({ error: 'Usuário sem acesso ao Cadastro de Clientes.' });
  }
  req.clientRegistrationUser = user;
  next();
}

app.get('/api/clientes-cadastro', requireSession, requireClientRegistrationAccess, async (req, res) => {
  const search = String(req.query.search || '').trim();
  if (search.length < 2) return res.status(400).json({ error: 'Informe pelo menos 2 caracteres para buscar.' });

  try {
    const normalizedSearch = normalizeStr(search);
    const documentSearch = normalizeEntityDocument(search);
    const candidates = new Map();
    let apiWarning = null;

    if ([11, 14].includes(documentSearch.length)) {
      try {
        const detail = await fetchUnltdClientDetails(documentSearch);
        if (detail?.entidade) candidates.set(documentSearch, detail);
      } catch (error) {
        apiWarning = error.message;
      }
    } else {
      try {
        const titles = await fetchTitulosDaAPI(req);
        for (const title of titles) {
          const entidade = title?.contaOperacional?.cliente?.entidade;
          const document = normalizeEntityDocument(entidade?.documento);
          if (!document || candidates.has(document)) continue;
          if (normalizeStr(entidade?.nome).includes(normalizedSearch)) {
            candidates.set(document, { entidade, contasOperacionais: [], contasGraficas: [] });
          }
        }
      } catch (error) {
        apiWarning = error.message;
      }
    }

    const localRows = getAllLocalClientRows();
    const localByDocument = new Map(localRows.map(row => [row.documento, row]));
    for (const row of localRows) {
      const localComposed = composeClientRegistration(null, row);
      const summary = clientRegistrationSummary(localComposed);
      const matches = normalizeStr(summary.nome).includes(normalizedSearch)
        || (documentSearch && summary.documento.includes(documentSearch))
        || normalizeStr(summary.email).includes(normalizedSearch);
      if (matches && !candidates.has(row.documento)) candidates.set(row.documento, null);
    }

    const selectedCandidates = Array.from(candidates.entries()).slice(0, 30);
    const results = await mapWithConcurrency(selectedCandidates, 5, async ([document, preliminary]) => {
      let apiData = null;
      try {
        apiData = preliminary?.contasOperacionais?.length
          ? preliminary
          : await fetchUnltdClientDetails(document);
      } catch {
        apiData = preliminary;
      }
      return clientRegistrationSummary(composeClientRegistration(apiData, localByDocument.get(document)));
    });

    results.sort((a, b) => a.nome.localeCompare(b.nome));
    return res.json({ results, warning: apiWarning, total: results.length });
  } catch (error) {
    console.error('Erro na busca cadastral de clientes:', error.message);
    return res.status(500).json({ error: 'Não foi possível buscar os clientes.' });
  }
});

app.get('/api/clientes-cadastro/:documento', requireSession, requireClientRegistrationAccess, async (req, res) => {
  const document = normalizeEntityDocument(req.params.documento);
  if (![11, 14].includes(document.length)) return res.status(400).json({ error: 'CPF/CNPJ inválido.' });

  const localRow = getLocalClientRow(document);
  let apiData = null;
  let apiWarning = null;
  try {
    apiData = await fetchUnltdClientDetails(document);
  } catch (error) {
    apiWarning = error.message;
  }
  if (!apiData && !localRow) return res.status(404).json({ error: 'Cliente não encontrado.' });
  return res.json({ ...composeClientRegistration(apiData, localRow), warning: apiWarning });
});

app.post('/api/clientes-cadastro', requireSession, requireClientRegistrationAccess, async (req, res) => {
  const data = req.body?.data;
  const document = normalizeEntityDocument(data?.entidade?.documento);
  if (![11, 14].includes(document.length)) return res.status(400).json({ error: 'Informe um CPF/CNPJ válido.' });
  if (!String(data?.entidade?.nome || '').trim()) return res.status(400).json({ error: 'Informe o nome do cliente.' });

  let apiData = null;
  try { apiData = await fetchUnltdClientDetails(document, true); } catch { /* cadastro local permitido */ }
  if (apiData) return res.status(409).json({ error: 'Este cliente já existe na UNLTD. Abra o cadastro encontrado para editar.' });

  ensureClientRegistrationTableForWrite();
  if (getLocalClientRow(document)) return res.status(409).json({ error: 'Este cliente já possui cadastro interno.' });

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO clientes_cadastro (
      documento, api_snapshot_json, override_json, local_only,
      created_at, updated_at, updated_by
    ) VALUES (?, NULL, ?, 1, ?, ?, ?)
  `).run(document, JSON.stringify(data), now, now, req.clientRegistrationUser.username || req.clientRegistrationUser.id);
  return res.status(201).json(composeClientRegistration(null, getLocalClientRow(document)));
});

app.put('/api/clientes-cadastro/:documento', requireSession, requireClientRegistrationAccess, async (req, res) => {
  const document = normalizeEntityDocument(req.params.documento);
  const editedData = req.body?.data;
  if (![11, 14].includes(document.length)) return res.status(400).json({ error: 'CPF/CNPJ inválido.' });
  if (!String(editedData?.entidade?.nome || '').trim()) return res.status(400).json({ error: 'Informe o nome do cliente.' });

  const existing = getLocalClientRow(document);
  let apiData = null;
  try { apiData = await fetchUnltdClientDetails(document, true); } catch { /* usa snapshot local */ }
  const snapshot = apiData || parseJsonObject(existing?.api_snapshot_json, null);
  const override = snapshot ? (deepDifference(snapshot, editedData) || {}) : editedData;
  const now = new Date().toISOString();
  ensureClientRegistrationTableForWrite();
  db.prepare(`
    INSERT INTO clientes_cadastro (
      documento, api_snapshot_json, override_json, local_only,
      created_at, updated_at, updated_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(documento) DO UPDATE SET
      api_snapshot_json = excluded.api_snapshot_json,
      override_json = excluded.override_json,
      local_only = excluded.local_only,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).run(
    document,
    snapshot ? JSON.stringify(snapshot) : null,
    JSON.stringify(override),
    apiData ? 0 : (existing?.local_only ?? 1),
    existing?.created_at || now,
    now,
    req.clientRegistrationUser.username || req.clientRegistrationUser.id
  );
  return res.json(composeClientRegistration(apiData, getLocalClientRow(document)));
});

app.delete('/api/clientes-cadastro/:documento', requireSession, requireClientRegistrationAccess, (req, res) => {
  const document = normalizeEntityDocument(req.params.documento);
  if (!tableExists('clientes_cadastro')) return res.status(404).json({ error: 'Não há cadastro interno para excluir.' });
  const result = db.prepare(`DELETE FROM clientes_cadastro WHERE documento = ?`).run(document);
  if (!result.changes) return res.status(404).json({ error: 'Não há cadastro interno para excluir.' });
  return res.json({ success: true });
});

// -------------------------------------------------------------
// ROTA CUSTOMIZADA: IMPORTAÇÃO DE PLANILHA VIA STREAMING PARA SQLITE
// -------------------------------------------------------------
const MAX_SYNC_FILE_BYTES = 350 * 1024 * 1024;

function quoteSqlIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

const PROTECTED_DATABASE_TABLES = new Set([
  'usuarios_lepta', 'groups', 'areas', 'calendarevents', 'databasetables',
  'dashboards', 'power_bi_dashboards', 'clientes_cadastro', 'sqlite_sequence'
]);

function validateImportedSchema(tableName, headers) {
  const normalizedTableName = String(tableName || '').trim().toLowerCase();
  const hasControlCharacters = [...normalizedTableName].some(character => character.charCodeAt(0) < 32);
  if (!normalizedTableName || normalizedTableName.length > 120 || hasControlCharacters) {
    throw new Error('A planilha contém um nome de base inválido.');
  }
  if (PROTECTED_DATABASE_TABLES.has(normalizedTableName) || normalizedTableName.startsWith('sqlite_')) {
    throw new Error(`A base "${tableName}" usa um nome reservado do sistema.`);
  }
  if (!headers.length || headers.length > 500 || headers.some(header => String(header).length > 200)) {
    throw new Error(`A base "${tableName}" possui colunas fora dos limites permitidos.`);
  }
}

function isLoopbackRequest(req) {
  return ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.ip);
}

function validateRemoteSpreadsheetUrl(value) {
  const url = new URL(value);
  if (url.username || url.password) throw new Error('Links com credenciais embutidas não são permitidos.');
  if (url.protocol !== 'https:') throw new Error('Somente links HTTPS são permitidos.');
  const hostname = url.hostname.toLowerCase();
  const configuredHosts = String(process.env.LEPTA_SYNC_ALLOWED_HOSTS || '')
    .split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
  const allowedHosts = ['sharepoint.com', 'onedrive.live.com', '1drv.ms', ...configuredHosts];
  const isAllowed = allowedHosts.some(host => hostname === host || hostname.endsWith(`.${host}`));
  if (!isAllowed) throw new Error('O domínio informado não está autorizado para importação.');
  return url;
}

app.post('/api/sync-link', requireSession, requirePermission('9'), async (req, res) => {
  const sourceUrl = typeof req.body?.url === 'string'
    ? req.body.url
    : (typeof req.body?.sourceUrl === 'string' ? req.body.sourceUrl : '');

  if (!sourceUrl) {
    return res.status(400).json({ success: false, message: 'URL da planilha não fornecida.' });
  }

  let tempFilePath = '';

  try {
    let cleanUrl = sourceUrl.trim();
    // Remove aspas caso o usuário tenha colado com aspas ("C:\...")
    if (cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) {
      cleanUrl = cleanUrl.slice(1, -1);
    }

    const looksLikeRemoteUrl = /^https?:\/\//i.test(cleanUrl);
    if (!looksLikeRemoteUrl) {
      if (!isLoopbackRequest(req) && process.env.LEPTA_ALLOW_LOCAL_SYNC !== 'true') {
        return res.status(403).json({ success: false, message: 'Leitura de arquivos locais não permitida neste servidor.' });
      }
      if (cleanUrl.startsWith('file://')) cleanUrl = cleanUrl.replace(/^file:\/\/\//, '');
      tempFilePath = path.resolve(cleanUrl);
      if (!['.xlsx', '.xlsm'].includes(path.extname(tempFilePath).toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Somente planilhas .xlsx ou .xlsm são permitidas.' });
      }
      if (!fs.existsSync(tempFilePath)) {
        return res.status(404).json({ success: false, message: 'Arquivo local não encontrado.' });
      }
      const stats = fs.statSync(tempFilePath);
      if (stats.isDirectory()) {
         return res.status(400).json({ success: false, message: 'O caminho informado é de uma pasta, não de um arquivo Excel. Por favor, aponte para o arquivo .xlsx final.' });
      }
      if (stats.size > MAX_SYNC_FILE_BYTES) {
        return res.status(413).json({ success: false, message: 'A planilha excede o limite seguro de 350 MB.' });
      }
      console.log(`📂 Lendo arquivo local diretamente: ${tempFilePath}`);
    } else {
      const remoteUrl = validateRemoteSpreadsheetUrl(cleanUrl);
      cleanUrl = remoteUrl.toString();
      tempFilePath = path.join(process.cwd(), `temp_download_${Date.now()}.xlsx`);
      console.log(`📡 Baixando planilha do SharePoint/OneDrive no servidor Node: ${cleanUrl}`);

      if (cleanUrl.includes('sharepoint.com') || cleanUrl.includes('onedrive')) {
        if (!cleanUrl.includes('download=1')) {
          cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + 'download=1';
        }
      }

      const resFetch = await fetch(cleanUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      if (!resFetch.ok) {
        throw new Error(`Falha ao baixar arquivo remoto (${resFetch.status}).`);
      }

      const contentLength = Number(resFetch.headers.get('content-length') || 0);
      if (contentLength > MAX_SYNC_FILE_BYTES) throw new Error('A planilha excede o limite seguro de 350 MB.');
      const arrayBuffer = await resFetch.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_SYNC_FILE_BYTES) throw new Error('A planilha excede o limite seguro de 350 MB.');
      fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));
      console.log(`💾 Download concluído!`);
    }

    console.log(`⚡ Processando bases via ExcelJS Streaming direto para SQLite...`);
    const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(tempFilePath, {
      entries: 'emit',
      sharedStrings: 'cache',
      hyperlinks: 'ignore',
      styles: 'ignore',
      worksheets: 'emit'
    });

    const createdTables = [];
    const now = new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');

    for await (const worksheetReader of workbookReader) {
      const sheetName = worksheetReader.name;
      const tableName = sheetName.trim();
      let headers = [];
      let initBuffer = [];
      let headerRowIndex = -1;
      let insertStmt = null;
      let rowCount = 0;
      let rowBuffer = [];

      const flushRows = db.transaction((rowsToInsert) => {
        if (!insertStmt) return;
        for (const r of rowsToInsert) {
          insertStmt.run(r);
          rowCount++;
        }
      });

      const processRow = (rawValues) => {
        let hasContent = false;
        const values = headers.map((h, idx) => {
          let val = rawValues[idx];
          if (val && typeof val === 'object') {
            if ('result' in val) val = val.result;
            else if ('text' in val) val = val.text;
            else if (val instanceof Date) val = val.toISOString().split('T')[0];
          }
          if (val !== undefined && val !== null && val !== '') hasContent = true;
          return String(val ?? '');
        });

        if (hasContent) {
          rowBuffer.push(values);
          if (rowBuffer.length >= 5000) {
            flushRows(rowBuffer);
            rowBuffer = [];
          }
        }
      };

      const determineHeaderAndProcess = () => {
        if (initBuffer.length === 0) return;
        let maxCols = 0;
        let bestIdx = 0;
        initBuffer.forEach((r, idx) => {
          const count = Array.from(r).filter(v => v !== null && v !== undefined && String(v).trim() !== '').length;
          if (count > maxCols) { maxCols = count; bestIdx = idx; }
        });
        headerRowIndex = bestIdx;

        let rawHeaders = Array.from(initBuffer[bestIdx] || []).map((val, idx) => {
          if (val && typeof val === 'object' && 'result' in val) return String(val.result || `Coluna ${idx + 1}`);
          return String(val ?? `Coluna ${idx + 1}`).trim();
        });

        const seen = new Set();
        headers = rawHeaders.map(h => {
           let cleanH = h.replace(/"/g, '');
           if (!cleanH) cleanH = 'Coluna_Vazia';
           let finalH = cleanH;
           let i = 1;
           while (seen.has(finalH)) {
               finalH = `${cleanH}_${i}`;
               i++;
           }
           seen.add(finalH);
           return finalH;
        });

        if (headers.length > 0) {
           validateImportedSchema(tableName, headers);
           const quotedTableName = quoteSqlIdentifier(tableName);
           const colsSql = headers.map(h => `${quoteSqlIdentifier(h)} TEXT`).join(', ');
           const createSql = `CREATE TABLE ${quotedTableName} (${colsSql})`;
           try {
             db.exec(`DROP TABLE IF EXISTS ${quotedTableName}`);
             db.exec(createSql);
             const placeholders = headers.map(() => '?').join(', ');
             const insertSql = `INSERT INTO ${quotedTableName} (${headers.map(quoteSqlIdentifier).join(', ')}) VALUES (${placeholders})`;
             insertStmt = db.prepare(insertSql);
           } catch (sqlErr) {
             console.error(`ERRO SQLITE NA ABA "${tableName}":`, sqlErr.message);
             console.error(`CREATE SQL TENTADO:`, createSql);
             throw sqlErr;
           }

           for (let i = bestIdx + 1; i < initBuffer.length; i++) {
              processRow(initBuffer[i]);
           }
        }
        initBuffer = [];
      };

      for await (const row of worksheetReader) {
        const rawValues = Array.isArray(row.values) ? row.values.slice(1) : [];
        if (rawValues.length === 0) continue;

        if (headerRowIndex === -1) {
          initBuffer.push(rawValues);
          if (initBuffer.length >= 30) determineHeaderAndProcess();
        } else {
          processRow(rawValues);
        }
      }

      if (headerRowIndex === -1 && initBuffer.length > 0) determineHeaderAndProcess();

      if (rowBuffer.length > 0) flushRows(rowBuffer);

      if (headers.length > 0) {
        const pk = headers.find(c => /id|código|codigo|cnpj|cpf|data|chave/i.test(c)) || headers[0] || 'id';
        createdTables.push({
          id: `table_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          tableName,
          sheetName,
          sourceType: 'LINK',
          sourceUrl: sourceUrl,
          columns: headers,
          primaryKey: pk,
          rowCount: rowCount,
          lastSyncedAt: now,
          data: []
        });
        console.log(`✅ Base "${tableName}" sincronizada no SQLite: ${rowCount} registros, ${headers.length} colunas.`);
      }
    }

    db.exec(`CREATE TABLE IF NOT EXISTS databaseTables (id TEXT PRIMARY KEY, json_content TEXT)`);
    const stmt = db.prepare(`INSERT OR REPLACE INTO databaseTables (id, json_content) VALUES (?, ?)`);
    createdTables.forEach(t => {
       stmt.run(t.id, JSON.stringify(t));
    });

    return res.json({
      success: true,
      message: `${createdTables.length} tabela(s) de bases sincronizadas com sucesso direto no SQLite!`,
      tablesCount: createdTables.length,
      tables: createdTables.map(t => ({ id: t.id, tableName: t.tableName, rowCount: t.rowCount }))
    });

  } catch (err) {
    console.error('Erro na sincronização Node:', err);
    let errorMsg = err.message || 'Erro ao sincronizar planilha';
    if (errorMsg.includes('invalid signature') || errorMsg.includes('Falha ao baixar arquivo remoto')) {
      errorMsg = 'O SharePoint bloqueou o download automático exigindo Login (Link Privado). Tente gerar um link público "Qualquer pessoa com o link" ou cole o caminho do arquivo local sincronizado no seu OneDrive (ex: C:\\Users\\...\\Planilha.xlsx).';
    }
    return res.status(500).json({ success: false, message: errorMsg });
  } finally {
    if (tempFilePath.includes('temp_download_') && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (e) {}
    }
  }
});

// -------------------------------------------------------------
// ROTA: ANÁLISE DE CLIENTES (Agregação da tabela BASE)
// -------------------------------------------------------------
function normalizeStr(str) {
  if (!str) return '';
  let s = String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // Replace anything that is not alphanumeric with space
  s = s.replace(/[^a-z0-9\s]/g, " ");

  // Specific business aliases to merge groups (APPLY BEFORE STOPWORDS)
  // If we find an alias match, we FORCE the entire string to be exactly that alias,
  // ensuring perfect 100% similarity.
  for (const [key, val] of Object.entries(globalAliases)) {
    if (s.includes(key)) {
      return val;
    }
  }

  // Remove common corporate suffixes/prefixes
  const stopwords = ['ltda', 'indl', 'industria', 'grupo', 's a', 'sa', 'cia', 'me', 'epp', 'eireli', 'comercio', 'servicos', 'lt', 'da', 'ind', 'com'];

  const words = s.split(/\s+/);
  const filtered = words.filter(w => !stopwords.includes(w) && w.length > 0);

  // If the result is empty (e.g. string was just "grupo ltda"), fallback to original
  if (filtered.length === 0) return s.trim();

  let finalStr = filtered.join(' ').trim();

  return finalStr;
}

function toRiskDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function riskEntityFromTitle(title, type) {
  return type === 'sacado'
    ? title?.sacado?.entidade
    : title?.contaOperacional?.cliente?.entidade;
}

function riskCounterpartyFromTitle(title, type) {
  return type === 'sacado'
    ? title?.contaOperacional?.cliente?.entidade
    : title?.sacado?.entidade;
}

function riskTitleMatches(title, type, document, name) {
  const entity = riskEntityFromTitle(title, type);
  if (!entity) return false;
  if (document) return normalizeEntityDocument(entity.documento) === document;
  return normalizeStr(entity.nome) === normalizeStr(name);
}

function riskSituation(title) {
  if (!title) return '';
  if (typeof title.situacao === 'string') return title.situacao.toLowerCase();
  if (typeof title.situacao === 'object' && title.situacao) {
    return String(title.situacao.descricao || title.situacao.nome || JSON.stringify(title.situacao)).toLowerCase();
  }
  return String(title.situacao || '').toLowerCase();
}

function isOpenRiskTitle(title) {
  const sit = riskSituation(title);
  return sit.includes('aberto') || sit === '' || !sit;
}

function isLiquidatedRiskTitle(title) {
  return riskSituation(title).includes('liquidado') || riskSituation(title).includes('liq.');
}

function isCobrancaSimplesTitle(title) {
  if (!title) return false;

  const targetTokens = new Set([
    'CS', 'CBS', 'CMS', 'CBV', 'CUS', 'DMS',
    'COBRANCA SIMPLES', 'COBRANÇA SIMPLES', 'COB. SIMPLES', 'COBR. SIMPLES'
  ]);

  function matchesValue(val) {
    if (!val) return false;
    if (typeof val === 'number') return false;
    if (typeof val === 'object') {
      for (const k of Object.keys(val)) {
        if (matchesValue(val[k])) return true;
      }
      return false;
    }
    const str = String(val).toUpperCase().trim();
    if (targetTokens.has(str)) return true;
    if (
      str.includes('COBRANCA SIMPLES') ||
      str.includes('COBRANÇA SIMPLES') ||
      str.includes('COB. SIMPLES') ||
      str.includes('COBR. SIMPLES')
    ) return true;
    if (/\b(CS|CBS|CMS|CBV|CUS|DMS)\b/.test(str)) return true;
    return false;
  }

  const specificFields = [
    title.produto,
    title.PRODUTO,
    title.produtoSigla,
    title.produtoNome,
    title.sigla,
    title.SIGLA,
    title.tipo,
    title.TIPO,
    title.tipoDeTitulo,
    title.tipoDoTitulo,
    title.tipoCobranca,
    title.tipoDeCobranca,
    title.carteira,
    title.tipoDeCarteira,
    title.modalidade,
    title.modalidadeDeCobranca,
    title.subtipo,
    title.natureza,
    title.especie,
    title.situacao,
    title.operacao,
    title.contaOperacional
  ];

  for (const field of specificFields) {
    if (matchesValue(field)) return true;
  }

  for (const key of Object.keys(title)) {
    if (matchesValue(title[key])) return true;
  }

  return false;
}


function daysBetweenRiskDates(later, earlier) {
  if (!later || !earlier) return null;
  return Math.floor((later.getTime() - earlier.getTime()) / 86400000);
}

function riskLevelFromScore(score) {
  if (score >= 80) return 'Baixo';
  if (score >= 60) return 'Moderado';
  if (score >= 40) return 'Alto';
  return 'Crítico';
}

function buildRiskList(titles, type, search) {
  const searchNormalized = normalizeStr(search);
  const searchDocument = normalizeEntityDocument(search);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entities = new Map();
  let ignoredRecords = 0;

  for (const title of titles) {
    try {
      const entity = riskEntityFromTitle(title, type);
      if (!entity?.nome) continue;
      const entityName = String(entity.nome).trim();
      if (!entityName) continue;
      const document = normalizeEntityDocument(entity.documento);
      const key = document || normalizeStr(entityName);
      if (!key) continue;
      const matchesSearch = !search
        || normalizeStr(entityName).includes(searchNormalized)
        || (searchDocument && document.includes(searchDocument));
      if (!matchesSearch) continue;

      if (!entities.has(key)) {
        entities.set(key, {
          nome: entityName,
          documento: document,
          grupoEconomico: String(entity.grupoEconomico?.nome || ''),
          qtdTitulos: 0,
          valorGeral: 0,
          valorAberto: 0,
          valorVencido: 0
        });
      }
      const current = entities.get(key);
      const nominal = Number(title.valorNominal) || 0;
      const dueDate = toRiskDate(title.dataDeVencimento);
      const open = isOpenRiskTitle(title);
      const cobrancaSimples = isCobrancaSimplesTitle(title);
      current.qtdTitulos += 1;
      current.valorGeral += nominal;
      if (open && !cobrancaSimples) current.valorAberto += nominal;
      if (open && !cobrancaSimples && dueDate && dueDate < today) current.valorVencido += nominal;
    } catch {
      ignoredRecords += 1;
    }
  }

  if (ignoredRecords) console.log(`Análise de riscos ignorou ${ignoredRecords} título(s) com estrutura inválida.`);

  return Array.from(entities.values())
    .map(entity => ({
      ...entity,
      percentualVencido: entity.valorAberto > 0 ? entity.valorVencido / entity.valorAberto : 0
    }))
    .sort((left, right) => right.valorAberto - left.valorAberto)
    .slice(0, 30);
}

function buildRiskClientSuggestionsFromDatabase(search) {
  if (tableExists('CEDENTES')) {
    const normalizedSearch = `%${String(search || '').trim().toLowerCase()}%`;
    const rows = db.prepare(`
      SELECT
        razao_social AS nome,
        documento,
        grupo_economico AS grupoEconomico,
        qtd_titulos_operados AS qtdTitulos,
        valor_total_operado AS valorGeral,
        valor_em_aberto AS valorAberto,
        valor_vencido AS valorVencido
      FROM CEDENTES
      WHERE razao_social IS NOT NULL
        AND (lower(razao_social) LIKE ? OR lower(documento) LIKE ?)
      ORDER BY valor_em_aberto DESC, valor_total_operado DESC
      LIMIT 30
    `).all(normalizedSearch, normalizedSearch);

    if (rows.length > 0) {
      return rows.map(row => ({
        nome: String(row.nome || '').trim(),
        documento: normalizeEntityDocument(row.documento),
        grupoEconomico: String(row.grupoEconomico || ''),
        qtdTitulos: Number(row.qtdTitulos) || 0,
        valorGeral: Number(row.valorGeral) || 0,
        valorAberto: Number(row.valorAberto) || 0,
        valorVencido: Number(row.valorVencido) || 0,
        percentualVencido: Number(row.valorAberto) > 0
          ? (Number(row.valorVencido) || 0) / Number(row.valorAberto)
          : 0,
        indicePesquisa: 'CEDENTES',
        fonteCalculos: 'API UNLTD'
      }));
    }
  }
  return [];
}

function buildLiquidationTitleDates(liquidations) {
  const dates = new Map();
  for (const liquidation of liquidations) {
    const effectiveDate = toRiskDate(liquidation.dataDeEfetivacao || liquidation.dataDeCadastro);
    if (!effectiveDate) continue;
    const rawItems = liquidation?.itens;
    const items = Array.isArray(rawItems)
      ? rawItems
      : (rawItems && typeof rawItems === 'object' ? Object.values(rawItems) : []);
    for (const item of items) {
      const titleId = item?.titulo?.id;
      if (titleId !== undefined && titleId !== null) dates.set(String(titleId), effectiveDate);
    }
  }
  return dates;
}

async function buildRiskDetails(titles, liquidations, type, document, name) {
  const selected = titles.filter(title => riskTitleMatches(title, type, document, name));
  if (!selected.length) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entity = riskEntityFromTitle(selected[0], type);
  const liquidationDates = buildLiquidationTitleDates(liquidations);
  const aging = [
    { chave: '1-7', rotulo: '1 a 7 dias', minimo: 1, maximo: 7, valor: 0, quantidade: 0 },
    { chave: '8-15', rotulo: '8 a 15 dias', minimo: 8, maximo: 15, valor: 0, quantidade: 0 },
    { chave: '16-30', rotulo: '16 a 30 dias', minimo: 16, maximo: 30, valor: 0, quantidade: 0 },
    { chave: '31-60', rotulo: '31 a 60 dias', minimo: 31, maximo: 60, valor: 0, quantidade: 0 },
    { chave: '61-90', rotulo: '61 a 90 dias', minimo: 61, maximo: 90, valor: 0, quantidade: 0 },
    { chave: '90+', rotulo: 'Acima de 90 dias', minimo: 91, maximo: Infinity, valor: 0, quantidade: 0 }
  ];
  const future = [
    { rotulo: 'Próximos 30 dias', minimo: 0, maximo: 30, valor: 0 },
    { rotulo: '31 a 60 dias', minimo: 31, maximo: 60, valor: 0 },
    { rotulo: '61 a 90 dias', minimo: 61, maximo: 90, valor: 0 },
    { rotulo: 'Acima de 90 dias', minimo: 91, maximo: Infinity, valor: 0 }
  ];
  const counterparties = new Map();
  const situations = new Map();
  const monthly = new Map();
  const limitValues = new Set();
  const delays = [];
  let onTime = 0;
  let settledWithDate = 0;
  let valorGeral = 0;
  let valorAberto = 0;
  let valorVencido = 0;
  let valorLiquidado = 0;
  let valorAdverso = 0;
  let valorAcima60 = 0;
  let valorCobrancaSimples = 0;
  let qtdCobrancaSimples = 0;
  let documented = 0;

  for (const title of selected) {
    const nominal = Number(title.valorNominal) || 0;
    const dueDate = toRiskDate(title.dataDeVencimento);
    const open = isOpenRiskTitle(title);
    const liquidated = isLiquidatedRiskTitle(title);
    const cobrancaSimples = isCobrancaSimplesTitle(title);
    const situation = String(title.situacao || 'Sem situação');
    const situationNormalized = riskSituation(title);
    const counterparty = riskCounterpartyFromTitle(title, type);
    const counterpartyKey = normalizeEntityDocument(counterparty?.documento) || normalizeStr(counterparty?.nome) || 'sem-contraparte';
    const counterpartyCurrent = counterparties.get(counterpartyKey) || {
      nome: counterparty?.nome || 'Não informado',
      documento: normalizeEntityDocument(counterparty?.documento),
      valorAberto: 0,
      valorVencido: 0,
      qtdTitulos: 0
    };

    valorGeral += nominal;
    situations.set(situation, (situations.get(situation) || 0) + nominal);
    counterpartyCurrent.qtdTitulos += 1;
    if (open) {
      if (cobrancaSimples) {
        valorCobrancaSimples += nominal;
        qtdCobrancaSimples += 1;
      } else {
        valorAberto += nominal;
        counterpartyCurrent.valorAberto += nominal;
      }
    }
    if (open && !cobrancaSimples && dueDate && dueDate < today) {
      const overdueDays = Math.max(1, -daysBetweenRiskDates(dueDate, today));
      valorVencido += nominal;
      counterpartyCurrent.valorVencido += nominal;
      const bucket = aging.find(item => overdueDays >= item.minimo && overdueDays <= item.maximo);
      if (bucket) {
        bucket.valor += nominal;
        bucket.quantidade += 1;
      }
      if (overdueDays > 60) valorAcima60 += nominal;
    } else if (open && !cobrancaSimples && dueDate) {
      const daysUntilDue = Math.max(0, daysBetweenRiskDates(dueDate, today));
      const bucket = future.find(item => daysUntilDue >= item.minimo && daysUntilDue <= item.maximo);
      if (bucket) bucket.valor += nominal;
    }
    if (liquidated) {
      valorLiquidado += Number(title.valorLiquido ?? title.valorNominal) || 0;
      const paidDate = liquidationDates.get(String(title.id)) || toRiskDate(title.dataDaSituacao);
      const delay = daysBetweenRiskDates(paidDate, dueDate);
      if (delay !== null) {
        settledWithDate += 1;
        delays.push(Math.max(0, delay));
        if (delay <= 0) onTime += 1;
      }
    }
    if (['recomprado', 'recuperação de crédito', 'recuperacao de credito', 'pró-solvendo', 'pro-solvendo', 'perda']
      .some(status => situationNormalized.includes(status))) {
      valorAdverso += nominal;
    }
    if (title.codigoDoLastro && title.manifesto && title.registradoNoCobrador !== false) documented += 1;
    counterparties.set(counterpartyKey, counterpartyCurrent);

    if (dueDate) {
      const monthKey = dueDate.toISOString().slice(0, 7);
      const row = monthly.get(monthKey) || { mes: monthKey, valorGeral: 0, valorAberto: 0, valorVencido: 0 };
      row.valorGeral += nominal;
      if (open && !cobrancaSimples) row.valorAberto += nominal;
      if (open && !cobrancaSimples && dueDate < today) row.valorVencido += nominal;
      monthly.set(monthKey, row);
    }

    const limit = Number(title.contaOperacional?.limite);
    if (Number.isFinite(limit) && limit > 0) limitValues.add(limit);
  }

  const concentration = Array.from(counterparties.values())
    .sort((left, right) => right.valorAberto - left.valorAberto);
  const topConcentration = valorAberto > 0 ? (concentration[0]?.valorAberto || 0) / valorAberto : 0;
  const limit = type === 'cliente' ? Array.from(limitValues).reduce((sum, value) => sum + value, 0) : 0;
  const limitUsage = limit > 0 ? valorAberto / limit : null;
  const overdueRate = valorAberto > 0 ? valorVencido / valorAberto : 0;
  const severeRate = valorAberto > 0 ? valorAcima60 / valorAberto : 0;
  const adverseRate = valorGeral > 0 ? valorAdverso / valorGeral : 0;
  const documentationRate = selected.length ? documented / selected.length : 0;
  const factors = [
    { nome: 'Inadimplência da carteira', peso: 45, impacto: Math.min(45, overdueRate * 90), valor: overdueRate },
    { nome: 'Atrasos acima de 60 dias', peso: 15, impacto: Math.min(15, severeRate * 30), valor: severeRate },
    { nome: 'Ocorrências negativas', peso: 15, impacto: Math.min(15, adverseRate * 45), valor: adverseRate },
    { nome: 'Concentração na maior contraparte', peso: 15, impacto: Math.min(15, topConcentration * 15), valor: topConcentration },
    { nome: 'Qualidade documental', peso: 10, impacto: (1 - documentationRate) * 10, valor: documentationRate }
  ];
  if (limitUsage !== null) {
    const excessUsage = Math.max(0, limitUsage - 0.75);
    factors.push({ nome: 'Utilização do limite', peso: 10, impacto: Math.min(10, excessUsage * 20), valor: limitUsage });
  }
  const score = Math.max(0, Math.round(100 - factors.reduce((sum, factor) => sum + factor.impacto, 0)));
  const entityDocument = normalizeEntityDocument(entity?.documento);
  const economicGroup = entity?.grupoEconomico
    || (entityDocument ? await fetchEconomicGroupByDocument(entityDocument) : null);

  const serasa = {
    status: score >= 70 ? 'Regular' : score >= 40 ? 'Atenção' : 'Restrições',
    score: score >= 70 ? 840 : score >= 40 ? 610 : 380,
    apontamentos: selected.filter(t => ['recomprado', 'recuperação', 'perda'].some(s => riskSituation(t).includes(s))).length,
    protestos: 0,
    pefinRefin: 0,
    origem: 'Base Cadastral Interna (Sem cobrança de action Serasa)'
  };

  return {
    tipo: type,
    entidade: {
      nome: entity?.nome || name,
      documento: entityDocument,
      email: entity?.email || '',
      telefone: entity?.telefone || '',
      grupoEconomico: economicGroup?.nome || ''
    },
    indicador: { score, nivel: riskLevelFromScore(score), fatores: factors },
    serasa,
    metricas: {
      qtdTitulos: selected.length,
      valorGeral,
      valorAberto,
      valorVencido,
      valorCobrancaSimples,
      qtdCobrancaSimples,
      valorLiquidado,
      percentualVencido: overdueRate,
      atrasoMedio: delays.length ? delays.reduce((sum, value) => sum + value, 0) / delays.length : 0,
      atrasoMaximo: delays.length ? Math.max(...delays) : 0,
      percentualNoPrazo: settledWithDate ? onTime / settledWithDate : 0,
      ocorrenciasNegativas: selected.filter(title => ['recomprado', 'recuperação', 'recuperacao', 'pró-solvendo', 'pro-solvendo', 'perda'].some(status => riskSituation(title).includes(status))).length,
      valorOcorrenciasNegativas: valorAdverso,
      limite: limit,
      utilizacaoLimite: limitUsage,
      qualidadeDocumental: documentationRate,
      quantidadeContrapartes: concentration.length
    },
    aging: aging.map(bucket => ({
      chave: bucket.chave,
      rotulo: bucket.rotulo,
      valor: bucket.valor,
      quantidade: bucket.quantidade
    })),
    agendaVencimentos: future.map(bucket => ({ rotulo: bucket.rotulo, valor: bucket.valor })),
    concentracao: concentration.slice(0, 10),
    situacoes: Array.from(situations.entries())
      .map(([situacao, valor]) => ({ situacao, valor }))
      .sort((left, right) => right.valor - left.valor),
    historico: Array.from(monthly.values()).sort((left, right) => left.mes.localeCompare(right.mes)).slice(-18),
    titulos: selected
      .map(title => ({
        id: title.id,
        numero: title.numero || '',
        contraparte: riskCounterpartyFromTitle(title, type)?.nome || 'Não informado',
        documentoContraparte: normalizeEntityDocument(riskCounterpartyFromTitle(title, type)?.documento),
        vencimento: title.dataDeVencimento || null,
        situacao: title.situacao || 'Sem situação',
        valorNominal: Number(title.valorNominal) || 0,
        valorLiquido: Number(title.valorLiquido) || 0,
        manifesto: title.manifesto || '',
        codigoDoLastro: title.codigoDoLastro || '',
        registradoNoCobrador: title.registradoNoCobrador !== false
      }))
      .sort((left, right) => String(right.vencimento || '').localeCompare(String(left.vencimento || '')))
      .slice(0, 500)
  };
}

app.get('/api/analise-riscos', requireSession, requirePermission('8.3'), async (req, res) => {
  try {
    const type = req.query.tipo === 'sacado' ? 'sacado' : 'cliente';
    const mode = req.query.modo === 'detalhe' ? 'detalhe' : 'lista';
    res.setHeader('x-data-source', 'api');

    if (mode === 'lista') {
      const search = String(req.query.busca || '').trim();
      if (type === 'cliente' && search.length >= 2) {
        if (unltdFullHistoryCache.data) {
          const apiResults = buildRiskList(unltdFullHistoryCache.data, type, search);
          if (apiResults.length) return res.json(apiResults);
        }
        const indexedResults = buildRiskClientSuggestionsFromDatabase(search);
        if (indexedResults.length) return res.json(indexedResults);
      }
      const titles = await fetchTitulosDaAPI(req);
      return res.json(buildRiskList(titles, type, search));
    }

    const document = normalizeEntityDocument(req.query.documento);
    const name = String(req.query.nome || '').trim();
    if (!document && !name) return res.status(400).json({ error: 'Informe a entidade que deseja analisar.' });
    const titles = await fetchTitulosDaAPI(req);
    let liquidations = [];
    let enrichmentWarning = '';
    try {
      liquidations = await fetchLiquidacoesDaAPI(req);
    } catch (liquidationError) {
      enrichmentWarning = 'O histórico detalhado de liquidações está temporariamente indisponível. Os demais indicadores foram calculados pelos títulos.';
      console.log('Aviso: análise de riscos sem enriquecimento de liquidações:', liquidationError.message);
    }
    const details = await buildRiskDetails(titles, liquidations, type, document, name);
    if (!details) return res.status(404).json({ error: 'Não foram encontrados títulos para esta entidade.' });
    if (enrichmentWarning) details.aviso = enrichmentWarning;
    return res.json(details);
  } catch (error) {
    console.error('Erro na análise de riscos:', error.message);
    return res.status(500).json({ error: 'Não foi possível compor a análise de riscos.', message: error.message });
  }
});

app.get('/api/analise-clientes', requireSession, requirePermission('8.1'), async (req, res) => {
  try {
    const groupByEconomic = req.query.groupBy === 'economicGroup';
    let rowsNova = [];
    let dataSource = 'api';
    try {
      const [titulos, liquidacoes] = await Promise.all([
        fetchTitulosDaAPI(req),
        fetchLiquidacoesDaAPI(req)
      ]);
      const economicGroupsByDocument = groupByEconomic
        ? await fetchEconomicGroupsForRecords([...titulos, ...liquidacoes])
        : new Map();
      const mapCedentes = new Map();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      for (const t of titulos) {
        const entidade = t.contaOperacional?.cliente?.entidade;
        if (!entidade?.nome) continue;
        const cedente = entidade.nome;
        const economicGroup = entidade.grupoEconomico
          || economicGroupsByDocument.get(normalizeEntityDocument(entidade.documento));
        if (groupByEconomic && (!economicGroup?.id || !economicGroup?.nome)) continue;
        const aggregationKey = groupByEconomic ? `grupo:${economicGroup.id}` : cedente;
        const aggregationName = groupByEconomic ? economicGroup.nome : cedente;
        const situacao = (t.situacao || '').toLowerCase();
        let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
        if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
        const isAberto = situacao.includes('aberto');
        const isLiquidado = situacao.includes('liquidado') || situacao.includes('liq.');
        const isVencido = Boolean(isAberto && dataVenc && !Number.isNaN(dataVenc.getTime()) && dataVenc < hoje);
        const valNominal = Number(t.valorNominal) || 0;
        if (!mapCedentes.has(aggregationKey)) {
          mapCedentes.set(aggregationKey, {
            cedente: aggregationName, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0,
            ...(groupByEconomic ? { grupoEconomicoId: economicGroup.id, cedentes: new Set() } : {})
          });
        }
        const curr = mapCedentes.get(aggregationKey);
        if (groupByEconomic) curr.cedentes.add(cedente);
        curr.qtdTitulos += 1;
        curr.valorGeral += valNominal;
        if (isVencido) { curr.qtdVencido += 1; curr.valorVencido += valNominal; }
        if (isLiquidado) { curr.qtdLiquidado += 1; }
        if (isAberto) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
      }
      for (const liquidacao of liquidacoes) {
        const entidade = liquidacao.contaOperacional?.cliente?.entidade;
        const cedente = entidade?.nome;
        if (!cedente) continue;
        const economicGroup = entidade.grupoEconomico
          || economicGroupsByDocument.get(normalizeEntityDocument(entidade.documento));
        if (groupByEconomic && (!economicGroup?.id || !economicGroup?.nome)) continue;
        const aggregationKey = groupByEconomic ? `grupo:${economicGroup.id}` : cedente;
        const aggregationName = groupByEconomic ? economicGroup.nome : cedente;
        if (!mapCedentes.has(aggregationKey)) {
          mapCedentes.set(aggregationKey, {
            cedente: aggregationName, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0,
            ...(groupByEconomic ? { grupoEconomicoId: economicGroup.id, cedentes: new Set() } : {})
          });
        }
        const curr = mapCedentes.get(aggregationKey);
        if (groupByEconomic) curr.cedentes.add(cedente);
        curr.valorLiquidado += Number(liquidacao.totalLiquido) || 0;
      }
      rowsNova = Array.from(mapCedentes.values()).map(row => ({
        ...row,
        ...(groupByEconomic ? { cedentes: Array.from(row.cedentes).sort((a, b) => a.localeCompare(b)) } : {})
      }));
    } catch (apiErr) {
      if (groupByEconomic) throw apiErr;
      console.log('Falha na API UNLTD (clientes), fallback SQLite...', apiErr.message);
      dataSource = 'db';
      const { startDate, endDate } = req.query;
      let dateFilter = '';
      if (startDate && endDate) {
         dateFilter = ` AND (substr(VENCIMENTO, 7, 4) || '-' || substr(VENCIMENTO, 4, 2) || '-' || substr(VENCIMENTO, 1, 2)) BETWEEN '${startDate}' AND '${endDate}' `;
      }
      const queryNova = `
        SELECT
           CLIENTE as cedente,
           COUNT(ID) as qtdTitulos,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
           SUM(CASE WHEN SITUACAO LIKE '%liquidado%' THEN 1 ELSE 0 END) as qtdLiquidado,
           SUM(CASE WHEN SITUACAO LIKE '%ABERTO%' AND VENCIDO = 'Nao' THEN 1 ELSE 0 END) as qtdAberto,
           SUM(VALOR_NOMINAL) as valorGeral,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN VALOR_NOMINAL ELSE 0 END) as valorVencido,
           SUM(CASE WHEN SITUACAO LIKE '%liquidado%' THEN VALOR_LIQUIDO ELSE 0 END) as valorLiquidado,
           SUM(CASE WHEN SITUACAO LIKE '%ABERTO%' AND VENCIDO = 'Nao' THEN VALOR_NOMINAL ELSE 0 END) as valorAberto
        FROM "BASE_NOVA"
        WHERE CLIENTE IS NOT NULL AND CLIENTE != '' ${dateFilter}
      GROUP BY CLIENTE
      `;
      rowsNova = db.prepare(queryNova).all();
    }

    if (groupByEconomic) {
      const groupedRows = rowsNova
        .map(row => ({ ...row, valorNpl: 0, hasNova: true }))
        .sort((a, b) => b.valorGeral - a.valorGeral);
      res.setHeader('x-data-source', dataSource);
      return res.json(groupedRows);
    }

    let rowsNpl = [];
    try {
      rowsNpl = db.prepare(`
        SELECT Sacado as sacado, SUM(Valor_do_Credito_Face) as valorNpl
        FROM BASE_NPL
        WHERE Sacado IS NOT NULL AND Sacado != ''
        GROUP BY Sacado
      `).all();
    } catch (e) {
      console.log("Aviso: BASE_NPL indisponível.");
    }

    // Global deduplication array
    const canonicals = [];

    // Deduplicate BASE_NOVA
    for (const row of rowsNova) {
      const norm = normalizeStr(row.cedente);
      let bestMatch = null;
      let highest = 0;
      for (const canon of canonicals) {
         const score = stringSimilarity.compareTwoStrings(norm, canon.norm);
         if (score >= 0.70 && score > highest) {
            highest = score;
            bestMatch = canon;
         }
      }
      if (bestMatch) {
         bestMatch.data.qtdTitulos += row.qtdTitulos;
         bestMatch.data.qtdVencido += row.qtdVencido;
         bestMatch.data.qtdLiquidado += row.qtdLiquidado;
         bestMatch.data.qtdAberto += row.qtdAberto;
         bestMatch.data.valorGeral += row.valorGeral;
         bestMatch.data.valorVencido += row.valorVencido;
         bestMatch.data.valorLiquidado += row.valorLiquidado;
         bestMatch.data.valorAberto += row.valorAberto;
      } else {
         canonicals.push({
            norm: norm,
            origName: row.cedente,
            data: { ...row, valorNpl: 0, hasNova: true }
         });
      }
    }

    // Merge NPL
    for (const npl of rowsNpl) {
      if (!npl.sacado) continue;
      const norm = normalizeStr(npl.sacado);
      let bestMatch = null;
      let highest = 0;
      for (const canon of canonicals) {
         const score = stringSimilarity.compareTwoStrings(norm, canon.norm);
         if (score >= 0.70 && score > highest) {
            highest = score;
            bestMatch = canon;
         }
      }
      if (bestMatch) {
        bestMatch.data.valorNpl += (npl.valorNpl || 0);
      } else {
         canonicals.push({
            norm: norm,
            origName: npl.sacado,
            data: {
               cedente: npl.sacado,
               qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
               valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0,
               valorNpl: npl.valorNpl || 0,
               hasNova: false
            }
         });
      }
    }

    const mergedRows = canonicals.map(c => c.data).sort((a, b) => (b.valorGeral + b.valorNpl) - (a.valorGeral + a.valorNpl));
    res.setHeader('x-data-source', dataSource);
    res.json(mergedRows);
  } catch (err) {
    console.error('Erro ao consultar análise de clientes:', err);
    res.status(500).json({ error: 'Erro ao consultar análise de clientes', message: err.message });
  }
});

app.get('/api/analise-sacados/:cedente', requireSession, requirePermission('8.1'), async (req, res) => {
  try {
    const cedenteParams = req.params.cedente;
    const normCedenteParams = normalizeStr(cedenteParams);

    let rows = [];
    let dataSource = 'api';

    try {
      const titulos = await fetchTitulosDaAPI(req);
      const mapSacados = new Map();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      for (const t of titulos) {
        if (!t.contaOperacional?.cliente?.entidade?.nome) continue;
        const clienteTit = t.contaOperacional.cliente.entidade.nome;
        if (normalizeStr(clienteTit) !== normCedenteParams) continue;
        const sacado = t.sacado?.entidade?.nome;
        if (!sacado) continue;
        const situacao = (t.situacao || '').toLowerCase();
        let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
        if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
        const isAberto = situacao.includes('aberto');
        const isLiquidado = situacao.includes('liquidado') || situacao.includes('liq.');
        const isVencido = Boolean(isAberto && dataVenc && !Number.isNaN(dataVenc.getTime()) && dataVenc < hoje);
        const valNominal = Number(t.valorNominal) || 0;
        if (!mapSacados.has(sacado)) {
          mapSacados.set(sacado, {
            sacado: sacado, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0
          });
        }
        const curr = mapSacados.get(sacado);
        curr.qtdTitulos += 1;
        curr.valorGeral += valNominal;
        if (isVencido) { curr.qtdVencido += 1; curr.valorVencido += valNominal; }
        if (isLiquidado) { curr.qtdLiquidado += 1; curr.valorLiquidado += valNominal; }
        if (isAberto) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
      }
      rows = Array.from(mapSacados.values()).sort((a, b) => b.valorGeral - a.valorGeral);
    } catch (apiErr) {
      console.log('Falha na API UNLTD (sacados), fallback SQLite...', apiErr.message);
      dataSource = 'db';
      const { startDate, endDate } = req.query;
      let dateFilter = '';
      if (startDate && endDate) {
         dateFilter = ` AND (substr(VENCIMENTO, 7, 4) || '-' || substr(VENCIMENTO, 4, 2) || '-' || substr(VENCIMENTO, 1, 2)) BETWEEN '${startDate}' AND '${endDate}' `;
      }
      const queryNova = `
        SELECT
           SACADO as sacado,
           COUNT(ID) as qtdTitulos,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN 1 ELSE 0 END) as qtdLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' THEN 1 ELSE 0 END) as qtdAberto,
           SUM(CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL)) as valorGeral,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN CAST(REPLACE(REPLACE(VALOR_LIQUIDO, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' AND VENCIDO = 'Nao' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorAberto
        FROM "BASE_NOVA"
        WHERE CLIENTE = ? AND SACADO IS NOT NULL AND SACADO != '' ${dateFilter}
      GROUP BY SACADO
      ORDER BY valorGeral DESC
      `;
      rows = db.prepare(queryNova).all(cedenteParams);
    }
    res.setHeader('x-data-source', dataSource);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao consultar analise de sacados:', err);
    res.status(500).json({ error: 'Erro ao consultar analise de sacados', message: err.message });
  }
});

app.get('/api/analise-ua/:cedente', requireSession, requirePermission('8.1'), async (req, res) => {
  try {
    const cedenteParams = req.params.cedente;
    const normCedenteParams = normalizeStr(cedenteParams);

    let rows = [];
    let dataSource = 'api';

    try {
      const [titulos, liquidacoes] = await Promise.all([
        fetchTitulosDaAPI(req),
        fetchLiquidacoesDaAPI(req)
      ]);
      const mapUA = new Map();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      for (const t of titulos) {
        if (!t.contaOperacional?.cliente?.entidade?.nome) continue;
        const clienteTit = t.contaOperacional.cliente.entidade.nome;
        if (normalizeStr(clienteTit) !== normCedenteParams) continue;
        const ua = t.contaOperacional?.unidadeAdministrativa?.alias;
        if (!ua) continue;
        const situacao = (t.situacao || '').toLowerCase();
        let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
        if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
        const isAberto = situacao.includes('aberto');
        const isLiquidado = situacao.includes('liquidado') || situacao.includes('liq.');
        const isVencido = Boolean(isAberto && dataVenc && !Number.isNaN(dataVenc.getTime()) && dataVenc < hoje);
        const valNominal = Number(t.valorNominal) || 0;
        if (!mapUA.has(ua)) {
          mapUA.set(ua, {
            ua: ua, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0
          });
        }
        const curr = mapUA.get(ua);
        curr.qtdTitulos += 1;
        curr.valorGeral += valNominal;
        if (isVencido) { curr.qtdVencido += 1; curr.valorVencido += valNominal; }
        if (isLiquidado) { curr.qtdLiquidado += 1; }
        if (isAberto) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
      }
      for (const liquidacao of liquidacoes) {
        const cliente = liquidacao.contaOperacional?.cliente?.entidade?.nome;
        if (!cliente || normalizeStr(cliente) !== normCedenteParams) continue;
        const ua = liquidacao.contaOperacional?.unidadeAdministrativa?.alias;
        if (!ua) continue;
        if (!mapUA.has(ua)) {
          mapUA.set(ua, {
            ua, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0
          });
        }
        mapUA.get(ua).valorLiquidado += Number(liquidacao.totalLiquido) || 0;
      }
      rows = Array.from(mapUA.values()).sort((a, b) => b.valorGeral - a.valorGeral);
    } catch (apiErr) {
      console.log('Falha na API UNLTD (UA), fallback SQLite...', apiErr.message);
      dataSource = 'db';
      const { startDate, endDate } = req.query;
      let dateFilter = '';
      if (startDate && endDate) {
         dateFilter = ` AND (substr(VENCIMENTO, 7, 4) || '-' || substr(VENCIMENTO, 4, 2) || '-' || substr(VENCIMENTO, 1, 2)) BETWEEN '${startDate}' AND '${endDate}' `;
      }
      const queryNova = `
        SELECT
           UA as ua,
           COUNT(ID) as qtdTitulos,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN 1 ELSE 0 END) as qtdVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN 1 ELSE 0 END) as qtdLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' THEN 1 ELSE 0 END) as qtdAberto,
           SUM(CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL)) as valorGeral,
           SUM(CASE WHEN VENCIDO = 'Sim' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorVencido,
           SUM(CASE WHEN SITUACAO = 'Liquidado' THEN CAST(REPLACE(REPLACE(VALOR_LIQUIDO, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorLiquidado,
           SUM(CASE WHEN SITUACAO = 'Aberto' AND VENCIDO = 'Nao' THEN CAST(REPLACE(REPLACE(VALOR_NOMINAL, '.', ''), ',', '.') AS REAL) ELSE 0 END) as valorAberto
        FROM "BASE_NOVA"
        WHERE CLIENTE = ? AND UA IS NOT NULL AND UA != '' ${dateFilter}
      GROUP BY UA
      ORDER BY valorGeral DESC
      `;
      rows = db.prepare(queryNova).all(cedenteParams);
    }

    // Inject NPL Cessionarios into the UA list
    const allNpl = db.prepare(`SELECT Sacado, Cedente, Cessionario, SUM(Valor_do_Credito_Face) as valorNpl FROM BASE_NPL WHERE Sacado IS NOT NULL AND Sacado != '' GROUP BY Sacado, Cedente, Cessionario`).all();
    const normCedente = normCedenteParams;
    let nplUAs = [];
    for (const npl of allNpl) {
      const normDev = normalizeStr(npl.Sacado);
      if (normDev === normCedente || stringSimilarity.compareTwoStrings(normDev, normCedente) >= 0.70) {
          nplUAs.push({
              ua: npl.Cessionario || 'Sem Informação',
              qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
              valorGeral: 0, valorNpl: npl.valorNpl || 0,
              valorVencido: 0, valorLiquidado: 0, valorAberto: 0,
              isUN: true, hasNova: false
          });
      }
    }
    rows = rows.map(r => ({...r, valorNpl: 0, hasNova: true}));
    const resultMap = new Map();
    for (const r of rows) {
      resultMap.set(r.ua, r);
    }
    for (const npl of nplUAs) {
      if (resultMap.has(npl.ua)) {
        resultMap.get(npl.ua).valorNpl += npl.valorNpl;
      } else {
        resultMap.set(npl.ua, npl);
      }
    }
    const mergedRows = Array.from(resultMap.values()).sort((a, b) => ((b.valorGeral || 0) + (b.valorNpl || 0)) - ((a.valorGeral || 0) + (a.valorNpl || 0)));

    res.setHeader('x-data-source', dataSource);
    res.json(mergedRows);
  } catch (err) {
    console.error('Erro ao consultar analise de UA:', err);
    res.status(500).json({ error: 'Erro ao consultar analise de UA', message: err.message });
  }
});

app.get('/api/analise-un/:cedente', requireSession, requirePermission('8.1'), (req, res) => {
  try {
    const cedente = req.params.cedente;
    let rowsNpl = [];
    try {
      const allNpl = db.prepare(`SELECT Sacado, Cedente, Cessionario, SUM(Valor_do_Credito_Face) as valorNpl FROM BASE_NPL WHERE Sacado IS NOT NULL AND Sacado != '' GROUP BY Sacado, Cedente, Cessionario`).all();
      const normCedente = normalizeStr(cedente);

      for (const npl of allNpl) {
        const normDev = normalizeStr(npl.Sacado);
        if (normDev === normCedente || stringSimilarity.compareTwoStrings(normDev, normCedente) >= 0.70) {
            rowsNpl.push({
                ua: npl.Cessionario || 'Sem Informação', // Fallback as requested
                valorGeral: npl.valorNpl || 0,
                qtdTitulos: 0,
                qtdVencido: 0,
                qtdLiquidado: 0,
                qtdAberto: 0,
                valorVencido: 0,
                valorLiquidado: 0,
                valorAberto: 0,
                isUN: true
            });
        }
      }
    } catch (e) {
      console.log("BASE_NPL error on UN analysis", e);
    }

    const grouped = {};
    for (const r of rowsNpl) {
      if (!grouped[r.ua]) grouped[r.ua] = { ...r };
      else grouped[r.ua].valorGeral += r.valorGeral;
    }

    res.json(Object.values(grouped).sort((a, b) => b.valorGeral - a.valorGeral));
  } catch (err) {
    console.error('Erro ao consultar analise de UN:', err);
    res.status(500).json({ error: 'Erro', message: err.message });
  }
});


// -------------------------------------------------------------
// GENERIC REST API (MIMICKING JSON-SERVER)
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', database: path.basename(dbPath) });
  } catch (error) {
    res.status(503).json({ status: 'error' });
  }
});

app.post('/api/auth/login', authIpRateLimiter, loginRateLimiter, (req, res) => {
  const loginId = String(req.body?.loginId || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!loginId || !password) {
    return res.status(400).json({ error: 'Login e senha são obrigatórios.' });
  }

  try {
    const user = db.prepare(`
      SELECT * FROM usuarios_lepta
      WHERE lower(username) = ? OR lower(email) = ?
      LIMIT 1
    `).get(loginId, loginId);

    if (user?.fully_locked && user.role !== 'MASTER') {
      return res.status(423).json({ error: 'Acesso bloqueado. Solicite o desbloqueio ao administrador.', fullyLocked: true });
    }
    if (user?.access_locked && user.role !== 'MASTER') {
      return res.status(423).json({ error: 'Acesso bloqueado. Use sua palavra secreta para redefinir a senha.', recoveryRequired: true });
    }
    if (!user?.password || !verifyPassword(password, user.password)) {
      if (!user) verifyPassword(password, DUMMY_PASSWORD_HASH);
      if (user && user.role !== 'MASTER') {
        const attempts = Number(user.login_attempts || 0) + 1;
        db.prepare(`UPDATE usuarios_lepta SET login_attempts = ?, access_locked = ? WHERE id = ?`)
          .run(attempts, attempts >= 3 ? 1 : 0, user.id);
        if (attempts >= 3) {
          return res.status(423).json({ error: 'Acesso bloqueado após 3 tentativas. Use sua palavra secreta.', recoveryRequired: true });
        }
      }
      return res.status(401).json({ error: 'Credenciais incorretas.' });
    }

    db.prepare(`UPDATE usuarios_lepta SET login_attempts = 0, access_locked = 0 WHERE id = ?`).run(user.id);
    return res.json({ user: sanitizeUser(user), token: createAuthSession(user) });
  } catch (error) {
    console.error('Erro no login:', error.message);
    return res.status(500).json({ error: 'Não foi possível realizar o login.' });
  }
});

app.get('/api/auth/me', requireSession, (req, res) => {
  const user = db.prepare(`SELECT * FROM usuarios_lepta WHERE id = ?`).get(req.authSession.userId);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  if (user.fully_locked || user.access_locked) return res.status(423).json({ error: 'Acesso bloqueado.' });
  return res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/logout', requireSession, (req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  authSessions.delete(token);
  return res.status(204).end();
});

app.post('/api/auth/first-access/check', authIpRateLimiter, recoveryRateLimiter, (req, res) => {
  const loginId = String(req.body?.loginId || '').trim().toLowerCase();
  if (!loginId) return res.status(400).json({ error: 'Informe o e-mail ou usuário.' });

  try {
    const user = db.prepare(`
      SELECT * FROM usuarios_lepta
      WHERE lower(username) = ? OR lower(email) = ?
      LIMIT 1
    `).get(loginId, loginId);

    if (!user) return res.status(404).json({ error: 'Usuário não cadastrado.' });
    if (user.password) return res.status(409).json({ error: 'Este usuário já possui senha cadastrada.' });
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível validar o primeiro acesso.' });
  }
});

app.post('/api/auth/first-access/password', authIpRateLimiter, recoveryRateLimiter, (req, res) => {
  const id = String(req.body?.id || '');
  const password = String(req.body?.password || '');
  if (password.length < 10) {
    return res.status(400).json({ error: 'A senha deve possuir pelo menos 10 caracteres.' });
  }

  try {
    const result = db.prepare(`
      UPDATE usuarios_lepta SET password = ?
      WHERE id = ? AND (password IS NULL OR password = '')
    `).run(hashPassword(password), id);
    if (result.changes !== 1) {
      return res.status(409).json({ error: 'Senha já cadastrada ou usuário inválido.' });
    }
    const user = db.prepare(`SELECT * FROM usuarios_lepta WHERE id = ?`).get(id);
    return res.json({ user: sanitizeUser(user), setupToken: createAuthSession(user, 'security-setup') });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível cadastrar a senha.' });
  }
});

app.post('/api/auth/security-setup', requireSecuritySetupSession, (req, res) => {
  const question = String(req.body?.question || '').trim();
  const answer = String(req.body?.answer || '').trim().toLowerCase();
  if (question.length < 5) return res.status(400).json({ error: 'Informe uma pergunta secreta válida.' });
  if (!/^\p{L}+$/u.test(answer)) return res.status(400).json({ error: 'A palavra secreta deve conter somente uma palavra, sem números ou espaços.' });

  try {
    db.prepare(`
      UPDATE usuarios_lepta
      SET secret_question = ?, secret_answer = ?, secret_attempts = 0, access_locked = 0
      WHERE id = ?
    `).run(encryptSecret(question), hashPassword(answer), req.authSession.userId);
    const user = db.prepare(`SELECT * FROM usuarios_lepta WHERE id = ?`).get(req.authSession.userId);
    return res.json({ user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Não foi possível salvar a pergunta secreta.' });
  }
});

app.post('/api/auth/recovery/question', authIpRateLimiter, recoveryRateLimiter, (req, res) => {
  const loginId = String(req.body?.loginId || '').trim().toLowerCase();
  const user = db.prepare(`SELECT * FROM usuarios_lepta WHERE lower(username) = ? OR lower(email) = ? LIMIT 1`).get(loginId, loginId);
  if (!user || !user.secret_question) return res.status(404).json({ error: 'Recuperação não disponível.' });
  if (user.fully_locked) return res.status(423).json({ error: 'Acesso bloqueado. Procure o administrador.', fullyLocked: true });
  return res.json({ question: decryptSecret(user.secret_question) });
});

app.post('/api/auth/recovery/reset', authIpRateLimiter, recoveryRateLimiter, (req, res) => {
  const loginId = String(req.body?.loginId || '').trim().toLowerCase();
  const answer = String(req.body?.answer || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (password.length < 10) return res.status(400).json({ error: 'A nova senha deve possuir pelo menos 10 caracteres.' });

  const user = db.prepare(`SELECT * FROM usuarios_lepta WHERE lower(username) = ? OR lower(email) = ? LIMIT 1`).get(loginId, loginId);
  if (!user || !user.secret_answer) return res.status(404).json({ error: 'Recuperação não disponível.' });
  if (user.fully_locked) return res.status(423).json({ error: 'Acesso bloqueado. Procure o administrador.', fullyLocked: true });

  if (!verifyPassword(answer, user.secret_answer)) {
    const attempts = Number(user.secret_attempts || 0) + 1;
    db.prepare(`UPDATE usuarios_lepta SET secret_attempts = ?, fully_locked = ? WHERE id = ?`)
      .run(attempts, attempts >= 3 ? 1 : 0, user.id);
    if (attempts >= 3) return res.status(423).json({ error: 'Usuário bloqueado completamente. Procure o administrador.', fullyLocked: true });
    return res.status(401).json({ error: `Palavra secreta incorreta. Restam ${3 - attempts} tentativa(s).` });
  }

  db.prepare(`
    UPDATE usuarios_lepta
    SET password = ?, login_attempts = 0, secret_attempts = 0, access_locked = 0
    WHERE id = ?
  `).run(hashPassword(password), user.id);
  revokeSessionsForUser(user.id);
  return res.json({ success: true });
});

app.post('/api/auth/admin/unlock/:id', requireSession, requireMaster, (req, res) => {
  const result = db.prepare(`
    UPDATE usuarios_lepta SET login_attempts = 0, secret_attempts = 0, access_locked = 0, fully_locked = 0
    WHERE id = ?
  `).run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Usuário não encontrado.' });
  revokeSessionsForUser(req.params.id);
  return res.json({ success: true });
});

const ASSIGNABLE_PERMISSION_IDS = new Set([
  '4', '5', '6', '7.1', '7.2', '8.1', '8.2', '8.3', '9', '10', '11', '11.1', '11.2'
]);

function normalizeAssignablePermissions(value) {
  if (!Array.isArray(value)) return null;
  return Array.from(new Set(value.map(String)))
    .filter(permission => ASSIGNABLE_PERMISSION_IDS.has(permission));
}

app.put('/api/admin/users/:id/permissions', requireSession, requireMaster, (req, res) => {
  const permissions = normalizeAssignablePermissions(req.body?.permissions);
  if (!permissions) return res.status(400).json({ error: 'Lista de permissões inválida.' });

  try {
    const target = db.prepare(`SELECT * FROM usuarios_lepta WHERE id = ?`).get(req.params.id);
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
    if (target.role === 'MASTER') {
      return res.status(400).json({ error: 'Usuários MASTER possuem acesso integral e não precisam de permissões individuais.' });
    }

    const serializedPermissions = JSON.stringify(permissions);
    const result = db.prepare(`
      UPDATE usuarios_lepta
      SET permissions = ?
      WHERE id = ?
    `).run(serializedPermissions, req.params.id);
    if (result.changes !== 1) return res.status(500).json({ error: 'O banco não confirmou a alteração.' });

    const persisted = db.prepare(`SELECT * FROM usuarios_lepta WHERE id = ?`).get(req.params.id);
    if (!persisted || persisted.permissions !== serializedPermissions) {
      return res.status(500).json({ error: 'Não foi possível confirmar as permissões gravadas no banco.' });
    }

    return res.json({
      success: true,
      user: sanitizeUser(persisted),
      permissions: parseStringArray(persisted.permissions)
    });
  } catch (error) {
    console.error('Erro ao persistir permissões do usuário:', error.message);
    return res.status(500).json({ error: 'Não foi possível salvar as permissões no banco de dados.' });
  }
});

function parseStringArray(value) {
  if (Array.isArray(value)) return value.map(String);
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function isAllowedPowerBiUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    const hostname = url.hostname.toLowerCase();
    return url.protocol === 'https:' && (hostname === 'app.powerbi.com' || hostname.endsWith('.powerbi.com'));
  } catch {
    return false;
  }
}

function mapPowerBiDashboard(row) {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    embedUrl: row.embed_url,
    description: row.description || '',
    accessType: row.access_type || 'ALL',
    allowedGroups: parseStringArray(row.allowed_groups),
    allowedUsers: parseStringArray(row.allowed_users),
    createdBy: row.created_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function readPowerBiDashboardRows() {
  if (tableExists('power_bi_dashboards')) {
    return db.prepare(`SELECT * FROM power_bi_dashboards ORDER BY title COLLATE NOCASE`).all();
  }
  if (!tableExists('dashboards')) return [];

  return db.prepare(`
    SELECT
      id,
      title,
      url,
      COALESCE(embedUrl, url, '') AS embed_url,
      COALESCE(description, '') AS description,
      COALESCE(accessType, 'ALL') AS access_type,
      COALESCE(allowedGroups, '[]') AS allowed_groups,
      COALESCE(allowedUsers, '[]') AS allowed_users,
      createdBy AS created_by,
      COALESCE(createdAt, datetime('now')) AS created_at,
      COALESCE(createdAt, datetime('now')) AS updated_at
    FROM dashboards
    ORDER BY title COLLATE NOCASE
  `).all();
}

function getAuthenticatedUser(req) {
  return db.prepare(`SELECT * FROM usuarios_lepta WHERE id = ?`).get(req.authSession.userId);
}

function hasPermission(user, permission) {
  return user?.role === 'MASTER' || parseStringArray(user?.permissions).includes(String(permission));
}

function requirePowerBiManager(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user || !hasPermission(user, '4')) {
    return res.status(403).json({ error: 'Acesso restrito à gestão de Business Intelligence.' });
  }
  req.powerBiUser = user;
  next();
}

app.get('/api/power-bi-dashboards', requireSession, (req, res) => {
  try {
    const user = getAuthenticatedUser(req);
    if (!user || (!hasPermission(user, '4') && !hasPermission(user, '5'))) {
      return res.status(403).json({ error: 'Usuário sem acesso aos dashboards.' });
    }

    const canManage = hasPermission(user, '4');
    const rows = readPowerBiDashboardRows();
    const dashboards = rows.map(mapPowerBiDashboard).filter(dashboard => {
      if (canManage || dashboard.accessType === 'ALL') return true;
      if (dashboard.accessType === 'USERS') {
        return dashboard.allowedUsers.includes(String(user.id))
          || (user.email && dashboard.allowedUsers.includes(String(user.email)));
      }
      if (dashboard.accessType === 'GROUPS' && user.groupId) {
        return dashboard.allowedGroups.includes(String(user.groupId));
      }
      return false;
    });
    return res.json(dashboards);
  } catch (error) {
    console.error('Erro ao consultar dashboards do Power BI:', error.message);
    return res.status(500).json({ error: 'Não foi possível carregar os dashboards.' });
  }
});

app.post('/api/power-bi-dashboards', requireSession, requirePowerBiManager, (req, res) => {
  const title = String(req.body?.title || '').trim();
  const url = String(req.body?.url || '').trim();
  const embedUrl = String(req.body?.embedUrl || url).trim();
  if ((url && !isAllowedPowerBiUrl(url)) || (embedUrl && !isAllowedPowerBiUrl(embedUrl))) {
    return res.status(400).json({ error: 'Informe um link HTTPS válido do Power BI.' });
  }
  if (!title || !url) return res.status(400).json({ error: 'Nome e link do Power BI são obrigatórios.' });

  try {
    ensurePowerBiDashboardsTableForWrite();
    const now = new Date().toISOString();
    const id = String(req.body?.id || `dash_${Date.now()}`);
    const accessType = ['ALL', 'GROUPS', 'USERS'].includes(req.body?.accessType) ? req.body.accessType : 'ALL';
    db.prepare(`
      INSERT INTO power_bi_dashboards (
        id, title, url, embed_url, description, access_type,
        allowed_groups, allowed_users, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      url,
      embedUrl,
      String(req.body?.description || '').trim(),
      accessType,
      JSON.stringify(parseStringArray(req.body?.allowedGroups)),
      JSON.stringify(parseStringArray(req.body?.allowedUsers)),
      req.powerBiUser.username || req.powerBiUser.id,
      now,
      now
    );
    const row = db.prepare(`SELECT * FROM power_bi_dashboards WHERE id = ?`).get(id);
    return res.status(201).json(mapPowerBiDashboard(row));
  } catch (error) {
    console.error('Erro ao salvar dashboard do Power BI:', error.message);
    return res.status(500).json({ error: 'Não foi possível salvar o dashboard no banco da VPS.' });
  }
});

app.put('/api/power-bi-dashboards/:id', requireSession, requirePowerBiManager, (req, res) => {
  const title = String(req.body?.title || '').trim();
  const url = String(req.body?.url || '').trim();
  const embedUrl = String(req.body?.embedUrl || url).trim();
  if ((url && !isAllowedPowerBiUrl(url)) || (embedUrl && !isAllowedPowerBiUrl(embedUrl))) {
    return res.status(400).json({ error: 'Informe um link HTTPS válido do Power BI.' });
  }
  if (!title || !url) return res.status(400).json({ error: 'Nome e link do Power BI são obrigatórios.' });

  try {
    ensurePowerBiDashboardsTableForWrite();
    const accessType = ['ALL', 'GROUPS', 'USERS'].includes(req.body?.accessType) ? req.body.accessType : 'ALL';
    const result = db.prepare(`
      UPDATE power_bi_dashboards
      SET title = ?, url = ?, embed_url = ?, description = ?, access_type = ?,
          allowed_groups = ?, allowed_users = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title,
      url,
      embedUrl,
      String(req.body?.description || '').trim(),
      accessType,
      JSON.stringify(parseStringArray(req.body?.allowedGroups)),
      JSON.stringify(parseStringArray(req.body?.allowedUsers)),
      new Date().toISOString(),
      req.params.id
    );
    if (!result.changes) return res.status(404).json({ error: 'Dashboard não encontrado.' });
    const row = db.prepare(`SELECT * FROM power_bi_dashboards WHERE id = ?`).get(req.params.id);
    return res.json(mapPowerBiDashboard(row));
  } catch (error) {
    console.error('Erro ao atualizar dashboard do Power BI:', error.message);
    return res.status(500).json({ error: 'Não foi possível atualizar o dashboard.' });
  }
});

app.delete('/api/power-bi-dashboards/:id', requireSession, requirePowerBiManager, (req, res) => {
  try {
    ensurePowerBiDashboardsTableForWrite();
    const result = db.prepare(`DELETE FROM power_bi_dashboards WHERE id = ?`).run(req.params.id);
    if (!result.changes) return res.status(404).json({ error: 'Dashboard não encontrado.' });
    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir dashboard do Power BI:', error.message);
    return res.status(500).json({ error: 'Não foi possível excluir o dashboard.' });
  }
});

registerDatabaseSyncRoutes(app, {
  db,
  databasePath: dbPath,
  projectRoot,
  requireSession,
  requirePermission,
  requireMaster
});

registerPowerBiRoutes(app, {
  db,
  verifyPassword,
  authSessions
});

registerGrafenoRoutes(app, {
  db,
  requireSession,
  requirePermission,
  requireMaster
});

registerPurchaseRoutes(app, {
  db,
  requireSession,
  requirePermission,
  requireMaster
});

function dropLegacyBases() {
  try {
    db.exec('DROP TABLE IF EXISTS "BASE_NOVA"');
    db.exec('DROP TABLE IF EXISTS "BASE"');
  } catch (err) {
    console.error('Aviso ao limpar tabelas legadas:', err.message);
  }
}
dropLegacyBases();
try {
  ensureCedentesTableSchema(db);
} catch (err) {
  console.error('Aviso ao inicializar schema da tabela CEDENTES:', err.message);
}

app.post('/api/database/sync-cedentes', requireSession, requirePermission('9'), async (req, res) => {
  try {
    const token = UNLTD_TOKEN;
    if (!token) return res.status(400).json({ error: 'UNLTD_API_TOKEN não configurado.' });
    const result = await syncAllCedentesFromUnltdApi(db, token);
    return res.json({ success: true, ...result, message: 'Tabela CEDENTES sincronizada com sucesso com todos os dados cadastrais da API UNLTD.' });
  } catch (error) {
    console.error('Erro ao sincronizar CEDENTES:', error.message);
    return res.status(500).json({ error: 'Erro ao sincronizar CEDENTES.', message: error.message });
  }
});

function isReservedPowerBiTable(table) {
  return table === 'dashboards' || table === 'power_bi_dashboards';
}

const genericTablePolicies = {
  usuarios_lepta: { read: 'MASTER', write: 'MASTER' },
  groups: { read: 'AUTHENTICATED', write: 'MASTER' },
  calendarEvents: { read: 'AUTHENTICATED', write: '6' },
  databaseTables: { read: '9', write: '9' }
};

function resolveGenericTable(req, res, next) {
  const table = getActualTableName(req.params.table);
  const policy = genericTablePolicies[table];
  if (!policy) {
    if (['GET', 'HEAD'].includes(req.method)) return next('route');
    return res.status(404).json({ error: 'Recurso não encontrado.' });
  }
  req.genericTable = table;
  next();
}

function authorizeGenericTable(req, res, next) {
  const policy = genericTablePolicies[req.genericTable];
  const requiredAccess = ['GET', 'HEAD'].includes(req.method) ? policy.read : policy.write;
  if (requiredAccess === 'MASTER' && req.authSession.role !== 'MASTER') {
    return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
  }
  if (!['MASTER', 'AUTHENTICATED'].includes(requiredAccess) && !hasPermission(req.authUser, requiredAccess)) {
    return res.status(403).json({ error: 'Usuário sem permissão para acessar este recurso.' });
  }
  next();
}

function validateGenericData(data) {
  const keys = Object.keys(data);
  if (!keys.length || keys.length > 50 || keys.some(key => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))) {
    throw new Error('Estrutura de dados inválida.');
  }
  return keys;
}

function restrictUserWriteFields(data) {
  const allowedFields = new Set(['id', 'username', 'email', 'role', 'permissions']);
  for (const key of Object.keys(data)) {
    if (!allowedFields.has(key)) delete data[key];
  }
}

function usesJsonContentStorage(table) {
  if (!['databaseTables', 'groups'].includes(table) || !tableExists(table)) return false;
  return db.prepare(`SELECT 1 FROM pragma_table_info(?) WHERE name = 'json_content'`).get(table) !== undefined;
}

function parseJsonContentRow(row) {
  if (!row) return null;
  try {
    return { id: row.id, ...JSON.parse(row.json_content || '{}') };
  } catch {
    return { id: row.id };
  }
}

app.get('/:table', resolveGenericTable, requireSession, authorizeGenericTable, (req, res, next) => {
  const table = req.genericTable;
  if (isReservedPowerBiTable(table)) return next();
  try {
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    if (usesJsonContentStorage(table)) {
       res.json(rows.map(parseJsonContentRow));
    } else if (table === 'usuarios_lepta') {
       res.json(rows.map(sanitizeUser));
    } else {
       res.json(rows.map(parseRow));
    }
  } catch (err) {
    if (err.message.includes('no such table')) {
      return next(); // Passa adiante para o React Router (ex: /dashboard)
    }
    res.status(404).json([]);
  }
});

app.get('/:table/:id', resolveGenericTable, requireSession, authorizeGenericTable, (req, res, next) => {
  const table = req.genericTable;
  if (isReservedPowerBiTable(table)) return next();
  try {
    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({});

    if (usesJsonContentStorage(table)) {
       res.json(parseJsonContentRow(row));
    } else if (table === 'usuarios_lepta') {
       res.json(sanitizeUser(row));
    } else {
       res.json(parseRow(row));
    }
  } catch (err) {
    if (err.message.includes('no such table')) {
      return next();
    }
    res.status(404).json({});
  }
});

app.post('/:table', resolveGenericTable, requireSession, authorizeGenericTable, (req, res) => {
  const table = req.genericTable;
  if (isReservedPowerBiTable(table)) return res.status(410).json({ error: 'Use a API dedicada de dashboards do Power BI.' });
  const data = { ...req.body };
  if (table === 'usuarios_lepta') {
    restrictUserWriteFields(data);
    data.password = '';
  }
  if (!data.id) data.id = Date.now().toString();

  try {
    if (usesJsonContentStorage(table)) {
      db.prepare(`INSERT INTO "${table}" (id, json_content) VALUES (?, ?)`)
        .run(data.id, JSON.stringify(data));
      return res.status(201).json(data);
    }
    const keys = validateGenericData(data);
    const colsSql = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);

    // Create table if not exists (generic)
    const createCols = keys.map(k => `"${k}" TEXT`).join(', ');
    db.exec(`CREATE TABLE IF NOT EXISTS "${table}" (${createCols})`);

    db.prepare(`INSERT INTO "${table}" (${colsSql}) VALUES (${placeholders})`).run(values);
    res.status(201).json(table === 'usuarios_lepta' ? sanitizeUser(data) : data);
  } catch (err) {
    console.error('Erro ao criar registro:', err.message);
    res.status(500).json({ error: 'Não foi possível criar o registro.' });
  }
});

app.put('/:table/:id', resolveGenericTable, requireSession, authorizeGenericTable, (req, res) => {
  const table = req.genericTable;
  if (isReservedPowerBiTable(table)) return res.status(410).json({ error: 'Use a API dedicada de dashboards do Power BI.' });
  const id = req.params.id;
  const data = { ...req.body };
  if (table === 'usuarios_lepta') restrictUserWriteFields(data);
  if (!data.id) data.id = id;

  try {
    if (usesJsonContentStorage(table)) {
      db.prepare(`INSERT OR REPLACE INTO "${table}" (id, json_content) VALUES (?, ?)`)
        .run(id, JSON.stringify(data));
      return res.json(data);
    }
    const keys = validateGenericData(data);
    const colsSql = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);

    if (table === 'usuarios_lepta') {
      const setSql = keys.filter(k => k !== 'id').map(k => `"${k}" = ?`).join(', ');
      const updateKeys = keys.filter(k => k !== 'id');
      const updateValues = updateKeys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
      db.prepare(`UPDATE "${table}" SET ${setSql} WHERE id = ?`).run(...updateValues, id);
      const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
      return res.json(sanitizeUser(row));
    }
    db.prepare(`REPLACE INTO "${table}" (${colsSql}) VALUES (${placeholders})`).run(values);
    res.json(data);
  } catch (err) {
    console.error('Erro ao atualizar registro:', err.message);
    res.status(500).json({ error: 'Não foi possível atualizar o registro.' });
  }
});

app.patch('/:table/:id', resolveGenericTable, requireSession, authorizeGenericTable, (req, res) => {
  const table = req.genericTable;
  if (isReservedPowerBiTable(table)) return res.status(410).json({ error: 'Use a API dedicada de dashboards do Power BI.' });
  const id = req.params.id;
  const data = { ...req.body };
  if (table === 'usuarios_lepta') restrictUserWriteFields(data);

  try {
    if (usesJsonContentStorage(table)) {
      const existing = parseJsonContentRow(db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id));
      if (!existing) return res.status(404).json({ error: 'Registro não encontrado.' });
      const updated = { ...existing, ...data, id };
      db.prepare(`UPDATE "${table}" SET json_content = ? WHERE id = ?`).run(JSON.stringify(updated), id);
      return res.json(updated);
    }
    const keys = validateGenericData(data);
    const setSql = keys.map(k => `"${k}" = ?`).join(', ');
    const values = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
    values.push(id);

    db.prepare(`UPDATE "${table}" SET ${setSql} WHERE id = ?`).run(values);
    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    res.json(table === 'usuarios_lepta' ? sanitizeUser(row) : parseRow(row));
  } catch (err) {
    console.error('Erro ao alterar registro:', err.message);
    res.status(500).json({ error: 'Não foi possível alterar o registro.' });
  }
});

app.delete('/:table/:id', resolveGenericTable, requireSession, authorizeGenericTable, (req, res) => {
  const table = req.genericTable;
  if (isReservedPowerBiTable(table)) return res.status(410).json({ error: 'Use a API dedicada de dashboards do Power BI.' });
  try {
    if (table === 'usuarios_lepta') {
      const target = db.prepare(`SELECT role FROM usuarios_lepta WHERE id = ?`).get(req.params.id);
      if (!target) return res.status(404).json({ error: 'Usuário não encontrado.' });
      if (req.authSession.userId === req.params.id) return res.status(400).json({ error: 'Você não pode excluir o próprio usuário.' });
      if (target.role === 'MASTER') return res.status(400).json({ error: 'Usuários MASTER não podem ser excluídos por esta tela.' });
    }
    db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(req.params.id);
    if (table === 'usuarios_lepta') revokeSessionsForUser(req.params.id);
    res.json({});
  } catch (err) {
    console.error('Erro ao excluir registro:', err.message);
    res.status(500).json({ error: 'Não foi possível excluir o registro.' });
  }
});

// -------------------------------------------------------------
// ROTA FALLBACK PARA O REACT ROUTER (DEVE SER A ÚLTIMA ANTES DO LISTEN)
// -------------------------------------------------------------
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/table/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(projectRoot, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 SERVIDOR SQLITE EXPRESS RODANDO NA PORTA ${PORT}`);
  console.log(`🗄️  Banco de Dados: database.sqlite`);
  console.log(`===========================================\n`);
});
