async function testDateFilter() {
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
  const rawTitulos = data.titulos || [];

  console.log('Total titulos retornados:', rawTitulos.length);

  // Filtra apenas os que o cadastro é estritamente 26/08/2026 (ou 2026-08-26)
  const exactDateTitulos = rawTitulos.filter(t => t.cadastro === '26/08/2026' || t.cadastro === '2026-08-26');
  console.log('Total com data de cadastro exata 26/08/2026:', exactDateTitulos.length);

  const msExact = exactDateTitulos.filter(t => t.fundoTipo === 'MULTISETORIAL');
  console.log('Total MS com data 26/08/2026:', msExact.length);
  const msSum = msExact.reduce((acc, t) => acc + t.valorNominal, 0);
  console.log('VALOR TOTAL MS FIDC NOMINAL:', msSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));

  const specialExact = exactDateTitulos.filter(t => t.fundoTipo === 'SPECIAL');
  console.log('Total Special com data 26/08/2026:', specialExact.length);
  const specialSum = specialExact.reduce((acc, t) => acc + t.valorNominal, 0);
  console.log('VALOR TOTAL SPECIAL FIDC NOMINAL:', specialSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
}

testDateFilter();
