async function inspectDiff() {
  const loginRes = await fetch('https://lepta.com.br/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: 'leptamaster', password: 'L3pt4m4st3r' })
  });
  const { token } = await loginRes.json();

  const analiseRes = await fetch('https://lepta.com.br/api/confirmacao/analise/consultar?data=2026-08-26', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await analiseRes.json();

  // Busca todos os títulos na API UNLTD bruta
  // Vamos buscar na API diretamente com a rota /recebiveis/titulos
  const unltdRes = await fetch('https://lepta-backend.bit-unltd.com.br/recebiveis/titulos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'UNLTD-BackEnd ' + process.env.UNLTD_API_TOKEN
    },
    body: JSON.stringify({
      tipoDeData: 'Cadastro',
      dataInicial: '2026-08-26T00:00:00',
      dataFinal: '2026-08-26T23:59:59',
      situacoes: ['Em Aberto']
    })
  });
  // Se não der direto, vamos comparar os campos
}
