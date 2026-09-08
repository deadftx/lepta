async function testBastianPosts() {
  const url = 'https://falkor-cda.bastian.globo.com/tenants/valor/instances/a8840b29-f781-4446-9a1a-20689f163516/posts';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
        'Origin': 'https://valor.globo.com',
        'Referer': 'https://valor.globo.com/'
      }
    });

    console.log(`[HTTP ${res.status}] ${url}`);
    const data = await res.json();
    console.log('Total items in Bastian post feed:', data?.items?.length);
    if (data?.items?.length > 0) {
      console.log('Item 1:', JSON.stringify(data.items[0], null, 2));
    }
  } catch (e) {
    console.log('Erro:', e.message);
  }
}

testBastianPosts();
