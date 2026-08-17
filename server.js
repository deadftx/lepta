import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';
import stringSimilarity from 'string-similarity';

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
// HELPER PARA BUSCAR TÍTULOS DA API UNLTD
// -------------------------------------------------------------
const UNLTD_TOKEN = 'FCFAF0D8C6570D1D9A1BE2D3571B53D5DF0F3BD3BCCE63A8849CCC8F1FA6072A';

async function fetchTitulosDaAPI(req) {
  const { startDate, endDate } = req.query;
  const payload = {};
  
  if (startDate && endDate) {
    payload.tipoDeData = 'Vencimento';
    // Adiciona timezone Z para manter em UTC conforme especificação, ajustando o final do dia
    payload.dataInicial = `${startDate}T00:00:00Z`;
    payload.dataFinal = `${endDate}T23:59:59Z`;
  }
  
  const response = await fetch('https://lepta-backend.bit-unltd.com.br/recebiveis/titulos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': UNLTD_TOKEN
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Erro API UNLTD (${response.SITUACAO}):`, errorText);
    throw new Error(`Erro API UNLTD: ${response.SITUACAO}`);
  }
  
  const titulos = await response.json();
  return Array.isArray(titulos) ? titulos : [];
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
      const titulos = await fetchTitulosDaAPI(req);
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
        const isLiquidado = situacao.includes('liquidado');
        const isVencido = isAberto && dataVenc && dataVenc < hoje;
        const valNominal = t.valorNominal || 0;
        const valLiquido = t.valorLiquido || 0;
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
        if (isLiquidado) { curr.qtdLiquidado += 1; curr.valorLiquidado += valLiquido; }
        if (isAberto && !isVencido) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
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
        const isLiquidado = situacao.includes('liquidado');
        const isVencido = isAberto && dataVenc && dataVenc < hoje;
        const valNominal = t.valorNominal || 0;
        const valLiquido = t.valorLiquido || 0;
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
        if (isLiquidado) { curr.qtdLiquidado += 1; curr.valorLiquidado += valLiquido; }
        if (isAberto && !isVencido) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
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
      const titulos = await fetchTitulosDaAPI(req);
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
        const isLiquidado = situacao.includes('liquidado');
        const isVencido = isAberto && dataVenc && dataVenc < hoje;
        const valNominal = t.valorNominal || 0;
        const valLiquido = t.valorLiquido || 0;
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
        if (isLiquidado) { curr.qtdLiquidado += 1; curr.valorLiquidado += valLiquido; }
        if (isAberto && !isVencido) { curr.qtdAberto += 1; curr.valorAberto += valNominal; }
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
