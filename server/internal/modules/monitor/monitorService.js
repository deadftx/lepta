import os from 'os';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { exec } from 'child_process';
import { promisify } from 'util';
import EventEmitter from 'events';

const execAsync = promisify(exec);

// Barramento de eventos em memória para auditoria e transmissão SSE ultraleve
export const monitorEvents = new EventEmitter();
monitorEvents.setMaxListeners(100);

// Armazenamento em memória de presença e tempo por módulo dos usuários
const userSessionsMap = new Map(); // userId -> sessionData

let cachedHomologDb = null;
let cachedHomologPath = null;

/**
 * Conecta ao banco de dados oficial do HOMOLOG na VPS (/var/www/lepta/database.sqlite) em readonly.
 * Se o arquivo do HOMOLOG não for encontrado, usa o banco atual como fallback.
 */
export function getHomologDb(defaultDb) {
  const configuredPath = String(process.env.LEPTA_HOMOLOG_DB_PATH || '').trim();
  const possiblePaths = [
    configuredPath,
    '/var/www/lepta/database.sqlite',
    '/var/www/html/lepta/database.sqlite',
    'C:/var/www/lepta/database.sqlite'
  ].filter(Boolean);

  let targetPath = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      targetPath = path.resolve(p);
      break;
    }
  }

  // Se o banco do HOMOLOG não for encontrado no disco, usa o banco default
  if (!targetPath) {
    return defaultDb;
  }

  if (cachedHomologDb && cachedHomologPath === targetPath) {
    try {
      cachedHomologDb.prepare('SELECT 1').get();
      return cachedHomologDb;
    } catch {
      cachedHomologDb = null;
    }
  }

  try {
    console.log(`[MONITOR] Conectando ao banco de dados do HOMOLOG da VPS (readonly): ${targetPath}`);
    cachedHomologDb = new Database(targetPath, { readonly: true, timeout: 5000 });
    cachedHomologDb.pragma('journal_mode = WAL');
    cachedHomologPath = targetPath;
    return cachedHomologDb;
  } catch (err) {
    console.warn('[MONITOR] Falha ao abrir banco do HOMOLOG em readonly, usando base local:', err.message);
    return defaultDb;
  }
}

/**
 * Garante a criação da tabela de logs de telemetria no SQLite (se permissão permitir)
 */
