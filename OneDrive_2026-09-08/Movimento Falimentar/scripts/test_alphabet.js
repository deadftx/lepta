import { getAuthenticatedSession } from '../dist/rgf.js';

async function testAlphabetSearch() {
  const cookie = await getAuthenticatedSession();
  const res = await fetch('https://rgfanalytics.com/ajax/suggestions?q=u', {
    headers: { Cookie: cookie, 'User-Agent': 'Mozilla/5.0' }
  });
  const list = await res.json();
  console.log(`Buscando letra "u": ${list.length} sugestões`);
  const starList = list.filter(x => (x.label || '').includes('★'));
  console.log(`Empresas confirmadas com estrela ★ (${starList.length}):`);
  starList.forEach((x, i) => console.log(`${i+1}. ${x.label} | CNPJ: ${x.cnpj}`));
}

testAlphabetSearch();
