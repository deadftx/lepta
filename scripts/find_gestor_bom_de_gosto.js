import Database from 'better-sqlite3';

const db = new Database('./database.sqlite');

async function searchClientManager() {
  console.log('--- BUSCANDO TÍTULOS DE "BOM DE GOSTO" NO BANCO LOCAL PARA VER O GERENTE ---');
  
  // Vamos buscar em estoque_titulos pelo CNPJ 08089064000112
  const titulos = db.prepare(`
    SELECT * FROM estoque_titulos 
    WHERE cedente_cnpj = '08089064000112' 
    LIMIT 5
  `).all();
  
  console.log('Total de títulos encontrados:', titulos.length);
  if (titulos.length > 0) {
    console.log('Amostra de título do banco local:', titulos[0]);
  }

  // Agora vamos consultar a API UNLTD em /recebiveis/titulos buscando por esse cedente
  // Fazendo login no lepta.com.br para usar o backend
  const loginRes = await fetch('https://lepta.com.br/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: 'leptamaster', password: 'L3pt4m4st3r' })
  });
  const { token } = await loginRes.json();

  // Vamos consultar o histórico geral na API do lepta ou na UNLTD
  const unltdRes = await fetch('https://lepta.com.br/api/unltd/history', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (unltdRes.ok) {
    const historyData = await unltdRes.json();
    console.log('Títulos no history:', historyData.titulos?.length);
    const bgTitulos = (historyData.titulos || []).filter(t => 
      String(t.contaOperacional?.cliente?.entidade?.documento || t.cliente?.documento || '').includes('08089064000112') ||
      String(t.contaOperacional?.cliente?.entidade?.nome || t.cliente?.nome || '').toLowerCase().includes('bom de gosto')
    );
    console.log('Títulos do Bom de Gosto no histórico UNLTD:', bgTitulos.length);
    if (bgTitulos.length > 0) {
      console.log('Gerente no título:', bgTitulos[0].gerente);
      console.log('ContaOperacional completa:', JSON.stringify(bgTitulos[0].contaOperacional, null, 2));
    }
  } else {
    console.log('Status /api/unltd/history:', unltdRes.status);
  }
}

searchClientManager();
