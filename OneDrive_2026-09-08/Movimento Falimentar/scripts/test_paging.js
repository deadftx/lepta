async function testPaging() {
  const DJEN_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
  
  console.log('Buscando páginas para "processamento de recuperacao"...');
  let foundCheppitosPage = -1;
  for (let page = 1; page <= 10; page++) {
    const url = `${DJEN_API}?texto=${encodeURIComponent('processamento de recuperacao')}&dataDisponibilizacaoInicio=2026-08-25&dataDisponibilizacaoFim=2026-09-01&itensPorPagina=100&pagina=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) break;
    const j = await res.json();
    const items = j.items || [];
    if (items.length === 0) break;

    const hit = items.find(x => (x.texto || '').includes('49.969.817/0001-61') || (x.texto || '').includes('CHEPPITOS'));
    if (hit) {
      foundCheppitosPage = page;
      console.log(`✓ CHEPPITOS ENCONTRADO NA PÁGINA ${page}! Total itens nesta página: ${items.length}`);
      break;
    }
  }

  console.log('Buscando páginas para "pedido de falencia"...');
  let foundCgsgPage = -1;
  for (let page = 1; page <= 10; page++) {
    const url = `${DJEN_API}?texto=${encodeURIComponent('falencia')}&dataDisponibilizacaoInicio=2026-08-25&dataDisponibilizacaoFim=2026-09-01&itensPorPagina=100&pagina=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) break;
    const j = await res.json();
    const items = j.items || [];
    if (items.length === 0) break;

    const hit = items.find(x => (x.texto || '').includes('32.878.783/0001-05') || (x.texto || '').includes('CGSG'));
    if (hit) {
      foundCgsgPage = page;
      console.log(`✓ CGSG ENCONTRADO NA PÁGINA ${page}! Total itens nesta página: ${items.length}`);
      break;
    }
  }
}

testPaging();
