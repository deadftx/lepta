async function testGloboSearchEndpoints() {
  const q = encodeURIComponent('movimento falimentar');
  const candidates = [
    `https://falkor-cda.bbt.globo.com/tenants/valor/busca?q=${q}`,
    `https://falkor-cda.bbt.globo.com/tenants/valor/search?q=${q}`,
    `https://falkor-cda.bbt.globo.com/tenants/g1/busca?q=${q}&from=valor`,
    `https://api.globo.com/busca/?q=${q}&site=valor`,
    `https://busca.globo.com/buscar/?q=${q}&species=not%C3%ADcias&site=Valor+Econ%C3%B4mico`,
    `https://valor.globo.com/busca/api?q=${q}`,
    `https://valor.globo.com/api/busca?q=${q}`
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/html'
        }
      });
      console.log(`[HTTP ${res.status}] ${url}`);
      if (res.ok) {
        const text = await res.text();
        console.log(`  Length: ${text.length} | Preview: ${text.slice(0, 300)}`);
      }
    } catch (e) {
      console.log(`[ERROR] ${url}: ${e.message}`);
    }
  }
}

testGloboSearchEndpoints();
