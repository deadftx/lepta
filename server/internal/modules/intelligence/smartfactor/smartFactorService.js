/**
 * Service para Consulta SmartFactor (Histórico Legado de Títulos e Operações)
 */

export function getSmartFactorCedentes(db) {
  return db.prepare(`
    SELECT DISTINCT CLIENTE as nome, DOCUMENTO as cnpj, COUNT(*) as totalTitulos, SUM(VALOR_NOMINAL) as totalVolume
    FROM BASE_SMARTFACTOR
    WHERE CLIENTE IS NOT NULL AND TRIM(CLIENTE) != ''
    GROUP BY CLIENTE
    ORDER BY CLIENTE ASC
  `).all();
}

export function searchSmartFactorTitles(db, filters = {}) {
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
    whereClauses.push('(LOWER(CLIENTE) LIKE ? OR DOCUMENTO LIKE ?)');
    params.push(term, term);
  }

  if (sacado && sacado.trim()) {
    const term = `%${sacado.trim().toLowerCase()}%`;
    whereClauses.push('(LOWER(SACADO) LIKE ? OR DOCUMENTO_SACADO LIKE ?)');
    params.push(term, term);
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
    whereClauses.push('LOWER(SITUACAO) = ?');
    params.push(situacao.trim().toLowerCase());
  }

  if (valorMin && !isNaN(parseFloat(valorMin))) {
    whereClauses.push('VALOR_NOMINAL >= ?');
    params.push(parseFloat(valorMin));
  }

  if (valorMax && !isNaN(parseFloat(valorMax))) {
    whereClauses.push('VALOR_NOMINAL <= ?');
    params.push(parseFloat(valorMax));
  }

  // Conversão de datas DD/MM/YYYY para comparação YYYY-MM-DD
  const dateToIsoExpr = (colName) => `(substr(${colName}, 7, 4) || '-' || substr(${colName}, 4, 2) || '-' || substr(${colName}, 1, 2))`;

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

  const kpis = db.prepare(kpisQuery).get(...params);

  // Listagem de títulos com limite e offset
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
}
