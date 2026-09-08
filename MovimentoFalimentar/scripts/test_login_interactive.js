import puppeteer from 'puppeteer';

const VALOR_EMAIL = process.env.VALOR_EMAIL || 'blrdomingues@gmail.com';
const VALOR_PASSWORD = process.env.VALOR_PASSWORD || 'LeptaCapital1';

async function testLoginInteractive() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  console.log('Navegando para tela de login...');
  await page.goto('https://login.globo.com/login/464?url=https%3A%2F%2Fvalor.globo.com%2F', { waitUntil: 'networkidle2' });

  // List all inputs and forms
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, button')).map(el => ({
      tag: el.tagName,
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder,
      text: el.textContent?.trim()
    }));
  });
  console.log('Inputs encontrados:', inputs);

  // Fill email
  const loginInput = await page.$('#login, input[name="login"]');
  if (loginInput) {
    await loginInput.type(VALOR_EMAIL, { delay: 30 });
  }

  const passInput = await page.$('#password, input[name="password"]');
  if (passInput) {
    await passInput.type(VALOR_PASSWORD, { delay: 30 });
  }
  
  // Click enter / submit
  console.log('Clicando em Entrar...');
  const submitBtn = await page.$('button[type="submit"], .button.button--submit');
  if (submitBtn) {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(e => console.log('Nav timeout:', e.message)),
      submitBtn.click()
    ]);
  }

  console.log('URL após submit:', page.url());
  const cookies = await page.cookies();
  console.log('Cookies obtidos:', cookies.map(c => `${c.name}=${c.value.slice(0, 15)}...`));

  await browser.close();
}

testLoginInteractive();
