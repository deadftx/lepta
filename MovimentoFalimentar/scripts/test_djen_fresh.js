import { scanDjen } from '../dist/djen.js';

async function testDjenFresh() {
  console.log('Testando busca no DJEN (últimos 7 dias)...');
  const items = await scanDjen(7);
  console.log(`Total capturado no DJEN: ${items.length} itens.`);
  console.log('\nAmostra de 15 empresas capturadas no DJEN:');
  items.slice(0, 15).forEach((x, i) => {
    console.log(`${i+1}. [${x.classe.padEnd(28)}] ${x.empresa.padEnd(40)} | CNPJ: ${(x.cnpj || '-').padEnd(18)} | Tribunal: ${x.tribunal} | Vara: ${x.varaComarca || '-'}`);
  });
}

testDjenFresh();
