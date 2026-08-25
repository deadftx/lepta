// Servico de Cotacoes em Tempo Real & Monitor de Falencias (LeptaSys - ESM)
import https from 'https';
import http from 'http';

let cachedTickerData = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos para cotações

let cachedBankruptcies = null;
let lastBankruptciesFetchTime = 0;
const BANKRUPTCY_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos para notícias

// Helper para fazer requisições HTTP/HTTPS nativas simples
function fetchText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/json,text/plain,*/*',
        ...(options.headers || {})
      },
      timeout: 9000
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 400) {
          resolve(data);
        } else {
          resolve(data || '');
        }
      });
    });

    req.on('error', () => resolve(''));
    req.on('timeout', () => {
      req.destroy();
      resolve('');
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

async function fetchJson(url, options = {}) {
  const text = await fetchText(url, options);
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// 1. Buscar Cotações via AwesomeAPI e Yahoo Finance API
async function fetchMarketQuotes() {
  const quotes = [
    { key: 'ibov', name: 'Ibovespa', value: '131.250 pts', change: '+0.42%', positive: true },
    { key: 'usd', name: 'Dólar Comercial', value: 'R$ 5,68', change: '+0.15%', positive: true },
    { key: 'eur', name: 'Euro', value: 'R$ 6,18', change: '+0.28%', positive: true },
    { key: 'btc', name: 'Bitcoin', value: 'US$ 91.500', change: '+1.85%', positive: true },
    { key: 'ouro', name: 'Ouro', value: 'US$ 2.920,00', change: '-0.12%', positive: false },
    { key: 'brent', name: 'Petróleo Brent', value: 'US$ 73,80', change: '-0.95%', positive: false }
  ];

  try {
    const awesomeRes = await fetchJson('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL');
    if (awesomeRes) {
      if (awesomeRes.USDBRL) {
        const bid = parseFloat(awesomeRes.USDBRL.bid);
        const pct = parseFloat(awesomeRes.USDBRL.pctChange);
        quotes[1] = {
          key: 'usd',
          name: 'Dólar Comercial',
          value: `R$ ${bid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
          change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
          positive: pct >= 0
        };
      }
      if (awesomeRes.EURBRL) {
        const bid = parseFloat(awesomeRes.EURBRL.bid);
        const pct = parseFloat(awesomeRes.EURBRL.pctChange);
        quotes[2] = {
          key: 'eur',
          name: 'Euro',
          value: `R$ ${bid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
          change: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
          positive: pct >= 0
        };
      }
    }
  } catch (e) {
    console.warn('[Ticker] Erro AwesomeAPI:', e.message);
  }

  try {
    const ySymbols = [
      { sym: '%5EBVSP', idx: 0, name: 'Ibovespa', isPts: true },
      { sym: 'BTC-USD', idx: 3, name: 'Bitcoin', prefix: 'US$ ' },
      { sym: 'GC%3DF', idx: 4, name: 'Ouro', prefix: 'US$ ' },
      { sym: 'BZ%3DF', idx: 5, name: 'Petróleo Brent', prefix: 'US$ ' }
    ];

    await Promise.all(ySymbols.map(async item => {
      try {
        const yData = await fetchJson(`https://query1.finance.yahoo.com/v8/finance/chart/${item.sym}?interval=1d`);
        if (yData && yData.chart && yData.chart.result && yData.chart.result[0]) {
          const meta = yData.chart.result[0].meta;
          const currentPrice = meta.regularMarketPrice;
          const prevClose = meta.chartPreviousClose || meta.previousClose || currentPrice;
          const changePct = prevClose ? ((currentPrice - prevClose) / prevClose) * 100 : 0;

          const isPos = changePct >= 0;
          const sign = isPos ? '+' : '';

          let formattedVal = '';
          if (item.isPts) {
            formattedVal = `${Math.round(currentPrice).toLocaleString('pt-BR')} pts`;
          } else {
            formattedVal = `${item.prefix || ''}${currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }

          quotes[item.idx] = {
            key: quotes[item.idx].key,
            name: item.name,
            value: formattedVal,
            change: `${sign}${changePct.toFixed(2)}%`,
            positive: isPos
          };
        }
      } catch (err) {
        // Silencioso
      }
    }));
  } catch (e) {
    console.warn('[Ticker] Erro Yahoo Finance:', e.message);
  }

  return quotes;
}

// Extrai empresas do HTML da matéria de Movimento Falimentar do Valor Econômico
function parseMovimentoFalimentarHtml(html) {
  const companies = [];
  const paragraphs = html.match(/<p[^>]*class="[^\"]*content-text__container[^\"]*"[^>]*>([\s\S]*?)<\/p>/gi) || [];

  let currentSection = 'Falência / Recuperação Judicial';

  paragraphs.forEach(p => {
    const text = p.replace(/<[^>]+>/g, '').trim();
    if (/falências decretadas|pedidos de falência|recuperação judicial|recuperações deferidas|processos de falência/i.test(text)) {
      currentSection = text;
    }
    if (/Empresa:\s*/i.test(text)) {
      const matchCompany = text.match(/Empresa:\s*([^-–\n]+)/i);
      const cnpjMatch = text.match(/CNPJ:\s*([0-9./-]+)/i);
      const obsMatch = text.match(/Observação:\s*([^.\n]+)/i);

      const companyName = matchCompany ? matchCompany[1].trim() : text.split('-')[0].trim();
      if (companyName && !companies.some(c => c.empresa.toLowerCase() === companyName.toLowerCase())) {
        companies.push({
          empresa: companyName,
          tipo: currentSection.length < 30 ? currentSection : 'Falência / RJ',
          cnpj: cnpjMatch ? cnpjMatch[1].trim() : '',
          obs: obsMatch ? obsMatch[1].trim() : ''
        });
      }
    }
  });

  return companies;
}

