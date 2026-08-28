import fs from 'fs';
import path from 'path';
import readline from 'readline';

const basePath = path.resolve('SmartFactor/backup_4055_270826');
const files = ['cedentes.csv', 'sacados.csv', 'opconvencional.csv', 'titulos.csv'];

for (const f of files) {
  const filePath = path.join(basePath, f);
  const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    const cols = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
    console.log(`=== ${f} (${cols.length} colunas) ===`);
    cols.forEach((c, idx) => console.log(`  [Col ${idx}] ${c}`));
    break;
  }
}
