import ExcelJS from 'exceljs';
import crypto from 'crypto';

const API_BASE_URL = 'https://lepta-backend.bit-unltd.com.br';

// Cache em memória para links compartilhados (tokens de acesso público)
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
function normalizeStr(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const ALLOWED_SIGLAS = new Set(['DM', 'DS']);

// Manifestos bloqueados (desmarcados / roxos na tela do Bitfin)
const DISALLOWED_MANIFESTOS = [
  'transacao desconhecida',
  'lastro inconsistente',
  'transacao nao concluida',
  'protestado'
];

/**
 * Valida se o título atende a todos os critérios restritivos do módulo de confirmação
 */
export function isTituloValidoParaAnalise(t) {
  // 1. SIGLA: somente DM (Duplicata Mercantil) e DS (Duplicata de Serviço)
  const rawSigla = (t.tipoDocumento?.sigla || t.especie?.sigla || t.sigla || t.tipo || '').trim().toUpperCase();
  if (rawSigla && !ALLOWED_SIGLAS.has(rawSigla)) {
    return false;
  }

  // 2. PRODUTO: somente FAT (Faturização)
  const rawProduto = (t.produto?.sigla || t.produto || '').trim().toUpperCase();
  if (rawProduto && !rawProduto.includes('FAT')) {
    return false;
  }

  // 3. SITUAÇÃO: somente Em Aberto / Aberto
  const situacao = normalizeStr(t.situacao || 'em aberto');
  if (!situacao.includes('aberto') || situacao.includes('liquidado') || situacao.includes('baixado')) {
    return false;
  }

  // 4. MANIFESTO: somente os manifestos ativos (rejeita os roxos/desmarcados)
  const manifesto = normalizeStr(t.manifesto || t.situacaoManifesto || 'sem atuacao');
  for (const disallowed of DISALLOWED_MANIFESTOS) {
    if (manifesto.includes(disallowed)) {
      return false;
    }
  }

  return true;
}

/**
 * Normaliza e enriquece um título da API UNLTD para a estrutura canônica dos 36 campos
 */
export function normalizeTituloRecord(t) {
  const rawUa = (
    t.contaOperacional?.unidadeAdministrativa?.nome ||
    t.contaOperacional?.unidadeAdministrativa?.alias ||
    t.unidadeAdministrativa?.nome ||
    t.unidadeAdministrativa?.alias ||
    t.ua ||
    ''
  ).trim();

  // Determina se é MS FIDC ou Special FIDC
  let ua = rawUa;
  let fundoTipo = 'MULTISETORIAL';
  if (/special/i.test(rawUa) || /special/i.test(t.fundo) || /special/i.test(t.fundo_id)) {
    ua = 'Lepta Special FIDC';
    fundoTipo = 'SPECIAL';
  } else {
    ua = 'Lepta MS FIDC';
    fundoTipo = 'MULTISETORIAL';
  }

  const cedenteDoc = String(t.contaOperacional?.cliente?.entidade?.documento || t.cliente?.documento || t.cedente_cnpj || '').replace(/\D/g, '');
  const sacadoDoc = String(t.sacado?.entidade?.documento || t.sacado?.documento || t.sacado_cnpj || '').replace(/\D/g, '');

  const id = t.id || '';
  const operacao = t.operacao?.id || t.operacaoId || t.operacao?.numero || t.operacao || '';
  const pagto = t.pagamentoOperacional?.id || t.pagamentoId || t.pagto || '';
  const cliente = (t.contaOperacional?.cliente?.entidade?.nome || t.cliente?.nome || t.cedente_nome || '').trim();
  const sacado = (t.sacado?.entidade?.nome || t.sacado?.nome || t.sacado_nome || '').trim();
  const produto = (t.produto?.sigla || t.produto || 'FAT').toUpperCase();
  const sigla = (t.tipoDocumento?.sigla || t.especie?.sigla || t.sigla || 'DM').toUpperCase();
  const numero = String(t.numero || t.numero_titulo || '').trim();

  const cadastro = formatDatePtBr(t.dataDeCadastro || t.cadastro || t.data_cadastro);
  const emissao = formatDatePtBr(t.dataDeEmissao || t.emissao || t.data_emissao);
  const vencimento = formatDatePtBr(t.dataDeVencimento || t.vencimento || t.data_vencimento);
  const vencimentoEfetivo = formatDatePtBr(t.dataDeVencimentoEfetivo || t.vencimentoEfetivo || t.dataDeVencimento || t.vencimento);

  const vencido = t.vencido === true || String(t.vencido).toLowerCase() === 'sim' ? 'Sim' : 'Nao';
  const situacao = t.situacao || 'Em Aberto';
  const dataSituacao = formatDatePtBr(t.dataDaSituacao || t.dataSituacao || t.dataDeCadastro || t.cadastro);
  const manifesto = t.manifesto || t.situacaoManifesto || 'Sem Atuacao';
  const dataManifesto = formatDatePtBr(t.dataDoManifesto || t.dataManifesto || t.dataDeCadastro || t.cadastro);

  const valorNominal = Number(t.valorNominal || t.valor_nominal_original || t.valor || 0);
  const descontoAbatimento = Number(t.descontoAbatimento || t.abatimento || 0);
  const valorLiquido = Number(t.valorLiquido || t.valor_liquido || (valorNominal - descontoAbatimento));
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

  const gerente = (t.gerente?.nome || t.contaOperacional?.gerente?.nome || t.gerente || '').trim();
  const superintendente = (t.superintendente?.nome || t.contaOperacional?.superintendente?.nome || t.superintendente || 'Sebastiao Neto').trim();
  const bancoCobrador = (t.bancoCobrador || t.cobranca?.banco || t.contaBancaria?.banco || '').trim();

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
    dataInicial: `${dataCadastro}T00:00:00.000Z`,
    dataFinal: `${dataCadastro}T23:59:59.999Z`,
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
  
  // 1. Aplica filtros estritos de negócio
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
  // Cabeçalho sem ponto e vírgula final
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

    // Adiciona ponto e vírgula final conforme padrão dos arquivos exportados
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

  // Define colunas
  worksheet.columns = CSV_HEADERS.map(header => ({
    header,
    key: header.replace(/[^A-Za-z0-9]/g, '_').toLowerCase(),
    width: Math.max(header.length + 4, 14)
  }));

  // Estiliza cabeçalho
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F172A' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Adiciona linhas
  for (const t of filtered) {
    worksheet.addRow([
      t.id,
      t.operacao,
      t.pagto,
      t.cliente,
      t.documentoCliente,
      t.sacado,
      t.documentoSacado,
      t.ua,
      t.produto,
      t.sigla,
      t.numero,
      t.cadastro,
      t.emissao,
      t.vencimento,
      t.vencimentoEfetivo,
      t.vencido,
      t.situacao,
      t.dataSituacao,
      t.manifesto,
      t.dataManifesto,
      t.valorNominal,
      t.descontoAbatimento,
      t.valorLiquido,
      t.valorPago,
      t.saldoDevedor,
      t.oscilacao,
      t.taxa,
      t.desagio,
      t.custo,
      t.receita,
      t.tarifasOperacao,
      t.prazoReal,
      t.prazoCobrado,
      t.gerente,
      t.superintendente,
      t.bancoCobrador
    ]);
  }

  // Formata colunas numéricas
  const currencyCols = [21, 22, 23, 24, 25, 26, 28, 29, 30, 31];
  currencyCols.forEach(colIdx => {
    worksheet.getColumn(colIdx).numFmt = 'R$ #,##0.00;[Red]-R$ #,##0.00;"R$ 0.00"';
  });
  worksheet.getColumn(27).numFmt = '#,##0.00000'; // Taxa
  worksheet.getColumn(32).numFmt = '#,##0.00'; // Prazo Real
  worksheet.getColumn(33).numFmt = '#,##0.00'; // Prazo Cobrado

  return await workbook.xlsx.writeBuffer();
}

/**
 * Cria ou recupera um token de compartilhamento público
 */
export function createShareToken({ dataCadastro, fundo = 'AMBOS', titulos }) {
  const token = crypto.randomBytes(16).toString('hex');
  const createdAt = Date.now();
  const expiresAt = createdAt + (7 * 24 * 60 * 60 * 1000); // 7 dias de validade

  shareTokensCache.set(token, {
    token,
    dataCadastro,
    fundo,
    titulos,
    createdAt,
    expiresAt
  });

  return token;
}

export function getSharedDataByToken(token) {
  const data = shareTokensCache.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    shareTokensCache.delete(token);
    return null;
  }
  return data;
}

