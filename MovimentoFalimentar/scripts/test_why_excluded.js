const LABOR_NOTICE_REGEX = /\b(trabalhist|vara\s+do\s+trabalho|trt\b|trt\d+|tst\b|csjt\b|justi[cç]a\s+do\s+trabalho|reclamat[oó]ria|reclamante|cr[eé]dito\s+trabalhista|habilita[cç][aã]o\s+trabalhista|rescis[aã]o\s+indireta|verbas\s+rescis[oó]rias|acordo\s+trabalhista|dep[oó]sito\s+recursal|clt\b|postotrabalhista)\b/i;
const MERIT_DECISION_REGEX = /(?:defir[oa]|deferid[oa]|deferimento)\s+(?:d[oe]\s+)?(?:o\s+)?processamento\s+(?:d[ea]\s+)?recupera[cç][aã]o|(?:conced[oa]|concedid[oa]|concess[aã]o)\s+(?:a\s+)?recupera[cç][aã]o|homolog(?:o|ad[oa]|a[cç][aã]o)\s+(?:d[oe]\s+)?(?:o\s+)?plano|decret(?:o|ad[oa]|a[cç][aã]o)\s+(?:a\s+)?fal[eê]ncia|convol(?:ada|ou|a[cç][aã]o)\s+em\s+fal[eê]ncia|senten[cç]a\s+declarat[oó]ria\s+de\s+fal[eê]ncia|declarada\s+aberta\s+a\s+fal[eê]ncia|pedido\s+de\s+fal[eê]ncia|fal[eê]ncia\s+requerida|requerimento\s+de\s+fal[eê]ncia|pedido\s+de\s+(?:processamento\s+de\s+)?recupera[cç][aã]o|recupera[cç][aã]o\s+extrajudicial|edital\s+do\s+art(?:\.|\s+)(?:52|53|7[ºo]|99)|edital\s+de\s+(?:convoca[cç][aã]o\s+de\s+)?credores|relação\s+de\s+credores|fal[eê]ncia\s+(?:extinta|elidida|indeferida)|extin[cç][aã]o\s+da\s+fal[eê]ncia/i;

function isExcludedCourtOrNotice(it) {
  const trib = String(it.siglaTribunal || '').toUpperCase();
  if (trib.startsWith('TRT') || trib.startsWith('TRF') || trib === 'TST' || trib === 'CSJT' || trib === 'STJ' || trib === 'STF') {
    return { excluded: true, reason: 'tribunal excluded: ' + trib };
  }
  
  const orgao = String(it.nomeOrgao || '').toLowerCase();
  if (
    orgao.includes('trabalho') ||
    orgao.includes('trabalhista') ||
    orgao.includes('juizado especial') ||
    orgao.includes('jec') ||
    orgao.includes('execuções fiscais') ||
    orgao.includes('execucoes fiscais') ||
    orgao.includes('fazenda pública') ||
    orgao.includes('fazenda publica') ||
    orgao.includes('família') ||
    orgao.includes('familia') ||
    orgao.includes('órfãos') ||
    orgao.includes('orfaos') ||
    orgao.includes('sucessões') ||
    orgao.includes('sucessoes') ||
    orgao.includes('câmara') ||
    orgao.includes('camara') ||
    orgao.includes('gabinete') ||
    orgao.includes('turma') ||
    orgao.includes('divisao de processamento') ||
    orgao.includes('divisão de processamento') ||
    orgao.includes('coordenadoria') ||
    orgao.includes('plenário') ||
    orgao.includes('plenario')
  ) {
    return { excluded: true, reason: 'orgao excluded: ' + orgao };
  }
  
  const texto = String(it.texto || '');
  const textoLower = texto.toLowerCase();

  if (LABOR_NOTICE_REGEX.test(textoLower)) {
    const match = textoLower.match(LABOR_NOTICE_REGEX);
    return { excluded: true, reason: 'labor regex matched: ' + match[0] };
  }

  if (
    textoLower.includes('conflito de competência') ||
    textoLower.includes('conflito de competencia') ||
    textoLower.includes('embargos à execução') ||
    textoLower.includes('embargos a execucao') ||
    textoLower.includes('ação de despejo') ||
    textoLower.includes('acao de despejo') ||
    textoLower.includes('ação indenizatória') ||
    textoLower.includes('acao indenizatoria')
  ) {
    return { excluded: true, reason: 'civil action excluded' };
  }

  if (!MERIT_DECISION_REGEX.test(texto)) {
    return { excluded: true, reason: 'merit regex failed' };
  }
  
  return { excluded: false, reason: 'ok' };
}

async function testWhyExcluded() {
  const DJEN_API = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';

  // 1. Cheppitos
  const res1 = await fetch(`${DJEN_API}?texto=${encodeURIComponent('49.969.817/0001-61')}&itensPorPagina=1`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const item1 = (await res1.json()).items[0];
  console.log('--- CHEPPITOS ---');
  console.log('Verificação:', isExcludedCourtOrNotice(item1));

  // 2. CGSG
  const res2 = await fetch(`${DJEN_API}?texto=${encodeURIComponent('32.878.783/0001-05')}&itensPorPagina=1`, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const item2 = (await res2.json()).items[0];
  console.log('\n--- CGSG ---');
  console.log('Verificação:', isExcludedCourtOrNotice(item2));
}

testWhyExcluded();
