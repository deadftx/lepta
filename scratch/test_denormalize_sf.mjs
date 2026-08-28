import fs from 'fs';
import path from 'path';
import readline from 'readline';

const basePath = path.resolve('SmartFactor/backup_4055_270826');

console.log('=== TESTE DE MAP E DENORMALIZAÇÃO SMARTFACTOR ➔ BASE_SMARTFACTOR ===\n');

// 1. Carregar Cedentes em Map
const cedMap = new Map();
const cedStream = fs.createReadStream(path.join(basePath, 'cedentes.csv'), { encoding: 'latin1' });
const cedRl = readline.createInterface({ input: cedStream, crlfDelay: Infinity });

for await (const line of cedRl) {
  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  if (c[0] && c[0] !== 'CPF/CNPJ') {
    cedMap.set(c[0].replace(/\D/g, ''), c[1]);
  }
}
console.log(`Cedentes carregados em memória: ${cedMap.size}`);

// 2. Carregar Sacados em Map
const sacMap = new Map();
const sacStream = fs.createReadStream(path.join(basePath, 'sacados.csv'), { encoding: 'latin1' });
const sacRl = readline.createInterface({ input: sacStream, crlfDelay: Infinity });

for await (const line of sacRl) {
  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  if (c[0] && c[0] !== 'CPF/CNPJ') {
    sacMap.set(c[0].replace(/\D/g, ''), c[1]);
  }
}
console.log(`Sacados carregados em memória: ${sacMap.size}`);

// 3. Carregar Operações em Map
const opMap = new Map();
const opStream = fs.createReadStream(path.join(basePath, 'opconvencional.csv'), { encoding: 'latin1' });
const opRl = readline.createInterface({ input: opStream, crlfDelay: Infinity });

for await (const line of opRl) {
  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  if (c[0] && c[0] !== 'Operação') {
    opMap.set(c[0], {
      dataOp: c[2],
      fator: parseFloat((c[3] || '0').replace(/\./g, '').replace(',', '.')) || 0,
      adValorem: parseFloat((c[4] || '0').replace(/\./g, '').replace(',', '.')) || 0,
      vFator: parseFloat((c[5] || '0').replace(/\./g, '').replace(',', '.')) || 0,
      vLiquido: parseFloat((c[17] || '0').replace(/\./g, '').replace(',', '.')) || 0
    });
  }
}
console.log(`Operações carregadas em memória: ${opMap.size}`);

// 4. Testar amostra de 5 títulos denormalizados
const titStream = fs.createReadStream(path.join(basePath, 'titulos.csv'), { encoding: 'latin1' });
const titRl = readline.createInterface({ input: titStream, crlfDelay: Infinity });

let count = 0;
for await (const line of titRl) {
  count++;
  if (count === 1) continue;
  if (count > 6) break;

  const c = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  const idTitulo = c[0];
  const idOp = c[22];
  const cnpjCed = (c[21] || '').replace(/\D/g, '');
  const cnpjSac = (c[6] || '').replace(/\D/g, '');
  const numDoc = c[9];
  const dtVenc = c[11];
  const dtLiq = c[18];
  const vFace = parseFloat((c[12] || '0').replace(/\./g, '').replace(',', '.')) || 0;
  const vOperado = parseFloat((c[13] || '0').replace(/\./g, '').replace(',', '.')) || 0;
  const vRecebido = parseFloat((c[29] || '0').replace(/\./g, '').replace(',', '.')) || 0;
  const status = c[19];

  const nomeCed = cedMap.get(cnpjCed) || 'Cedente ' + cnpjCed;
  const nomeSac = sacMap.get(cnpjSac) || 'Sacado ' + cnpjSac;
  const op = opMap.get(idOp) || {};

  console.log(`\n--- Título #${idTitulo} (Op: ${idOp}) ---`);
  console.log(`  CLIENTE: ${nomeCed} (${c[21]})`);
  console.log(`  SACADO: ${nomeSac} (${c[6]})`);
  console.log(`  NUMERO: ${numDoc}`);
  console.log(`  EMISSAO (Data Op): ${op.dataOp || c[23]}`);
  console.log(`  VENCIMENTO: ${dtVenc} | DATA LIQUIDAÇÃO: ${dtLiq || 'Em Aberto'}`);
  console.log(`  VALOR NOMINAL (Face): R$ ${vFace.toFixed(2)} | VALOR LIQUIDO: R$ ${vOperado.toFixed(2)} | VALOR PAGO: R$ ${vRecebido.toFixed(2)}`);
  console.log(`  TAXA (Fator): ${op.fator || 0}% | STATUS: ${status}`);
}
