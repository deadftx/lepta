async function testTermsForCheppitos() {
  const DJEN_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
  
  const terms = [
    'recuperacao judicial',
    'pedido de processamento',
    'processamento de recuperacao',
    'processamento da recuperacao',
    'litisconsorcio ativo',
    'divina picanha',
    '49.969.817/0001-61'
  ];

  for (const t of terms) {
    const url = `${DJEN_API}?texto=${encodeURIComponent(t)}&dataDisponibilizacaoInicio=2026-08-25&dataDisponibilizacaoFim=2026-09-01&itensPorPagina=5`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const j = await res.json();
      console.log(`Termo "${t}": ${j.count ?? j.items?.length ?? 0} resultados encontrados no período`);
    } else {
      console.log(`Termo "${t}": HTTP ${res.status}`);
    }
  }
}

testTermsForCheppitos();
