async function testProperLogin() {
  const postRes = await fetch('https://rgfanalytics.com/login/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Origin': 'https://rgfanalytics.com',
      'Referer': 'https://rgfanalytics.com/login',
      'Accept': 'application/json, text/plain, */*'
    },
    body: JSON.stringify({
      email: 'luan.alvarez@lepta.com.br',
      password: 'Rgfanalytics@26'
    })
  });

  console.log('Status POST login:', postRes.status);
  const text = await postRes.text();
  console.log('Resposta:', text.slice(0, 300));
  const finalCookie = postRes.headers.get('set-cookie');
  console.log('Cookie final autenticado:', finalCookie);
}

testProperLogin();
