import { getValorHoje } from '../dist/valor_scraper.js';

async function testGetValorHoje() {
  console.log('Testando getValorHoje()...');
  const res = await getValorHoje();
  console.log('Resultado:');
  console.log('Título:', res?.title);
  console.log('URL:', res?.url);
  console.log('Data:', res?.date);
  console.log('Itens encontrados:', res?.items?.length);
  if (res?.items) {
    res.items.forEach((it, i) => {
      console.log(`\n${i+1}. [${it.classe}] ${it.empresa} | CNPJ: ${it.cnpj || '-'}`);
      console.log(`   Endereço: ${it.endereco || '-'}`);
      console.log(`   Admin: ${it.administradorJudicial || '-'}`);
      console.log(`   Vara: ${it.varaComarca || '-'}`);
    });
  }
}

testGetValorHoje();
