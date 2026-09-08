import { today, allRecent } from '../dist/db.js';
import { getValorHoje } from '../dist/valor_scraper.js';

async function testApiValorHoje() {
  console.log('--- 1. Itens no banco para hoje ---');
  const allToday = today();
  console.log('Total hoje no banco:', allToday.length);
  const valorItems = allToday.filter(i => String(i.fonte || '').includes('Valor') || String(i.tribunal || '') === 'VALOR');
  console.log('Total do Valor hoje no banco:', valorItems.length);
  const classesBanco = [...new Set(valorItems.map(i => i.classe))];
  console.log('Classes presentes no banco:', classesBanco);

  console.log('\n--- 2. Itens retornados por getValorHoje() ---');
  const data = await getValorHoje();
  console.log('Total getValorHoje():', data.items.length);
  const classesCrawler = [...new Set(data.items.map(i => i.classe))];
  console.log('Classes getValorHoje():', classesCrawler);
}

testApiValorHoje();
