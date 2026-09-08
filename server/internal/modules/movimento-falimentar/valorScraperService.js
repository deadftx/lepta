import fs from 'fs';
import path from 'path';
import { saveItem, getMovimentoDb } from './movimentoDb.js';

const GLOBO_SEARCH_API = 'https://busca.globo.com/v1/search';

export function normalizeValorClass(classe) {
  const c = String(classe || '').toUpperCase();
  if (c.includes('CONVOLA')) return 'RECUPERAÇÃO JUDICIAL CONVOLADA EM FALÊNCIA';
  if (c.includes('CUMPRIMENTO DE RECUPERAÇÃO') || c.includes('CUMPRIMENTO DE RECUPERACAO')) return 'CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL';
  if (c.includes('EXTRAJUDICIAL') || c.includes('EXTRAJUDICIAIS')) return 'RECUPERAÇÕES EXTRAJUDICIAIS CONCEDIDAS';
  if (c.includes('DEFERIDA') || c.includes('DEFERIMENTO') || c.includes('PROCESSAMENTO')) return 'RECUPERAÇÃO JUDICIAL DEFERIDA';
  if (c.includes('CONCEDIDA') || c.includes('HOMOLOGADA') || c.includes('CONCESSÃO') || c.includes('HOMOLOGAÇÃO')) return 'RECUPERAÇÃO JUDICIAL CONCEDIDA';
  if (c.includes('PEDIDO DE RECUPERAÇÃO') || c.includes('PEDIDO DE RJ')) return 'PEDIDOS DE RECUPERAÇÃO JUDICIAL';
  if (c.includes('FALÊNCIA DECRETADA') || c.includes('FALENCIA DECRETADA') || c.includes('DECRETO') || c.includes('FALÊNCIAS DECRETADAS') || c.includes('FALENCIAS DECRETADAS')) return 'FALÊNCIAS DECRETADAS';
  if (c.includes('PEDIDO DE FALÊNCIA') || c.includes('PEDIDO DE FALENCIA') || c.includes('FALÊNCIA REQUERIDA') || c.includes('FALENCIA REQUERIDA') || c.includes('AUTOFALÊNCIA')) return 'PEDIDOS DE FALÊNCIA';
  if (c.includes('EXTINT') || c.includes('ELIDID') || c.includes('INDEFERID')) return 'PROCESSOS DE FALÊNCIA EXTINTOS';
  if (c.includes('EDITAL') || c.includes('CREDORES') || c.includes('HABILITA')) return 'EDITAIS DE CREDORES';
  return 'FALÊNCIAS DECRETADAS';
}

