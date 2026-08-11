import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const dbPath = path.join(process.cwd(), 'database.sqlite');
const jsonPath = path.join(process.cwd(), 'db.json');

console.log('Iniciando migração de JSON para SQLite...');

if (fs.existsSync(dbPath)) {
  console.log('O arquivo database.sqlite já existe. Removendo arquivo anterior para criar uma migração limpa...');
  fs.unlinkSync(dbPath);
}

const sqliteDb = new Database(dbPath);
const dbJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Função para criar tabela de forma genérica
function createTableForArray(tableName, dataArray) {
  if (dataArray.length === 0) {
    // Tabela vazia e sem esquema fixo, cria apenas com campo id e content (JSON) para não dar erro
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, json_content TEXT)`);
    return;
  }

  // Descobrir todas as colunas a partir do primeiro objeto (ou merge de todos)
  const columns = new Set();
  dataArray.forEach(obj => Object.keys(obj).forEach(k => columns.add(k)));
  
  if (!columns.has('id')) {
    columns.add('id');
  }

  let createSql = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
  const colDefs = [];
  
  columns.forEach(col => {
    if (col === 'id') {
      colDefs.push(`"${col}" TEXT PRIMARY KEY`);
    } else {
      colDefs.push(`"${col}" TEXT`); // Armazenaremos tudo como texto (incluindo JSON strings para arrays/objetos)
    }
  });

  createSql += colDefs.join(',\n');
  createSql += '\n);';

  sqliteDb.exec(createSql);

  // Inserir os dados
  const insertCols = Array.from(columns);
  const placeholders = insertCols.map(() => '?').join(', ');
  const insertStmt = sqliteDb.prepare(`INSERT INTO ${tableName} (${insertCols.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`);

  // Agrupa os inserts em uma transação para ser super rápido
  const insertMany = sqliteDb.transaction((items) => {
    for (const item of items) {
      const values = insertCols.map(col => {
        let val = item[col];
        if (val === undefined || val === null) return null;
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });
      
      // Garante que tenha um ID, se não tinha
      const idIdx = insertCols.indexOf('id');
      if (!values[idIdx]) values[idIdx] = `temp_${Date.now()}_${Math.random().toString(36).substring(2,7)}`;
      
      insertStmt.run(values);
    }
  });

  insertMany(dataArray);
  console.log(`✅ Tabela '${tableName}' migrada com ${dataArray.length} registros.`);
}

Object.keys(dbJson).forEach(key => {
  let tableName = key;
  
  // Customização pedida pelo usuário: usuários na tabela usuarios_lepta
  if (key === 'users') {
    tableName = 'usuarios_lepta';
  }

  const data = dbJson[key];

  if (Array.isArray(data)) {
    createTableForArray(tableName, data);
  } else if (typeof data === 'object' && data !== null) {
    // Configurações isoladas (como settings)
    sqliteDb.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (id TEXT PRIMARY KEY, json_content TEXT)`);
    const insertStmt = sqliteDb.prepare(`INSERT INTO ${tableName} (id, json_content) VALUES (?, ?)`);
    insertStmt.run('default', JSON.stringify(data));
    console.log(`✅ Tabela '${tableName}' migrada como objeto de configuração.`);
  }
});

console.log('🎉 Migração concluída com sucesso!');
sqliteDb.close();
