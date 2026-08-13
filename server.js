import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve arquivos estáticos do frontend (pasta dist) em produção
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, 'dist')));

// Inicializa banco de dados
const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath, { fileMustExist: false });
db.pragma('journal_mode = WAL');

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
        throw new Error(`Falha ao baixar arquivo remoto (${resFetch.status}).`);
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
app.get('/api/analise-clientes', (req, res) => {
  try {
    const query = `
      SELECT 
        CLIENTE as cedente,
        COUNT(id) as qtdTitulos,
        SUM(VALOR) as valorGeral,
        SUM(CASE WHEN Status = 'Vencido' THEN VALOR ELSE 0 END) as valorVencido
      FROM "BASE"
      WHERE CLIENTE IS NOT NULL AND CLIENTE != ''
      GROUP BY CLIENTE
      ORDER BY valorGeral DESC
    `;
    const rows = db.prepare(query).all();
    res.json(rows);
  } catch (err) {
    console.error('Erro ao consultar análise de clientes:', err);
    res.status(500).json({ error: 'Erro ao consultar análise de clientes', message: err.message });
  }
});

app.get('/api/analise-sacados/:cedente', (req, res) => {
  try {
    const cedente = req.params.cedente;
    const query = `
      SELECT 
        SACADO as sacado,
        COUNT(id) as qtdTitulos,
        SUM(VALOR) as valorGeral,
        SUM(CASE WHEN Status = 'Vencido' THEN VALOR ELSE 0 END) as valorVencido
      FROM "BASE"
      WHERE CLIENTE = ? AND SACADO IS NOT NULL AND SACADO != ''
      GROUP BY SACADO
      ORDER BY valorGeral DESC
    `;
    const rows = db.prepare(query).all(cedente);
    res.json(rows);
  } catch (err) {
    console.error('Erro ao consultar analise de sacados:', err);
    res.status(500).json({ error: 'Erro ao consultar analise de sacados', message: err.message });
  }
});


// -------------------------------------------------------------
// GENERIC REST API (MIMICKING JSON-SERVER)
// -------------------------------------------------------------

app.get('/:table', (req, res, next) => {
  const table = getActualTableName(req.params.table);
  try {
    const rows = db.prepare(`SELECT * FROM "${table}"`).all();
    if (table === 'databaseTables') {
       res.json(rows.map(r => JSON.parse(r.json_content)));
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
  try {
    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({});
    
    if (table === 'databaseTables') {
       res.json(JSON.parse(row.json_content));
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
  const data = req.body;
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
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/:table/:id', (req, res) => {
  const table = getActualTableName(req.params.table);
  const id = req.params.id;
  const data = req.body;
  if (!data.id) data.id = id;

  try {
    const keys = Object.keys(data);
    const colsSql = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);

    // Usamos REPLACE INTO para simplificar PUT (que sobrescreve)
    db.prepare(`REPLACE INTO "${table}" (${colsSql}) VALUES (${placeholders})`).run(values);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/:table/:id', (req, res) => {
  const table = getActualTableName(req.params.table);
  const id = req.params.id;
  const data = req.body;

  try {
    const keys = Object.keys(data);
    const setSql = keys.map(k => `"${k}" = ?`).join(', ');
    const values = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
    values.push(id);

    db.prepare(`UPDATE "${table}" SET ${setSql} WHERE id = ?`).run(values);
    const row = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`).get(id);
    res.json(parseRow(row));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/:table/:id', (req, res) => {
  const table = getActualTableName(req.params.table);
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
