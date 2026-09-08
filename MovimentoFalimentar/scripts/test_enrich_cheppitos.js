import { fetchCompanyByCnpj } from '../dist/enrich.js';

async function testEnrichCheppitos() {
  const cnpjs = [
    '49.969.817/0001-61',
    '29.165.751/0001-40',
    '29.123.167/0001-21',
    '13.763.675/0001-34',
    '18.638.300/0001-66',
    '11.955.043/0001-47',
    '23.716.707/0001-02',
    '35.295.467/0001-90',
    '07.749.764/0001-23',
    '18.137.445/0001-83',
    '35.157.493/0001-52',
    '07.990.780/0001-03', // Magdala / Vimez
    '20.874.252/0001-57',
    '07.200.181/0001-49',
    '28.693.303/0001-56',
    '26.355.124/0001-83',
    '24.343.917/0001-57',
    '21.260.637/0001-97',
    '20.433.078/0001-07',
    '32.878.783/0001-05'  // CGSG
  ];

  console.log('Enriquecendo CNPJs com a Receita Federal / API pública:');
  for (const cnpj of cnpjs) {
    const info = await fetchCompanyByCnpj(cnpj);
    console.log(`CNPJ: ${cnpj} -> Razão Social: ${info?.razaoSocial} | Endereço: ${info?.enderecoCompleto}`);
  }
}

testEnrichCheppitos();