export function detectSectionHeader(rawLine) {
  const norm = rawLine
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().trim();

  if (norm.includes('EMPRESA:') || norm.includes('CNPJ:') || norm.includes('ENDERECO:') ||
    norm.includes('ADMINISTRADOR') || norm.includes('COMARCA:') ||
    norm.includes('OBSERVACAO:') || norm.includes('OBS:') || norm.includes('REQUERENTE:') ||
    norm.includes('DEVEDOR') || norm.includes('PROCESSO Nº') || norm.includes('PROCESSO N.') ||
    norm.includes('DESISTENCIA') || norm.includes('CONFORME') || norm.includes('TERMOS') ||
    norm.length > 70) {
    return null;
  }

  if (norm.includes('CONVOLAD') || norm.includes('CONVOLACAO')) return 'RECUPERAÇÃO JUDICIAL CONVOLADA EM FALÊNCIA';
  if (norm.includes('CUMPRIMENTO') && (norm.includes('RECUPERAC') || norm.includes('PLANO'))) return 'CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL';
  if (norm.includes('EXTRAJUDICIAL') || norm.includes('EXTRAJUDICIAIS')) return 'RECUPERAÇÕES EXTRAJUDICIAIS CONCEDIDAS';
  if (norm.includes('PEDIDO') && (norm.includes('RECUPERAC') || norm.includes('RJ'))) return 'PEDIDOS DE RECUPERAÇÃO JUDICIAL';
  if ((norm.includes('PEDIDO') && (norm.includes('FALENC') || norm.includes('AUTOFALENC'))) || norm.includes('FALENCIA REQUERIDA')) return 'PEDIDOS DE FALÊNCIA';
  if (/^(?:[-–•*#\s]*)(?:PROCESSO[S]?\s+DE\s+FALENCIA\s+EXTINTO[S]?|FALENCIA[S]?\s+EXTINTA[S]?)/.test(norm) || (norm.includes('FALENCIA') && (norm.includes('EXTINT') || norm.includes('ELIDID')))) return 'PROCESSOS DE FALÊNCIA EXTINTOS';
  if (/^(?:[-–•*#\s]*)(?:FALENCIA[S]?\s+DECRETADA[S]?|DECRETO\s+DE\s+FALENCIA)/.test(norm) || (norm.includes('FALENCIA') && norm.includes('DECRETAD'))) return 'FALÊNCIAS DECRETADAS';
  if (/^(?:[-–•*#\s]*)(?:RECUPERAC[AO|OES]+\s+JUDICIA[IS]+\s+DEFERIDA[S]?|PROCESSAMENTO\s+DEFERIDO)/.test(norm) || (norm.includes('RECUPERAC') && norm.includes('DEFERID') && !norm.includes('CUMPRIMENTO'))) return 'RECUPERAÇÃO JUDICIAL DEFERIDA';
  if (/^(?:[-–•*#\s]*)(?:RECUPERAC[AO|OES]+\s+JUDICIA[IS]+\s+CONCEDIDA[S]?|RECUPERAC[AO|OES]+\s+CONCEDIDA[S]?|HOMOLOGAC[AO|OES]+\s+DE\s+RECUPERAC)/.test(norm) || (norm.includes('RECUPERAC') && (norm.includes('CONCEDID') || norm.includes('HOMOLOGAD')) && !norm.includes('CUMPRIMENTO'))) return 'RECUPERAÇÃO JUDICIAL CONCEDIDA';
  if (/^(?:[-–•*#\s]*)(?:EDITAI[S]?\s+DE\s+CREDORES|RELAC[AO|OES]+\s+DE\s+CREDORES)/.test(norm) || norm.includes('EDITAL')) return 'EDITAIS DE CREDORES';
  return null;
}

export function parseValorArticleText(text, publicationDate, articleUrl) {
  const items = [];
  let currentClasse = 'FALÊNCIAS DECRETADAS';
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = cleanText.split('\n');
  let currentBlockLines = [];

  function isFieldLine(line) {
    return /^(?:[-–•*#\s]*)?(?:Empresa|Requerente|Requerida|Devedor[a]?|CNPJ|Endere[çc]o|Administrador[a]?(?:\s+Judicial)?|AJ|Vara(?:\s*[\/\-]\s*Comarca)?|Comarca|Observa[çc][aã]o|Obs):/i.test(line);
  }

  function isVaraUnprefixedLine(line) {
    return /^(?:[-–•*#\s]*)?(\d+ª?\s+Vara|Vara\s+|Comarca\s+|Vara\s+Regional|Ju[íi]zo\s+de\s+Direito)/i.test(line);
  }

  function processBlock(lines, classe) {
    if (!lines || lines.length === 0) return;
    const blockText = lines.join('\n').trim();
    if (blockText.length < 5) return;

    let empresa = null;
    let cnpj = null;
    let endereco = null;
    let administrador = null;
    let varaComarca = null;
    let observacao = null;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (!l) continue;

      if (/^(?:[-–•*#\s]*)?(?:Empresa|Requerente|Requerida|Devedor[a]?):\s*(.*)$/i.test(l)) {
        const m = l.match(/^(?:[-–•*#\s]*)?(?:Empresa|Requerente|Requerida|Devedor[a]?):\s*(.*)$/i);
        if (m && m[1]) empresa = m[1].replace(/[-–\s]*CNPJ:.*$/i, '').trim();
      } else if (/^(?:[-–•*#\s]*)?CNPJ:\s*(.*)$/i.test(l)) {
        const m = l.match(/^(?:[-–•*#\s]*)?CNPJ:\s*(.*)$/i);
        if (m && m[1]) cnpj = m[1].trim();
      } else if (/^(?:[-–•*#\s]*)?Endere[çc]o:\s*(.*)$/i.test(l)) {
        const m = l.match(/^(?:[-–•*#\s]*)?Endere[çc]o:\s*(.*)$/i);
        if (m && m[1]) endereco = m[1].trim();
      } else if (/^(?:[-–•*#\s]*)?(?:Administrador[a]?(?:\s+Judicial)?|AJ):\s*(.*)$/i.test(l)) {
        const m = l.match(/^(?:[-–•*#\s]*)?(?:Administrador[a]?(?:\s+Judicial)?|AJ):\s*(.*)$/i);
        if (m && m[1]) administrador = m[1].trim();
      } else if (/^(?:[-–•*#\s]*)?(?:Vara(?:\s*[\/\-]\s*Comarca)?|Comarca):\s*(.*)$/i.test(l)) {
        const m = l.match(/^(?:[-–•*#\s]*)?(?:Vara(?:\s*[\/\-]\s*Comarca)?|Comarca):\s*(.*)$/i);
        if (m && m[1]) varaComarca = m[1].trim();
      } else if (isVaraUnprefixedLine(l)) {
        varaComarca = l.replace(/^[-–•*#\s]+/, '').trim();
      } else if (/^(?:[-–•*#\s]*)?(?:Observa[çc][aã]o|Obs):\s*(.*)$/i.test(l)) {
        const m = l.match(/^(?:[-–•*#\s]*)?(?:Observa[çc][aã]o|Obs):\s*(.*)$/i);
        if (m && m[1]) observacao = m[1].trim();
      } else if (!empresa && i === 0 && !isFieldLine(l)) {
        empresa = l.replace(/^[-–•*#\s]+/, '').split(/[-–]|CNPJ:/i)[0].trim();
      }
    }

    const fullInline = lines.join(' ').replace(/\s+/g, ' ').trim();
    if (!cnpj) {
      const cnpjMatch = fullInline.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/);
      if (cnpjMatch) cnpj = cnpjMatch[1];
    }
    if (!empresa) {
      const nameMatch = fullInline.match(/^(?:[-–•*#\s]*)?(?:Empresa|Requerente|Requerida|Devedor[a]?)?\s*([A-Z0-9\s\.\,\-\/\&]{4,60}?)(?:[-–]|CNPJ:|Endere[çc]o:|\d{2}\.\d{3}\.\d{3})/i);
      if (nameMatch && nameMatch[1]) empresa = nameMatch[1].trim();
    }

    if (empresa || cnpj) {
      const cleanEmpresa = empresa ? empresa.replace(/^[-–•*#\s]+/, '').trim() : (cnpj ? `Empresa ${cnpj}` : 'Empresa não identificada');
      items.push({
        empresa: cleanEmpresa,
        cnpj: cnpj || 'Não informado',
        endereco: endereco || '',
        administradorJudicial: administrador || '',
        varaComarca: varaComarca || '',
        classe: normalizeValorClass(classe),
        tribunal: 'VALOR',
        tribunalNome: 'Valor Econômico',
        dataAjuizamento: publicationDate || new Date().toISOString(),
        dataCaptura: new Date().toISOString(),
        fonte: 'Valor Econômico (valor.globo.com)',
        processo: `VALOR-${(publicationDate || new Date().toISOString()).slice(0, 10).replace(/-/g, '')}-${items.length + 1}`,
        raw: {
          originalText: blockText,
          articleUrl,
          observacao
        }
      });
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();
    if (!rawLine) continue;

    const detectedHeader = detectSectionHeader(rawLine);
    if (detectedHeader) {
      if (currentBlockLines.length > 0) {
        processBlock(currentBlockLines, currentClasse);
        currentBlockLines = [];
      }
      currentClasse = detectedHeader;
      continue;
    }

    const hasBullet = /^[-–•*#]/.test(rawLine);
    const startsWithCompanyPrefix = /^(?:Empresa|Requerente|Requerida|Devedor[a]?):/i.test(rawLine);
    const nextLine = i + 1 < rawLines.length ? rawLines[i + 1].trim() : '';
    const nextIsField = isFieldLine(nextLine);
    const blockHasFields = currentBlockLines.some(isFieldLine);

    const isNewStart = startsWithCompanyPrefix ||
      (hasBullet && (rawLine.includes('Ltda') || rawLine.includes('S.A.') || rawLine.includes('S/A') || rawLine.includes('Eireli') || nextIsField)) ||
      (nextIsField && !isFieldLine(rawLine) && !isVaraUnprefixedLine(rawLine)) ||
      (blockHasFields && !isFieldLine(rawLine) && !isVaraUnprefixedLine(rawLine));

    if (isNewStart && currentBlockLines.length > 0) {
      processBlock(currentBlockLines, currentClasse);
      currentBlockLines = [rawLine];
    } else {
      currentBlockLines.push(rawLine);
    }
  }

  if (currentBlockLines.length > 0) {
    processBlock(currentBlockLines, currentClasse);
  }

  return items;
}

export async function fetchValorArticlesList(size = 25) {
  try {
    const payload = [
      {
        search_profile: 'sp_valor_globo_com',
        query: 'valor.info_query_recency',
        params: {
          q: 'movimento falimentar',
          from: 0,
          size
        }
      }
    ];

    const res = await fetch(GLOBO_SEARCH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': 'valor',
        'X-Must-Thumborize': 'true',
        'X-Track-Urls': 'true',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Origin: 'https://valor.globo.com',
        Referer: 'https://valor.globo.com/'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return [];
    const data = await res.json();
    const hits = data?.[0]?.result?.hits?.hits || [];
    return hits.map((h) => {
      const src = h._source || h;
      let directUrl = src.url || '';
      if (directUrl.includes('u=http')) {
        const match = directUrl.match(/u=(https?%3A%2F%2F[^&]+)/);
        if (match) directUrl = decodeURIComponent(match[1]);
      }
      return {
        title: src.title || src.header || 'Movimento falimentar',
        url: directUrl,
        date: src.publicationDate || src.created || new Date().toISOString()
      };
    });
  } catch (e) {
    console.warn('[VALOR] Falha ao consultar API de matérias do Valor:', e.message);
  }
  return [];
}

let cachedValorHoje = null;
let lastValorScan = 0;

export async function getValorHoje(projectRoot) {
  if (cachedValorHoje && cachedValorHoje.items?.length > 0 && Date.now() - lastValorScan < 1000 * 60 * 15) {
    return cachedValorHoje;
  }

  // 1. Tenta ler arquivo local em MovimentoFalimentar/data/today_valor.json
  const candidateTodayPaths = [
    path.resolve(projectRoot, 'MovimentoFalimentar/data/today_valor.json'),
    path.resolve(process.cwd(), 'MovimentoFalimentar/data/today_valor.json'),
    path.resolve('MovimentoFalimentar/data/today_valor.json')
  ];

  const todayPath = candidateTodayPaths.find(p => fs.existsSync(p));
  if (todayPath) {
    try {
      const raw = fs.readFileSync(todayPath, 'utf8');
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        cachedValorHoje = {
          ...data,
          items: data.items.map(i => ({ ...i, classe: normalizeValorClass(i.classe) }))
        };
        lastValorScan = Date.now();
        return cachedValorHoje;
      }
    } catch {}
  }

  // 2. Se não houver arquivo ou estiver vazio, busca matérias recentes
  const articles = await fetchValorArticlesList(5);
  const latest = articles[0] || null;

  return cachedValorHoje || {
    title: latest?.title || 'Movimento falimentar',
    url: latest?.url || 'https://valor.globo.com/busca/?q=movimento%20falimentar',
    date: latest?.date || new Date().toISOString(),
    items: [],
    rawText: ''
  };
}

export function importValorText(text, date, projectRoot) {
  const publicationDate = date || new Date().toISOString();
  const items = parseValorArticleText(text, publicationDate).map(i => ({
    ...i,
    classe: normalizeValorClass(i.classe)
  }));

  const db = getMovimentoDb(projectRoot);
  for (const item of items) {
    saveItem(db, item);
  }

  cachedValorHoje = {
    title: 'Movimento falimentar',
    url: 'https://valor.globo.com/busca/?q=movimento%20falimentar',
    date: publicationDate,
    items,
    rawText: text
  };
  lastValorScan = Date.now();

  const candidateTodayPaths = [
    path.resolve(projectRoot, 'MovimentoFalimentar/data/today_valor.json'),
    path.resolve(process.cwd(), 'MovimentoFalimentar/data/today_valor.json')
  ];
  try {
    fs.writeFileSync(candidateTodayPaths[0], JSON.stringify(cachedValorHoje, null, 2), 'utf8');
  } catch {}

  return {
    success: true,
    count: items.length,
    items
  };
}
