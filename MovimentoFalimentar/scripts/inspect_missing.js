async function inspectMissing() {
  const DJEN_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
  
  for (const q of ['09.008.431/0001-79', '46.011.524/0001-89', '03.143.714/0001-47', '07.556.817/0001-90', 'Transnecher', 'Gasdiesel']) {
    const res = await fetch(`${DJEN_API}?texto=${encodeURIComponent(q)}&itensPorPagina=2`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const j = await res.json();
      console.log(`\n=== Busca "${q}": ${j.count || j.items?.length || 0} resultados ===`);
      if (j.items?.length > 0) {
        for (const it of j.items) {
          console.log(`Tribunal: ${it.siglaTribunal} | Órgão: ${it.nomeOrgao} | Data: ${it.data_disponibilizacao} | Tipo: ${it.tipoComunicacao}`);
          console.log(`Texto: ${it.texto?.slice(0, 300).replace(/\s+/g, ' ')}`);
        }
      }
    }
  }
}

inspectMissing();
