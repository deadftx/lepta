import puppeteer from 'puppeteer';
import type { RjItem } from './types.js';
import path from 'node:path';
import fs from 'node:fs';

const GLOBO_SEARCH_API = 'https://busca.globo.com/v1/search';
const PROFILE_DIR = path.resolve('data/puppeteer_profile');

export type ValorArticleInfo = {
  title: string;
  url: string;
  date: string;
  items: RjItem[];
  rawText: string;
};

function detectSectionHeader(rawLine: string): string | null {
  const norm = rawLine
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase().trim();

  // Não é cabeçalho se contiver marcadores de dados, pontuação de frase ou for longo
  if (norm.includes('EMPRESA:') || norm.includes('CNPJ:') || norm.includes('ENDERECO:') || 
      norm.includes('ADMINISTRADOR') || norm.includes('COMARCA:') || 
      norm.includes('OBSERVACAO:') || norm.includes('OBS:') || norm.includes('REQUERENTE:') ||
      norm.includes('DEVEDOR') || norm.includes('PROCESSO Nº') || norm.includes('PROCESSO N.') ||
      norm.includes('DESISTENCIA') || norm.includes('CONFORME') || norm.includes('TERMOS') ||
      norm.length > 70) {
    return null;
  }

  // Subtítulos Oficiais exatos
  if (norm.includes('CONVOLAD') || norm.includes('CONVOLACAO')) {
    return 'RECUPERAÇÃO JUDICIAL CONVOLADA EM FALÊNCIA';
  }
  if (norm.includes('CUMPRIMENTO') && (norm.includes('RECUPERAC') || norm.includes('PLANO'))) {
    return 'CUMPRIMENTO DE RECUPERAÇÃO JUDICIAL';
  }
  if (norm.includes('EXTRAJUDICIAL') || norm.includes('EXTRAJUDICIAIS')) {
    return 'RECUPERAÇÕES EXTRAJUDICIAIS CONCEDIDAS';
  }
  if (norm.includes('PEDIDO') && (norm.includes('RECUPERAC') || norm.includes('RJ'))) {
    return 'PEDIDOS DE RECUPERAÇÃO JUDICIAL';
  }
  if ((norm.includes('PEDIDO') && (norm.includes('FALENC') || norm.includes('AUTOFALENC'))) || norm.includes('FALENCIA REQUERIDA')) {
    return 'PEDIDOS DE FALÊNCIA';
  }
  if (/^(?:[-–•*#\s]*)(?:PROCESSO[S]?\s+DE\s+FALENCIA\s+EXTINTO[S]?|FALENCIA[S]?\s+EXTINTA[S]?)/.test(norm) || (norm.includes('FALENCIA') && (norm.includes('EXTINT') || norm.includes('ELIDID')))) {
    return 'PROCESSOS DE FALÊNCIA EXTINTOS';
  }
  if (/^(?:[-–•*#\s]*)(?:FALENCIA[S]?\s+DECRETADA[S]?|DECRETO\s+DE\s+FALENCIA)/.test(norm) || (norm.includes('FALENCIA') && norm.includes('DECRETAD'))) {
    return 'FALÊNCIAS DECRETADAS';
  }
  if (/^(?:[-–•*#\s]*)(?:RECUPERAC[AO|OES]+\s+JUDICIA[IS]+\s+DEFERIDA[S]?|PROCESSAMENTO\s+DEFERIDO)/.test(norm) ||
      (norm.includes('RECUPERAC') && norm.includes('DEFERID') && !norm.includes('CUMPRIMENTO'))) {
    return 'RECUPERAÇÃO JUDICIAL DEFERIDA';
  }
  if (/^(?:[-–•*#\s]*)(?:RECUPERAC[AO|OES]+\s+JUDICIA[IS]+\s+CONCEDIDA[S]?|RECUPERAC[AO|OES]+\s+CONCEDIDA[S]?|HOMOLOGAC[AO|OES]+\s+DE\s+RECUPERAC)/.test(norm) ||
      (norm.includes('RECUPERAC') && (norm.includes('CONCEDID') || norm.includes('HOMOLOGAD')) && !norm.includes('CUMPRIMENTO'))) {
    return 'RECUPERAÇÃO JUDICIAL CONCEDIDA';
  }
  if (/^(?:[-–•*#\s]*)(?:EDITAI[S]?\s+DE\s+CREDORES|RELAC[AO|OES]+\s+DE\s+CREDORES)/.test(norm) || norm.includes('EDITAL')) {
    return 'EDITAIS DE CREDORES';
  }

  return null;
}

export function parseValorArticleText(text: string, publicationDate?: string, articleUrl?: string): RjItem[] {
  const items: RjItem[] = [];
  let currentClasse = 'FALÊNCIAS DECRETADAS';

  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = cleanText.split('\n');
  let currentBlockLines: string[] = [];

  function isFieldLine(line: string): boolean {
    return /^(?:[-–•*#\s]*)?(?:Empresa|Requerente|Requerida|Devedor[a]?|CNPJ|Endere[çc]o|Administrador[a]?(?:\s+Judicial)?|AJ|Vara(?:\s*[\/\-]\s*Comarca)?|Comarca|Observa[çc][aã]o|Obs):/i.test(line);
  }

  function isVaraUnprefixedLine(line: string): boolean {
    return /^(?:[-–•*#\s]*)?(\d+ª?\s+Vara|Vara\s+|Comarca\s+|Vara\s+Regional|Ju[íi]zo\s+de\s+Direito)/i.test(line);
  }

  function processBlock(lines: string[], classe: string) {
    if (!lines || lines.length === 0) return;
    const blockText = lines.join('\n').trim();
    if (blockText.length < 5) return;

    let empresa: string | null = null;
    let cnpj: string | null = null;
    let endereco: string | null = null;
    let administrador: string | null = null;
    let varaComarca: string | null = null;
    let observacao: string | null = null;

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
      const cM = fullInline.match(/CNPJ:\s*([^–-]+?)(?=\s*Endere[çc]o:|\s*Administrador|\s*Vara|\s*Obs|$)/i) || fullInline.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
      if (cM) cnpj = (cM[1] || cM[0]).trim();
    }
    if (!empresa) {
      const eM = fullInline.match(/(?:Empresa|Requerente|Requerida|Devedora):\s*([^–-]+?)(?=\s*[-–]|\s*CNPJ:|\s*Endere[çc]o:|$)/i);
      if (eM) empresa = eM[1].trim();
      else if (lines[0]) empresa = lines[0].replace(/^[-–•*#\s]+/, '').split(/[-–]|CNPJ:/i)[0].trim();
    }
    if (!endereco) {
      const endM = fullInline.match(/Endere[çc]o:\s*([^–-]+?)(?=\s*Administrador|\s*Vara|\s*Obs|$)/i);
      if (endM) endereco = endM[1].trim();
    }
    if (!administrador) {
      const admM = fullInline.match(/Administrador[a]?(?:\s+Judicial)?:\s*([^–-]+?)(?=\s*Vara|\s*Obs|\s*\d+ª?\s+Vara|$)/i);
      if (admM) administrador = admM[1].trim();
    }
    if (!varaComarca) {
      const varM = fullInline.match(/(?:Vara(?:\s*[\/\-]\s*Comarca)?|Comarca):\s*([^–-]+?)(?=\s*Obs|$)/i) ||
                   fullInline.match(/(\d+ª?\s+Vara\s+[^–-]+?)(?=\s*Obs|\s*Observa[çc][aã]o:|$)/i) ||
                   fullInline.match(/(Vara\s+Regional\s+[^–-]+?)(?=\s*Obs|\s*Observa[çc][aã]o:|$)/i);
      if (varM) varaComarca = varM[1].trim();
    }
    if (!observacao) {
      const obsM = fullInline.match(/(?:Observa[çc][aã]o|Obs):\s*(.*)$/i);
      if (obsM) observacao = obsM[1].trim();
    }

    if (empresa || cnpj) {
      items.push({
        empresa: empresa || 'Empresa Identificada no Valor Econômico',
        cnpj: cnpj || null,
        endereco: endereco || null,
        administradorJudicial: administrador || null,
        varaComarca: varaComarca || 'Publicado no Valor Econômico',
        classe,
        tribunal: 'VALOR',
        tribunalNome: 'Valor Econômico',
        dataAjuizamento: publicationDate || new Date().toISOString(),
        dataCaptura: new Date().toISOString(),
        fonte: 'Valor Econômico (valor.globo.com)',
        processo: `VALOR-${(publicationDate || new Date().toISOString()).slice(0, 10).replace(/[^0-9]/g, '')}-${items.length + 1}`,
        raw: {
          originalText: fullInline,
          articleUrl,
          observacao
        }
      });
    }
  }

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();
    if (!rawLine) {
      if (currentBlockLines.length > 0) {
        processBlock(currentBlockLines, currentClasse);
        currentBlockLines = [];
      }
      continue;
    }

    const detectedHeader = detectSectionHeader(rawLine);
    if (detectedHeader) {
      if (currentBlockLines.length > 0) {
        processBlock(currentBlockLines, currentClasse);
        currentBlockLines = [];
      }
      currentClasse = detectedHeader;
      continue;
    }

    const hasEmpresaPrefix = /^(?:[-–•*#\s]*)?(?:Empresa|Requerente|Requerida|Devedor[a]?):/i.test(rawLine);
    const hasBullet = /^(?:[-–•*#]\s+)/.test(rawLine);
    const nextLine = (i + 1 < rawLines.length) ? rawLines[i + 1].trim() : '';
    const nextIsField = isFieldLine(nextLine) && !/^(?:[-–•*#\s]*)?(?:Empresa|Requerente|Requerida|Devedor[a]?):/i.test(nextLine);

    const blockHasFields = currentBlockLines.some(l => isFieldLine(l) || isVaraUnprefixedLine(l));
    const isNewStart = hasEmpresaPrefix || 
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

export async function fetchValorArticlesList(size = 25): Promise<Array<{ title: string; url: string; date: string }>> {
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
    const data: any = await res.json();
    const hits = data?.[0]?.result?.hits?.hits || [];

    return hits.map((h: any) => {
      const src = h._source || h;
      let directUrl = src.url || '';
      if (directUrl.includes('u=http')) {
        const match = directUrl.match(/u=(https?%3A%2F%2F[^&]+)/);
        if (match) {
          directUrl = decodeURIComponent(match[1]);
        }
      }
      return {
        title: src.title || src.header || 'Movimento falimentar',
        url: directUrl,
        date: src.publicationDate || src.created || new Date().toISOString()
      };
    });
  } catch (e) {
    console.error('✗ Erro ao listar matérias do Valor:', e);
  }
  return [];
}

function getEdgeExecutablePath(): string | undefined {
  const paths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe` : ''
  ];
  return paths.find(p => p && fs.existsSync(p));
}

export async function fetchValorArticleContent(url: string) {
  const sessionPath = path.resolve('data/globo_session.json');
  let savedCookies: any[] = [];
  if (fs.existsSync(sessionPath)) {
    try {
      savedCookies = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    } catch (e) {}
  }

  const edgePath = getEdgeExecutablePath();
  const launchOptions: any = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
  };
  if (edgePath) {
    launchOptions.executablePath = edgePath;
  }

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    if (savedCookies.length > 0) {
      await page.setCookie(...savedCookies);
    }
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 35000 });

    // Scroll para renderizar todas as empresas da matéria sem limite
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight || totalHeight > 10000) {
            clearInterval(timer);
            resolve(true);
          }
        }, 100);
      });
    });

    const data = await page.evaluate(() => {
      const container = document.querySelector('.mc-article-body, .content-text__container, article');
      let pElements = container ? Array.from(container.querySelectorAll('p, h2, h3, li')) : [];
      if (pElements.length === 0) {
        pElements = Array.from(document.querySelectorAll('.mc-article-body p, article p, p, h2, h3'));
      }
      const paragraphs = pElements.map(p => p.textContent?.trim() || '').filter(t => t.length > 2);
      return {
        title: document.querySelector('h1')?.textContent?.trim() || '',
        paragraphs
      };
    });
    return data;
  } finally {
    await browser.close();
  }
}

export async function getValorHoje(): Promise<ValorArticleInfo> {
  const articles = await fetchValorArticlesList(1);
  const allItems: RjItem[] = [];
  let rawText = '';

  let mainTitle = 'Movimento falimentar';
  let mainUrl = 'https://valor.globo.com/busca/?q=movimento%20falimentar';
  let mainDate = new Date().toISOString();

  if (articles.length > 0) {
    mainTitle = articles[0].title;
    mainUrl = articles[0].url;
    mainDate = articles[0].date;

    try {
      // 1. Tentar extração direta com Puppeteer e cookies de assinante
      const content = await fetchValorArticleContent(articles[0].url);
      if (content.paragraphs.length > 1) {
        rawText = content.paragraphs.join('\n\n');
        const parsed = parseValorArticleText(rawText, articles[0].date, articles[0].url);
        allItems.push(...parsed);
      }
    } catch (e: any) {
      console.error(`Erro ao consultar matéria do dia ${articles[0].url}:`, e.message);
    }
  }

  // Se o crawler ao vivo obteve apenas 1 parágrafo por paywall, carregar os dados completos do dia
  if (allItems.length <= 1) {
    const todayJsonPath = path.resolve('data/today_valor.json');
    if (fs.existsSync(todayJsonPath)) {
      try {
        const saved = JSON.parse(fs.readFileSync(todayJsonPath, 'utf8'));
        if (saved && saved.items && saved.items.length > 0) {
          return {
            title: saved.title || mainTitle,
            url: saved.url || mainUrl,
            date: saved.date || mainDate,
            items: saved.items,
            rawText: saved.rawText || ''
          };
        }
      } catch (e) {}
    }
  }

  // Deduplicar empresas por CNPJ ou Nome
  const uniqueItems: RjItem[] = [];
  const seenKeys = new Set<string>();

  for (const item of allItems) {
    const key = (item.cnpj || item.empresa || '').trim().toUpperCase();
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueItems.push(item);
    }
  }

  return {
    title: mainTitle,
    url: mainUrl,
    date: mainDate,
    items: uniqueItems,
    rawText
  };
}
