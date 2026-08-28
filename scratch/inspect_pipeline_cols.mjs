import ExcelJS from 'exceljs';
import fs from 'fs';

const pipelineCandidates = [
  './PIPELINE PROPOSTAS - PIETRA.xlsx',
  'C:/Users/ArthurFeltrinDeco/OneDrive - Lepta/Depto Comercial NPL - Documentos/DEPTO COMERCIAL NPL/ACOMPANHAMENTO DE CASOS - NPL/GESTOR/PIETRA/PIPELINE PROPOSTAS - PIETRA.xlsx'
];
const pipelinePath = pipelineCandidates.find(p => fs.existsSync(p));

console.log('Pipeline Path:', pipelinePath);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(pipelinePath);

wb.eachSheet((ws) => {
  console.log(`\n=== ABA: "${ws.name}" (Linhas: ${ws.rowCount}) ===`);
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    const row = ws.getRow(r);
    const vals = [];
    row.eachCell((c, colNum) => {
      let v = c.value;
      if (typeof v === 'object' && v !== null) v = v.result || v.text || '';
      vals.push(`[Col ${colNum}] ${String(v).slice(0, 30)}`);
    });
    if (vals.length > 0) {
      console.log(`Linha ${r}: ${vals.join(' | ')}`);
    }
  }
});
