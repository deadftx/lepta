import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let dbInstance = null;

export const INVALID_COMPANY_REGEX = /^(foro\s|juizado|vara\s|\d+[\s?ªºa-zA-Z]*\s*vara\b|comarca\s|tribunal|camara\s|gabinete|secretaria|cartorio|promotoria|ministerio\s+publico|seo\b|secao\s|divisao\s+de|fazenda\s+publica|orfaos|sucessoes)/i;
export const LABOR_COURT_REGEX = /\b(trabalhist|vara\s+do\s+trabalho|trt\b|trt\d+|tst\b|csjt\b|justi[cç]a\s+do\s+trabalho|reclamat[oó]ria|reclamante|cr[eé]dito\s+trabalhista|habilita[cç][aã]o\s+trabalhista|rescis[aã]o\s+indireta|verbas\s+rescis[oó]rias|acordo\s+trabalhista|dep[oó]sito\s+recursal|clt\b|postotrabalhista)\b/i;

export function isLaborRelated(x) {
  if (!x) return false;
  const trib = String(x.tribunal || '');
  if (trib.toUpperCase().startsWith('TRT') || trib.toUpperCase() === 'TST' || trib.toUpperCase() === 'CSJT') {
    return true;
  }
  const textToCheck = `${x.empresa || ''} ${x.varaComarca || ''} ${x.tribunalNome || ''} ${x.administradorJudicial || ''} ${x.classe || ''} ${x.fonte || ''}`;
  return LABOR_COURT_REGEX.test(textToCheck);
}

export function isInvalidCompany(name) {
  if (!name) return false;
  const n = name.trim();
  if (n.length < 3) return true;
  if (INVALID_COMPANY_REGEX.test(n)) return true;
  if (/\bvara\b|\bjuizado\b|\bforo\s+central\b|\bju[ií]zo\s+[uú]nico\b|\b[oó]rf[aã]os\b|\bsucess[oõ]es\b|\bexecu[cç][oõ]es\s+fiscais\b/i.test(n)) {
    return true;
  }
  if (LABOR_COURT_REGEX.test(n)) return true;
  return false;
}

