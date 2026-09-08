import puppeteer from 'puppeteer';

const VALOR_EMAIL = process.env.VALOR_EMAIL || 'blrdomingues@gmail.com';
const VALOR_PASSWORD = process.env.VALOR_PASSWORD || 'LeptaCapital1';

async function testLoginThroughHome() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('1. Navegando para valor.globo.com...');
  await page.goto('https://valor.globo.com/', { waitUntil: 'networkidle2' });

  // Find "Entrar" link / button
  const loginBtn = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a, button'));
    const entrar = anchors.find(a => (a.textContent || '').trim().toLowerCase() === 'entrar' || (a.getAttribute('href') || '').includes('login'));
    return entrar ? { text: entrar.textContent?.trim(), href: entrar.getAttribute('href') } : null;
  });
  console.log('Botão Entrar encontrado na home:', loginBtn);

  if (loginBtn?.href) {
    const fullHref = loginBtn.href.startsWith('http') ? loginBtn.href : `https://valor.globo.com${loginBtn.href}`;
    console.log('Navegando para URL de login:', fullHref);
    await page.goto(fullHref, { waitUntil: 'networkidle2' });
    console.log('Página carregada:', page.url());

    // Check inputs on this login page
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('input')).map(i => ({ id: i.id, name: i.name, type: i.type, placeholder: i.placeholder }));
    });
    console.log('Inputs encontrados na tela de login:', inputs);
  }

  await browser.close();
}

testLoginThroughHome();
