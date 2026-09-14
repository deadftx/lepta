const XLSX = require('xlsx');
const fs = require('fs');

const filePietra = 'PIPELINE PROPOSTAS - PIETRA.xlsx';
const fileNpl = fs.readdirSync('.').find(f => f.includes('CR') && f.includes('NPL') && f.endsWith('.xlsx'));

console.log('File Pietra:', filePietra);
console.log('File NPL:', fileNpl);

function inspect(file) {
  console.log('\n====================================');
  console.log('FILE:', file);
  const wb = XLSX.readFile(file);
  console.log('All Sheets:', wb.SheetNames);
  wb.SheetNames.forEach(s => {
    if (s.toLowerCase().includes('fech')) {
      const ws = wb.Sheets[s];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      console.log(`\nSheet [${s}] has ${rows.length} rows.`);
      for (let i = 0; i < Math.min(5, rows.length); i++) {
        console.log(`Row ${i} (${rows[i]?.length} cols):`, JSON.stringify(rows[i]));
      }
    }
  });
}

inspect(filePietra);
inspect(fileNpl);
