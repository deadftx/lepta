import puppeteer from 'puppeteer';

const VALOR_EMAIL = 'blrdomingues@gmail.com';
const VALOR_PASSWORD = 'LeptaCapital1';

async function testOpenLoginModal() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Navegando para o Valor Econômico...');
  await page.goto('https://valor.globo.com/', { waitUntil: 'networkidle2' });

  // Listen for popup / new target
  browser.on('targetcreated', async target => {
    console.log('NOVO TARGET/POPUP ABERTO:', target.url());
    if (target.type() === 'page') {
      const popup = await target.page();
      if (popup) {
        console.log('Popup page URL:', popup.url());
        await popup.screenshot({ path: 'scripts/popup.png' });
      }
    }
  });

  // Click Entrar
  console.log('Clicando no elemento Entrar...');
  await page.evaluate(() => {
    const el = document.querySelector('a[href*="login"], button[class*="login"], .barra-item-login, #login');
    if (el) {
      (el).click();
      return true;
    }
    const all = Array.from(document.querySelectorAll('*'));
    const btn = all.find(e => (e.textContent || '').trim().toLowerCase() === 'entrar');
    if (btn) {
      (btn).click();
      return true;
    }
    return false;
  });

  await new Promise(r => setTimeout(r, 5000));

  // Check current URL and frames
  console.log('URL final:', page.url());
  for (const f of page.frames()) {
    if (f.url().includes('login') || f.url().includes('globo')) {
      console.log('Frame Globo encontrado:', f.url());
    }
  }

  await browser.close();
}

testOpenLoginModal();
