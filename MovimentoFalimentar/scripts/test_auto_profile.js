import puppeteer from 'puppeteer';
import path from 'node:path';

const PROFILE_DIR = path.resolve('data/puppeteer_profile');
const VALOR_EMAIL = process.env.VALOR_EMAIL || 'blrdomingues@gmail.com';
const VALOR_PASSWORD = process.env.VALOR_PASSWORD || 'LeptaCapital1';

export async function scrapeValorDailyAuto() {
  console.log('--- INICIANDO CRAWLER AUTOMÁTICO DO VALOR ECONÔMICO COM PERFIL PERSISTENTE ---');
  
  const browser = await puppeteer.launch({
    headless: true,
    userDataDir: PROFILE_DIR,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  const targetArticle = 'https://valor.globo.com/empresas/noticia/2026/09/02/aab6f56b-movimento-falimentar.ghtml';
  console.log('1. Acessando matéria do dia no Valor Econômico...');
  await page.goto(targetArticle, { waitUntil: 'networkidle2', timeout: 35000 });

  // Verificar se o usuário já está logado ou se o paywall está presente
  const isSubscriber = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const isPaywallPresent = document.querySelector('.paywall, #paywall, .tp-backdrop, iframe[src*="tinypass"]');
    return !isPaywallPresent;
  });

  console.log('Status de assinante detectado na página:', isSubscriber ? 'LOGADO' : 'NÃO LOGADO / PAYWALL');

  // Se não estiver logado, realizar login automático via Globo ID
  if (!isSubscriber) {
    console.log('2. Iniciando autenticação automática com credenciais...');
    const loginUrl = `https://login.globo.com/login/464?url=${encodeURIComponent(targetArticle)}`;
    await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 35000 });

    console.log('Página de autenticação carregada:', page.url());

    // Verificar se estamos no AuthX ou login padrão da Globo
    const isAuthX = page.url().includes('authx');
    if (isAuthX) {
      console.log('3. Preenchendo login no AuthX (Passo 1: Email)...');
      await page.waitForSelector('input[name="email"], input[type="email"], input[name="login"]', { timeout: 10000 });
      await page.type('input[name="email"], input[type="email"], input[name="login"]', VALOR_EMAIL, { delay: 60 });
      await page.click('button[type="submit"]');

      console.log('4. Aguardando campo de senha (Passo 2)...');
      await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 15000 });
      await page.type('input[name="password"], input[type="password"]', VALOR_PASSWORD, { delay: 60 });
      await page.click('button[type="submit"]');
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    } else {
      // Login clássico da Globo
      const inputLogin = await page.$('#login, input[name="login"]');
      if (inputLogin) {
        await page.type('#login, input[name="login"]', VALOR_EMAIL, { delay: 50 });
        await page.type('#password, input[name="password"]', VALOR_PASSWORD, { delay: 50 });
        await page.click('button[type="submit"], input[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
      }
    }

    console.log('5. Retornando ao artigo com sessão autenticada...');
    await page.goto(targetArticle, { waitUntil: 'networkidle2', timeout: 35000 });
  }

  // Scroll suave para garantir carregamento de todos os parágrafos
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight || totalHeight > 4000) {
          clearInterval(timer);
          resolve(true);
        }
      }, 100);
    });
  });

  await new Promise(r => setTimeout(r, 2000));

  // Extrair todos os parágrafos do texto da matéria
  const data = await page.evaluate(() => {
    const title = document.querySelector('h1.content-head__title, h1')?.textContent?.trim() || '';
    const pubDate = document.querySelector('time[itemprop="datePublished"], time')?.textContent?.trim() || '';
    const pElements = Array.from(document.querySelectorAll('.content-text__container, .mc-article-body p, article p, p'));
    const paragraphs = pElements.map(p => p.textContent?.trim() || '').filter(t => t.length > 10);
    return { title, pubDate, paragraphs };
  });

  console.log(`\n✓ EXTRAÇÃO CONCLUÍDA: ${data.paragraphs.length} parágrafos identificados.`);
  data.paragraphs.forEach((p, i) => console.log(`[${i+1}] ${p.slice(0, 100)}...`));

  await browser.close();
  return data;
}

if (process.argv[1].endsWith('test_auto_profile.js')) {
  scrapeValorDailyAuto();
}
