import { getFidcDb } from './fidcDb.js';

// Helpers de datas e números
export function cleanCnpj(val) {
  if (!val) return null;
  return String(val).replace(/\D/g, '') || null;
}

export function cnpjRaiz(cnpj) {
  if (!cnpj) return null;
  return cleanCnpj(cnpj)?.substring(0, 8) || null;
}

export function fmtCnpj(cnpj) {
  if (!cnpj) return '—';
  const raw = cleanCnpj(cnpj) || '';
  if (raw.length === 11) return `${raw.slice(0, 3)}.${raw.slice(3, 6)}.${raw.slice(6, 9)}-${raw.slice(9, 11)}`;
  const c = raw.padStart(14, '0');
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12, 14)}`;
}

export function cdiDiario(cdiAnualPct) {
  return Math.pow(1 + cdiAnualPct / 100, 1 / 252);
}

/**
 * Retorna a lista de fundos e suas classes
 */
export function getFundosAndClasses() {
  const db = getFidcDb();
  const fundos = db.prepare('SELECT * FROM fundos ORDER BY id').all();
  const classes = db.prepare('SELECT * FROM classes ORDER BY fundo_id, id').all();
  return { fundos, classes };
}

/**
 * Resumo do Dashboard para o FIDC selecionado
 */
export function getDashboardSummary({ fundoId = 'MULTISETORIAL', data }) {
  const db = getFidcDb();

  // Se data informada não tiver cotas gravadas, busca a data válida mais recente (<= data solicitada)
  let targetDate = data;
  if (targetDate) {
    const hasCotas = db.prepare('SELECT 1 FROM historico_cotas WHERE fundo_id = ? AND data = ? LIMIT 1').get(fundoId, targetDate);
    if (!hasCotas) {
      const closest = db.prepare('SELECT MAX(data) as d FROM historico_cotas WHERE fundo_id = ? AND data <= ?').get(fundoId, targetDate);
      if (closest?.d) {
        targetDate = closest.d;
      } else {
        const maxAny = db.prepare('SELECT MAX(data) as d FROM historico_cotas WHERE fundo_id = ?').get(fundoId);
        targetDate = maxAny?.d || new Date().toISOString().substring(0, 10);
      }
    }
  } else {
    const maxDateRow = db.prepare('SELECT MAX(data) as d FROM historico_cotas WHERE fundo_id = ?').get(fundoId);
    targetDate = maxDateRow?.d || new Date().toISOString().substring(0, 10);
  }

  // PL Atual e Cotas da Data
  const cotasRows = db.prepare(`
    SELECT hc.classe_id, hc.cota, hc.pl, c.nome as classe_nome, c.tipo, c.spread
    FROM historico_cotas hc
    JOIN classes c ON c.id = hc.classe_id AND c.fundo_id = hc.fundo_id
    WHERE hc.fundo_id = ? AND hc.data = ?
    ORDER BY c.tipo DESC, c.id
  `).all(fundoId, targetDate);

  const plTotal = cotasRows.reduce((acc, r) => acc + (r.pl || 0), 0);

  // PL da Data Anterior (para cálculo de variação)
  const prevDateRow = db.prepare(`
    SELECT MAX(data) as d FROM historico_cotas WHERE fundo_id = ? AND data < ?
  `).get(fundoId, targetDate);
  const prevDate = prevDateRow?.d;

  let plPrev = 0;
  if (prevDate) {
    const prevCotas = db.prepare(`
      SELECT SUM(pl) as total FROM historico_cotas WHERE fundo_id = ? AND data = ?
    `).get(fundoId, prevDate);
    plPrev = prevCotas?.total || 0;
  }
  const plVariacaoPct = plPrev > 0 ? ((plTotal - plPrev) / plPrev) * 100 : 0;

  // Snapshot de Estoque mais próximo/recente
  const snap = db.prepare(`
    SELECT * FROM estoque_snapshots
    WHERE fundo_id = ? AND data <= ?
    ORDER BY data DESC LIMIT 1
  `).get(fundoId, targetDate);

  let carteiraResumo = {
    totalTitulos: 0,
    valorPresente: 0,
    valorNominal: 0,
    pddTotal: 0,
    pddPctPL: 0,
    vencidosValor: 0,
    vencidosPctPL: 0,
    dataSnapshot: snap?.data || null
  };

  let topCedentes = [];
  let topSacados = [];

  if (snap) {
    const cardTotais = db.prepare(`
      SELECT
        COUNT(*) as total_titulos,
        SUM(valor_presente) as vp,
        SUM(valor_nominal_atual) as vn,
        SUM(COALESCE(pdd_nota, 0) + COALESCE(pdd_vencido, 0)) as pdd,
        SUM(CASE WHEN date(data_vencimento) < date(data_posicao) THEN valor_presente ELSE 0 END) as vencidos
      FROM estoque_titulos
      WHERE snapshot_id = ?
    `).get(snap.id);

    carteiraResumo = {
      totalTitulos: cardTotais?.total_titulos || 0,
      valorPresente: cardTotais?.vp || 0,
      valorNominal: cardTotais?.vn || 0,
      pddTotal: cardTotais?.pdd || 0,
      pddPctPL: plTotal > 0 ? (cardTotais?.pdd / plTotal) * 100 : 0,
      vencidosValor: cardTotais?.vencidos || 0,
      vencidosPctPL: plTotal > 0 ? (cardTotais?.vencidos / plTotal) * 100 : 0,
      dataSnapshot: snap.data
    };

    // Top 5 Cedentes
    topCedentes = db.prepare(`
      SELECT
        COALESCE(cedente_nome, 'Não Identificado') as nome,
        cedente_cnpj as cnpj,
        SUM(valor_presente) as valor,
        COUNT(*) as titulos
      FROM estoque_titulos
      WHERE snapshot_id = ?
      GROUP BY cedente_cnpj, cedente_nome
      ORDER BY valor DESC
      LIMIT 5
    `).all(snap.id).map(r => ({
      ...r,
      pctPL: plTotal > 0 ? (r.valor / plTotal) * 100 : 0
    }));

    // Top 5 Sacados
    topSacados = db.prepare(`
      SELECT
        COALESCE(sacado_nome, 'Não Identificado') as nome,
        sacado_cnpj as cnpj,
        SUM(valor_presente) as valor,
        COUNT(*) as titulos
      FROM estoque_titulos
      WHERE snapshot_id = ?
      GROUP BY sacado_cnpj, sacado_nome
      ORDER BY valor DESC
      LIMIT 5
    `).all(snap.id).map(r => ({
      ...r,
      pctPL: plTotal > 0 ? (r.valor / plTotal) * 100 : 0
    }));
  }

  // Limites e Enquadramento de Subordinação
  const limitesSub = db.prepare('SELECT * FROM limites_sub WHERE fundo_id = ?').all(fundoId);
  const subEnquadramento = limitesSub.map(lim => {
    let classesIds = [];
    try {
      classesIds = JSON.parse(lim.classes);
    } catch {
      classesIds = [lim.classes];
    }
    const plSubset = cotasRows
      .filter(c => classesIds.includes(c.classe_id))
      .reduce((sum, c) => sum + c.pl, 0);
    const pctReal = plTotal > 0 ? (plSubset / plTotal) * 100 : 0;
    const ok = lim.tipo === 'min' ? pctReal >= lim.valor : pctReal <= lim.valor;

    return {
      descricao: lim.descricao,
      tipo: lim.tipo,
      limitePct: lim.valor,
      realPct: pctReal,
      plValor: plSubset,
      enquadrado: ok
    };
  });

  // CDI do dia
  const cdiRow = db.prepare('SELECT taxa_anual FROM cdi WHERE data = ?').get(targetDate);

  // Histórico de PL (últimos 30 registros)
  const historicoPL = db.prepare(`
    SELECT data, SUM(pl) as pl_total
    FROM historico_cotas
    WHERE fundo_id = ?
    GROUP BY data
    ORDER BY data DESC
    LIMIT 30
  `).all(fundoId).reverse();

  return {
    fundoId,
    data: targetDate,
    prevDate,
    plTotal,
    plPrev,
    plVariacaoPct,
    cdiTaxaAnual: cdiRow?.taxa_anual || null,
    cotas: cotasRows,
    carteira: carteiraResumo,
    subordinao: subEnquadramento,
    topCedentes,
    topSacados,
    historicoPL
  };
}

/**
 * Histórico de Cotas com cálculo de CDI e Subordinação
 */
export function getCotasHistory({ fundoId = 'MULTISETORIAL', dataInicio, dataFim, limit = 100 }) {
  const db = getFidcDb();
  let query = `
    SELECT
      hc.id,
      hc.fundo_id,
      hc.data,
      hc.classe_id,
      hc.cota,
      hc.pl,
      c.nome as classe_nome,
      c.tipo,
      c.spread,
      cdi.taxa_anual as cdi_anual
    FROM historico_cotas hc
    JOIN classes c ON c.id = hc.classe_id AND c.fundo_id = hc.fundo_id
    LEFT JOIN cdi ON cdi.data = hc.data
    WHERE hc.fundo_id = ?
  `;
  const params = [fundoId];

  if (dataInicio) {
    query += ' AND hc.data >= ?';
    params.push(dataInicio);
  }
  if (dataFim) {
    query += ' AND hc.data <= ?';
    params.push(dataFim);
  }

  query += ' ORDER BY hc.data DESC, c.tipo DESC, c.id LIMIT ?';
  params.push(Number(limit) || 100);

  const rows = db.prepare(query).all(...params);
  return rows;
}

/**
 * Detalhes e Decomposição Completa da Carteira / Estoque
 */
export function getCarteiraSummary({ fundoId = 'MULTISETORIAL', data }) {
  const db = getFidcDb();

  let targetDate = data;
  if (!targetDate) {
    const snapMax = db.prepare('SELECT MAX(data) as d FROM estoque_snapshots WHERE fundo_id = ?').get(fundoId);
    targetDate = snapMax?.d;
  }

  if (!targetDate) {
    return { error: 'Nenhum snapshot de estoque encontrado para este fundo.' };
  }

  const snap = db.prepare(`
    SELECT * FROM estoque_snapshots WHERE fundo_id = ? AND data <= ? ORDER BY data DESC LIMIT 1
  `).get(fundoId, targetDate);

  if (!snap) {
    return { error: 'Nenhum snapshot disponível na data especificada.' };
  }

  // PL da data correspondente
  const plRow = db.prepare(`
    SELECT SUM(pl) as total FROM historico_cotas WHERE fundo_id = ? AND data <= ? ORDER BY data DESC LIMIT 1
  `).get(fundoId, snap.data);
  const plTotal = plRow?.total || 0;

  // 1. Totais Gerais
  const totais = db.prepare(`
    SELECT
      COUNT(*) as total_titulos,
      SUM(valor_presente) as vp,
      SUM(valor_nominal_original) as vno,
      SUM(valor_nominal_atual) as vna,
      SUM(valor_aquisicao) as va,
      SUM(COALESCE(pdd_nota, 0) + COALESCE(pdd_vencido, 0)) as pdd_total,
      SUM(COALESCE(pdd_nota, 0)) as pdd_nota,
      SUM(COALESCE(pdd_vencido, 0)) as pdd_vencido
    FROM estoque_titulos
    WHERE snapshot_id = ?
  `).get(snap.id);

  // 2. Por Tipo de Ativo
  const porTipo = db.prepare(`
    SELECT
      COALESCE(tipo_ativo, 'Outros') as tipo,
      COUNT(*) as titulos,
      SUM(valor_presente) as valor,
      SUM(COALESCE(pdd_nota, 0) + COALESCE(pdd_vencido, 0)) as pdd
    FROM estoque_titulos
    WHERE snapshot_id = ?
    GROUP BY tipo_ativo
    ORDER BY valor DESC
  `).all(snap.id).map(r => ({
    ...r,
    pctPL: plTotal > 0 ? (r.valor / plTotal) * 100 : 0
  }));

  // 3. Por Nota de PDD
  const porNota = db.prepare(`
    SELECT
      COALESCE(nota_pdd, 'Sem Nota') as nota,
      COUNT(*) as titulos,
      SUM(valor_presente) as valor,
      SUM(COALESCE(pdd_nota, 0) + COALESCE(pdd_vencido, 0)) as pdd
    FROM estoque_titulos
    WHERE snapshot_id = ?
    GROUP BY nota_pdd
    ORDER BY pdd DESC
  `).all(snap.id);

  // 4. Por Faixa de Vencimento
  const porVencimento = db.prepare(`
    SELECT
      CASE
        WHEN julianday(data_vencimento) - julianday(data_posicao) > 0 THEN 'A Vencer'
        WHEN julianday(data_posicao) - julianday(data_vencimento) BETWEEN 0 AND 30 THEN 'Vencido 0-30 dias'
        WHEN julianday(data_posicao) - julianday(data_vencimento) BETWEEN 31 AND 60 THEN 'Vencido 31-60 dias'
        WHEN julianday(data_posicao) - julianday(data_vencimento) BETWEEN 61 AND 90 THEN 'Vencido 61-90 dias'
        WHEN julianday(data_posicao) - julianday(data_vencimento) BETWEEN 91 AND 180 THEN 'Vencido 91-180 dias'
        ELSE 'Vencido > 180 dias'
      END as faixa,
      COUNT(*) as titulos,
      SUM(valor_presente) as valor,
      SUM(COALESCE(pdd_nota, 0) + COALESCE(pdd_vencido, 0)) as pdd
    FROM estoque_titulos
    WHERE snapshot_id = ?
    GROUP BY faixa
    ORDER BY valor DESC
  `).all(snap.id);

  // 5. Top 15 Cedentes e Top 15 Sacados
  const topCedentes = db.prepare(`
    SELECT
      cedente_nome as nome,
      cedente_cnpj as cnpj,
      COUNT(*) as titulos,
      SUM(valor_presente) as valor,
      SUM(COALESCE(pdd_nota, 0) + COALESCE(pdd_vencido, 0)) as pdd
    FROM estoque_titulos
    WHERE snapshot_id = ?
    GROUP BY cedente_cnpj, cedente_nome
    ORDER BY valor DESC
    LIMIT 15
  `).all(snap.id).map(r => ({
    ...r,
    pctPL: plTotal > 0 ? (r.valor / plTotal) * 100 : 0
  }));

  const topSacados = db.prepare(`
    SELECT
      sacado_nome as nome,
      sacado_cnpj as cnpj,
      COUNT(*) as titulos,
      SUM(valor_presente) as valor,
      SUM(COALESCE(pdd_nota, 0) + COALESCE(pdd_vencido, 0)) as pdd
    FROM estoque_titulos
    WHERE snapshot_id = ?
    GROUP BY sacado_cnpj, sacado_nome
    ORDER BY valor DESC
    LIMIT 15
  `).all(snap.id).map(r => ({
    ...r,
    pctPL: plTotal > 0 ? (r.valor / plTotal) * 100 : 0
  }));

  return {
    fundoId,
    data: snap.data,
    snapshotId: snap.id,
    plTotal,
    totais,
    porTipo,
    porNota,
    porVencimento,
    topCedentes,
    topSacados
  };
}

/**
 * Consulta Paginada de Títulos do Estoque
 */
export function getTitulos({ fundoId = 'MULTISETORIAL', data, search = '', tipo, nota, page = 1, limit = 50 }) {
  const db = getFidcDb();
  let snap = null;
  if (data) {
    snap = db.prepare('SELECT id, data FROM estoque_snapshots WHERE fundo_id = ? AND data <= ? ORDER BY data DESC LIMIT 1').get(fundoId, data);
  } else {
    snap = db.prepare('SELECT id, data FROM estoque_snapshots WHERE fundo_id = ? ORDER BY data DESC LIMIT 1').get(fundoId);
  }

  if (!snap) {
    return { titulos: [], total: 0, page: 1, totalPages: 0 };
  }

  let whereClauses = ['snapshot_id = ?'];
  let params = [snap.id];

  if (search && search.trim()) {
    const s = `%${search.trim()}%`;
    whereClauses.push('(cedente_nome LIKE ? OR sacado_nome LIKE ? OR cedente_cnpj LIKE ? OR sacado_cnpj LIKE ? OR numero_titulo LIKE ?)');
    params.push(s, s, s, s, s);
  }

  if (tipo) {
    whereClauses.push('tipo_ativo = ?');
    params.push(tipo);
  }

  if (nota) {
    whereClauses.push('nota_pdd = ?');
    params.push(nota);
  }

  const whereStr = whereClauses.join(' AND ');

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM estoque_titulos WHERE ${whereStr}`).get(...params);
  const total = countRow?.total || 0;

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(10, Number(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  const titulos = db.prepare(`
    SELECT
      id,
      data_posicao,
      cedente_cnpj,
      cedente_nome,
      sacado_cnpj,
      sacado_nome,
      tipo_ativo,
      data_emissao,
      data_aquisicao,
      data_vencimento,
      numero_titulo,
      valor_aquisicao,
      valor_nominal_atual,
      valor_presente,
      pdd_nota,
      pdd_vencido,
      nota_pdd
    FROM estoque_titulos
    WHERE ${whereStr}
    ORDER BY valor_presente DESC
    LIMIT ? OFFSET ?
  `).all(...params, limitNum, offset);

  return {
    fundoId,
    data: snap.data,
    snapshotId: snap.id,
    titulos,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum)
  };
}

