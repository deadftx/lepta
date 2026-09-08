import { scanTribunal } from '../dist/datajud.js';

async function testDataJudDirect() {
  const apiKey = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
  console.log('Testando DataJud para TJSP e TJDFT nos últimos 7 dias...');

  const tjsp = await scanTribunal({ alias: 'tjsp', code: 'TJSP', name: 'Tribunal de Justiça de São Paulo' }, apiKey, 7, 50);
  console.log('TJSP itens encontrados:', tjsp.length);
  if (tjsp.length > 0) {
    console.log('TJSP Amostra:');
    console.log(JSON.stringify(tjsp.slice(0, 3), null, 2));
  }

  const tjdft = await scanTribunal({ alias: 'tjdft', code: 'TJDFT', name: 'Tribunal de Justiça do DF' }, apiKey, 7, 50);
  console.log('TJDFT itens encontrados:', tjdft.length);
  if (tjdft.length > 0) {
    console.log('TJDFT Amostra:');
    console.log(JSON.stringify(tjdft.slice(0, 3), null, 2));
  }
}

testDataJudDirect();
