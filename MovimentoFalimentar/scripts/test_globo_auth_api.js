async function testGloboAuthApi() {
  const email = 'blrdomingues@gmail.com';
  const password = 'LeptaCapital1';

  // Test standard Globo ID auth endpoints
  const authUrls = [
    'https://autenticacao.globo.com/api/authentication',
    'https://login.globo.com/api/authentication',
    'https://api.globo.com/v1/session',
    'https://goidc.globo.com/auth/realms/globo.com/protocol/openid-connect/token'
  ];

  for (const url of authUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
          'Origin': 'https://valor.globo.com',
          'Referer': 'https://valor.globo.com/'
        },
        body: JSON.stringify({
          payload: {
            email,
            password,
            serviceId: 464
          }
        })
      });

      console.log(`[HTTP ${res.status}] ${url}`);
      const text = await res.text();
      console.log('Response:', text.slice(0, 500));
    } catch (e) {
      console.log(`[ERROR] ${url}: ${e.message}`);
    }
  }
}

testGloboAuthApi();
