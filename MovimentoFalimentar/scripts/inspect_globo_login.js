import puppeteer from 'puppeteer';

async function inspectGloboLoginPage() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://login.globo.com/login/464', { waitUntil: 'networkidle2' });
  console.log('Final URL:', page.url());
  const html = await page.content();
  console.log('Page Title:', await page.title());
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, button, iframe')).map(el => ({
      tag: el.tagName,
      name: el.getAttribute('name'),
      id: el.getAttribute('id'),
      type: el.getAttribute('type'),
      placeholder: el.getAttribute('placeholder'),
      src: el.getAttribute('src')
    }));
  });
  console.log('Inputs found:', JSON.stringify(inputs, null, 2));
  await browser.close();
}

inspectGloboLoginPage();
