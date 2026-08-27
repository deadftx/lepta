async function testEndpoints() {
  const loginRes = await fetch('https://lepta.com.br/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: 'leptamaster', password: 'L3pt4m4st3r' })
  });
  const { token } = await loginRes.json();

  // Vamos consultar os relatórios gerenciais ou posições onde o gerente aparece
  // Vamos buscar em /api/posicao ou /api/cedentes ou outras rotas do Lepta
  const endpoints = [
    '/api/cedentes',
    '/api/gestao/posicao',
    '/api/relatorios/titulos',
    '/api/operacoes'
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`https://lepta.com.br${ep}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log(`Endpoint ${ep}: Status ${res.status}`);
      if (res.ok) {
        const d = await res.json();
        console.log(`Dados ${ep}:`, Array.isArray(d) ? `Array de ${d.length}` : Object.keys(d));
      }
    } catch (e) {
      console.log(`Erro ${ep}:`, e.message);
    }
  }
}

testEndpoints();
