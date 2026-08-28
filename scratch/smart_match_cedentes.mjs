import fs from 'fs';
import path from 'path';
import readline from 'readline';
import Database from 'better-sqlite3';
import stringSimilarity from 'string-similarity';

const basePath = path.resolve('SmartFactor/backup_4055_270826');
const dbPath = path.resolve('database.sqlite');
const db = new Database(dbPath);

console.log('=== BUSCA INTELIGENTE E CRUZAMENTO AVANÇADO (SMARTFACTOR vs BITFIN/LEPTA) ===\n');

// 1. Carregar todas as fontes da BitFin / Lepta disponíveis no banco
const bitfinSources = [];

// Tabela CEDENTES
try {
  const rows = db.prepare('SELECT * FROM CEDENTES').all();
  rows.forEach(r => {
    bitfinSources.push({
      fonte: 'CEDENTES',
      nome: r.nome || '',
      documento: r.documento || '',
      cnpj_raiz: r.cnpj_raiz || (r.documento ? r.documento.replace(/\D/g, '').substring(0, 8) : ''),
      raw: r
    });
  });
} catch (e) {}

// Tabela CEDENTES_CNPJS
try {
  const rows = db.prepare('SELECT * FROM CEDENTES_CNPJS').all();
  rows.forEach(r => {
    bitfinSources.push({
      fonte: 'CEDENTES_CNPJS',
      nome: r.nome || r.razao_social || '',
      documento: r.cnpj || r.documento || '',
      cnpj_raiz: (r.cnpj || '').replace(/\D/g, '').substring(0, 8),
      raw: r
    });
  });
} catch (e) {}

// Tabela FIDC_CEDENTES
try {
  const rows = db.prepare('SELECT * FROM FIDC_CEDENTES').all();
  rows.forEach(r => {
    bitfinSources.push({
      fonte: 'FIDC_CEDENTES',
      nome: r.nome || r.cedente || '',
      documento: r.cnpj || r.documento || '',
      cnpj_raiz: (r.cnpj || '').replace(/\D/g, '').substring(0, 8),
      raw: r
    });
  });
} catch (e) {}

// Tabela BASE_NPL
try {
  const rows = db.prepare('SELECT DISTINCT cedente, cedente_cnpj FROM BASE_NPL WHERE cedente IS NOT NULL').all();
  rows.forEach(r => {
    bitfinSources.push({
      fonte: 'BASE_NPL',
      nome: r.cedente || '',
      documento: r.cedente_cnpj || '',
      cnpj_raiz: (r.cedente_cnpj || '').replace(/\D/g, '').substring(0, 8),
      raw: r
    });
  });
} catch (e) {}

console.log(`Total de registros de cedentes catalogados no BitFin/Lepta: ${bitfinSources.length}`);

// 2. Carregar Cedentes do SmartFactor
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
  const grupo = cols[12];
  const dataCad = cols[9];
  const docClean = (cnpj || '').replace(/\D/g, '');
  const cnpjRaiz = docClean.substring(0, 8);

  if (cnpj || nome) {
    sfCedentes.push({ cnpj, nome, setor, grupo, dataCad, docClean, cnpjRaiz });
  }
}

console.log(`Total de Cedentes no SmartFactor: ${sfCedentes.length}\n`);

