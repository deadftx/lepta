async function testWhichTermMatches() {
  const DJEN_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
  
  const SEARCH_TERMS = [
    'defiro o processamento',
    'deferimento do processamento',
    'pedido de processamento',
    'processamento de recuperacao',
    'processamento da recuperacao',
    'edital do art 52',
    'edital do art. 52',
    'concedo a recuperacao',
    'concessao da recuperacao',
    'homologo o plano de recuperacao',
    'homologacao do plano',
    'pedido de recuperacao judicial',
    'recuperacao extrajudicial',
    'decreto a falencia',
    'decretada a falencia',
    'declarada aberta a falencia',
    'convolada em falencia',
    'convolacao em falencia',
    'sentenca declaratoria de falencia',
    'pedido de falencia',
    'requerimento de falencia',
    'falencia requerida',
    'falencia extinta',
    'extincao da falencia',
    'edital de credores',
    'edital do art 7',
    'edital do art. 7',
    'edital do art 99',
    'relacao de credores'
  ];

  for (const t of SEARCH_TERMS) {
    const url = `${DJEN_API}?texto=${encodeURIComponent(t)}&dataDisponibilizacaoInicio=2026-08-25&dataDisponibilizacaoFim=2026-09-01&itensPorPagina=50&pagina=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];
      const hasCheppitos = items.some(x => (x.texto || '').includes('49.969.817/0001-61') || (x.texto || '').includes('CHEPPITOS'));
      const hasCgsg = items.some(x => (x.texto || '').includes('32.878.783/0001-05') || (x.texto || '').includes('CGSG'));
      const hasMagdala = items.some(x => (x.texto || '').includes('07.990.780/0001-03') || (x.texto || '').includes('MAGDALA'));
      
      if (hasCheppitos || hasCgsg || hasMagdala) {
        console.log(`✓ Termo "${t}" encontrou: ${hasCheppitos ? '[CHEPPITOS] ' : ''}${hasCgsg ? '[CGSG] ' : ''}${hasMagdala ? '[MAGDALA]' : ''}`);
      }
    }
  }
}

testWhichTermMatches();
