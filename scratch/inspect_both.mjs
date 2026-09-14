import ExcelJS from 'exceljs';
import fs from 'fs';

async function inspectFile(filePath) {
  console.log('\n=============================================');
  console.log('Inspecting:', filePath);
  if (!fs.existsSync(filePath)) {
    console.log('File not found!');
    return;
  }
  const stats = fs.statSync(filePath);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log('Worksheets:', wb.worksheets.map(w => w.name));

  for (const ws of wb.worksheets) {
    if (ws.name.toLowerCase().includes('fech')) {
      console.log(`\n--- Target Worksheet: "${ws.name}" ---`);
      console.log(`Row count reported: ${ws.rowCount}, Column count: ${ws.columnCount}`);

      // Find header row (usually row 1, 2, or 3)
      for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
        const row = ws.getRow(r);
        const cells = [];
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          let val = cell.value;
          if (val && typeof val === 'object') {
            val = val.result || val.text || JSON.stringify(val);
          }
          if (val !== null && val !== undefined && String(val).trim() !== '') {
            cells.push({ col: colNum, val: String(val).trim() });
          }
        });
        if (cells.length > 0) {
          console.log(`Row ${r} (${cells.length} non-empty cells):`, cells.slice(0, 15).map(c => `[${c.col}] ${c.val}`).join(' | '));
        }
      }
    }
  }
}

const nplFile = fs.readdirSync('.').find(f => f.includes('NPL') && f.includes('CR') && f.endsWith('.xlsx'));

await inspectFile('PIPELINE PROPOSTAS - PIETRA.xlsx');
if (nplFile) {
  await inspectFile(nplFile);
}
