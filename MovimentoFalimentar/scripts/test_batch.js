import path from 'node:path';

async function testBatchCheck() {
  const loginRes = await fetch('https://rgfanalytics.com/login/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'luan.alvarez@lepta.com.br',
      password: 'Rgfanalytics@26'
    })
  });
  const cookie = loginRes.headers.get('set-cookie');

  const testList = [
    { nome: 'AMERICANAS S.A.', cnpj: '00776574000660' },
    { nome: 'RODOSUL AGRONEGOCIOS LTDA', cnpj: '04384375000153' },
    { nome: 'QUADRAC TELECOMUNICACOES', cnpj: '07698978000118' },
    { nome: 'TINTO HOLDING LTDA', cnpj: '01597168000199' },
    { nome: 'ODEBRECHT ENGENHARIA', cnpj: '19821234000128' }
  ];

  for (const item of testList) {
    const res = await fetch(`https://rgfanalytics.com/ajax/company/details/${item.cnpj}`, {
      headers: { Cookie: cookie }
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`Empresa: ${item.nome.padEnd(28)} | CNPJ: ${item.cnpj} | ESTA_EM_RJ: "${data?.ESTA_EM_RJ}"`);
    } else {
      console.log(`Empresa: ${item.nome.padEnd(28)} | CNPJ: ${item.cnpj} | Status HTTP: ${res.status}`);
    }
  }
}

testBatchCheck();
