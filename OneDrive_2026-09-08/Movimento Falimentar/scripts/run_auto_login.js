import puppeteer from 'puppeteer';
import fs from 'node:fs';

async function autoLoginAndSaveSession() {
  console.log('Iniciando Puppeteer para login automático na Globo...');
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  const articleUrl = 'https://valor.globo.com/empresas/noticia/2026/09/02/aab6f56b-movimento-falimentar.ghtml';
  const loginUrl = 'https://login.globo.com/login/464?url=' + encodeURIComponent(articleUrl);

  console.log('1. Acessando login da Globo...');
  await page.goto(loginUrl, { waitUntil: 'networkidle2', timeout: 35000 });

  console.log('Página de login:', page.url());

  try {
    const emailSelector = 'input[name="email"], input[type="email"], #login';
    await page.waitForSelector(emailSelector, { timeout: 8000 });
    console.log('Preenchendo email...');
    await page.type(emailSelector, 'blrdomingues@gmail.com', { delay: 40 });
    
    const submitBtn = await page.$('button[type="submit"], input[type="submit"]');
    if (submitBtn) await submitBtn.click();
    await new Promise(r => setTimeout(r, 2500));

    const passSelector = 'input[name="password"], input[type="password"], #password';
    await page.waitForSelector(passSelector, { timeout: 10000 });
    console.log('Preenchendo senha...');
    await page.type(passSelector, 'LeptaCapital1', { delay: 40 });

    const submitPass = await page.$('button[type="submit"], input[type="submit"]');
    if (submitPass) await submitPass.click();
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 20000 }).catch(() => {});
  } catch(e) {
    console.log('Etapa de login:', e.message);
  }

  console.log('2. Acessando artigo do Valor com cookies...');
  await page.goto(articleUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  const data = await page.evaluate(() => {
    const pElements = Array.from(document.querySelectorAll('.content-text__container, .mc-article-body p, article p, p'));
    const paragraphs = pElements.map(p => p.textContent.trim()).filter(t => t.length > 10);
    return { title: document.querySelector('h1')?.textContent?.trim(), paragraphs };
  });

  console.log('Parágrafos encontrados:', data.paragraphs.length);
  const cookies = await page.cookies();
  if (cookies.length > 0) {
    fs.mkdirSync('data', { recursive: true });
    fs.writeFileSync('data/globo_session.json', JSON.stringify(cookies, null, 2));
    console.log('Cookies salvos:', cookies.length);
  }

  await browser.close();
}

autoLoginAndSaveSession();
