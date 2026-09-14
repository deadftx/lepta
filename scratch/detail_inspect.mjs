import ExcelJS from 'exceljs';
import fs from 'fs';

async function detailInspect() {
  const wbPietra = new ExcelJS.Workbook();
  await wbPietra.xlsx.readFile('PIPELINE PROPOSTAS - PIETRA.xlsx');
  const wsPietra = wbPietra.getWorksheet('CASOS FECHADOS');

  console.log('--- PIETRA: CASOS FECHADOS ---');
  const headerRowP = wsPietra.getRow(8);
  const headersP = [];
  headerRowP.eachCell({ includeEmpty: false }, (cell, colNum) => {
    headersP.push({ col: colNum, name: String(cell.value).trim() });
  });
  console.log('Headers count:', headersP.length);
  console.log('Headers:', headersP);

  // Count valid data rows
  let validPietraRows = 0;
  for (let r = 9; r <= 1000; r++) {
    const row = wsPietra.getRow(r);
    const c1 = row.getCell(1).value;
    const c2 = row.getCell(2).value;
    const c3 = row.getCell(3).value;
    if (c1 || c2 || c3) {
      validPietraRows++;
    } else {
      // Check if there are next rows or if it ended
      let hasMore = false;
      for (let look = r + 1; look <= r + 5; look++) {
        if (wsPietra.getRow(look).getCell(1).value || wsPietra.getRow(look).getCell(2).value) {
          hasMore = true;
          break;
        }
      }
      if (!hasMore && r > 20) break;
    }
  }
  console.log('Valid data rows in Pietra:', validPietraRows);

  const nplFile = fs.readdirSync('.').find(f => f.includes('NPL') && f.includes('CR') && f.endsWith('.xlsx'));
  const wbNpl = new ExcelJS.Workbook();
  await wbNpl.xlsx.readFile(nplFile);
  const wsNpl = wbNpl.getWorksheet('FECHADOS');

  console.log('\n--- NPL: FECHADOS ---');
  const headerRowN = wsNpl.getRow(2);
  const headersN = [];
  headerRowN.eachCell({ includeEmpty: false }, (cell, colNum) => {
    headersN.push({ col: colNum, name: String(cell.value).trim() });
  });
  console.log('Headers count:', headersN.length);
  console.log('Headers:', headersN);

  let validNplRows = 0;
  for (let r = 3; r <= wsNpl.rowCount; r++) {
    const row = wsNpl.getRow(r);
    const devedor = row.getCell(8).value;
    const cedente = row.getCell(7).value;
    if (devedor || cedente) validNplRows++;
  }
  console.log('Valid data rows in NPL:', validNplRows);
}

await detailInspect();