export function getMovimentoDb(projectRoot) {
  if (dbInstance) return dbInstance;

  const candidatePaths = [
    path.resolve(projectRoot, 'MovimentoFalimentar/data/movimento.db'),
    path.resolve(process.cwd(), 'MovimentoFalimentar/data/movimento.db'),
    path.resolve('MovimentoFalimentar/data/movimento.db')
  ];

  let resolvedDbPath = candidatePaths.find(p => fs.existsSync(p));
  if (!resolvedDbPath) {
    resolvedDbPath = candidatePaths[0];
    const dir = path.dirname(resolvedDbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new Database(resolvedDbPath);
  dbInstance.pragma('journal_mode = WAL');

  dbInstance.exec(`CREATE TABLE IF NOT EXISTS rj_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    processo TEXT NOT NULL,
    tribunal TEXT NOT NULL,
    tribunal_nome TEXT NOT NULL,
    classe TEXT NOT NULL,
    empresa TEXT,
    cnpj TEXT,
    endereco TEXT,
    administrador_judicial TEXT,
    vara_comarca TEXT,
    data_ajuizamento TEXT,
    data_captura TEXT NOT NULL,
    fonte TEXT NOT NULL,
    raw_json TEXT NOT NULL
  );`);

  dbInstance.exec(`CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    total INTEGER DEFAULT 0,
    error TEXT
  );`);

  return dbInstance;
}

export function saveItem(db, i) {
  if (isLaborRelated(i)) return;

  const rawObj = i.raw || {};
  if (rawObj.statusRJ === 'Não' || rawObj.ESTA_EM_RJ === 'Não' || rawObj.status_rj === 'Não') {
    return;
  }

  let cleanEmpresa = i.empresa ? i.empresa.trim() : null;
  if (isInvalidCompany(cleanEmpresa)) {
    cleanEmpresa = null;
  }
  const cleanCnpj = i.cnpj ? i.cnpj.trim() : null;
  if (!cleanEmpresa && !cleanCnpj) {
    return;
  }

  let existing;
  if (cleanEmpresa && cleanCnpj) {
    existing = db.prepare(`
      SELECT id FROM rj_events 
      WHERE processo = ? AND tribunal = ? AND (empresa = ? OR cnpj = ?)
      LIMIT 1
    `).get(i.processo, i.tribunal, cleanEmpresa, cleanCnpj);
  } else if (cleanEmpresa) {
    existing = db.prepare(`
      SELECT id FROM rj_events 
      WHERE processo = ? AND tribunal = ? AND empresa = ?
      LIMIT 1
    `).get(i.processo, i.tribunal, cleanEmpresa);
  } else if (cleanCnpj) {
    existing = db.prepare(`
      SELECT id FROM rj_events 
      WHERE processo = ? AND tribunal = ? AND cnpj = ?
      LIMIT 1
    `).get(i.processo, i.tribunal, cleanCnpj);
  }

  if (existing) {
    db.prepare(`
      UPDATE rj_events 
      SET tribunal_nome = ?, classe = ?, empresa = ?, cnpj = ?, endereco = ?, 
          administrador_judicial = ?, vara_comarca = ?, data_ajuizamento = ?, 
          data_captura = ?, fonte = ?, raw_json = ?
      WHERE id = ?
    `).run(
      i.tribunalNome,
      i.classe,
      cleanEmpresa,
      cleanCnpj,
      i.endereco || null,
      i.administradorJudicial || null,
      i.varaComarca || null,
      i.dataAjuizamento || null,
      i.dataCaptura || new Date().toISOString(),
      i.fonte,
      JSON.stringify(i.raw || {}),
      existing.id
    );
    return;
  }

  db.prepare(`
    INSERT INTO rj_events (
      processo, tribunal, tribunal_nome, classe, empresa, cnpj,
      endereco, administrador_judicial, vara_comarca,
      data_ajuizamento, data_captura, fonte, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    i.processo,
    i.tribunal,
    i.tribunalNome,
    i.classe,
    cleanEmpresa,
    cleanCnpj,
    i.endereco || null,
    i.administradorJudicial || null,
    i.varaComarca || null,
    i.dataAjuizamento || null,
    i.dataCaptura || new Date().toISOString(),
    i.fonte,
    JSON.stringify(i.raw || {})
  );
}

function mapRow(r) {
  let raw = {};
  try {
    raw = JSON.parse(r.raw_json);
  } catch {}
  return {
    id: r.id,
    processo: r.processo,
    tribunal: r.tribunal,
    tribunalNome: r.tribunal_nome,
    classe: r.classe,
    empresa: r.empresa,
    cnpj: r.cnpj,
    endereco: r.endereco,
    administradorJudicial: r.administrador_judicial,
    varaComarca: r.vara_comarca,
    dataAjuizamento: r.data_ajuizamento,
    dataCaptura: r.data_captura,
    fonte: r.fonte,
    raw
  };
}

export function getAllRecent(db, days = 7) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT * FROM rj_events
    WHERE (data_captura >= ? OR data_ajuizamento >= ?)
    ORDER BY COALESCE(data_ajuizamento, data_captura) DESC, id DESC
  `).all(since, since);
  return rows.map(mapRow);
}

export function getToday(db) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`
    SELECT * FROM rj_events
    WHERE substr(data_captura, 1, 10) = ? OR substr(data_ajuizamento, 1, 10) = ?
    ORDER BY id DESC
  `).all(todayStr, todayStr);
  return rows.map(mapRow);
}

export function getLastScan(db) {
  return db.prepare(`SELECT * FROM scans ORDER BY id DESC LIMIT 1`).get() || null;
}
