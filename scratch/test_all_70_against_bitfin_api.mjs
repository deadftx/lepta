import fs from 'fs';
import path from 'path';
import readline from 'readline';

const basePath = path.resolve('SmartFactor/backup_4055_270826');
const token = process.env.UNLTD_API_TOKEN || '';

console.log('=== PENTE FINO: TESTANDO OS 70 CEDENTES DO SMARTFACTOR NA API BITFIN ===\n');

// Carregar os 70 cedentes do SmartFactor
const filePath = path.join(basePath, 'cedentes.csv');
const fileStream = fs.createReadStream(filePath, { encoding: 'latin1' });
const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

const sfCedentes = [];
let lineCount = 0;

for await (const line of rl) {
  lineCount++;
  if (lineCount === 1) continue;
  const cols = line.split(';').map(s => s.trim().replace(/^"|"$/g, ''));
  const cnpj = cols[0];
  const nome = cols[1];
  const setor = cols[10];
  const docClean = (cnpj || '').replace(/\D/g, '');
  if (docClean) {
    sfCedentes.push({ cnpj, nome, setor, docClean });
  }
}

console.log(`Total de cedentes a consultar: ${sfCedentes.length}\n`);

// Consultar API da BitFin
const results = [];

for (let i = 0; i < sfCedentes.length; i++) {
  const sf = sfCedentes[i];
  try {
    const url = `https://lepta-backend.bit-unltd.com.br/entidades/${sf.docClean}`;
    const headers = token ? { 'Authorization': `UNLTD-BackEnd ${token}` } : {};
    
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    
    if (res.ok) {
      const data = await res.json();
      results.push({
        status: 'ENCONTRADO_NA_API_BITFIN',
        sf,
        bitfinNome: data?.nome || data?.razaoSocial || data?.fantasia || 'Nome não informado',
        bitfinData: data
      });
      console.log(`[✓ BITFIN API] Encontrado: ${sf.nome} ➔ ${data?.nome || data?.razaoSocial} (CNPJ: ${sf.cnpj})`);
    } else if (res.status === 404) {
      results.push({
        status: 'NAO_ENCONTRADO',
        sf,
        statusHttp: 404
      });
      console.log(`[✗ 404] Não cadastrado na API: ${sf.nome} (CNPJ: ${sf.cnpj})`);
    } else {
      results.push({
        status: 'ERRO_HTTP',
        sf,
        statusHttp: res.status
      });
      console.log(`[? ${res.status}] Resposta HTTP ${res.status}: ${sf.nome}`);
    }
  } catch (err) {
    results.push({
      status: 'ERRO_REDE',
      sf,
      erro: err.message
    });
    console.log(`[! ERRO] ${sf.nome}: ${err.message}`);
  }
}

console.log('\n==============================================');
console.log('RESUMO FINAL DO PENTE FINO NA API BITFIN:');
const found = results.filter(r => r.status === 'ENCONTRADO_NA_API_BITFIN');
const notFound = results.filter(r => r.status === 'NAO_ENCONTRADO');
const other = results.filter(r => r.status !== 'ENCONTRADO_NA_API_BITFIN' && r.status !== 'NAO_ENCONTRADO');

console.log(`Total Encontrados na API BitFin: ${found.length} de ${sfCedentes.length}`);
console.log(`Total Não Encontrados (404): ${notFound.length}`);
console.log(`Outros/Sem Auth/Timeout: ${other.length}`);
