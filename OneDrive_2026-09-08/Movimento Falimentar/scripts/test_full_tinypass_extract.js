import puppeteer from 'puppeteer';

const VALOR_EMAIL = 'blrdomingues@gmail.com';
const VALOR_PASSWORD = 'LeptaCapital1';

async function fullLoginAndExtract() {
  console.log('Iniciando Puppeteer...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const targetArticle = 'https://valor.globo.com/empresas/noticia/2026/09/02/aab6f56b-movimento-falimentar.ghtml';
  console.log('1. Navegando para o artigo:', targetArticle);
  await page.goto(targetArticle, { waitUntil: 'networkidle2' });

  // Listen for login popup window
  let popupPage = null;
  browser.on('targetcreated', async target => {
    if (target.type() === 'page') {
      const p = await target.page();
      if (p) {
        console.log('✓ Popup de login detectado:', p.url());
        popupPage = p;
      }
    }
  });

  // Find tinypass frame and click #button-login
  const frames = page.frames();
  const tpFrame = frames.find(f => f.url().includes('tinypass.com'));
  if (tpFrame) {
    console.log('2. Clicando em #button-login no Tinypass...');
    await tpFrame.click('#button-login, .btn-login, a');
  }

  // Wait 4 seconds for popup or navigation
  await new Promise(r => setTimeout(r, 4000));

  // If popup opened, fill credentials
  const authPage = popupPage || page;
  console.log('3. Página de autenticação ativa:', authPage.url());

  // Wait for login inputs in authPage
  try {
    await authPage.waitForSelector('input[type="email"], input[name="login"], #login, input[type="text"]', { timeout: 8000 });
    console.log('4. Inserindo email...');
    await authPage.type('input[type="email"], input[name="login"], #login, input[type="text"]', VALOR_EMAIL, { delay: 30 });
    
    console.log('5. Inserindo senha...');
    await authPage.type('input[type="password"], input[name="password"], #password', VALOR_PASSWORD, { delay: 30 });

    console.log('6. Clicando em Entrar...');
    await authPage.click('button[type="submit"], input[type="submit"], button.button');
    
    await new Promise(r => setTimeout(r, 6000));
  } catch (e) {
    console.log('Nota ao preencher login:', e.message);
  }

  // Back on the main page, reload or scroll down
  console.log('7. Recarregando artigo com cookies da sessão...');
  await page.goto(targetArticle, { waitUntil: 'networkidle2' });
  await page.evaluate(() => window.scrollBy(0, 1500));
  await new Promise(r => setTimeout(r, 3000));

  // Extract all paragraphs
  const articleData = await page.evaluate(() => {
    const title = document.querySelector('h1')?.textContent?.trim() || '';
    const date = document.querySelector('time')?.textContent?.trim() || '';
    const pNodes = Array.from(document.querySelectorAll('.content-text__container, .mc-article-body p, article p, p'));
    const paragraphs = pNodes.map(p => p.textContent?.trim() || '').filter(t => t.length > 5);
    return { title, date, paragraphs };
  });

  console.log('\n--- RESULTADO FINAL DA EXTRAÇÃO ---');
  console.log('Título:', articleData.title);
  console.log('Data:', articleData.date);
  console.log(`Total de parágrafos extraídos: ${articleData.paragraphs.length}`);
  articleData.paragraphs.forEach((p, i) => console.log(`\n[${i+1}] ${p}`));

  await browser.close();
}

fullLoginAndExtract();