/**
 * Gera relatório HTML público, responsivo e interativo para compartilhamento
 */
export function generateAnaliseHtmlReport({ titulos, dataCadastro, fundo = 'AMBOS', shareToken }) {
  let filtered = titulos || [];
  if (fundo === 'MULTISETORIAL' || fundo === 'MS') {
    filtered = filtered.filter(t => t.fundoTipo === 'MULTISETORIAL');
  } else if (fundo === 'SPECIAL') {
    filtered = filtered.filter(t => t.fundoTipo === 'SPECIAL');
  }

  const totalNominal = filtered.reduce((acc, t) => acc + t.valorNominal, 0);
  const totalLiquido = filtered.reduce((acc, t) => acc + t.valorLiquido, 0);
  const totalReceita = filtered.reduce((acc, t) => acc + t.receita, 0);
  const totalQtd = filtered.length;

  const dataFmt = formatDatePtBr(dataCadastro);
  const fundoNome = fundo === 'SPECIAL' ? 'Lepta Special FIDC' : fundo === 'MULTISETORIAL' ? 'Lepta Multisorial FIDC' : 'Geral (Todos os Fundos)';

  const tableRows = filtered.map((t, idx) => `
    <tr>
      <td style="text-align: center; color: #64748b;">${idx + 1}</td>
      <td style="font-weight: 700; color: #38bdf8;">${t.numero || '-'}</td>
      <td style="font-weight: 600;">${t.cliente || '-'}</td>
      <td style="font-size: 0.76rem; color: #94a3b8;">${t.documentoCliente || '-'}</td>
      <td>${t.sacado || '-'}</td>
      <td>
        <span class="badge ${t.fundoTipo === 'SPECIAL' ? 'badge-special' : 'badge-multi'}">
          ${t.ua}
        </span>
      </td>
      <td>${t.vencimento || '-'}</td>
      <td style="text-align: right; font-weight: 700;">R$ ${formatNumberPtBr(t.valorNominal)}</td>
      <td style="text-align: right; color: #38bdf8;">R$ ${formatNumberPtBr(t.valorLiquido)}</td>
      <td style="text-align: right; color: #4ade80; font-weight: 700;">R$ ${formatNumberPtBr(t.receita)}</td>
      <td style="text-align: right;">${formatNumberPtBr(t.taxa, 4, 4)}%</td>
      <td style="text-align: center;">
        <span class="badge ${t.situacao === 'Liquidado' ? 'badge-success' : 'badge-warning'}">${t.situacao}</span>
      </td>
      <td>${t.gerente || '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Análise de Confirmação — ${dataFmt} — LEPTA CAPITAL</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #0f172a;
      --border: #1e293b;
      --text: #f8fafc;
      --text-dim: #94a3b8;
      --primary: #38bdf8;
      --success: #4ade80;
      --warning: #fbbf24;
      --special: #f59e0b;
      --multi: #38bdf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
      padding: 1.5rem;
      line-height: 1.5;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
      padding-bottom: 1.25rem;
      border-bottom: 1px solid var(--border);
    }
    .brand {
      font-size: 1.35rem;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .brand span { color: var(--primary); }
    .subtitle { font-size: 0.85rem; color: var(--text-dim); }
    .btn-download {
      background: linear-gradient(135deg, #0284c7, #0369a1);
      color: #ffffff;
      border: 1px solid #38bdf8;
      padding: 0.65rem 1.25rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-download:hover {
      background: #0284c7;
      box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .kpi-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .kpi-label { font-size: 0.75rem; text-transform: uppercase; color: var(--text-dim); font-weight: 700; }
    .kpi-val { font-size: 1.35rem; font-weight: 800; color: #fff; }
    .table-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .table-header {
      padding: 1rem 1.25rem;
      background: #090d16;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 700;
      font-size: 0.95rem;
    }
    .table-wrapper {
      overflow-x: auto;
      max-height: 70vh;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.82rem;
      white-space: nowrap;
    }
    th {
      background: #090d16;
      color: var(--text-dim);
      text-align: left;
      padding: 10px 14px;
      font-weight: 700;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    td {
      padding: 9px 14px;
      border-bottom: 1px solid rgba(30, 41, 59, 0.6);
      color: var(--text);
    }
    tr:hover td {
      background: rgba(56, 189, 248, 0.04);
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 0.72rem;
      font-weight: 700;
      border: 1px solid;
    }
    .badge-multi { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: #38bdf8; }
    .badge-special { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: #fbbf24; }
    .badge-success { background: rgba(74, 222, 128, 0.15); color: #4ade80; border-color: #4ade80; }
    .badge-warning { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border-color: #fbbf24; }
    @media (max-width: 768px) {
      body { padding: 0.75rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <div class="brand">LEPTA <span>CAPITAL</span></div>
        <div class="subtitle">Análise de Confirmação — Data de Cadastro: <strong>${dataFmt}</strong> | Fundo: <strong>${fundoNome}</strong></div>
      </div>
      <div>
        <a href="/api/confirmacao/analise/public/${shareToken}?download=xlsx" class="btn-download">
          📥 Baixar Planilha (.xlsx)
        </a>
        <a href="/api/confirmacao/analise/public/${shareToken}?download=csv" class="btn-download" style="margin-left: 6px; background: #334155; border-color: #64748b;">
          📄 Baixar CSV Oficial
        </a>
      </div>
    </header>

    <div class="kpi-grid">
      <div class="kpi-card">
        <span class="kpi-label">Total de Títulos</span>
        <span class="kpi-val">${totalQtd.toLocaleString('pt-BR')}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Valor Nominal Total</span>
        <span class="kpi-val">R$ ${formatNumberPtBr(totalNominal)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Valor Líquido Total</span>
        <span class="kpi-val" style="color: #38bdf8;">R$ ${formatNumberPtBr(totalLiquido)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Receita Apurada</span>
        <span class="kpi-val" style="color: #4ade80;">R$ ${formatNumberPtBr(totalReceita)}</span>
      </div>
    </div>

    <div class="table-card">
      <div class="table-header">
        <span>Títulos Cadastrados (${filtered.length})</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Número</th>
              <th>Cedente (Cliente)</th>
              <th>CNPJ Cedente</th>
              <th>Sacado</th>
              <th>Fundo (UA)</th>
              <th>Vencimento</th>
              <th style="text-align: right;">Valor Nominal</th>
              <th style="text-align: right;">Valor Líquido</th>
              <th style="text-align: right;">Receita</th>
              <th style="text-align: right;">Taxa</th>
              <th style="text-align: center;">Situação</th>
              <th>Gerente</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows.length > 0 ? tableRows : '<tr><td colspan="13" style="text-align:center; padding: 2rem; color: #94a3b8;">Nenhum título encontrado para esta data.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}
