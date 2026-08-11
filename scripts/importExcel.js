import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import Database from 'better-sqlite3';

const filePath = process.argv[2];
if (!filePath) {
  console.error('❌ Caminho do arquivo não fornecido.');
  process.exit(1);
}

const dbPath = path.join(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

async function runImport() {
  console.log(`🚀 Iniciando Importação Local: ${filePath}`);
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: 'emit', sharedStrings: 'cache', hyperlinks: 'ignore', styles: 'ignore', worksheets: 'emit'
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
        const count = r.filter(v => v !== null && v !== undefined && String(v).trim() !== '').length;
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
         db.exec(`DROP TABLE IF EXISTS "${tableName}"`);
         try {
             db.exec(`CREATE TABLE "${tableName}" (${colsSql})`);
         } catch (err) {
             console.error(`Erro ao criar tabela. SQL: CREATE TABLE "${tableName}" (${colsSql})`);
             throw err;
         }
         const placeholders = headers.map(() => '?').join(', ');
         insertStmt = db.prepare(`INSERT INTO "${tableName}" (${headers.map(h => `"${h}"`).join(', ')}) VALUES (${placeholders})`);
         
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
        sourceType: 'FILE',
        fileName: path.basename(filePath),
        columns: headers,
        primaryKey: pk,
        rowCount: rowCount,
        lastSyncedAt: now,
        data: []
      });
      console.log(`✅ Base "${tableName}": ${rowCount} registros, ${headers.length} colunas.`);
    }
  }

  db.exec(`CREATE TABLE IF NOT EXISTS databaseTables (id TEXT PRIMARY KEY, json_content TEXT)`);
  const stmt = db.prepare(`INSERT OR REPLACE INTO databaseTables (id, json_content) VALUES (?, ?)`);
  createdTables.forEach(t => stmt.run(t.id, JSON.stringify(t)));

  console.log(`\n🎉 Sucesso! ${createdTables.length} tabela(s) gravada(s) diretamente no SQLite!`);
}

runImport().catch(console.error);
