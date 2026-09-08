import puppeteer from 'puppeteer';

const VALOR_EMAIL = 'blrdomingues@gmail.com';
const VALOR_PASSWORD = 'LeptaCapital1';

async function testPuppeteerLogin() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    // Remove webdriver flag
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const targetArticle = 'https://valor.globo.com/empresas/noticia/2026/09/02/aab6f56b-movimento-falimentar.ghtml';
    console.log('Navegando para o artigo...');
    await page.goto(targetArticle, { waitUntil: 'networkidle2', timeout: 30000 });

    // Look for "Já é assinante? Entre" or "Entrar" link
    console.log('Procurando link de login na página...');
    const loginUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a, button'));
      for (const el of links) {
        const text = (el.textContent || '').toLowerCase();
        const href = el.getAttribute('href') || '';
        if (text.includes('entre') || text.includes('entrar') || text.includes('faça login') || text.includes('assinante') || href.includes('login.globo.com')) {
          return { text: el.textContent?.trim(), href: el.getAttribute('href') };
        }
      }
      return null;
    });

    console.log('Link de login encontrado:', loginUrl);

    if (loginUrl?.href) {
      const fullUrl = loginUrl.href.startsWith('http') ? loginUrl.href : `https://valor.globo.com${loginUrl.href}`;
      console.log('Acessando página de login:', fullUrl);
      await page.goto(fullUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      console.log('URL da página de login:', page.url());

      // Tirar screenshot para inspecionar
      await page.screenshot({ path: 'scripts/login_screen.png' });
      console.log('Screenshot salva em scripts/login_screen.png');
    }
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await browser.close();
  }
}

testPuppeteerLogin();
