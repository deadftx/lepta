import fs from 'fs';

let token = process.env.UNLTD_API_TOKEN || '';
if (!token && fs.existsSync('/var/www/lepta/.env')) {
  const envContent = fs.readFileSync('/var/www/lepta/.env', 'utf8');
  const match = envContent.match(/UNLTD_API_TOKEN=(.+)/);
  if (match) token = match[1].trim();
}

if (!token) {
  console.error('ERRO: Token UNLTD_API_TOKEN não encontrado na VPS.');
  process.exit(1);
}

const API_BASE_URL = 'https://lepta-backend.bit-unltd.com.br';

async function testApi() {
  const dataCadastro = '2026-08-26';

  // Teste 1: data 03:00:00.000Z ate 02:59:59.999Z (Brasília)
  const payload1 = {
    tipoDeData: 'Cadastro',
    dataInicial: `${dataCadastro}T03:00:00.000Z`,
    dataFinal: `2026-08-27T02:59:59.999Z`,
    situacoes: ['Em Aberto']
  };

  // Teste 2: data 00:00:00.000Z ate 23:59:59.999Z (UTC)
  const payload2 = {
    tipoDeData: 'Cadastro',
    dataInicial: `${dataCadastro}T00:00:00.000Z`,
    dataFinal: `${dataCadastro}T23:59:59.999Z`,
    situacoes: ['Em Aberto']
  };

  console.log('=== TESTE 1: RANGE HORÁRIO DE BRASÍLIA (03:00 A 02:59Z) ===');
  const res1 = await fetch(`${API_BASE_URL}/recebiveis/titulos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `UNLTD-BackEnd ${token}` },
    body: JSON.stringify(payload1)
  });
  const data1 = await res1.json();
  analyzeResponse(data1);

  console.log('\n=== TESTE 2: RANGE UTC PURO (00:00 A 23:59Z) ===');
  const res2 = await fetch(`${API_BASE_URL}/recebiveis/titulos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `UNLTD-BackEnd ${token}` },
    body: JSON.stringify(payload2)
  });
  const data2 = await res2.json();
  analyzeResponse(data2);
}

function analyzeResponse(data) {
  console.log(`Total títulos brutos retornados: ${Array.isArray(data) ? data.length : 0}`);

  if (Array.isArray(data) && data.length > 0) {
    let totalNominalBruto = 0;
    const uaMap = {};
    const prodMap = {};
    const siglaMap = {};
    const manMap = {};

    data.forEach(t => {
      const val = Number(t.valorNominal || t.valor_nominal_original || t.valor || 0);
      totalNominalBruto += val;

      const ua = String(t.contaOperacional?.unidadeAdministrativa?.nome || t.unidadeAdministrativa?.nome || t.ua || t.fundo || 'Nenhum');
      uaMap[ua] = (uaMap[ua] || 0) + val;

      const prod = String(t.produto?.sigla || t.produto?.nome || t.produto || 'Nenhum');
      prodMap[prod] = (prodMap[prod] || 0) + val;

      const sig = String(t.tipoDocumento?.sigla || t.especie?.sigla || t.sigla || 'Nenhum');
      siglaMap[sig] = (siglaMap[sig] || 0) + val;

      let man = t.situacaoManifesto || t.manifesto || 'Sem Atuação';
      if (typeof man === 'object') man = man.descricao || man.nome || man.sigla || JSON.stringify(man);
      manMap[String(man)] = (manMap[String(man)] || 0) + val;
    });

    console.log(`Valor Nominal Total Bruto sem filtros: R$ ${totalNominalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log('\n--- UAs (Valores Nominais Somados) ---');
    Object.entries(uaMap).forEach(([k, v]) => console.log(`  - ${k}: R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));

    console.log('\n--- Produtos (Valores Nominais Somados) ---');
    Object.entries(prodMap).forEach(([k, v]) => console.log(`  - ${k}: R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));

    console.log('\n--- Siglas (Valores Nominais Somados) ---');
    Object.entries(siglaMap).forEach(([k, v]) => console.log(`  - ${k}: R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));

    console.log('\n--- Manifestos (Valores Nominais Somados) ---');
    Object.entries(manMap).forEach(([k, v]) => console.log(`  - ${k}: R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
  }
}

testApi();
