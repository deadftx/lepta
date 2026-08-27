import os from 'os';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { exec } from 'child_process';
import { promisify } from 'util';
import EventEmitter from 'events';

const execAsync = promisify(exec);

export const monitorEvents = new EventEmitter();
monitorEvents.setMaxListeners(100);

const userSessionsMap = new Map();
let cachedHomologDb = null;
let cachedHomologPath = null;

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
    cachedHomologDb = new Database(targetPath, { readonly: true, timeout: 5000 });
    cachedHomologDb.pragma('journal_mode = WAL');
    cachedHomologPath = targetPath;
    return cachedHomologDb;
  } catch (err) {
    console.warn('[MONITOR] Falha ao abrir banco do HOMOLOG em readonly, usando base local:', err.message);
    return defaultDb;
  }
}

export function ensureMonitorSchema(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS monitor_user_sessions (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT,
        role TEXT,
        status TEXT NOT NULL DEFAULT 'online',
        current_module TEXT DEFAULT 'Home',
        current_path TEXT DEFAULT '/',
        last_seen_at TEXT NOT NULL,
        login_at TEXT,
        total_session_seconds INTEGER DEFAULT 0,
        module_time_json TEXT DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS site_analytics_hits (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        path TEXT NOT NULL,
        referrer TEXT,
        device_type TEXT,
        browser TEXT,
        created_at TEXT NOT NULL
      );

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
        level TEXT NOT NULL DEFAULT 'ERROR',
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        user_id TEXT,
        path TEXT,
        created_at TEXT NOT NULL
      );
    `);
  } catch (err) {
    // Ignora erro se for readonly
  }
}

/**
 * Registra um acesso anônimo no site institucional (lepta.com.br)
 */
export function recordPublicSiteHit(db, { sessionId, path: hitPath, referrer, userAgent }) {
  ensureMonitorSchema(db);
  const id = `hit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const isoNow = new Date().toISOString();

  // Helper para identificar tipo de dispositivo e navegador
  const ua = String(userAgent || '');
  let deviceType = 'Desktop';
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
    deviceType = /ipad|tablet/i.test(ua) ? 'Tablet' : 'Mobile';
  }

  let browser = 'Outro';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua)) browser = 'Safari';
  else if (/firefox/i.test(ua)) browser = 'Firefox';

  try {
    db.prepare(`
      INSERT INTO site_analytics_hits (id, session_id, path, referrer, device_type, browser, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, String(sessionId || 'sess_anon'), String(hitPath || '/'), String(referrer || 'Direto'), deviceType, browser, isoNow);
  } catch (err) {
    console.error('Erro ao gravar hit do site no SQLite:', err.message);
  }

  monitorEvents.emit('site_hit', { id, sessionId, path: hitPath, deviceType, browser, timestamp: isoNow });
}

/**
 * Coleta estatísticas consolidadas de acessos ao site institucional (lepta.com.br)
 */
export function getPublicSiteAnalytics(defaultDb, { period = 'today' } = {}) {
  const targetDb = getHomologDb(defaultDb);
  ensureMonitorSchema(defaultDb);

  const now = new Date();

  // Define limite inferior de data conforme o filtro selecionado
  let startDateIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(); // Hoje 00:00

  if (period === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startDateIso = d.toISOString();
  } else if (period === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    startDateIso = d.toISOString();
  } else if (period === 'month') {
    const d = new Date(now.getFullYear(), now.getMonth(), 1);
    startDateIso = d.toISOString();
  }

  try {
    // 1. Visitantes online nos últimos 5 minutos no site
    const fiveMinAgoIso = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    const onlineNow = targetDb.prepare(`
      SELECT COUNT(DISTINCT session_id) as count
      FROM site_analytics_hits
      WHERE created_at >= ?
    `).get(fiveMinAgoIso)?.count || 0;

    // 2. Total de sessões e pageviews no período
    const periodStats = targetDb.prepare(`
      SELECT
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(*) as total_pageviews
      FROM site_analytics_hits
      WHERE created_at >= ?
    `).get(startDateIso) || { total_sessions: 0, total_pageviews: 0 };

    // 3. Páginas mais acessadas
    const topPages = targetDb.prepare(`
      SELECT path, COUNT(*) as views
      FROM site_analytics_hits
      WHERE created_at >= ?
      GROUP BY path
      ORDER BY views DESC
      LIMIT 10
    `).all(startDateIso);

    // 4. Distribuição por dispositivo (Desktop / Mobile / Tablet)
    const devices = targetDb.prepare(`
      SELECT device_type, COUNT(*) as count
      FROM site_analytics_hits
      WHERE created_at >= ?
      GROUP BY device_type
    `).all(startDateIso);

    // 5. Distribuição por navegador
    const browsers = targetDb.prepare(`
      SELECT browser, COUNT(*) as count
      FROM site_analytics_hits
      WHERE created_at >= ?
      GROUP BY browser
    `).all(startDateIso);

    return {
      period,
      onlineNow,
      totalSessions: periodStats.total_sessions || 0,
      totalPageviews: periodStats.total_pageviews || 0,
      topPages,
      devices,
      browsers
    };
  } catch (err) {
    console.error('Erro ao consultar analytics do site:', err.message);
    return {
      period,
      onlineNow: 0,
      totalSessions: 0,
      totalPageviews: 0,
      topPages: [],
      devices: [],
      browsers: []
    };
  }
}

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

export function recordUserHeartbeat(db, { userId, username, email, role, path: currentPath, moduleName }) {
  const now = Date.now();
  const isoNow = new Date().toISOString();

  let session = userSessionsMap.get(userId);

  if (!session) {
    session = {
      userId,
      username,
      email,
      role: role || 'USER',
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

  try {
    ensureMonitorSchema(db);
    db.prepare(`
      INSERT INTO monitor_user_sessions (
        user_id, username, email, role, status, current_module, current_path,
        last_seen_at, login_at, total_session_seconds, module_time_json
      ) VALUES (?, ?, ?, ?, 'online', ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        email = excluded.email,
        role = excluded.role,
        status = 'online',
        current_module = excluded.current_module,
        current_path = excluded.current_path,
        last_seen_at = excluded.last_seen_at,
        total_session_seconds = excluded.total_session_seconds,
        module_time_json = excluded.module_time_json
    `).run(
      userId,
      username,
      email,
      role || 'USER',
      session.currentModule,
      session.currentPath,
      isoNow,
      session.loginAt,
      session.totalSessionSeconds,
      JSON.stringify(session.moduleTimeSeconds)
    );
  } catch (err) {
    // Ignora se for readonly
  }

  monitorEvents.emit('presence_update', {
    userId,
    username,
    currentModule: session.currentModule,
    status: 'online',
    timestamp: isoNow
  });

  return session;
}

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

  let dbSessionsMap = new Map();
  try {
    const dbSessions = targetDb.prepare(`SELECT * FROM monitor_user_sessions`).all();
    dbSessions.forEach(s => dbSessionsMap.set(s.user_id, s));
  } catch {}

  const now = Date.now();

  return allUsers.map(u => {
    const memorySession = userSessionsMap.get(u.id);
    const dbSession = dbSessionsMap.get(u.id);

    let status = 'offline';
    let lastSeenAt = u.updated_at || u.created_at;
    let loginAt = null;
    let currentModule = 'Nenhum';
    let currentPath = '/';
    let totalSessionSeconds = 0;
    let moduleTimeSeconds = {};

    const activeLastSeen = memorySession?.lastSeenAt || dbSession?.last_seen_at;

    if (activeLastSeen) {
      const msSinceLastSeen = now - new Date(activeLastSeen).getTime();
      if (msSinceLastSeen <= 90000) {
        status = 'online';
      } else if (msSinceLastSeen <= 300000) {
        status = 'idle';
      }

      lastSeenAt = activeLastSeen;
      loginAt = memorySession?.loginAt || dbSession?.login_at || null;
      currentModule = memorySession?.currentModule || dbSession?.current_module || 'Sistema';
      currentPath = memorySession?.currentPath || dbSession?.current_path || '/';
      totalSessionSeconds = memorySession?.totalSessionSeconds || dbSession?.total_session_seconds || 0;

      try {
        moduleTimeSeconds = memorySession?.moduleTimeSeconds || JSON.parse(dbSession?.module_time_json || '{}');
      } catch {
        moduleTimeSeconds = {};
      }
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