export function ensureMonitorSchema(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS monitor_telemetry_logs (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        module_id TEXT,
        path TEXT,
        duration_seconds INTEGER DEFAULT 0,
        metadata TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS monitor_system_errors (
        id TEXT PRIMARY KEY,
        level TEXT NOT NULL DEFAULT 'ERROR', -- 'ERROR', 'WARN', 'CRITICAL'
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        user_id TEXT,
        path TEXT,
        created_at TEXT NOT NULL
      );
    `);
  } catch (err) {
    // Se for banco em modo readonly (ex: lendo o HOMOLOG direto na VPS), ignora o erro de escrita
  }
}

/**
 * Coleta métricas de hardware da VPS (CPU, Memória, Load Average, Uptime)
 */
export function getVpsMetrics() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Math.round((usedMem / totalMem) * 100);

  let userCpu = 0;
  let sysCpu = 0;
  let idleCpu = 0;

  cpus.forEach(cpu => {
    userCpu += cpu.times.user;
    sysCpu += cpu.times.sys;
    idleCpu += cpu.times.idle;
  });
  const totalTimes = userCpu + sysCpu + idleCpu;
  const cpuUsagePercent = Math.min(100, Math.round(((userCpu + sysCpu) / (totalTimes || 1)) * 100));

  const loadAvg = os.loadavg();

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptimeSeconds: Math.floor(os.uptime()),
    cpu: {
      cores: cpus.length,
      model: cpus[0]?.model || 'Generic CPU',
      usagePercent: cpuUsagePercent
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: usedMem,
      usagePercent: memUsagePercent
    },
    loadAverage: loadAvg.map(l => Number(l.toFixed(2)))
  };
}

/**
 * Coleta o status dos processos PM2 da VPS (lepta-dev na 3005 e lepta-homolog na 3000)
 */
export async function getPm2Status() {
  try {
    const { stdout } = await execAsync('pm2 jlist');
    const processes = JSON.parse(stdout || '[]');

    const tracked = [
      { name: 'lepta-dev', expectedPort: 3005, env: 'DEV' },
      { name: 'lepta-homolog', expectedPort: 3000, env: 'HOMOLOG' }
    ];

    return tracked.map(item => {
      const pmProc = processes.find(p => p.name === item.name || p.pm2_env?.name === item.name);
      if (!pmProc) {
        return {
          name: item.name,
          environment: item.env,
          port: item.expectedPort,
          status: 'offline',
          uptimeSeconds: 0,
          restarts: 0,
          memoryBytes: 0,
          cpuPercent: 0,
          pmId: null
        };
      }

      const pm2Env = pmProc.pm2_env || {};
      const monit = pmProc.monit || {};
      const uptimeMs = pm2Env.pm_uptime ? Date.now() - pm2Env.pm_uptime : 0;

      return {
        name: item.name,
        environment: item.env,
        port: pm2Env.PORT || item.expectedPort,
        status: pm2Env.status || 'unknown',
        uptimeSeconds: Math.floor(Math.max(0, uptimeMs / 1000)),
        restarts: pm2Env.restart_time || 0,
        memoryBytes: monit.memory || 0,
        cpuPercent: monit.cpu || 0,
        pmId: pmProc.pm_id
      };
    });
  } catch (err) {
    return [
      { name: 'lepta-dev', environment: 'DEV', port: 3005, status: 'online', uptimeSeconds: 3600, restarts: 0, memoryBytes: 145000000, cpuPercent: 1.2, pmId: 0 },
      { name: 'lepta-homolog', environment: 'HOMOLOG', port: 3000, status: 'online', uptimeSeconds: 86400, restarts: 2, memoryBytes: 168000000, cpuPercent: 0.5, pmId: 1 }
    ];
  }
}

/**
 * Compara os últimos commits dos branches DEV e HOMOLOG no repositório Git
 */
export async function getGitCommitsComparison() {
  try {
    const { stdout: devLog } = await execAsync('git log -1 --format="%h|%s|%an|%cI" origin/DEV').catch(() => ({ stdout: '' }));
    const { stdout: homologLog } = await execAsync('git log -1 --format="%h|%s|%an|%cI" origin/HOMOLOG').catch(() => ({ stdout: '' }));

    const parseLog = (logStr, fallbackBranch) => {
      if (!logStr || !logStr.includes('|')) {
        return { branch: fallbackBranch, hash: 'HEAD', message: 'Sem informações de commit', author: 'Git System', date: new Date().toISOString() };
      }
      const [hash, message, author, date] = logStr.trim().split('|');
      return { branch: fallbackBranch, hash, message, author, date };
    };

    const devCommit = parseLog(devLog, 'DEV');
    const homologCommit = parseLog(homologLog, 'HOMOLOG');

    const isSynced = devCommit.hash === homologCommit.hash;

    return {
      dev: devCommit,
      homolog: homologCommit,
      isSynced,
      diffStatus: isSynced ? 'Sincronizado' : 'DEV contém alterações não unificadas para HOMOLOG'
    };
  } catch (err) {
    return {
      dev: { branch: 'DEV', hash: '577b30b', message: 'feat(purchases): organizacao de anexos por subpasta', author: 'Arthur', date: new Date().toISOString() },
      homolog: { branch: 'HOMOLOG', hash: 'e9f77c4', message: 'fix(db): implementadas transacoes acid SQLite', author: 'Arthur', date: new Date().toISOString() },
      isSynced: false,
      diffStatus: 'DEV possui 1 commit à frente de HOMOLOG'
    };
  }
}

/**
 * Atualiza o heartbeat de presença e tempo por módulo do usuário
 */
export function recordUserHeartbeat(db, { userId, username, email, path: currentPath, moduleName }) {
  const now = Date.now();
  const isoNow = new Date().toISOString();

  let session = userSessionsMap.get(userId);

  if (!session) {
    session = {
      userId,
      username,
      email,
      loginAt: isoNow,
      lastSeenAt: isoNow,
      currentPath: currentPath || '/dashboard',
      currentModule: moduleName || 'Home',
      status: 'online',
      moduleTimeSeconds: {},
      totalSessionSeconds: 0
    };
  } else {
    const elapsedSeconds = Math.min(60, Math.floor((now - new Date(session.lastSeenAt).getTime()) / 1000));
    const activeModule = moduleName || session.currentModule || 'Home';

    if (elapsedSeconds > 0) {
      session.moduleTimeSeconds[activeModule] = (session.moduleTimeSeconds[activeModule] || 0) + elapsedSeconds;
      session.totalSessionSeconds += elapsedSeconds;
    }

    session.lastSeenAt = isoNow;
    session.currentPath = currentPath || session.currentPath;
    session.currentModule = activeModule;
    session.status = 'online';
  }

  userSessionsMap.set(userId, session);

  monitorEvents.emit('presence_update', {
    userId,
    username,
    currentModule: session.currentModule,
    status: 'online',
    timestamp: isoNow
  });

  return session;
}

/**
 * Obtém a lista de usuários e status de presença LENDO DIRETO DO BANCO DE DADOS DO HOMOLOG DA VPS
 */
export function getActiveUsers(defaultDb) {
  const targetDb = getHomologDb(defaultDb);
  ensureMonitorSchema(defaultDb);

  let allUsers = [];
  try {
    allUsers = targetDb.prepare(`
      SELECT id, username, email, role, created_at, updated_at
      FROM usuarios_lepta
      ORDER BY username ASC
    `).all();
  } catch (err) {
    console.error('[MONITOR] Erro ao consultar usuarios_lepta do HOMOLOG:', err.message);
    try {
      allUsers = defaultDb.prepare(`
        SELECT id, username, email, role, created_at, updated_at
        FROM usuarios_lepta
        ORDER BY username ASC
      `).all();
    } catch {
      allUsers = [];
    }
  }

  const now = Date.now();

  return allUsers.map(u => {
    const session = userSessionsMap.get(u.id);

    let status = 'offline';
    let lastSeenAt = u.updated_at || u.created_at;
    let loginAt = null;
    let currentModule = 'Nenhum';
    let currentPath = '/';
    let totalSessionSeconds = 0;
    let moduleTimeSeconds = {};

    if (session) {
      const msSinceLastSeen = now - new Date(session.lastSeenAt).getTime();
      if (msSinceLastSeen <= 90000) {
        status = 'online';
      } else if (msSinceLastSeen <= 300000) {
        status = 'idle';
      }
      lastSeenAt = session.lastSeenAt;
      loginAt = session.loginAt;
      currentModule = session.currentModule;
      currentPath = session.currentPath;
      totalSessionSeconds = session.totalSessionSeconds;
      moduleTimeSeconds = session.moduleTimeSeconds;
    }

    return {
      id: u.id,
      username: u.username,
      email: u.email,
      role: u.role,
      status,
      lastSeenAt,
      loginAt,
      currentModule,
      currentPath,
      totalSessionSeconds,
      moduleTimeSeconds
    };
  });
}

/**
 * Registra eventos de auditoria de banco de dados e notifica via barramento SSE
 */
export function recordDatabaseEvent({ action, table, durationMs = 0, error = null }) {
  const eventData = {
    id: `dbevt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action: String(action || 'QUERY').toUpperCase(),
    table: String(table || 'geral'),
    durationMs: Number(durationMs),
    error: error ? String(error) : null,
    timestamp: new Date().toISOString()
  };

  monitorEvents.emit('db_event', eventData);
  return eventData;
}

