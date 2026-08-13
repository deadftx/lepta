const fs = require('fs');
const csv = require('csv-parser');
const db = require('better-sqlite3')('database.sqlite');

const files = [
  'Lepta MS FIDC - Titulos - 2000-07-01 - 2050-07-31.csv',
  'Lepta Securit. - Titulos - 2000-07-01 - 2050-07-31.csv',
  'Lepta Special FIDC - Titulos - 2000-07-01 - 2050-07-31.csv'
];

db.exec(`DROP TABLE IF EXISTS "BASE_NOVA"`);

let tableCreated = false;
let insertStmt;
let columnNames = [];

function parseBRL(value) {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  // Regex to detect if it's a number formatted like 1.234,56 or 1234,56
  let clean = value.replace(/\./g, '').replace(',', '.');
  let num = parseFloat(clean);
  return isNaN(num) ? value : num;
}

const currencyColumns = [
  'VALOR_NOMINAL', 'DESCONTO_ABATIMENTO', 'VALOR_LIQUIDO', 
  'VALOR_PAGO', 'SALDO_DEVEDOR', 'OSCILACAO', 'TAXA', 
  'DESAGIO', 'CUSTO', 'RECEITA', 'TARIFAS_OPERACAO'
];

function processFile(filename) {
  return new Promise((resolve, reject) => {
    let batch = [];
    
    const insertMany = db.transaction((rows) => {
      for (const row of rows) insertStmt.run(row);
    });

    fs.createReadStream(filename)
      .pipe(csv({
        separator: ';',
        mapHeaders: ({ header, index }) => {
          // Remover o segundo 'DOCUMENTO' (coluna G que é index 6)
          if (index === 6) return null; // Ignora essa coluna
          
          let cleanHeader = header.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/ç/g, "c").replace(/Ç/g, "C").toUpperCase();
          return cleanHeader;
        }
      }))
      .on('headers', (headers) => {
        if (!tableCreated) {
          columnNames = headers;
          const columnsDef = columnNames.map(h => `"${h}" TEXT`).join(', ');
          db.exec(`CREATE TABLE "BASE_NOVA" (${columnsDef})`);
          
          const placeholders = columnNames.map(() => '?').join(', ');
          insertStmt = db.prepare(`INSERT INTO "BASE_NOVA" VALUES (${placeholders})`);
          tableCreated = true;
        }
      })
      .on('data', (data) => {
        const rowValues = columnNames.map(col => {
          let val = data[col] || '';
          if (currencyColumns.includes(col)) {
            val = parseBRL(val);
          }
          return val;
        });
        batch.push(rowValues);
        
        if (batch.length >= 5000) {
          insertMany(batch);
          batch = [];
        }
      })
      .on('end', () => {
        if (batch.length > 0) {
          insertMany(batch);
        }
        resolve();
      })
      .on('error', reject);
  });
}

async function run() {
  try {
    for (const f of files) {
      console.log("Processando", f);
      await processFile(f);
    }
    console.log("Migração concluída com sucesso!");
    
    // Contar total
    const total = db.prepare('SELECT COUNT(*) as c FROM "BASE_NOVA"').get();
    console.log(`Total de linhas inseridas: ${total.c}`);
    
  } catch (err) {
    console.error("Erro na importação:", err);
  }
}

run();
