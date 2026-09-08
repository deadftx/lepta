async function checkValorToday() {
  const payload = [
    {
      search_profile: 'sp_valor_globo_com',
      query: 'valor.info_query_recency',
      params: {
        q: 'movimento falimentar',
        from: 0,
        size: 5
      }
    }
  ];

  const res = await fetch('https://busca.globo.com/v1/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': 'valor',
      'X-Must-Thumborize': 'true',
      'X-Track-Urls': 'true',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Origin: 'https://valor.globo.com',
      Referer: 'https://valor.globo.com/'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  const hits = data?.[0]?.result?.hits?.hits || [];
  console.log(`Total hits: ${hits.length}`);
  for (const h of hits) {
    const src = h._source || h;
    console.log('--- Hit ---');
    console.log('Title:', src.title || src.header);
    console.log('URL:', src.url);
    console.log('Publication date:', src.publicationDate || src.created);
  }
}

checkValorToday();