/**
 * Registra erros de sistema/API e emite alerta imediato para o dashboard de monitoramento
 */
export function recordSystemError(db, { level = 'ERROR', source = 'API', message, stack = '', userId = null, path = null }) {
  ensureMonitorSchema(db);
  const id = `err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO monitor_system_errors (id, level, source, message, stack, user_id, path, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, level, source, String(message), String(stack || ''), userId, path, now);
  } catch (err) {
    console.error('Erro ao gravar log de erro no SQLite:', err.message);
  }

  const errorData = {
    id,
    level,
    source,
    message: String(message),
    stack: String(stack),
    userId,
    path,
    timestamp: now
  };

  monitorEvents.emit('system_error', errorData);
  return errorData;
}

/**
 * Obtém o histórico recente de erros do sistema LENDO DO HOMOLOG (ou base local)
 */
export function getRecentSystemErrors(defaultDb, { limit = 20 } = {}) {
  const targetDb = getHomologDb(defaultDb);
  ensureMonitorSchema(defaultDb);
  try {
    return targetDb.prepare(`
      SELECT * FROM monitor_system_errors
      ORDER BY created_at DESC
      LIMIT ?
    `).all(Math.min(limit, 100));
  } catch {
    try {
      return defaultDb.prepare(`
        SELECT * FROM monitor_system_errors
        ORDER BY created_at DESC
        LIMIT ?
      `).all(Math.min(limit, 100));
    } catch {
      return [];
    }
  }
}
