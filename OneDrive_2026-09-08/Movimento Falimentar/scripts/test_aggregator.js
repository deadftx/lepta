import { getValorHoje } from '../dist/valor_scraper.js';

async function testAggregator() {
  console.log('Testando agregador automático de matérias do Valor Econômico...');
  const res = await getValorHoje();
  console.log('Resultado da varredura:');
  console.log('Título:', res.title);
  console.log('Total de empresas extraídas automaticamente:', res.items.length);
  res.items.forEach((it, i) => {
    console.log(`${i + 1}. [${it.classe}] ${it.empresa} - CNPJ: ${it.cnpj || '-'}`);
  });
}

testAggregator();
