import { scryptSync, timingSafeEqual } from 'crypto';

const BLOCKED_TABLES = new Set([
  'usuarios_lepta',
  'settings',
  'authsessions',
  'sqlite_sequence',
  'sqlite_stat1',
  'sqlite_stat4'
]);

function isTableAllowed(tableName) {
  if (!tableName || typeof tableName !== 'string') return false;
  const normalized = tableName.trim().toLowerCase();
  if (BLOCKED_TABLES.has(normalized)) return false;
  if (normalized.startsWith('sqlite_')) return false;
  if (/password|secret|token|credential/i.test(normalized)) return false;
  return true;
}

function quoteIdentifier(identifier) {
  return `"${String(identifier || '').replace(/"/g, '""')}"`;
}

function parseStringArray(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(v => String(v || '').trim()).filter(Boolean) : [];
  } catch {
    return value.split(',').map(v => v.trim()).filter(Boolean);
  }
}

function hasBiPermission(user) {
  if (!user) return false;
  if (user.role === 'MASTER') return true;
  const permissions = parseStringArray(user.permissions);
  return permissions.includes('9'); // 9 = Banco de Dados
}

function escapeCsvField(value, delimiter = ',') {
  if (value === null || value === undefined) return '';
  let str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function registerPowerBiRoutes(app, {
  db,
  verifyPassword,
  authSessions
}) {
  const failedAttempts = new Map();

  // Middleware de autenticação específico para Power BI (Basic Auth ou Bearer/Token)
  const authenticateBiRequest = (req, res, next) => {
    const authHeader = String(req.headers.authorization || '').trim();
    const tokenQuery = String(req.query.token || req.query.api_key || '').trim();

    let user = null;

    // 1. Tenta autenticação via Bearer Token ou Query Param
    if (authHeader.startsWith('Bearer ') || tokenQuery) {
      const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : tokenQuery;
      if (authSessions && authSessions.has(token)) {
        const session = authSessions.get(token);
        if (session.expiresAt >= Date.now()) {
          user = db.prepare('SELECT * FROM usuarios_lepta WHERE id = ?').get(session.userId);
        }
      }
    }

    // 2. Tenta autenticação via HTTP Basic Auth (Padrão nativo do Power BI Web)
    if (!user && authHeader.startsWith('Basic ')) {
      const base64Credentials = authHeader.substring(6).trim();
      try {
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
        const separatorIndex = credentials.indexOf(':');
        if (separatorIndex > 0) {
          const loginId = credentials.substring(0, separatorIndex).trim().toLowerCase();
          const password = credentials.substring(separatorIndex + 1);

          // Rate limit por IP para prevenir força bruta
          const ipKey = `bi-auth:${req.ip}:${loginId}`;
          const attempt = failedAttempts.get(ipKey);
          const now = Date.now();
          if (attempt && attempt.count >= 15 && attempt.resetAt > now) {
            res.setHeader('Retry-After', Math.ceil((attempt.resetAt - now) / 1000));
            return res.status(429).json({ error: 'Muitas tentativas de autenticação no Power BI. Tente novamente mais tarde.' });
          }

          const candidate = db.prepare(`
            SELECT * FROM usuarios_lepta
            WHERE lower(username) = ? OR lower(email) = ?
            LIMIT 1
          `).get(loginId, loginId);

          if (candidate && !candidate.fully_locked && !candidate.access_locked) {
            if (verifyPassword && verifyPassword(password, candidate.password)) {
              user = candidate;
              failedAttempts.delete(ipKey);
            }
          }

          if (!user) {
            const currentCount = (attempt && attempt.resetAt > now) ? attempt.count + 1 : 1;
            failedAttempts.set(ipKey, { count: currentCount, resetAt: now + 15 * 60 * 1000 });
          }
        }
      } catch (e) {
        console.error('Erro ao decodificar Basic Auth:', e.message);
      }
    }

    // Se não autenticou, envia cabeçalho WWW-Authenticate para o Power BI abrir a janela de credenciais
    if (!user) {
      res.setHeader('WWW-Authenticate', 'Basic realm="LEPTA Power BI Integration", charset="UTF-8"');
      return res.status(401).json({
        error: 'Autenticação necessária. No Power BI, use o tipo de credencial Básico (usuário e senha do LEPTA).'
      });
    }

    // Verifica bloqueio de acesso
    if (user.fully_locked || user.access_locked) {
      return res.status(423).json({ error: 'Acesso do usuário bloqueado no sistema LEPTA.' });
    }

    // Verifica se possui permissão 9 (Banco de Dados) ou MASTER
    if (!hasBiPermission(user)) {
      return res.status(403).json({
        error: 'Usuário sem permissão para exportação do Banco de Dados para o Power BI (permissão de Banco de Dados necessária).'
      });
    }

    req.biUser = user;
    next();
  };

  /**
   * Helper para listar todas as tabelas permitidas e seus metadados
   */
  function getAllowedTables() {
    const rows = db.prepare(`
      SELECT name, type
      FROM sqlite_master
      WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
    `).all();

    const allowed = [];
    for (const row of rows) {
      if (!isTableAllowed(row.name)) continue;

      let count = 0;
      try {
        const countRow = db.prepare(`SELECT count(*) AS c FROM ${quoteIdentifier(row.name)}`).get();
        count = countRow ? countRow.c : 0;
      } catch {
        count = 0;
      }

      let columns = [];
      try {
        const pragma = db.prepare(`PRAGMA table_info(${quoteIdentifier(row.name)})`).all();
        columns = pragma.map(col => ({
          name: col.name,
          type: col.type || 'TEXT',
          primaryKey: Boolean(col.pk)
        }));
      } catch {
        columns = [];
      }

      allowed.push({
        name: row.name,
        type: row.type,
        rowCount: count,
        columnsCount: columns.length,
        columns
      });
    }

    return allowed;
  }

  // -------------------------------------------------------------
  // GET /api/bi/catalog - Catálogo de tabelas para o Power BI
  // -------------------------------------------------------------
  app.get('/api/bi/catalog', authenticateBiRequest, (req, res) => {
    try {
      const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.get('host') || 'localhost:3004';
      const baseUrl = `${protocol}://${host}`;

      const tables = getAllowedTables().map(table => ({
        ...table,
        endpoints: {
          json: `${baseUrl}/api/bi/data/${encodeURIComponent(table.name)}?format=json`,
          csv: `${baseUrl}/api/bi/data/${encodeURIComponent(table.name)}?format=csv`
        },
        powerQueryM: {
          json: `let\n    Fonte = Json.Document(Web.Contents("${baseUrl}/api/bi/data/${encodeURIComponent(table.name)}", [Headers=[#"Accept"="application/json"]]))\nin\n    Table.FromRecords(Fonte)`,
          csv: `let\n    Fonte = Csv.Document(Web.Contents("${baseUrl}/api/bi/data/${encodeURIComponent(table.name)}?format=csv"), [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),\n    Cabecalho = Table.PromoteHeaders(Fonte, [PromoteAllScalars=true])\nin\n    Cabecalho`
        }
      }));

      return res.json({
        service: 'LEPTA Power BI Data Feed API',
        authenticatedAs: req.biUser.username || req.biUser.email,
        timestamp: new Date().toISOString(),
        totalTables: tables.length,
        tables
      });
    } catch (error) {
      console.error('Erro no catálogo do Power BI:', error.message);
      return res.status(500).json({ error: 'Erro ao gerar catálogo de dados para o Power BI.' });
    }
  });

  // -------------------------------------------------------------
  // GET /api/bi/schema/:table - Metadados de uma tabela específica
  // -------------------------------------------------------------
  app.get('/api/bi/schema/:table', authenticateBiRequest, (req, res) => {
    const tableName = String(req.params.table || '').trim();
    if (!isTableAllowed(tableName)) {
      return res.status(403).json({ error: 'Tabela não autorizada para consulta no Power BI.' });
    }

    try {
      const exists = db.prepare(`
        SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?
      `).get(tableName);

      if (!exists) {
        return res.status(404).json({ error: `Tabela '${tableName}' não encontrada.` });
      }

      const columns = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
      const countRow = db.prepare(`SELECT count(*) AS c FROM ${quoteIdentifier(tableName)}`).get();

      return res.json({
        tableName,
        rowCount: countRow ? countRow.c : 0,
        columns: columns.map(c => ({
          name: c.name,
          type: c.type || 'TEXT',
          notNull: Boolean(c.notnull),
          primaryKey: Boolean(c.pk)
        }))
      });
    } catch (error) {
      console.error('Erro ao consultar schema:', error.message);
      return res.status(500).json({ error: 'Erro ao obter estrutura da tabela.' });
    }
  });

  // -------------------------------------------------------------
  // GET /api/bi/data/:table - Exportação de dados (JSON ou CSV Stream)
  // -------------------------------------------------------------
  app.get('/api/bi/data/:table', authenticateBiRequest, (req, res) => {
    const tableName = String(req.params.table || '').trim();
    if (!isTableAllowed(tableName)) {
      return res.status(403).json({ error: 'Tabela não autorizada para exportação no Power BI.' });
    }

    try {
      const exists = db.prepare(`
        SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?
      `).get(tableName);

      if (!exists) {
        return res.status(404).json({ error: `Tabela '${tableName}' não encontrada no banco de dados.` });
      }

      const format = String(req.query.format || 'json').toLowerCase();
      const limit = req.query.limit ? Math.max(1, parseInt(req.query.limit, 10)) : null;
      const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset, 10)) : null;
      const delimiter = String(req.query.delimiter || ',').charAt(0) || ',';

      let sql = `SELECT * FROM ${quoteIdentifier(tableName)}`;
      const params = [];
      if (limit !== null) {
        sql += ` LIMIT ?`;
        params.push(limit);
        if (offset !== null) {
          sql += ` OFFSET ?`;
          params.push(offset);
        }
      }

      const stmt = db.prepare(sql);
      const iterator = stmt.iterate(...params);

      // --- FORMATO HTML (Visualizador de Tabela Web Limpo no Navegador) ---
      if (format === 'html' || format === 'web') {
        const columnsInfo = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
        const columnNames = columnsInfo.map(c => c.name);
        const rows = stmt.all(...params);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LEPTA BI - Tabela ${tableName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0b0f19;
      --card: #111827;
      --border: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --accent: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); color: var(--text); padding: 24px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
    h1 { font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    .badge { background: #1e3a8a; color: #93c5fd; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; }
    .controls { display: flex; gap: 10px; align-items: center; }
    input[type="text"] { background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 8px 14px; border-radius: 8px; font-size: 13px; outline: none; width: 280px; }
    input[type="text"]:focus { border-color: var(--accent); }
    .btn { background: #1e293b; border: 1px solid var(--border); color: #e2e8f0; padding: 8px 14px; border-radius: 8px; text-decoration: none; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; }
    .btn:hover { background: #334155; }
    .table-container { background: var(--card); border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; max-height: calc(100vh - 120px); box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; white-space: nowrap; }
    thead th { background: #0b111e; color: #94a3b8; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 16px; position: sticky; top: 0; border-bottom: 1px solid var(--border); }
    tbody td { padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #e2e8f0; max-width: 400px; overflow: hidden; text-overflow: ellipsis; }
    tbody tr:hover { background: rgba(255,255,255,0.02); }
    .empty { padding: 40px; text-align: center; color: var(--muted); }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Tabela: <code>${tableName}</code> <span class="badge">${rows.length} registros</span></h1>
    </div>
    <div class="controls">
      <input type="text" id="filter" placeholder="Buscar / Filtrar na tabela..." onkeyup="filterTable()">
      <a href="?format=csv" class="btn" download>Exportar CSV</a>
      <a href="?format=json" class="btn">Ver JSON</a>
    </div>
  </div>
  <div class="table-container">
    <table id="dataTable">
      <thead>
        <tr>
          ${columnNames.map(c => `<th>${c}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.length === 0 ? `<tr><td colspan="${columnNames.length}" class="empty">Nenhum registro encontrado nesta tabela.</td></tr>` : ''}
        ${rows.map(r => `<tr>${columnNames.map(c => {
          let v = r[c];
          if (v === null || v === undefined) return '<td style="color:#64748b">—</td>';
          if (typeof v === 'object') v = JSON.stringify(v);
          return `<td>${String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>`;
        }).join('')}</tr>`).join('')}
      </tbody>
    </table>
  </div>
  <script>
    function filterTable() {
      const q = document.getElementById('filter').value.toLowerCase();
      const rows = document.querySelectorAll('#dataTable tbody tr');
      rows.forEach(tr => {
        tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
        return res.send(html);
      }

      // --- FORMATO CSV (Streaming com UTF-8 BOM) ---
      if (format === 'csv') {
        const columnsInfo = db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
        const columnNames = columnsInfo.map(c => c.name);

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(tableName)}.csv"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');

        // Escreve UTF-8 BOM para Power BI e Excel reconhecerem acentuação perfeitamente
        res.write('\uFEFF');

        // Linha de cabeçalho
        res.write(columnNames.map(col => escapeCsvField(col, delimiter)).join(delimiter) + '\r\n');

        // Streaming das linhas
        for (const row of iterator) {
          const line = columnNames.map(col => escapeCsvField(row[col], delimiter)).join(delimiter);
          res.write(line + '\r\n');
        }

        return res.end();
      }

      // --- FORMATO JSON (Streaming de Array para o Power BI) ---
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      res.write('[');
      let isFirst = true;

      for (const row of iterator) {
        // Trata campos JSON stringificados caso existam
        const cleanRow = { ...row };
        for (const key in cleanRow) {
          const val = cleanRow[key];
          if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
            try {
              cleanRow[key] = JSON.parse(val);
            } catch {
              // Mantém texto original se não for JSON válido
            }
          }
        }

        if (!isFirst) {
          res.write(',');
        } else {
          isFirst = false;
        }

        res.write(JSON.stringify(cleanRow));
      }

      res.write(']');
      return res.end();

    } catch (error) {
      console.error(`Erro ao exportar dados da tabela '${tableName}':`, error.message);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Erro ao extrair dados para o Power BI.' });
      }
      res.end();
    }
  });
}
