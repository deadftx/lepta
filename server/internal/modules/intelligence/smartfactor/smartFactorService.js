import fs from 'fs';
import path from 'path';
import readline from 'readline';

/**
 * Service para Consulta SmartFactor (Histórico Legado de Títulos e Operações)
 */

export function ensureSmartFactorTable(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS BASE_SMARTFACTOR (
        ID TEXT PRIMARY KEY,
        OPERACAO TEXT,
        PAGTO TEXT,
        CLIENTE TEXT,
        DOCUMENTO TEXT,
        SACADO TEXT,
        DOCUMENTO_SACADO TEXT,
        UA TEXT DEFAULT 'SmartFactor',
        PRODUTO TEXT,
        SIGLA TEXT,
        NUMERO TEXT,
        CADASTRO TEXT,
        EMISSAO TEXT,
        VENCIMENTO TEXT,
        VENCIMENTO_EFETIVO TEXT,
        VENCIDO TEXT,
        SITUACAO TEXT,
        DATA_SITUACAO TEXT,
        VALOR_NOMINAL REAL DEFAULT 0,
        DESCONTO_ABATIMENTO REAL DEFAULT 0,
        VALOR_LIQUIDO REAL DEFAULT 0,
        VALOR_PAGO REAL DEFAULT 0,
        SALDO_DEVEDOR REAL DEFAULT 0,
        TAXA REAL DEFAULT 0,
        DESAGIO REAL DEFAULT 0,
        TARIFAS_OPERACAO REAL DEFAULT 0,
        PRAZO_REAL REAL DEFAULT 0,
        PRAZO_COBRADO REAL DEFAULT 0,
        BANCO_COBRADOR TEXT,
        SETOR_CEDENTE TEXT,
        GRUPO_ECONOMICO TEXT,
        CIDADE_SACADO TEXT,
        UF_SACADO TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sf_cliente ON BASE_SMARTFACTOR (CLIENTE);
      CREATE INDEX IF NOT EXISTS idx_sf_documento ON BASE_SMARTFACTOR (DOCUMENTO);
      CREATE INDEX IF NOT EXISTS idx_sf_sacado ON BASE_SMARTFACTOR (SACADO);
      CREATE INDEX IF NOT EXISTS idx_sf_vencimento ON BASE_SMARTFACTOR (VENCIMENTO);
      CREATE INDEX IF NOT EXISTS idx_sf_situacao ON BASE_SMARTFACTOR (SITUACAO);
      CREATE INDEX IF NOT EXISTS idx_sf_data_situacao ON BASE_SMARTFACTOR (DATA_SITUACAO);
    `);
  } catch (err) {
    console.error('[SMARTFACTOR] Erro ao garantir schema de BASE_SMARTFACTOR:', err.message);
  }
}

export function getSmartFactorCedentes(db) {
  ensureSmartFactorTable(db);
  try {
    return db.prepare(`
      SELECT DISTINCT CLIENTE as nome, DOCUMENTO as cnpj, COUNT(*) as totalTitulos, SUM(VALOR_NOMINAL) as totalVolume
      FROM BASE_SMARTFACTOR
      WHERE CLIENTE IS NOT NULL AND TRIM(CLIENTE) != ''
      GROUP BY CLIENTE
      ORDER BY CLIENTE ASC
    `).all();
  } catch (err) {
    console.error('[SMARTFACTOR] Erro ao buscar cedentes:', err.message);
    return [];
  }
}

// Conversão robusta de datas: suporta tanto DD/MM/YYYY quanto YYYY-MM-DD
const dateToIsoExpr = (colName) => `
  CASE 
    WHEN ${colName} IS NULL OR ${colName} = '' THEN '9999-99-99'
    WHEN instr(${colName}, '/') > 0 THEN (substr(${colName}, 7, 4) || '-' || substr(${colName}, 4, 2) || '-' || substr(${colName}, 1, 2))
    ELSE ${colName}
  END
`;

export function searchSmartFactorTitles(db, filters = {}) {
  ensureSmartFactorTable(db);

  const {
    cedente = '',
    sacado = '',
    numero = '',
    operacao = '',
    situacao = '',
    valorMin = '',
    valorMax = '',
    dataOpDe = '',
    dataOpAte = '',
    vencDe = '',
    vencAte = '',
    liqDe = '',
    liqAte = '',
    limit = 500,
    offset = 0
  } = filters;

  const whereClauses = ['1=1'];
  const params = [];

  if (cedente && cedente.trim()) {
    const term = `%${cedente.trim().toLowerCase()}%`;
    const docClean = cedente.replace(/\D/g, '');
    if (docClean.length >= 4) {
      whereClauses.push('(LOWER(CLIENTE) LIKE ? OR DOCUMENTO LIKE ? OR REPLACE(REPLACE(REPLACE(DOCUMENTO, ".", ""), "/", ""), "-", "") LIKE ?)');
      params.push(term, `%${cedente.trim()}%`, `%${docClean}%`);
    } else {
      whereClauses.push('(LOWER(CLIENTE) LIKE ? OR DOCUMENTO LIKE ?)');
      params.push(term, term);
    }
  }

  if (sacado && sacado.trim()) {
    const term = `%${sacado.trim().toLowerCase()}%`;
    const docClean = sacado.replace(/\D/g, '');
    if (docClean.length >= 4) {
      whereClauses.push('(LOWER(SACADO) LIKE ? OR DOCUMENTO_SACADO LIKE ? OR REPLACE(REPLACE(REPLACE(DOCUMENTO_SACADO, ".", ""), "/", ""), "-", "") LIKE ?)');
      params.push(term, `%${sacado.trim()}%`, `%${docClean}%`);
    } else {
      whereClauses.push('(LOWER(SACADO) LIKE ? OR DOCUMENTO_SACADO LIKE ?)');
      params.push(term, term);
    }
  }

  if (numero && numero.trim()) {
    const term = `%${numero.trim().toLowerCase()}%`;
    whereClauses.push('(LOWER(NUMERO) LIKE ? OR BANCO_COBRADOR LIKE ?)');
    params.push(term, term);
  }

  if (operacao && operacao.trim()) {
    whereClauses.push('OPERACAO = ?');
    params.push(operacao.trim());
  }

  if (situacao && situacao.trim()) {
    whereClauses.push('LOWER(SITUACAO) LIKE ?');
    params.push(`%${situacao.trim().toLowerCase()}%`);
  }

  if (valorMin && !isNaN(parseFloat(valorMin))) {
    whereClauses.push('VALOR_NOMINAL >= ?');
    params.push(parseFloat(valorMin));
  }

  if (valorMax && !isNaN(parseFloat(valorMax))) {
    whereClauses.push('VALOR_NOMINAL <= ?');
    params.push(parseFloat(valorMax));
  }

  if (dataOpDe) {
    whereClauses.push(`${dateToIsoExpr('EMISSAO')} >= ?`);
    params.push(dataOpDe);
  }
  if (dataOpAte) {
    whereClauses.push(`${dateToIsoExpr('EMISSAO')} <= ?`);
    params.push(dataOpAte);
  }

  if (vencDe) {
    whereClauses.push(`${dateToIsoExpr('VENCIMENTO')} >= ?`);
    params.push(vencDe);
  }
  if (vencAte) {
    whereClauses.push(`${dateToIsoExpr('VENCIMENTO')} <= ?`);
    params.push(vencAte);
  }

  if (liqDe) {
    whereClauses.push(`DATA_SITUACAO IS NOT NULL AND DATA_SITUACAO != '' AND ${dateToIsoExpr('DATA_SITUACAO')} >= ?`);
    params.push(liqDe);
  }
  if (liqAte) {
    whereClauses.push(`DATA_SITUACAO IS NOT NULL AND DATA_SITUACAO != '' AND ${dateToIsoExpr('DATA_SITUACAO')} <= ?`);
    params.push(liqAte);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;
  const today = new Date().toISOString().split('T')[0];

  // Agregações e KPIs de Resumo
  const kpisQuery = `
    SELECT
      COUNT(*) as totalTitulos,
      SUM(COALESCE(VALOR_NOMINAL, 0)) as totalValorNominal,
      SUM(COALESCE(VALOR_LIQUIDO, 0)) as totalValorLiquido,
      SUM(COALESCE(VALOR_PAGO, 0)) as totalValorPago,
      SUM(COALESCE(DESAGIO, 0)) as totalDesagio,
      SUM(COALESCE(TARIFAS_OPERACAO, 0)) as totalTarifas,
      -- Regra estrita de Vencidos: Somente se ABERTO/NÃO QUITADO e vencimento no passado
      SUM(CASE 
        WHEN LOWER(SITUACAO) NOT LIKE '%quit%' AND LOWER(SITUACAO) NOT LIKE '%liq%' AND ${dateToIsoExpr('VENCIMENTO')} < '${today}' 
        THEN VALOR_NOMINAL 
        ELSE 0 
      END) as totalValorVencido,
      COUNT(CASE 
        WHEN LOWER(SITUACAO) NOT LIKE '%quit%' AND LOWER(SITUACAO) NOT LIKE '%liq%' AND ${dateToIsoExpr('VENCIMENTO')} < '${today}' 
        THEN 1 
      END) as totalQtdVencido,
      -- Liquidado / Quitado
      SUM(CASE 
        WHEN LOWER(SITUACAO) LIKE '%quit%' OR LOWER(SITUACAO) LIKE '%liq%' 
        THEN VALOR_PAGO 
        ELSE 0 
      END) as totalValorLiquidado,
      COUNT(CASE 
        WHEN LOWER(SITUACAO) LIKE '%quit%' OR LOWER(SITUACAO) LIKE '%liq%' 
        THEN 1 
      END) as totalQtdLiquidado,
      -- Em Aberto
      SUM(CASE 
        WHEN LOWER(SITUACAO) NOT LIKE '%quit%' AND LOWER(SITUACAO) NOT LIKE '%liq%' 
        THEN VALOR_NOMINAL 
        ELSE 0 
      END) as totalValorAberto,
      COUNT(CASE 
        WHEN LOWER(SITUACAO) NOT LIKE '%quit%' AND LOWER(SITUACAO) NOT LIKE '%liq%' 
        THEN 1 
      END) as totalQtdAberto
    FROM BASE_SMARTFACTOR
    ${whereSql}
  `;

  try {
    const kpis = db.prepare(kpisQuery).get(...params) || {};

    const titlesQuery = `
      SELECT *
      FROM BASE_SMARTFACTOR
      ${whereSql}
      ORDER BY ${dateToIsoExpr('EMISSAO')} DESC, ID DESC
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(titlesQuery).all(...params, limit, offset);

    return {
      kpis: {
        totalTitulos: Number(kpis.totalTitulos || 0),
        totalValorNominal: Number(kpis.totalValorNominal || 0),
        totalValorLiquido: Number(kpis.totalValorLiquido || 0),
        totalValorPago: Number(kpis.totalValorPago || 0),
        totalDesagio: Number(kpis.totalDesagio || 0),
        totalTarifas: Number(kpis.totalTarifas || 0),
        totalValorVencido: Number(kpis.totalValorVencido || 0),
        totalQtdVencido: Number(kpis.totalQtdVencido || 0),
        totalValorLiquidado: Number(kpis.totalValorLiquidado || 0),
        totalQtdLiquidado: Number(kpis.totalQtdLiquidado || 0),
        totalValorAberto: Number(kpis.totalValorAberto || 0),
        totalQtdAberto: Number(kpis.totalQtdAberto || 0)
      },
      titles: rows,
      totalRecords: Number(kpis.totalTitulos || 0)
    };
  } catch (err) {
    console.error('[SMARTFACTOR] Erro na consulta:', err.message);
    return {
      kpis: {
        totalTitulos: 0,
        totalValorNominal: 0,
        totalValorLiquido: 0,
        totalValorPago: 0,
        totalDesagio: 0,
        totalTarifas: 0,
        totalValorVencido: 0,
        totalQtdVencido: 0,
        totalValorLiquidado: 0,
        totalQtdLiquidado: 0,
        totalValorAberto: 0,
        totalQtdAberto: 0
      },
      titles: [],
      totalRecords: 0
    };
  }
}
