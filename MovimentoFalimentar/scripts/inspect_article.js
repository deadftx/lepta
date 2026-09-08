async function inspectArticleContent() {
  const url = 'https://valor.globo.com/empresas/noticia/2026/09/01/25c88085-movimento-falimentar.ghtml';
  console.log('Fetching article:', url);
  
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  console.log('Status:', res.status);
  const html = await res.text();
  console.log('HTML length:', html.length);

  // Check paywall or paragraphs
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
  console.log(`Found ${paragraphs.length} paragraphs`);
  console.log('Paragraphs preview:');
  for (let i = 0; i < Math.min(20, paragraphs.length); i++) {
    console.log(`[P${i+1}] ${paragraphs[i]}`);
  }

  // Also check for article body JSON or raw text
  const bodyText = html.match(/class="content-text__container[^"]*"[\s\S]*?<\/div>/gi);
  if (bodyText) {
    console.log('Body container found!');
  }
}

inspectArticleContent();
