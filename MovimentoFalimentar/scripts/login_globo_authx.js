import puppeteer from 'puppeteer';
import fs from 'node:fs';

async function performAuthXLogin() {
  console.log('Iniciando login no AuthX da Conta Globo...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 768 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

  await page.goto('https://minhaconta.globo.com', { waitUntil: 'networkidle2', timeout: 35000 });
  console.log('Página carregada:', page.url());

  // Passo 1: Digitar Email
  await page.waitForSelector('input[name="email"], input[type="email"]', { timeout: 10000 });
  console.log('1. Digitando e-mail...');
  await page.type('input[name="email"], input[type="email"]', 'blrdomingues@gmail.com', { delay: 60 });
  
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) await submitBtn.click();

  // Passo 2: Digitar Senha
  console.log('2. Aguardando campo de senha...');
  await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 15000 });
  console.log('Digitando senha...');
  await page.type('input[name="password"], input[type="password"]', 'LeptaCapital1', { delay: 60 });

  const submitPass = await page.$('button[type="submit"]');
  if (submitPass) await submitPass.click();

  console.log('3. Aguardando autenticação...');
  await new Promise(r => setTimeout(r, 6000));

  console.log('URL após login:', page.url());

  // Passo 3: Acessar matéria do dia no Valor com a sessão
  const articleUrl = 'https://valor.globo.com/empresas/noticia/2026/09/02/aab6f56b-movimento-falimentar.ghtml';
  console.log('4. Acessando matéria no Valor Econômico com sessão autenticada...');
  await page.goto(articleUrl, { waitUntil: 'networkidle2', timeout: 35000 });

  const result = await page.evaluate(() => {
    const pElements = Array.from(document.querySelectorAll('.content-text__container, .mc-article-body p, article p, p'));
    const paragraphs = pElements.map(p => p.textContent?.trim() || '').filter(t => t.length > 10 && (t.includes('Empresa:') || t.includes('CNPJ:') || t.includes('FALÊNCIAS') || t.includes('RECUPERAÇÃO') || t.includes('PEDIDOS')));
    return {
      title: document.querySelector('h1')?.textContent?.trim(),
      paragraphs
    };
  });

  console.log(`\n✓ Parágrafos com empresas extraídos: ${result.paragraphs.length}`);
  result.paragraphs.forEach((p, idx) => console.log(`[${idx+1}]`, p.slice(0, 90)));

  // Salvar cookies para reutilização headless permanente
  const cookies = await page.cookies();
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/globo_session.json', JSON.stringify(cookies, null, 2));
  console.log(`✓ ${cookies.length} cookies salvos em data/globo_session.json!`);

  await browser.close();
}

performAuthXLogin();