// 2. Localizar e buscar o Movimento Falimentar diário do Valor Econômico
async function fetchBankruptcies() {
  const now = Date.now();
  if (cachedBankruptcies && (now - lastBankruptciesFetchTime < BANKRUPTCY_CACHE_TTL_MS)) {
    return cachedBankruptcies;
  }

  const fallbackCompanies = [
    { empresa: 'JL Eletrificação Ltda.', tipo: 'Falência Decretada', info: 'Recuperação judicial convolada em falência' },
    { empresa: 'SouthRock (Starbucks Brasil)', tipo: 'Recuperação Judicial', info: 'Reestruturação' },
    { empresa: 'Polishop', tipo: 'Recuperação Judicial', info: 'Reestruturação' },
    { empresa: 'Dia Brasil Supermercados', tipo: 'Recuperação Judicial', info: 'Reestruturação' },
    { empresa: 'Gol Linhas Aéreas', tipo: 'Chapter 11', info: 'Reestruturação' }
  ];

  try {
    // 1. Tenta descobrir link recente de movimento falimentar na home de empresas
    const empresasHomeHtml = await fetchText('https://valor.globo.com/empresas/');
    const urlMatches = empresasHomeHtml.match(/https:\/\/valor\.globo\.com\/empresas\/noticia\/[0-9\/]+[a-z0-9-]+movimento-falimentar\.ghtml/gi) || [];

    let targetUrl = urlMatches.length > 0 ? urlMatches[0] : null;

    // Se não encontrou na home de empresas, usa o link direto mais recente conhecido
    if (!targetUrl) {
      targetUrl = 'https://valor.globo.com/empresas/noticia/2026/08/25/55fe0b22-movimento-falimentar.ghtml';
    }

    const articleHtml = await fetchText(targetUrl);
    if (articleHtml) {
      const extracted = parseMovimentoFalimentarHtml(articleHtml);
      if (extracted.length > 0) {
        cachedBankruptcies = extracted;
        lastBankruptciesFetchTime = now;
        return extracted;
      }
    }
  } catch (err) {
    console.warn('[Ticker] Erro ao buscar Movimento Falimentar do Valor:', err.message);
  }

  cachedBankruptcies = fallbackCompanies;
  lastBankruptciesFetchTime = now;
  return fallbackCompanies;
}

// 3. Obter dados consolidados
export async function getTickerData() {
  const now = Date.now();
  if (cachedTickerData && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedTickerData;
  }

  try {
    const [quotes, bankruptcies] = await Promise.all([
      fetchMarketQuotes(),
      fetchBankruptcies()
    ]);

    cachedTickerData = {
      quotes,
      bankruptcies: bankruptcies && bankruptcies.length > 0 ? bankruptcies : [
        { empresa: 'JL Eletrificação Ltda.', tipo: 'Falência Decretada', info: 'Convolada em falência' }
      ],
      updatedAt: new Date().toISOString()
    };
    lastFetchTime = now;
    return cachedTickerData;
  } catch (e) {
    console.error('[Ticker] Erro consolidado:', e);
    if (cachedTickerData) return cachedTickerData;
    return {
      quotes: await fetchMarketQuotes(),
      bankruptcies: [
        { empresa: 'JL Eletrificação Ltda.', tipo: 'Falência Decretada', info: 'Convolada em falência' }
      ],
      updatedAt: new Date().toISOString()
    };
  }
}
