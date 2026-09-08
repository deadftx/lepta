async function searchExactCases() {
  const DJEN_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
  
  const testQueries = [
    '32.878.783/0001-05',
    '32878783000105',
    'CGSG Participações',
    'Gasdiesel',
    '09.008.431/0001-79',
    'JMA Serviços',
    '18.929.300/0001-15',
    'Manguinhos Química',
    'Refinaria de Petróleos Manguinhos',
    'Lejan Indústria',
    'Transnecher',
    'Cheppitos',
    '49.969.817/0001-61',
    'Vimez',
    '07.990.780/0001-03'
  ];

  for (const q of testQueries) {
    try {
      const url = `${DJEN_API}?texto=${encodeURIComponent(q)}&itensPorPagina=5`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (res.ok) {
        const json = await res.json();
        const total = json?.count ?? json?.items?.length ?? 0;
        console.log(`Busca "${q}": ${total} resultado(s) no DJEN`);
        if (json?.items?.length > 0) {
          const first = json.items[0];
          console.log(`  -> Tribunal: ${first.siglaTribunal} | Órgão: ${first.nomeOrgao} | Data: ${first.data_disponibilizacao} | Tipo: ${first.tipoComunicacao}`);
          console.log(`  -> Trecho: ${first.texto?.slice(0, 200).replace(/\s+/g, ' ')}`);
        }
      } else {
        console.log(`Busca "${q}": HTTP ${res.status}`);
      }
    } catch (e) {
      console.error(e.message);
    }
  }
}

searchExactCases();