// 3. Algoritmo de Busca Inteligente Multi-Critério
function normalizeText(txt) {
  if (!txt) return '';
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .replace(/\b(ltda|eireli|s\/a|sa|me|epp|unipessoal|brasil|comercio|industria|servicos|distribuidora|de|e|do|da|em|recuperacao|judicial)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractKeywords(txt) {
  const norm = normalizeText(txt);
  return norm.split(' ').filter(w => w.length >= 3);
}

const matchedResults = [];
const unmatchedResults = [];

for (const sf of sfCedentes) {
  let bestMatch = null;
  let matchType = null;
  let matchScore = 0;

  const sfNorm = normalizeText(sf.nome);
  const sfKeywords = extractKeywords(sf.nome);

  for (const bf of bitfinSources) {
    const bfDocClean = (bf.documento || '').replace(/\D/g, '');
    const bfCnpjRaiz = bf.cnpj_raiz || bfDocClean.substring(0, 8);
    const bfNorm = normalizeText(bf.nome);
    const bfKeywords = extractKeywords(bf.nome);

    // 1. Match exato de CNPJ completo (14 dígitos)
    if (sf.docClean && bfDocClean && sf.docClean === bfDocClean && sf.docClean.length >= 11) {
      bestMatch = bf;
      matchType = 'CNPJ Exato (14 dígitos)';
      matchScore = 1.0;
      break;
    }

    // 2. Match de CNPJ Raiz (8 primeiros dígitos)
    if (sf.cnpjRaiz && bfCnpjRaiz && sf.cnpjRaiz === bfCnpjRaiz && sf.cnpjRaiz.length === 8) {
      bestMatch = bf;
      matchType = 'CNPJ Raiz (Matriz/Filial)';
      matchScore = 0.95;
      break;
    }

    // 3. Match de Palavra-chave principal (ex: AUSUS, ALMAX, BRAZILIAN GLOBAL)
    if (sfKeywords.length > 0 && bfKeywords.length > 0) {
      // Primeira palavra chave relevante exclusiva (ex: "ausus", "almax", "brazilian")
      const primaryKey = sfKeywords[0];
      if (primaryKey.length >= 4 && bfKeywords.includes(primaryKey)) {
        const commonWords = sfKeywords.filter(w => bfKeywords.includes(w));
        const keyScore = commonWords.length / Math.min(sfKeywords.length, bfKeywords.length);
        if (keyScore >= 0.5 && keyScore > matchScore) {
          matchScore = keyScore;
          bestMatch = bf;
          matchType = `Palavra-chave (${commonWords.join('+')})`;
        }
      }
    }

    // 4. Match de Similaridade Textual (Dice / Levenshtein)
    if (sfNorm && bfNorm) {
      const sim = stringSimilarity.compareTwoStrings(sfNorm, bfNorm);
      if (sim >= 0.65 && sim > matchScore) {
        matchScore = sim;
        bestMatch = bf;
        matchType = `Similaridade Fonética/Texto (${(sim * 100).toFixed(0)}%)`;
      }
    }
  }

  if (bestMatch && matchScore >= 0.5) {
    matchedResults.push({ sf, match: bestMatch, matchType, matchScore });
  } else {
    unmatchedResults.push(sf);
  }
}

console.log(`==============================================`);
console.log(`RESULTADO DO CRUZAMENTO INTELIGENTE:`);
console.log(`✓ Cedentes ENCONTRADOS no BitFin/Lepta: ${matchedResults.length} (${((matchedResults.length / sfCedentes.length) * 100).toFixed(1)}%)`);
console.log(`✗ Cedentes NÃO ENCONTRADOS: ${unmatchedResults.length} (${((unmatchedResults.length / sfCedentes.length) * 100).toFixed(1)}%)`);
console.log(`==============================================\n`);

console.log(`--- CEDENTES ENCONTRADOS (LISTA COMPLETA) ---`);
matchedResults.forEach((res, i) => {
  console.log(`[${i + 1}] SMARTFACTOR: ${res.sf.nome} (CNPJ: ${res.sf.cnpj})`);
  console.log(`    ➔ BITFIN/LEPTA: ${res.match.nome} (CNPJ/Doc: ${res.match.documento || '---'} | Fonte: ${res.match.fonte})`);
  console.log(`    ➔ Tipo de Vínculo: ${res.matchType} | Score: ${(res.matchScore * 100).toFixed(0)}%\n`);
});

if (unmatchedResults.length > 0) {
  console.log(`--- CEDENTES REALMENTE INÉDITOS / NÃO ENCONTRADOS (${unmatchedResults.length}) ---`);
  unmatchedResults.forEach((sf, i) => {
    console.log(`[${i + 1}] CNPJ: ${sf.cnpj} | Nome: ${sf.nome} | Setor: ${sf.setor || '---'} | Data Cad: ${sf.dataCad}`);
  });
}
