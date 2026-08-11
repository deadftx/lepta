import ExcelJS from 'exceljs';
const filePath = 'Lepta - TitulosEmAberto.xlsx';
async function run() {
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(filePath, {
    entries: 'emit', sharedStrings: 'cache', hyperlinks: 'ignore', styles: 'ignore', worksheets: 'emit'
  });
  for await (const worksheetReader of workbookReader) {
    if (worksheetReader.name !== 'BASE') continue;
    let count = 0;
    for await (const row of worksheetReader) {
      const vals = Array.isArray(row.values) ? row.values : [];
      // ID is probably the second or third column
      if (vals.includes('97119') || vals.includes(97119)) {
        count++;
      }
    }
    console.log(`ID 97119 found ${count} times in BASE sheet.`);
  }
}
run();
