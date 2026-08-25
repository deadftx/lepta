// Servico de Cotacoes em Tempo Real & Monitor de Falencias (LeptaSys - ESM)
import https from 'https';
import http from 'http';

let cachedTickerData = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 segundos

// Helper para fazer requisições HTTP/HTTPS nativas simples
function fetchJson(url, options = {}) {
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
        'Accept': 'application/json, text/plain, */*',
        ...(options.headers || {})
      },
      timeout: 8000
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 100)}`));
          }
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout'));
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// 1. Buscar Cotacoes via AwesomeAPI e Yahoo Finance API
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
    const awesomeRes = await fetchJson('https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL').catch(() => null);
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

// 2. Buscar Notícias / Publicações de Falências e Recuperações Judiciais do Valor Econômico
async function fetchBankruptcies() {
  const defaultBankruptcies = [
    { empresa: 'Pedidos & Deferimentos do Dia', tipo: 'RJ/Falência', info: 'Nenhum decreto crítico publicado nas últimas horas' }
  ];

  try {
    const query = encodeURIComponent('falência "recuperação judicial"');
    const valorSearchUrl = `https://falkor-cda.brminfra.com/va/search/valor-economico?q=${query}&limit=6`;
    
    const searchRes = await fetchJson(valorSearchUrl).catch(() => null);

    if (searchRes && Array.isArray(searchRes.items) && searchRes.items.length > 0) {
      const parsedCompanies = [];
      
      searchRes.items.forEach(item => {
        const title = item.title || (item.content && item.content.title) || '';
        const summary = item.summary || (item.content && item.content.summary) || '';
        const fullText = `${title} ${summary}`;

        const matchRJ = fullText.match(/(?:recuperação judicial da|falência da|falência do|decreto de falência da|empresa)\s+([A-ZÀ-Ú][a-zA-ZÀ-ú0-9\s&.-]{3,35})/i);
        if (matchRJ && matchRJ[1]) {
          const rawName = matchRJ[1].trim().replace(/\s+(no|na|de|em|para|com|por|que|após|segundo)\s*$/i, '');
          if (rawName.length > 3 && !parsedCompanies.some(c => c.empresa.toLowerCase() === rawName.toLowerCase())) {
            parsedCompanies.push({
              empresa: rawName,
              tipo: fullText.toLowerCase().includes('falência') ? 'Falência' : 'Recuperação Judicial',
              info: title.substring(0, 75) + '...'
            });
          }
        } else if (title) {
          parsedCompanies.push({
            empresa: title.split(/[-–|:]/)[0].trim(),
            tipo: title.toLowerCase().includes('falência') ? 'Falência' : 'Recuperação Judicial',
            info: title
          });
        }
      });

      if (parsedCompanies.length > 0) {
        return parsedCompanies.slice(0, 5);
      }
    }
  } catch (e) {
    console.warn('[Ticker] Erro ao buscar falências do Valor Econômico:', e.message);
  }

  return defaultBankruptcies;
}

// 3. Obter dados consolidados com Cache
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
      bankruptcies,
      updatedAt: new Date().toISOString()
    };
    lastFetchTime = now;
    return cachedTickerData;
  } catch (e) {
    console.error('[Ticker] Erro consolidado:', e);
    if (cachedTickerData) return cachedTickerData;
    return {
      quotes: await fetchMarketQuotes(),
      bankruptcies: [{ empresa: 'Monitor de Falências', tipo: 'Informativo', info: 'Atualizando dados...' }],
      updatedAt: new Date().toISOString()
    };
  }
}
