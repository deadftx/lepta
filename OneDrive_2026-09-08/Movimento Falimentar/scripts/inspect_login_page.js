import puppeteer from 'puppeteer';

async function inspectLoginPage() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  await page.goto('https://login.globo.com/login/464', { waitUntil: 'networkidle2' });

  // Dump frames
  const frames = page.frames();
  console.log(`Page has ${frames.length} frames`);
  for (let i = 0; i < frames.length; i++) {
    console.log(`Frame ${i}: ${frames[i].url()}`);
  }

  // Dump all input elements in all frames
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const inputs = await f.evaluate(() => {
      return Array.from(document.querySelectorAll('input, button, a')).map(el => ({
        tag: el.tagName,
        id: el.id,
        name: el.name,
        type: el.type,
        placeholder: el.placeholder,
        text: el.textContent?.trim()
      }));
    });
    console.log(`Inputs in frame ${i}:`, inputs);
  }

  // Dump body HTML preview
  const bodyHtml = await page.evaluate(() => document.body.innerHTML);
  console.log('Body HTML length:', bodyHtml.length);
  console.log('Body snippet:', bodyHtml.slice(0, 1500));

  await browser.close();
}

inspectLoginPage();
