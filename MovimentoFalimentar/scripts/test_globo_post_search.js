async function testGloboPostSearch() {
  const url = 'https://busca.globo.com/v1/search';
  const payload = [
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

  console.log('Posting payload to:', url);
  console.log(JSON.stringify(payload, null, 2));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Origin': 'https://valor.globo.com',
      'Referer': 'https://valor.globo.com/'
    },
    body: JSON.stringify(payload)
  });

  console.log('Response status:', res.status);
  const data = await res.json();
  console.log('Data returned:');
  console.log(JSON.stringify(data, null, 2).slice(0, 3000));
}

testGloboPostSearch();
