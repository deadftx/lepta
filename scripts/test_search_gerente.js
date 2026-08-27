async function inspectRawBomDeGosto() {
  const loginRes = await fetch('https://lepta.com.br/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: 'leptamaster', password: 'L3pt4m4st3r' })
  });
  const { token } = await loginRes.json();

  const res = await fetch(`https://lepta.com.br/api/confirmacao/analise/consultar?data=2026-08-24`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  const titulos = data.titulos || [];
  const bg = titulos.filter(t => 
    String(t.cliente || '').toLowerCase().includes('bom de gosto') || 
    String(t.documentoCliente || '').includes('08089064000112')
  );
  console.log('Títulos do Bom de Gosto encontrados no dia 24/08:', bg.length);
  if (bg.length > 0) {
    console.log('Primeiro título formatado:', bg[0]);
  }
}

inspectRawBomDeGosto();
