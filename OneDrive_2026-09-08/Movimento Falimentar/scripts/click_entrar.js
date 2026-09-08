import puppeteer from 'puppeteer';

async function clickEntrar() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  await page.goto('https://valor.globo.com/', { waitUntil: 'networkidle2' });

  console.log('Clicando no botão Entrar...');
  await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('a, button, span, div'));
    const entrar = anchors.find(a => (a.textContent || '').trim().toLowerCase() === 'entrar');
    if (entrar) (entrar).click();
  });

  await new Promise(r => setTimeout(r, 4000));
  console.log('URL atual após clique:', page.url());

  // Check if an iframe or modal appeared
  const frames = page.frames();
  console.log(`Total de frames agora: ${frames.length}`);
  for (let i = 0; i < frames.length; i++) {
    console.log(`Frame ${i}: ${frames[i].url()}`);
  }

  await browser.close();
}

clickEntrar();
