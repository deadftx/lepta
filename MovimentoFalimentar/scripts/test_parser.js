async function testParserDetail() {
  const DJEN_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

  // Buscar publicação do grupo Cheppitos
  const res = await fetch(`${DJEN_API}?texto=${encodeURIComponent('49.969.817/0001-61')}&itensPorPagina=1`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const json = await res.json();
  const text = json.items[0].texto;

  console.log('--- TESTANDO PARSER DE EMPRESAS NO TEXTO ---');
  
  // Padrão de extração de empresas com CNPJ no texto:
  // "DIVINA PICANHA COMÉRCIO DE ALIMENTOS LTDA (CNPJ nº 07.749.764/0001-23)"
  // "por NOME DA EMPRESA (CNPJ nº XX.XXX.XXX/XXXX-XX)"
  // "Recuperanda: MAGDALA & SANTOS LTDA, CNPJ nº 07.990.780/0001-03, com sede na..."
  const regexList = [
    /([A-Z0-9\s.&'-]+?)\s*\(\s*CNPJ\s*(?:n[º°.]?)?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})\s*\)/gi,
    /(?:Recuperanda|Falida|Devedora|Requerida)\s*:\s*([A-Z0-9\s.&'-]+?)(?:,\s*CNPJ|\s+CNPJ|\s*\(CNPJ)/gi,
    /([A-Z0-9\s.&'-]+?)\s*,\s*CNPJ\s*(?:n[º°.]?)?\s*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/gi
  ];

  const foundCompanies = [];
  for (const r of regexList) {
    for (const m of text.matchAll(r)) {
      foundCompanies.push({ nome: m[1].trim(), cnpj: m[2]?.trim() || null });
    }
  }

  console.log(`Encontradas ${foundCompanies.length} empresas no texto do TJCE:`);
  foundCompanies.forEach((c, i) => console.log(`${i+1}. ${c.nome} | CNPJ: ${c.cnpj}`));
}

testParserDetail();
