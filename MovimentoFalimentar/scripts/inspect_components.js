async function inspectComponents() {
  const searchUrl = 'https://valor.globo.com/busca/?q=movimento%20falimentar';
  const res = await fetch(searchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  const text = await res.text();
  const m = text.match(/window\.__COMPONENTS__\s*=\s*(\{[\s\S]*?\});/);
  if (m) {
    try {
      const data = JSON.parse(m[1]);
      console.log('Keys in window.__COMPONENTS__:', Object.keys(data));
      console.log('Structure:', JSON.stringify(data, null, 2).slice(0, 2000));
    } catch (e) {
      console.error('JSON parse error:', e.message);
    }
  } else {
    console.log('window.__COMPONENTS__ not matched directly');
  }

  // Also search for globo search API (e.g., https://falkor-cda.bbt.globo.com or api.globo.com)
  const falkor = text.match(/https:\/\/[a-zA-Z0-9.-]+\.globo\.com\/[^\s"']+/g) || [];
  console.log('Globo URLs:', [...new Set(falkor)].slice(0, 20));
}

inspectComponents();
