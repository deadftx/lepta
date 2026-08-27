import ExcelJS from 'exceljs';
import crypto from 'crypto';

const API_BASE_URL = 'https://lepta-backend.bit-unltd.com.br';

const shareTokensCache = new Map();

/**
 * Formata número no padrão pt-BR com casas decimais configuráveis
 */
function formatNumberPtBr(val, minDecimals = 2, maxDecimals = 2) {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '0,00';
  }
  const num = Number(val);
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals
  });
}

/**
 * Formata data ISO para DD/MM/AAAA
 */
function formatDatePtBr(dateVal) {
  if (!dateVal) return '';
  try {
    const s = String(dateVal).trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    const parts = s.substring(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  } catch {
    return '';
  }
}

function normalizeStr(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Extrai texto limpo de strings ou Objetos JSON retornados pela API UNLTD
 */
function extractText(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    return Object.values(val)
      .filter(v => v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number'))
      .map(v => String(v).trim())
      .join(' ');
  }
  return String(val).trim();
}

/**
 * Valida Unidade Administrativa (somente MS FIDC e Special FIDC; rejeita Gestora e Securitizadora)
 */
function getUnidadeAdministrativaInfo(t) {
  const rawUa = extractText(
    t.contaOperacional?.unidadeAdministrativa?.alias ||
    t.contaOperacional?.unidadeAdministrativa?.nome ||
    t.unidadeAdministrativa?.nome ||
    t.unidadeAdministrativa?.alias ||
    t.contaOperacional?.unidadeAdministrativa ||
    t.unidadeAdministrativa ||
    t.ua ||
    t.fundo ||
    ''
  );
  const norm = normalizeStr(rawUa);

  if (norm.includes('gestora') || norm.includes('securitizadora')) {
    return null; // Rejeita Lepta Gestora e Lepta Securitizadora (Print 1)
  }

  if (norm.includes('special')) {
    return { name: 'Lepta Special FIDC', type: 'SPECIAL' };
  }

  if (norm.includes('ms') || norm.includes('mult') || norm.includes('multisetorial') || norm.includes('lepta ms')) {
    return { name: 'Lepta MS FIDC', type: 'MULTISETORIAL' };
  }

  return null; // Descarta qualquer operação sem identificação explícita de MS ou Special
}

/**
 * Checa se produto é Faturização (FAT)
 */
function isProdutoValido(t) {
  const prodStr = extractText(
    t.contaOperacional?.produto?.sigla ||
    t.contaOperacional?.produto?.descricao ||
    t.contaOperacional?.produto ||
    t.produto?.sigla ||
    t.produto?.descricao ||
    t.produto?.nome ||
    t.produto ||
    ''
  );
  const norm = normalizeStr(prodStr);
  if (!norm) return true;
  if (norm.includes('ccb') || norm.includes('cobranca') || norm.includes('comissaria') ||
      norm.includes('confissao') || norm.includes('custodia') || norm.includes('domicilio') ||
      norm.includes('fomento') || norm.includes('intercompany') || norm.includes('nota')) {
    return false;
  }
  return norm.includes('fat') || norm.includes('faturizacao');
}

/**
 * Checa se sigla/espécie é Duplicata Mercantil (DM) ou Duplicata de Serviço (DS)
 */
function isSiglaValida(t) {
  const siglaStr = extractText(
    t.tipoDocumento?.sigla ||
    t.especie?.sigla ||
    t.sigla ||
    t.contaOperacional?.sigla ||
    t.tipoDocumento ||
    t.especie ||
    t.tipo ||
    ''
  );
  const norm = normalizeStr(siglaStr);
  if (!norm.trim()) return true;
  if (norm.includes('contrato') || norm.includes('cheque') || norm.includes('ccb')) {
    return false;
  }
  return norm.includes('dm') || norm.includes('ds') || norm.includes('duplicata');
}

/**
 * Checa se situação é Em Aberto
 */
function isSituacaoValida(t) {
  const sitStr = extractText(t.situacao);
  const norm = normalizeStr(sitStr);
  if (!norm) return true;
  if (norm.includes('liquidado') || norm.includes('baixado') || norm.includes('recomprado') ||
      norm.includes('cartorio') || norm.includes('perda') || norm.includes('pro solvendo') ||
      norm.includes('credito') || norm.includes('cancelad') || norm.includes('rejeitad')) {
    return false;
  }
  return norm.includes('aberto');
}

/**
 * Checa se manifesto é um dos 7 ativos (descarta os 4 roxos/desmarcados)
 */
function isManifestoValido(t) {
  const manStr = extractText(t.situacaoManifesto || t.manifesto || t.situacao_manifesto || '');
  const norm = normalizeStr(manStr);
  if (!norm.trim() || norm === '--') return true;

  const DISALLOWED_MANIFESTOS = [
    'transacao desconhecida',
    'desconhecida',
    'lastro inconsistente',
    'inconsistente',
    'transacao nao concluida',
    'nao concluida',
    'protestado',
    'protesto'
  ];

  for (const disallowed of DISALLOWED_MANIFESTOS) {
    if (norm.includes(disallowed)) {
      return false;
    }
  }

  return true;
}

/**
 * Valida se o título atende a todos os critérios dos filtros estritos da Bitfin (Prints 1, 2 e 3)
 */
export function isTituloValidoParaAnalise(t) {
  if (!getUnidadeAdministrativaInfo(t)) return false;
  if (!isProdutoValido(t)) return false;
  if (!isSiglaValida(t)) return false;
  if (!isSituacaoValida(t)) return false;
  if (!isManifestoValido(t)) return false;
  return true;
}

/**
 * Normaliza e enriquece um título da API UNLTD para a estrutura canônica dos 36 campos
 */
export function normalizeTituloRecord(t) {
  const uaInfo = getUnidadeAdministrativaInfo(t) || { name: 'Lepta MS FIDC', type: 'MULTISETORIAL' };
  const ua = uaInfo.name;
  const fundoTipo = uaInfo.type;

  const cedenteDoc = String(t.contaOperacional?.cliente?.entidade?.documento || t.cliente?.documento || t.cedente_cnpj || '').replace(/\D/g, '');
  const sacadoDoc = String(t.sacado?.entidade?.documento || t.sacado?.documento || t.sacado_cnpj || '').replace(/\D/g, '');

  const id = t.id || '';
  const operacao = t.operacao?.id || t.operacaoId || t.operacao?.numero || t.operacao || '';
  const pagto = t.pagamentoOperacional?.id || t.pagamentoOperacional || t.pagamentoId || t.pagto || '';
  const cliente = (t.contaOperacional?.cliente?.entidade?.nome || t.cliente?.nome || t.cedente_nome || '').trim();
  const sacado = (t.sacado?.entidade?.nome || t.sacado?.nome || t.sacado_nome || '').trim();
  const produto = (extractText(t.contaOperacional?.produto?.sigla || t.contaOperacional?.produto?.descricao || t.produto) || 'FAT').toUpperCase();
  const sigla = (extractText(t.sigla || t.tipoDocumento?.sigla || t.especie?.sigla || t.contaOperacional?.sigla) || 'DM').toUpperCase();
  const numero = String(t.numero || t.numero_titulo || '').trim();

  const cadastro = formatDatePtBr(t.dataDeCadastro || t.cadastro || t.data_cadastro);
  const emissao = formatDatePtBr(t.dataDeEmissao || t.emissao || t.data_emissao);
  const vencimento = formatDatePtBr(t.dataDeVencimento || t.vencimento || t.data_vencimento);
  const vencimentoEfetivo = formatDatePtBr(t.dataDeVencimentoEfetivo || t.vencimentoEfetivo || t.dataDeVencimento || t.vencimento);

  const vencido = t.vencido === true || String(t.vencido).toLowerCase() === 'sim' ? 'Sim' : 'Nao';
  const situacao = extractText(t.situacao) || 'Em Aberto';
  const dataSituacao = formatDatePtBr(t.dataDaSituacao || t.dataSituacao || t.dataDeCadastro || t.cadastro);
  const manifesto = extractText(t.situacaoManifesto || t.manifesto) || 'Sem Atuacao';
  const dataManifesto = formatDatePtBr(t.dataDoManifesto || t.dataManifesto || t.dataDeCadastro || t.cadastro);

  const valorNominal = Number(t.valorNominal || t.valor_nominal_original || t.valor || 0);
  const descontoAbatimento = Number(t.descontoAbatimento || t.valorDoAbatimento || t.abatimento || 0);
  const valorLiquido = Number(t.valorLiquido || (valorNominal - descontoAbatimento));
  const valorPago = Number(t.valorPago || 0);
  const saldoDevedor = Number(t.saldoDevedor || (valorNominal - valorPago));
  const oscilacao = t.oscilacao !== undefined ? Number(t.oscilacao) : -valorNominal;
  const taxa = Number(t.taxa || t.taxaMensal || 0);
  const desagio = Number(t.desagio || t.valorDesagio || 0);
  const custo = Number(t.custo || t.valorCusto || 0);
  const receita = Number(t.receita || t.valorReceita || (desagio - custo));
  const tarifasOperacao = Number(t.tarifasOperacao || t.tarifa || 0);
  const prazoReal = Number(t.prazoReal || 0);
  const prazoCobrado = Number(t.prazoCobrado || 0);

  const gerente = extractText(t.gerente?.nome || t.contaOperacional?.gerente?.nome || t.gerente);
  const superintendente = extractText(t.superintendente?.nome || t.contaOperacional?.superintendente?.nome || t.superintendente) || 'Sebastiao Neto';
  const bancoCobrador = extractText(t.bancoCobrador || t.cobranca?.banco || t.contaBancaria?.banco);

  return {
    id,
    operacao,
    pagto,
    cliente,
    documentoCliente: cedenteDoc,
    sacado,
    documentoSacado: sacadoDoc,
    ua,
    fundoTipo,
    produto,
    sigla,
    numero,
    cadastro,
    emissao,
    vencimento,
    vencimentoEfetivo,
    vencido,
    situacao,
    dataSituacao,
    manifesto,
    dataManifesto,
    valorNominal,
    descontoAbatimento,
    valorLiquido,
    valorPago,
    saldoDevedor,
    oscilacao,
    taxa,
    desagio,
    custo,
    receita,
    tarifasOperacao,
    prazoReal,
    prazoCobrado,
    gerente,
    superintendente,
    bancoCobrador
  };
}

/**
 * Consulta a API UNLTD para a data de cadastro informada aplicando os filtros estritos
 */
export async function fetchTitulosAnaliseByDate({ dataCadastro, unltdToken }) {
  if (!unltdToken) {
    throw new Error('Token de autenticação UNLTD (UNLTD_API_TOKEN) não configurado no servidor.');
  }

  if (!dataCadastro || !/^\d{4}-\d{2}-\d{2}$/.test(dataCadastro)) {
    throw new Error('Data de cadastro inválida. Use o formato AAAA-MM-DD.');
  }

  const payload = {
    tipoDeData: 'Cadastro',
    dataInicial: `${dataCadastro}T00:00:00`,
    dataFinal: `${dataCadastro}T23:59:59`,
    situacoes: ['Em Aberto']
  };

  const response = await fetch(`${API_BASE_URL}/recebiveis/titulos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `UNLTD-BackEnd ${unltdToken}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Erro na API UNLTD (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawTitulos = Array.isArray(data) ? data : [];

  // Análise diagnóstica detalhada
  let totalNominalBruto = 0;
  const rejectedReasons = { ua: 0, produto: 0, sigla: 0, situacao: 0, manifesto: 0 };
  const rawUas = {};
  const rawProds = {};
  const rawSiglas = {};
  const rawManifs = {};

  rawTitulos.forEach(t => {
    const v = Number(t.valorNominal || t.valor_nominal_original || t.valor || 0);
    totalNominalBruto += v;

    const uaStr = extractText(
      t.contaOperacional?.unidadeAdministrativa?.alias ||
      t.contaOperacional?.unidadeAdministrativa?.nome ||
      t.unidadeAdministrativa?.nome ||
      t.ua ||
      'VAZIO'
    );
    rawUas[uaStr] = (rawUas[uaStr] || 0) + v;

    const prodStr = extractText(t.contaOperacional?.produto?.descricao || t.contaOperacional?.produto?.sigla || t.produto || 'VAZIO');
    rawProds[prodStr] = (rawProds[prodStr] || 0) + v;

    const sigStr = extractText(t.sigla || t.tipoDocumento || t.especie || 'VAZIO');
    rawSiglas[sigStr] = (rawSiglas[sigStr] || 0) + v;

    const manStr = extractText(t.situacaoManifesto || t.manifesto || 'VAZIO');
    rawManifs[manStr] = (rawManifs[manStr] || 0) + v;

    if (!getUnidadeAdministrativaInfo(t)) rejectedReasons.ua += v;
    else if (!isProdutoValido(t)) rejectedReasons.produto += v;
    else if (!isSiglaValida(t)) rejectedReasons.sigla += v;
    else if (!isSituacaoValida(t)) rejectedReasons.situacao += v;
    else if (!isManifestoValido(t)) rejectedReasons.manifesto += v;
  });

  console.log(`\n=================== DIAGNÓSTICO CONFIRMAÇÃO (${dataCadastro}) ===================`);
  console.log(`[UNLTD API] Total títulos brutos retornados: ${rawTitulos.length}`);
  console.log(`[UNLTD API] Valor Nominal Bruto total: R$ ${totalNominalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log('[UNLTD API] Rejeitados por categoria (Valores Nominais):', JSON.stringify(rejectedReasons, null, 2));
  console.log('========================================================================\n');

  // 1. Aplica filtros estritos das prints do Bitfin
  const filteredRaw = rawTitulos.filter(isTituloValidoParaAnalise);

  // 2. Normaliza para o modelo canônico de 36 colunas
  const normalized = filteredRaw.map(normalizeTituloRecord);

  // Calcula estatísticas gerais
  const totalTitulos = normalized.length;
  const totalNominal = normalized.reduce((acc, t) => acc + t.valorNominal, 0);
  const totalLiquido = normalized.reduce((acc, t) => acc + t.valorLiquido, 0);
  const totalReceita = normalized.reduce((acc, t) => acc + t.receita, 0);

  const msTitulos = normalized.filter(t => t.fundoTipo === 'MULTISETORIAL');
  const specialTitulos = normalized.filter(t => t.fundoTipo === 'SPECIAL');

  return {
    dataCadastro,
    totalTitulos,
    totalNominal,
    totalLiquido,
    totalReceita,
    qtdMs: msTitulos.length,
    valorMs: msTitulos.reduce((acc, t) => acc + t.valorNominal, 0),
    qtdSpecial: specialTitulos.length,
    valorSpecial: specialTitulos.reduce((acc, t) => acc + t.valorNominal, 0),
    debugInfo: {
      rawCount: rawTitulos.length,
      totalNominalBruto,
      sampleOfficial: rawTitulos.find(t => t.id === 135891 || t.id === '135891'),
      sampleExtra: rawTitulos.find(t => t.id === 136242 || t.id === '136242' || t.id === 136238 || t.id === '136238'),
      rawUas,
      rawProds,
      rawSiglas,
      rawManifs,
      rejectedReasons
    },
    titulos: normalized
  };
}

/**
 * Cabeçalhos exatos oficiais do CSV (36 colunas)
 */
export const CSV_HEADERS = [
  'ID',
  'OPERACAO',
  'PAGTO',
  'CLIENTE',
  'DOCUMENTO',
  'SACADO',
  'DOCUMENTO',
  'UA',
  'PRODUTO',
  'SIGLA',
  'NUMERO',
  'CADASTRO',
  'EMISSAO',
  'VENCIMENTO',
  'VENCIMENTO EFETIVO',
  'VENCIDO',
  'SITUACAO',
  'DATA SITUACAO',
  'MANIFESTO',
  'DATA MANIFESTO',
  'VALOR NOMINAL',
  'DESCONTO ABATIMENTO',
  'VALOR LIQUIDO',
  'VALOR PAGO',
  'SALDO DEVEDOR',
  'OSCILACAO',
  'TAXA',
  'DESAGIO',
  'CUSTO',
  'RECEITA',
  'TARIFAS OPERACAO',
  'PRAZO REAL',
  'PRAZO COBRADO',
  'GERENTE',
  'SUPERINTENDENTE',
  'BANCO COBRADOR'
];

/**
 * Gera a string CSV idêntica ao padrão oficial do sistema
 */
export function generateTitulosCsv({ titulos, fundo = 'AMBOS' }) {
  let filtered = titulos || [];
  if (fundo === 'MULTISETORIAL' || fundo === 'MS') {
    filtered = filtered.filter(t => t.fundoTipo === 'MULTISETORIAL');
  } else if (fundo === 'SPECIAL') {
    filtered = filtered.filter(t => t.fundoTipo === 'SPECIAL');
  }

  const lines = [];
  lines.push(CSV_HEADERS.join(';'));

  for (const t of filtered) {
    const row = [
      t.id,
      t.operacao,
      t.pagto,
      t.cliente,
      t.documentoCliente ? `="${t.documentoCliente}"` : '',
      t.sacado,
      t.documentoSacado ? `="${t.documentoSacado}"` : '',
      t.ua,
      t.produto,
      t.sigla,
      t.numero ? `="${t.numero}"` : '',
      t.cadastro,
      t.emissao,
      t.vencimento,
      t.vencimentoEfetivo,
      t.vencido,
      t.situacao,
      t.dataSituacao,
      t.manifesto,
      t.dataManifesto,
      formatNumberPtBr(t.valorNominal, 2, 2),
      formatNumberPtBr(t.descontoAbatimento, 2, 2),
      formatNumberPtBr(t.valorLiquido, 2, 2),
      formatNumberPtBr(t.valorPago, 2, 2),
      formatNumberPtBr(t.saldoDevedor, 2, 2),
      formatNumberPtBr(t.oscilacao, 2, 2),
      formatNumberPtBr(t.taxa, 5, 5),
      formatNumberPtBr(t.desagio, 2, 2),
      formatNumberPtBr(t.custo, 2, 2),
      formatNumberPtBr(t.receita, 2, 2),
      formatNumberPtBr(t.tarifasOperacao, 2, 2),
      formatNumberPtBr(t.prazoReal, 2, 2),
      formatNumberPtBr(t.prazoCobrado, 2, 2),
      t.gerente,
      t.superintendente,
      t.bancoCobrador
    ];

    lines.push(row.join(';') + ';');
  }

  return lines.join('\r\n');
}

/**
 * Gera um arquivo Excel (.xlsx) usando ExcelJS
 */
export async function generateTitulosExcel({ titulos, fundo = 'AMBOS', dataCadastro }) {
  let filtered = titulos || [];
  if (fundo === 'MULTISETORIAL' || fundo === 'MS') {
    filtered = filtered.filter(t => t.fundoTipo === 'MULTISETORIAL');
  } else if (fundo === 'SPECIAL') {
    filtered = filtered.filter(t => t.fundoTipo === 'SPECIAL');
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Lepta Capital - Análise de Confirmação';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(
    fundo === 'SPECIAL' ? 'Lepta Special FIDC' : fundo === 'MULTISETORIAL' ? 'Lepta MS FIDC' : 'Titulos Geral'
  );

  worksheet.columns = CSV_HEADERS.map(header => ({
    header,
    key: header.replace(/[^A-Za-z0-9]/g, '_').toLowerCase(),
    width: Math.max(header.length + 4, 14)
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }
  };

  for (const t of filtered) {
    worksheet.addRow({
      id: t.id,
      operacao: t.operacao,
      pagto: t.pagto,
      cliente: t.cliente,
      documento: t.documentoCliente,
      sacado: t.sacado,
      documento_1: t.documentoSacado,
      ua: t.ua,
      produto: t.produto,
      sigla: t.sigla,
      numero: t.numero,
      cadastro: t.cadastro,
      emissao: t.emissao,
      vencimento: t.vencimento,
      vencimento_efetivo: t.vencimentoEfetivo,
      vencido: t.vencido,
      situacao: t.situacao,
      data_situacao: t.dataSituacao,
      manifesto: t.manifesto,
      data_manifesto: t.dataManifesto,
      valor_nominal: t.valorNominal,
      desconto_abatimento: t.descontoAbatimento,
      valor_liquido: t.valorLiquido,
      valor_pago: t.valorPago,
      saldo_devedor: t.saldoDevedor,
      oscilacao: t.oscilacao,
      taxa: t.taxa,
      desagio: t.desagio,
      custo: t.custo,
      receita: t.receita,
      tarifas_operacao: t.tarifasOperacao,
      prazo_real: t.prazoReal,
      prazo_cobrado: t.prazoCobrado,
      gerente: t.gerente,
      superintendente: t.superintendente,
      banco_cobrador: t.bancoCobrador
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

export function createShareToken({ dataCadastro, fundo = 'AMBOS', titulos }) {
  const token = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 3600 * 1000;

  const data = {
    dataCadastro,
    fundo,
    titulos: titulos || [],
    createdAt: now,
    expiresAt
  };

  shareTokensCache.set(token, data);
  return token;
}

export function getSharedDataByToken(token) {
  if (!token) return null;
  const data = shareTokensCache.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    shareTokensCache.delete(token);
    return null;
  }
  return data;
}

export function generateAnaliseHtmlReport({ dataCadastro, fundo = 'AMBOS', titulos }) {
  let filtered = titulos || [];
  if (fundo === 'MULTISETORIAL' || fundo === 'MS') {
    filtered = filtered.filter(t => t.fundoTipo === 'MULTISETORIAL');
  } else if (fundo === 'SPECIAL') {
    filtered = filtered.filter(t => t.fundoTipo === 'SPECIAL');
  }

  const totalTitulos = filtered.length;
  const totalNominal = filtered.reduce((acc, t) => acc + t.valorNominal, 0);
  const totalLiquido = filtered.reduce((acc, t) => acc + t.valorLiquido, 0);
  const totalReceita = filtered.reduce((acc, t) => acc + t.receita, 0);

  const tituloFundo = fundo === 'SPECIAL' ? 'Lepta Special FIDC' : fundo === 'MULTISETORIAL' ? 'Lepta MS FIDC' : 'Lepta FIDC - Visão Geral';

  const rowsHtml = filtered.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.operacao}</td>
      <td><strong>${t.cliente}</strong><br><small>${t.documentoCliente}</small></td>
      <td>${t.sacado}<br><small>${t.documentoSacado}</small></td>
      <td><span class="badge ${t.fundoTipo.toLowerCase()}">${t.ua}</span></td>
      <td>${t.produto} - ${t.sigla}</td>
      <td>${t.numero}</td>
      <td>${t.cadastro}</td>
      <td>${t.vencimento}</td>
      <td class="num font-bold">R$ ${formatNumberPtBr(t.valorNominal)}</td>
      <td class="num">R$ ${formatNumberPtBr(t.valorLiquido)}</td>
      <td><span class="status-tag">${t.manifesto}</span></td>
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Análise de Confirmação - ${tituloFundo}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
        .h-title { font-size: 24px; font-weight: 800; color: #38bdf8; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .kpi { background: #1e293b; padding: 16px; border-radius: 8px; border: 1px solid #334155; }
        .kpi-label { font-size: 12px; color: #94a3b8; font-weight: 600; }
        .kpi-val { font-size: 20px; font-weight: 800; color: #f1f5f9; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 8px; overflow: hidden; font-size: 13px; }
        th { background: #0f172a; color: #94a3b8; padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
        td { padding: 10px 12px; border-bottom: 1px solid #334155; color: #cbd5e1; }
        .num { text-align: right; }
        .font-bold { font-weight: 700; color: #f8fafc; }
        .badge { padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .badge.multisetorial { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
        .badge.special { background: rgba(168, 85, 247, 0.2); color: #c084fc; }
        .status-tag { background: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 4px; font-size: 11px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="h-title">${tituloFundo}</div>
          <p style="margin:4px 0 0 0; color:#94a3b8;">Data de Cadastro: <strong>${formatDatePtBr(dataCadastro)}</strong></p>
        </div>
        <div style="font-size:12px; color:#64748b;">Lepta Capital System</div>
      </div>

      <div class="kpi-grid">
        <div class="kpi">
          <div class="kpi-label">TOTAL TÍTULOS</div>
          <div class="kpi-val">${totalTitulos}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">VALOR NOMINAL TOTAL</div>
          <div class="kpi-val" style="color:#4ade80;">R$ ${formatNumberPtBr(totalNominal)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">VALOR LÍQUIDO TOTAL</div>
          <div class="kpi-val" style="color:#38bdf8;">R$ ${formatNumberPtBr(totalLiquido)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">RECEITA ESTIMADA</div>
          <div class="kpi-val" style="color:#c084fc;">R$ ${formatNumberPtBr(totalReceita)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>OP.</th>
            <th>CLIENTE / CEDENTE</th>
            <th>SACADO</th>
            <th>UA</th>
            <th>PROD.</th>
            <th>NÚMERO</th>
            <th>CADASTRO</th>
            <th>VENCIMENTO</th>
            <th class="num">NOMINAL</th>
            <th class="num">LÍQUIDO</th>
            <th>MANIFESTO</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </body>
    </html>
  `;
}
