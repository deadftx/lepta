import fs from 'fs';
import path from 'path';
import readline from 'readline';

const basePath = path.resolve('SmartFactor/backup_4055_270826');

console.log('=== PENTE FINO VIA API DE HOMOLOGAÇÃO / BITFIN (https://lepta.com.br) ===\n');

// 1. Carregar os 70 cedentes do SmartFactor
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
  const cnpjRaiz = docClean.substring(0, 8);
  if (cnpj || nome) {
    sfCedentes.push({ cnpj, nome, setor, docClean, cnpjRaiz });
  }
}

console.log(`Carregados ${sfCedentes.length} cedentes do SmartFactor.`);

// 2. Consultar /api/analise-clientes em https://lepta.com.br (que puxa tudo da API UNLTD/Bitfin em tempo real)
try {
  console.log('Buscando base de clientes ativos da API BitFin via https://lepta.com.br/api/analise-clientes...');
  const res = await fetch('https://lepta.com.br/api/analise-clientes', {
    headers: { 'Cache-Control': 'no-cache' }
  });
  
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const clients = await res.json();
  console.log(`Retornados ${clients.length} cedentes/clientes da API BitFin.`);

  const matched = [];
  const unmatched = [];

  for (const sf of sfCedentes) {
    const found = clients.find(c => {
      const cDoc = (c.documento || c.cnpj || '').replace(/\D/g, '');
      const cRaiz = cDoc.substring(0, 8);
      const cNome = (c.cedente || c.nome || '').toLowerCase();
      const sfNomeNorm = sf.nome.toLowerCase();

      if (sf.docClean && cDoc && sf.docClean === cDoc) return true;
      if (sf.cnpjRaiz && cRaiz && sf.cnpjRaiz === cRaiz) return true;
      if (cNome.includes('maranata') && sfNomeNorm.includes('maranata')) return true;
      if (sfNomeNorm.length >= 5 && cNome.includes(sfNomeNorm.substring(0, 8))) return true;
      return false;
    });

    if (found) {
      matched.push({ sf, found });
    } else {
      unmatched.push(sf);
    }
  }

  console.log(`\n==============================================`);
  console.log(`✓ ENCONTRADOS NA API BITFIN EM TEMPO REAL: ${matched.length} (${((matched.length / sfCedentes.length) * 100).toFixed(1)}%)`);
  console.log(`✗ NÃO ENCONTRADOS: ${unmatched.length}`);
  console.log(`==============================================\n`);

  matched.forEach((m, idx) => {
    console.log(`[${idx + 1}] SF: ${m.sf.nome} (${m.sf.cnpj})`);
    console.log(`     ➔ BITFIN: ${m.found.cedente} (Doc: ${m.found.documento || m.found.cnpj || '---'}) | Valor Geral: R$ ${(m.found.valorGeral || 0).toLocaleString('pt-BR')}\n`);
  });

  if (unmatched.length > 0) {
    console.log(`--- AINDA NÃO ENCONTRADOS (${unmatched.length}) ---`);
    unmatched.forEach((u, idx) => {
      console.log(`[${idx + 1}] ${u.nome} (CNPJ: ${u.cnpj})`);
    });
  }
} catch (err) {
  console.error('Erro ao consultar API:', err.message);
}
