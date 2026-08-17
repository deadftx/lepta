import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';
import stringSimilarity from 'string-similarity';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const app = express();
app.use(cors({ exposedHeaders: ['x-data-source'] }));
app.use(express.json({ limit: '50mb' }));

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
app.use(express.static(path.join(__dirname, 'dist')));

// Inicializa banco de dados
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath, { fileMustExist: false });
db.pragma('journal_mode = WAL');

const authSecretPath = path.join(__dirname, '.auth-secret');
if (!process.env.AUTH_ENCRYPTION_KEY && !fs.existsSync(authSecretPath)) {
  fs.writeFileSync(authSecretPath, randomBytes(32).toString('hex'), { mode: 0o600 });
}
const authEncryptionKey = createHash('sha256')
  .update(process.env.AUTH_ENCRYPTION_KEY || fs.readFileSync(authSecretPath, 'utf8').trim())
  .digest();

const PASSWORD_PREFIX = 'scrypt';
const authSessions = new Map();

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
  } catch (error) {
    if (!String(error.message).includes('no such table')) throw error;
  }
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
  const token = randomBytes(32).toString('hex');
  authSessions.set(token, { userId: user.id, role: user.role, purpose, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
  return token;
}

function readSession(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = authSessions.get(token);
  if (session && session.expiresAt >= Date.now()) return session;
  if (token) authSessions.delete(token);
  return null;
}

function requireSession(req, res, next) {
  const session = readSession(req);
  if (!session || session.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
  req.authSession = session;
  next();
}

ensureUserSecurityColumns();

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
const UNLTD_TOKEN = '4E5BF2FC1313695BD24FB21591DC3D4E69B24CC04BCC6DB53CC2541CAA7A1367';
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
  const response = await fetch('https://lepta-backend.bit-unltd.com.br/recebiveis/titulos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `UNLTD-BackEnd ${UNLTD_TOKEN}`
    },
    body: JSON.stringify({ tipoDeData: 'Vencimento', situacoes: UNLTD_SITUACOES, ...period })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`UNLTD respondeu ${response.status}: ${errorText}`);
  }

  const titulos = await response.json();
  return Array.isArray(titulos) ? titulos : [];
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

