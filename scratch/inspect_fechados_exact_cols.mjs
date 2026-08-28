import ExcelJS from 'exceljs';
import fs from 'fs';

const fechadosCandidates = [
  'C:/Users/ArthurFeltrinDeco/OneDrive - Lepta/Arquivos de Chat do Microsoft Teams/CASOS_NPL_FECHADOS_CONSOLIDADO_INTEGRADO.xlsx',
  './CASOS_NPL_FECHADOS_CONSOLIDADO_INTEGRADO.xlsx'
];
const fechadosPath = fechadosCandidates.find(p => fs.existsSync(p));

console.log('Fechados Path:', fechadosPath);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(fechadosPath);

const ws = wb.getWorksheet('CONSOLIDADO') || wb.worksheets[0];
console.log(`Linhas totais na planilha: ${ws.rowCount}`);

for (let r = 1; r <= 10; r++) {
  const row = ws.getRow(r);
  const vals = [];
  row.eachCell((c, colNum) => {
    let v = c.value;
    if (typeof v === 'object' && v !== null) v = v.result || v.text || '';
    vals.push(`[Col ${colNum}] ${String(v).slice(0, 35)}`);
  });
  if (vals.length > 0) {
    console.log(`Linha ${r}: ${vals.join(' | ')}`);
  }
}