/**
 * Base de Cedentes com vínculo de gerentes e setores
 */
export function getCedentesList({ search = '', semGerenteOnly = false }) {
  const db = getFidcDb();
  let query = `
    SELECT
      c.cnpj_raiz,
      c.nome,
      c.estado,
      c.setor_id,
      c.gerente_id,
      c.criado_em,
      g.nome as gerente_nome,
      s.nome as setor_nome
    FROM cedentes c
    LEFT JOIN gerentes g ON g.id = c.gerente_id
    LEFT JOIN setores s ON s.id = c.setor_id
    WHERE 1=1
  `;
  const params = [];

  if (search && search.trim()) {
    query += ' AND (c.nome LIKE ? OR c.cnpj_raiz LIKE ?)';
    params.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  if (semGerenteOnly) {
    query += ' AND c.gerente_id IS NULL';
  }

  query += ' ORDER BY c.nome ASC';

  const cedentes = db.prepare(query).all(...params);
  const gerentes = db.prepare('SELECT * FROM gerentes ORDER BY nome').all();
  const setores = db.prepare('SELECT * FROM setores ORDER BY nome').all();

  return { cedentes, gerentes, setores };
}

/**
 * Salva/Atualiza Cedente
 */
export function saveCedente({ cnpj_raiz, nome, estado, setor_id, gerente_id }) {
  const db = getFidcDb();
  const cleanRaiz = cleanCnpj(cnpj_raiz)?.substring(0, 8);
  if (!cleanRaiz) throw new Error('CNPJ raiz inválido.');

  db.prepare(`
    INSERT INTO cedentes (cnpj_raiz, nome, estado, setor_id, gerente_id, criado_em)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(cnpj_raiz) DO UPDATE SET
      nome = excluded.nome,
      estado = excluded.estado,
      setor_id = excluded.setor_id,
      gerente_id = excluded.gerente_id
  `).run(
    cleanRaiz,
    nome.trim(),
    estado || null,
    setor_id ? Number(setor_id) : null,
    gerente_id ? Number(gerente_id) : null
  );

  return { success: true };
}

/**
 * Lançamentos de Receita
 */
export function getReceitas({ fundoId = 'MULTISETORIAL', mes, ano }) {
  const db = getFidcDb();
  let query = 'SELECT * FROM receita_lancamentos WHERE fundo_id = ?';
  const params = [fundoId];

  if (ano && mes) {
    const mesStr = String(mes).padStart(2, '0');
    query += " AND strftime('%Y-%m', data) = ?";
    params.push(`${ano}-${mesStr}`);
  } else if (ano) {
    query += " AND strftime('%Y', data) = ?";
    params.push(String(ano));
  }

  query += ' ORDER BY data DESC, id DESC';
  const lancamentos = db.prepare(query).all(...params);

  // Agrupamento por Cedente
  const porCedente = db.prepare(`
    SELECT
      cedente_nome,
      COUNT(*) as lancamentos,
      SUM(valor_bruto) as bruto,
      SUM(valor_liquido) as liquido
    FROM receita_lancamentos
    WHERE fundo_id = ?
    GROUP BY cedente_nome
    ORDER BY liquido DESC
  `).all(fundoId);

  return { fundoId, lancamentos, porCedente };
}
