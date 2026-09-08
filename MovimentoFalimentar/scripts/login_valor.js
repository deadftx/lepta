import puppeteer from 'puppeteer';
import fs from 'node:fs';

function getEdgeExecutablePath() {
  const paths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe` : ''
  ];
  return paths.find(p => p && fs.existsSync(p));
}

async function interactiveLogin() {
  const edgePath = getEdgeExecutablePath();
  console.log('======================================================');
  console.log('🚀 ABRINDO MICROSOFT EDGE PARA LOGIN NO VALOR ECONÔMICO');
  if (edgePath) {
    console.log('Navegador:', edgePath);
  }
  console.log('======================================================');
  console.log('Credenciais de Assinante:');
  console.log('E-mail: blrdomingues@gmail.com');
  console.log('Senha:  LeptaCapital1');
  console.log('======================================================\n');

  const launchOptions = {
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox']
  };

  if (edgePath) {
    launchOptions.executablePath = edgePath;
  } else {
    launchOptions.channel = 'msedge';
  }

  const browser = await puppeteer.launch(launchOptions);
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.goto('https://minhaconta.globo.com', { waitUntil: 'networkidle2' });

  try {
    const emailSelector = 'input[name="email"], input[type="email"]';
    await page.waitForSelector(emailSelector, { timeout: 8000 });
    await page.type(emailSelector, 'blrdomingues@gmail.com', { delay: 40 });
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) await submitBtn.click();
  } catch (e) {}

  console.log('👉 Por favor, digite a senha e conclua o login na janela do Microsoft Edge.');
  console.log('Aguardando conclusão do login...');

  await page.waitForFunction(() => {
    return (window.location.href.includes('minhaconta.globo.com') && !window.location.href.includes('authx')) ||
           window.location.href.includes('valor.globo.com');
  }, { timeout: 180000 });

  const cookies = await page.cookies();
  fs.mkdirSync('data', { recursive: true });
  fs.writeFileSync('data/globo_session.json', JSON.stringify(cookies, null, 2));

  console.log(`\n✓ Sucesso! ${cookies.length} cookies salvos em data/globo_session.json.`);
  console.log('Verificando extração completa no Valor Econômico...');

  const articleUrl = 'https://valor.globo.com/empresas/noticia/2026/09/02/aab6f56b-movimento-falimentar.ghtml';
  await page.goto(articleUrl, { waitUntil: 'networkidle2' });

  const paragraphs = await page.evaluate(() => {
    const pElements = Array.from(document.querySelectorAll('.content-text__container, .mc-article-body p, article p, p'));
    return pElements.map(p => p.textContent?.trim() || '').filter(t => t.length > 10 && (t.includes('Empresa:') || t.includes('CNPJ:')));
  });

  console.log(`✓ ${paragraphs.length} empresas identificadas na matéria do dia no Microsoft Edge!`);
  await browser.close();
}

interactiveLogin();