// -------------------------------------------------------------
// ROTA CUSTOMIZADA: IMPORTAÇÃO DE PLANILHA VIA STREAMING PARA SQLITE
// -------------------------------------------------------------
app.post('/api/sync-link', async (req, res) => {
  const sourceUrl = req.body.url || req.body.sourceUrl;
  
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
    
    if (cleanUrl.startsWith('file://')) {
      cleanUrl = cleanUrl.replace(/^file:\/\/\//, '');
    }

    if (fs.existsSync(cleanUrl)) {
      const stats = fs.statSync(cleanUrl);
      if (stats.isDirectory()) {
         return res.status(400).json({ success: false, message: 'O caminho informado é de uma pasta, não de um arquivo Excel. Por favor, aponte para o arquivo .xlsx final.' });
      }
      tempFilePath = cleanUrl;
      console.log(`📂 Lendo arquivo local diretamente: ${tempFilePath}`);
    } else {
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
        throw new Error(`Falha ao baixar arquivo remoto (${resFetch.SITUACAO}).`);
      }

      const arrayBuffer = await resFetch.arrayBuffer();
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
           const colsSql = headers.map(h => `"${h}" TEXT`).join(', ');
           const createSql = `CREATE TABLE "${tableName}" (${colsSql})`;
           try {
             db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
             db.exec(createSql);
             const placeholders = headers.map(() => '?').join(', ');
             const insertSql = `INSERT INTO "${tableName}" (${headers.map(h => `"${h}"`).join(', ')}) VALUES (${placeholders})`;
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
  let s = str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
  
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

app.get('/api/analise-clientes', async (req, res) => {
  try {
    let rowsNova = [];
    let dataSource = 'api';
    try {
      const [titulos, liquidacoes] = await Promise.all([
        fetchTitulosDaAPI(req),
        fetchLiquidacoesDaAPI(req)
      ]);
      const mapCedentes = new Map();
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      for (const t of titulos) {
        if (!t.contaOperacional?.cliente?.entidade?.nome) continue;
        const cedente = t.contaOperacional.cliente.entidade.nome;
        const situacao = (t.situacao || '').toLowerCase();
        let dataVenc = t.dataDeVencimento ? new Date(t.dataDeVencimento) : null;
        if (dataVenc) dataVenc.setHours(0, 0, 0, 0);
        const isAberto = situacao.includes('aberto');
        const isLiquidado = situacao.includes('liquidado') || situacao.includes('liq.');
        const isVencido = Boolean(isAberto && dataVenc && !Number.isNaN(dataVenc.getTime()) && dataVenc < hoje);
        const valNominal = Number(t.valorNominal) || 0;
        if (!mapCedentes.has(cedente)) {
          mapCedentes.set(cedente, {
            cedente: cedente, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0
          });
        }
        const curr = mapCedentes.get(cedente);
        curr.qtdTitulos += 1;
        curr.valorGeral += valNominal;
        if (isVencido) { curr.qtdVencido += 1; curr.valorVencido += valNominal; }
        if (isLiquidado) { curr.qtdLiquidado += 1; }
        if (isAberto) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
      }
      for (const liquidacao of liquidacoes) {
        const cedente = liquidacao.contaOperacional?.cliente?.entidade?.nome;
        if (!cedente) continue;
        if (!mapCedentes.has(cedente)) {
          mapCedentes.set(cedente, {
            cedente, qtdTitulos: 0, qtdVencido: 0, qtdLiquidado: 0, qtdAberto: 0,
            valorGeral: 0, valorVencido: 0, valorLiquidado: 0, valorAberto: 0
          });
        }
        mapCedentes.get(cedente).valorLiquidado += Number(liquidacao.totalLiquido) || 0;
      }
      rowsNova = Array.from(mapCedentes.values());
    } catch (apiErr) {
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

app.get('/api/analise-sacados/:cedente', async (req, res) => {
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

app.get('/api/analise-ua/:cedente', async (req, res) => {
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

app.get('/api/analise-un/:cedente', (req, res) => {
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

app.post('/api/auth/login', (req, res) => {
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

    if (user?.fully_locked) {
      return res.status(423).json({ error: 'Acesso bloqueado. Solicite o desbloqueio ao administrador.', fullyLocked: true });
    }
    if (user?.access_locked) {
      return res.status(423).json({ error: 'Acesso bloqueado. Use sua palavra secreta para redefinir a senha.', recoveryRequired: true });
    }
    if (!user?.password || !verifyPassword(password, user.password)) {
      if (user) {
        const attempts = Number(user.login_attempts || 0) + 1;
        db.prepare(`UPDATE usuarios_lepta SET login_attempts = ?, access_locked = ? WHERE id = ?`)
          .run(attempts, attempts >= 3 ? 1 : 0, user.id);
        if (attempts >= 3) {
          return res.status(423).json({ error: 'Acesso bloqueado após 3 tentativas. Use sua palavra secreta.', recoveryRequired: true });
        }
      }
      return res.status(401).json({ error: 'Credenciais incorretas.' });
    }

    db.prepare(`UPDATE usuarios_lepta SET login_attempts = 0 WHERE id = ?`).run(user.id);
    return res.json({ user: sanitizeUser(user), token: createAuthSession(user) });
  } catch (error) {
    console.error('Erro no login:', error.message);
    return res.status(500).json({ error: 'Não foi possível realizar o login.' });
  }
});

app.post('/api/auth/first-access/check', (req, res) => {
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

app.post('/api/auth/first-access/password', (req, res) => {
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

app.post('/api/auth/security-setup', requireSession, (req, res) => {
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

app.post('/api/auth/recovery/question', (req, res) => {
  const loginId = String(req.body?.loginId || '').trim().toLowerCase();
  const user = db.prepare(`SELECT * FROM usuarios_lepta WHERE lower(username) = ? OR lower(email) = ? LIMIT 1`).get(loginId, loginId);
  if (!user || !user.secret_question) return res.status(404).json({ error: 'Recuperação não disponível.' });
  if (user.fully_locked) return res.status(423).json({ error: 'Acesso bloqueado. Procure o administrador.', fullyLocked: true });
  return res.json({ question: decryptSecret(user.secret_question) });
});

app.post('/api/auth/recovery/reset', (req, res) => {
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
  return res.json({ success: true });
});

app.post('/api/auth/admin/unlock/:id', requireSession, (req, res) => {
  if (req.authSession.role !== 'MASTER') return res.status(403).json({ error: 'Somente um usuário MASTER pode desbloquear acessos.' });
  const result = db.prepare(`
    UPDATE usuarios_lepta SET login_attempts = 0, secret_attempts = 0, access_locked = 0, fully_locked = 0
    WHERE id = ?
  `).run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Usuário não encontrado.' });
  return res.json({ success: true });
});

app.get('/:table', (req, res, next) => {
  const table = getActualTableName(req.params.table);
  if (table === 'usuarios_lepta' && !readSession(req)) return res.status(401).json({ error: 'Sessão inválida.' });
  try {
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    if (table === 'databaseTables') {
       res.json(rows.map(r => JSON.parse(r.json_content)));
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

app.get('/:table/:id', (req, res, next) => {
  const table = getActualTableName(req.params.table);
  if (table === 'usuarios_lepta' && !readSession(req)) return res.status(401).json({ error: 'Sessão inválida.' });
  try {
    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({});
    
    if (table === 'databaseTables') {
       res.json(JSON.parse(row.json_content));
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

app.post('/:table', (req, res) => {
  const table = getActualTableName(req.params.table);
  const session = table === 'usuarios_lepta' ? readSession(req) : null;
  if (table === 'usuarios_lepta' && session?.role !== 'MASTER') return res.status(403).json({ error: 'Somente MASTER pode criar usuários.' });
  const data = { ...req.body };
  if (table === 'usuarios_lepta') data.password = '';
  if (!data.id) data.id = Date.now().toString();

  try {
    const keys = Object.keys(data);
    const colsSql = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
    
    // Create table if not exists (generic)
    const createCols = keys.map(k => `"${k}" TEXT`).join(', ');
    db.exec(`CREATE TABLE IF NOT EXISTS "${table}" (${createCols})`);
    
    db.prepare(`INSERT INTO "${table}" (${colsSql}) VALUES (${placeholders})`).run(values);
    res.status(201).json(table === 'usuarios_lepta' ? sanitizeUser(data) : data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/:table/:id', (req, res) => {
  const table = getActualTableName(req.params.table);
  const session = table === 'usuarios_lepta' ? readSession(req) : null;
  if (table === 'usuarios_lepta' && session?.role !== 'MASTER') return res.status(403).json({ error: 'Somente MASTER pode alterar usuários.' });
  const id = req.params.id;
  const data = { ...req.body };
  if (table === 'usuarios_lepta') delete data.password;
  if (!data.id) data.id = id;

  try {
    const keys = Object.keys(data);
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
    res.status(500).json({ error: err.message });
  }
});

app.patch('/:table/:id', (req, res) => {
  const table = getActualTableName(req.params.table);
  const session = table === 'usuarios_lepta' ? readSession(req) : null;
  if (table === 'usuarios_lepta' && session?.role !== 'MASTER') return res.status(403).json({ error: 'Somente MASTER pode alterar usuários.' });
  const id = req.params.id;
  const data = { ...req.body };
  if (table === 'usuarios_lepta') delete data.password;

  try {
    const keys = Object.keys(data);
    const setSql = keys.map(k => `"${k}" = ?`).join(', ');
    const values = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
    values.push(id);

    db.prepare(`UPDATE "${table}" SET ${setSql} WHERE id = ?`).run(values);
    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    res.json(table === 'usuarios_lepta' ? sanitizeUser(row) : parseRow(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/:table/:id', (req, res) => {
  const table = getActualTableName(req.params.table);
  const session = table === 'usuarios_lepta' ? readSession(req) : null;
  if (table === 'usuarios_lepta' && session?.role !== 'MASTER') return res.status(403).json({ error: 'Somente MASTER pode excluir usuários.' });
  try {
    db.prepare(`DELETE FROM "${table}" WHERE id = ?`).run(req.params.id);
    res.json({});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ROTA FALLBACK PARA O REACT ROUTER (DEVE SER A ÚLTIMA ANTES DO LISTEN)
// -------------------------------------------------------------
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/table/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3004;
app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 SERVIDOR SQLITE EXPRESS RODANDO NA PORTA ${PORT}`);
  console.log(`🗄️  Banco de Dados: database.sqlite`);
  console.log(`===========================================\n`);
});
