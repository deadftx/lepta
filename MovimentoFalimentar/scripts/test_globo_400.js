async function testGloboStatus400() {
  const url = 'https://busca.globo.com/v1/search';
  const S = [
    {
      search_profile: 'navegacional_valor',
      query: 'valor.info_query_recency',
      params: {
        q: 'movimento falimentar',
        from: 0,
        size: 10
      }
    }
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': 'valor',
      'X-Must-Thumborize': 'true',
      'X-Track-Urls': 'true',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://valor.globo.com',
      'Referer': 'https://valor.globo.com/'
    },
    body: JSON.stringify(S)
  });

  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Body:', text);
}

testGloboStatus400();
