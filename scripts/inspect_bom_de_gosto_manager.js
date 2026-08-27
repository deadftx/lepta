async function inspectManager() {
  const loginRes = await fetch('https://lepta.com.br/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: 'leptamaster', password: 'L3pt4m4st3r' })
  });
  const { token } = await loginRes.json();

  // Vamos buscar em várias datas de 2026 para encontrar operações ou títulos com os campos completos
  // Dia 24/08/2026 teve 29 títulos de Bom de Gosto!
  // Vamos buscar na rota de confirmação/analise para o dia 24/08
  const res24 = await fetch('https://lepta.com.br/api/confirmacao/analise/consultar?data=2026-08-24', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (res24.ok) {
    const data24 = await res24.json();
    console.log('Total titulos 24/08:', data24.titulos?.length);
    const bgTitulos = (data24.titulos || []).filter(t => 
      String(t.cliente || '').toLowerCase().includes('bom de gosto') ||
      String(t.documentoCliente || '').includes('08089064000112')
    );
    console.log('Títulos Bom de Gosto em 24/08:', bgTitulos.length);
    if (bgTitulos.length > 0) {
      console.log('\n--- TÍTULO COMPLETO DO BOM DE GOSTO ---');
      console.log(JSON.stringify(bgTitulos[0], null, 2));
    }
  }

  // Vamos testar outras datas (ex: maio/2026, junho/2026, julho/2026, agosto/2026)
  const otherDates = ['2026-05-15', '2026-06-15', '2026-07-15', '2026-08-01', '2026-08-10', '2026-08-20', '2026-08-25'];
  for (const d of otherDates) {
    const r = await fetch(`https://lepta.com.br/api/confirmacao/analise/consultar?data=${d}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!r.ok) continue;
    const dJson = await r.json();
    const bg = (dJson.titulos || []).filter(t => 
      String(t.cliente || '').toLowerCase().includes('bom de gosto') ||
      String(t.documentoCliente || '').includes('08089064000112')
    );
    if (bg.length > 0) {
      console.log(`\nData ${d} tem ${bg.length} títulos: Gerente="${bg[0].gerente}" | Super="${bg[0].superintendente}"`);
    }
  }
}

inspectManager();
