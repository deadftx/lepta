import { getFidcDb } from './fidcDb.js';
import { getDashboardSummary, getCarteiraSummary, getReceitas, fmtCnpj } from './fidcService.js';

export function formatBrl(val) {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPct(val) {
  return `${(val || 0).toFixed(2)}%`;
}

export function formatDatePt(d) {
  if (!d) return '—';
  const parts = d.split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

/**
 * Gera o relatório diário em HTML completo, responsivo e interativo em tela única
 */
export function generateRelatorioDiarioHtml(options = {}) {
  const db = getFidcDb();

  const {
    dataReferencia,
    dataReceita,
    fundo = 'AMBOS',
    sections = {
      cotas: { enabled: true, resumo: true, rentabilidades: true, limites: true },
      concentracoes: { enabled: true, limites: true, cedentes: true, sacados: true, ccbs: true, totalCedentes: true },
      pdd: { enabled: true, resumo: true, cedente: true, variacao: true, gerente: true, rating: true },
      vencidos: { enabled: true, resumo: true, cedente: true },
      tiposAtivo: { enabled: true },
      receita: { enabled: true }
    },
    sectionsOrder = ['cotas', 'concentracoes', 'pdd', 'vencidos', 'tiposAtivo', 'receita']
  } = options;

  const fundosToProcess = fundo === 'AMBOS'
    ? ['MULTISETORIAL', 'SPECIAL']
    : [fundo];

  // Extrai ano e mês para receita se informado
  let recAno, recMes;
  if (dataReceita) {
    const parts = dataReceita.split('-');
    if (parts.length >= 2) {
      recAno = parts[0];
      recMes = parts[1];
    }
  }

  // Coleta os dados de cada fundo
  const fundosData = fundosToProcess.map(fundoId => {
    const dash = getDashboardSummary({ fundoId, data: dataReferencia });
    const cart = getCarteiraSummary({ fundoId, data: dash.data });
    let recData = null;
    try {
      recData = getReceitas({ fundoId, ano: recAno, mes: recMes });
    } catch (_) {}

    return {
      fundoId,
      nome: fundoId === 'MULTISETORIAL' ? 'LEPTA MULTISETORIAL FIDC' : 'LEPTA SPECIAL OPPORTUNITIES FIDC',
      shortNome: fundoId === 'MULTISETORIAL' ? 'Multisetorial' : 'Special Opportunities',
      accentColor: fundoId === 'MULTISETORIAL' ? '#38bdf8' : '#a855f7',
      accentBg: fundoId === 'MULTISETORIAL' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(168, 85, 247, 0.12)',
      accentBorder: fundoId === 'MULTISETORIAL' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(168, 85, 247, 0.3)',
      dash,
      cart,
      receitas: recData
    };
  });

  // Totais consolidados executivos
  const totalConsolidadoPL = fundosData.reduce((acc, f) => acc + (f.dash?.plTotal || 0), 0);
  const totalConsolidadoCarteira = fundosData.reduce((acc, f) => acc + (f.dash?.carteira?.valorPresente || f.cart?.totais?.vp || 0), 0);
  const totalConsolidadoPDD = fundosData.reduce((acc, f) => acc + (f.dash?.carteira?.pddTotal || f.cart?.totais?.pdd_total || 0), 0);
  const totalConsolidadoVencidos = fundosData.reduce((acc, f) => acc + (f.dash?.carteira?.vencidosValor || 0), 0);
  const totalConsolidadoTitulos = fundosData.reduce((acc, f) => acc + (f.dash?.carteira?.totalTitulos || f.cart?.totais?.total_titulos || 0), 0);

  // Data de referência efetiva (usada no cabeçalho)
  const refDateFormatted = formatDatePt(fundosData[0]?.dash?.data || dataReferencia);
  const dataReceitaFormatted = formatDatePt(dataReceita || new Date().toISOString().substring(0, 10));
  const emittedAt = new Date().toLocaleString('pt-BR');

  // Gera HTML
  let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <title>Relatório Diário de Gestão — Lepta Capital (${refDateFormatted})</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-inner: #1a2234;
      --card-border: #232f46;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --primary: #38bdf8;
      --special: #a855f7;
      --success: #4ade80;
      --warning: #fbbf24;
      --danger: #f87171;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    }
    
    body {
      background-color: var(--bg);
      color: var(--text);
      padding: 1rem 1.25rem 2rem 1.25rem;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    
    .container {
      max-width: 1800px;
      margin: 0 auto;
    }
    
    /* ── STICKY TOPBAR ── */
    .topbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(9, 13, 22, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--card-border);
      padding: 0.85rem 0;
      margin-bottom: 1.25rem;
    }
    
    .topbar-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    
    .brand-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .brand-logo {
      font-size: 1.35rem;
      font-weight: 900;
      letter-spacing: -0.5px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .brand-logo span { color: #f97316; }
    
    .brand-subtitle {
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-top: 1px;
    }
    
    .date-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: var(--primary);
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 700;
    }

    /* ── CONSOLIDATED HEADER SUMMARY ── */
    .consolidated-bar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      background: rgba(17, 24, 39, 0.8);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 10px 14px;
      margin-bottom: 1.25rem;
    }
    
    .c-kpi {
      display: flex;
      flex-direction: column;
    }
    .c-kpi-lbl {
      font-size: 0.68rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }
    .c-kpi-val {
      font-size: 1.1rem;
      font-weight: 800;
      color: #fff;
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
    }

    /* ── 2-COLUMN SPLIT GRID (MULTI VS SPECIAL) ── */
    .funds-split-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      align-items: start;
    }
    
    .fund-column {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      transition: all 0.2s ease;
      min-width: 0; /* Prevents table overflow from breaking grid */
    }
    
    .fund-column.hidden {
      display: none !important;
    }
    
    .fund-column.full-width {
      grid-column: 1 / -1;
    }
    
    /* ── FUND HEADER & BADGES ── */
    .fund-header-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 1rem 1.25rem;
      position: relative;
      overflow: hidden;
    }
    
    .fund-header-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }
    .fund-header-multi::before { background: linear-gradient(90deg, #38bdf8, #0284c7); }
    .fund-header-special::before { background: linear-gradient(90deg, #a855f7, #7c3aed); }
    
    .fund-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.85rem;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .fund-name-badge {
      font-size: 1.05rem;
      font-weight: 800;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    /* ── FUND MINI KPIS ── */
    .fund-kpis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 8px;
    }
    
    .mini-kpi {
      background: var(--card-inner);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 6px;
      padding: 8px 10px;
    }
    
    .mini-kpi-label {
      font-size: 0.65rem;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--text-dim);
      letter-spacing: 0.4px;
    }
    
    .mini-kpi-val {
      font-size: 1.05rem;
      font-weight: 800;
      color: #fff;
      margin: 3px 0 1px 0;
      font-variant-numeric: tabular-nums;
    }
    
    .mini-kpi-sub {
      font-size: 0.72rem;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    /* ── SECTION CARDS ── */
    .section-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 0.9rem 1.1rem;
    }
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.6rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      padding-bottom: 0.45rem;
    }
    
    .section-title {
      font-size: 0.86rem;
      font-weight: 700;
      color: #f1f5f9;
      display: flex;
      align-items: center;
      gap: 6px;
      letter-spacing: -0.2px;
    }
    
    .section-count-badge {
      font-size: 0.7rem;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--card-inner);
      padding: 2px 8px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }

    /* ── SCROLLABLE MENUS / TABLES ── */
    .scroll-box {
      max-height: 250px;
      overflow-y: auto;
      overflow-x: auto;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(15, 23, 42, 0.45);
      position: relative;
    }
    
    .scroll-box-lg {
      max-height: 290px;
    }
    
    /* Scrollbar personalizada */
    .scroll-box::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    .scroll-box::-webkit-scrollbar-track {
      background: rgba(15, 23, 42, 0.6);
      border-radius: 4px;
    }
    .scroll-box::-webkit-scrollbar-thumb {
      background: #334155;
      border-radius: 4px;
    }
    .scroll-box::-webkit-scrollbar-thumb:hover {
      background: #475569;
    }
    .scroll-box {
      scrollbar-width: thin;
      scrollbar-color: #334155 rgba(15, 23, 42, 0.6);
    }

    /* ── TABLES ── */
    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 0.78rem;
    }
    
    th {
      text-align: left;
      padding: 7px 9px;
      background: #151e2e;
      color: var(--text-muted);
      font-weight: 700;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 1px solid var(--card-border);
      position: sticky;
      top: 0;
      z-index: 2;
      white-space: nowrap;
    }
    
    td {
      padding: 6px 9px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: #e2e8f0;
      white-space: nowrap;
    }
    
    tr:last-child td {
      border-bottom: none;
    }
    
    tr:hover td {
      background: rgba(255, 255, 255, 0.035);
    }
    
    .num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .txt-center {
      text-align: center;
    }

    /* ── BADGES ── */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .badge-success {
      background: rgba(74, 222, 128, 0.14);
      color: var(--success);
      border: 1px solid rgba(74, 222, 128, 0.3);
    }
    .badge-danger {
      background: rgba(248, 113, 113, 0.14);
      color: var(--danger);
      border: 1px solid rgba(248, 113, 113, 0.3);
    }
    .badge-warning {
      background: rgba(251, 191, 36, 0.14);
      color: var(--warning);
      border: 1px solid rgba(251, 191, 36, 0.3);
    }
    .badge-info {
      background: rgba(56, 189, 248, 0.14);
      color: var(--primary);
      border: 1px solid rgba(56, 189, 248, 0.3);
    }

    .sub-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }

    /* ── FOOTER ── */
    .report-footer {
      text-align: center;
      color: var(--text-dim);
      font-size: 0.72rem;
      margin-top: 2rem;
      border-top: 1px solid var(--card-border);
      padding-top: 1rem;
    }

    /* ── CELULAR NA VERTICAL (PORTRAIT / TELAS ESTREITAS): 1 COLUNA ── */
    @media screen and (max-width: 768px) and (orientation: portrait), screen and (max-width: 600px) {
      .funds-split-grid {
        grid-template-columns: 1fr !important;
        gap: 1.25rem;
      }
      body {
        padding: 0.6rem 0.4rem 1.5rem 0.4rem;
      }
      .sub-grid {
        grid-template-columns: 1fr !important;
      }
      .consolidated-bar {
        grid-template-columns: repeat(2, 1fr);
      }
      .section-card {
        padding: 0.75rem 0.6rem;
      }
    }

    /* ── CELULAR NA HORIZONTAL (LANDSCAPE) E DESKTOP: 2 COLUNAS LADO A LADO ── */
    @media screen and (orientation: landscape) and (min-width: 580px), screen and (min-width: 769px) {
      .funds-split-grid {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 1rem;
      }
      .sub-grid {
        grid-template-columns: 1fr;
      }
    }

    /* ── ESTILOS DE IMPRESSÃO / SALVAR PDF ── */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding: 0 !important;
      }
      .topbar, .controls-bar, .search-input {
        display: none !important;
      }
      .print-header {
        display: flex !important;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #000;
        padding-bottom: 8px;
        margin-bottom: 12px;
      }
      .print-header .brand-logo {
        color: #000 !important;
      }
      .print-header .brand-logo span {
        color: #d97706 !important;
      }
      .consolidated-bar {
        background: #f8fafc !important;
        border: 1px solid #cbd5e1 !important;
        page-break-inside: avoid;
      }
      .c-kpi-val, .mini-kpi-val {
        color: #000000 !important;
      }
      .funds-split-grid {
        display: block !important;
      }
      .fund-column {
        display: block !important;
        page-break-after: always;
        margin-bottom: 20px;
      }
      .fund-column:last-child {
        page-break-after: auto;
      }
      .fund-header-card, .section-card, .mini-kpi {
        background: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        color: #000000 !important;
        page-break-inside: avoid;
        margin-bottom: 10px;
      }
      .scroll-box, .scroll-box-lg {
        max-height: none !important;
        overflow: visible !important;
        border: 1px solid #e2e8f0 !important;
      }
      th {
        background: #f1f5f9 !important;
        color: #334155 !important;
        border-bottom: 1px solid #94a3b8 !important;
      }
      td {
        border-bottom: 1px solid #e2e8f0 !important;
        color: #000000 !important;
      }
      .badge-success { color: #166534 !important; border-color: #166534 !important; }
      .badge-danger { color: #991b1b !important; border-color: #991b1b !important; }
      .badge-warning { color: #854d0e !important; border-color: #854d0e !important; }
      .badge-info { color: #075985 !important; border-color: #075985 !important; }
      .section-title { color: #0f172a !important; }
    }
    
    .print-header { display: none; }
  </style>
</head>
<body>
  <div class="container">
    
    <!-- Printable Header (Visible only in PDF/Print) -->
    <div class="print-header">
      <div>
        <div class="brand-logo">LEPTA <span>CAPITAL</span></div>
        <div style="font-size: 0.8rem; color: #475569;">Relatório Diário de Gestão — FIDCs</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 0.9rem; font-weight: 700;">Posição: ${refDateFormatted}</div>
        <div style="font-size: 0.75rem; color: #64748b;">Emissão: ${emittedAt}</div>
      </div>
    </div>

    <!-- Top Executive Header -->
    <header class="topbar">
      <div class="topbar-content">
        <div class="brand-section">
          <div>
            <div class="brand-logo">LEPTA <span>CAPITAL</span></div>
            <div class="brand-subtitle">Relatório Diário Consolidado de Gestão & Monitoramento</div>
          </div>
        </div>

        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
          <span class="date-badge">📅 Posição: ${refDateFormatted}</span>
          <span style="font-size: 0.72rem; color: var(--text-dim);">Emissão: ${emittedAt}</span>
        </div>
      </div>
    </header>

    <!-- Consolidated KPIs Strip -->
    <div class="consolidated-bar">
      <div class="c-kpi">
        <span class="c-kpi-lbl">PL Consolidado Total</span>
        <span class="c-kpi-val" style="color: var(--primary);">${formatBrl(totalConsolidadoPL)}</span>
      </div>
      <div class="c-kpi">
        <span class="c-kpi-lbl">Carteira de Direitos Creditórios</span>
        <span class="c-kpi-val">${formatBrl(totalConsolidadoCarteira)}</span>
      </div>
      <div class="c-kpi">
        <span class="c-kpi-lbl">PDD Total Consolidado</span>
        <span class="c-kpi-val" style="color: var(--warning);">${formatBrl(totalConsolidadoPDD)}</span>
      </div>
      <div class="c-kpi">
        <span class="c-kpi-lbl">Títulos Vencidos</span>
        <span class="c-kpi-val" style="color: var(--danger);">${formatBrl(totalConsolidadoVencidos)}</span>
      </div>
      <div class="c-kpi">
        <span class="c-kpi-lbl">Total de Títulos Ativos</span>
        <span class="c-kpi-val">${totalConsolidadoTitulos.toLocaleString('pt-BR')}</span>
      </div>
    </div>

    <!-- Main 2-Column Split Grid -->
    <main class="funds-split-grid" id="fundsGrid">
`;

  // Renderiza cada fundo na sua coluna
  for (const item of fundosData) {
    const { fundoId, nome, shortNome, accentColor, dash, cart, receitas } = item;
    const plTotal = dash.plTotal || 0;
    const plVar = dash.plVariacaoPct || 0;
    const varColor = plVar >= 0 ? 'var(--success)' : 'var(--danger)';
    const varSign = plVar >= 0 ? '+' : '';
    const isMulti = fundoId === 'MULTISETORIAL';
    const headerClass = isMulti ? 'fund-header-multi' : 'fund-header-special';

    html += `
      <section class="fund-column" id="col-${fundoId}">
        
        <!-- Header do Fundo & KPIs -->
        <div class="fund-header-card ${headerClass}">
          <div class="fund-title-row">
            <div class="fund-name-badge" style="color: ${accentColor};">
              ${isMulti ? '🏢' : '💎'} ${nome}
            </div>
            <span class="badge" style="background: ${item.accentBg}; color: ${accentColor}; border: 1px solid ${item.accentBorder};">
              ${shortNome}
            </span>
          </div>

          <div class="fund-kpis-grid">
            <div class="mini-kpi">
              <div class="mini-kpi-label">Patrimônio Líquido</div>
              <div class="mini-kpi-val">${formatBrl(plTotal)}</div>
              <div class="mini-kpi-sub" style="color: ${varColor}; font-weight: 700;">
                ${varSign}${plVar.toFixed(2)}% vs D-1
              </div>
            </div>

            <div class="mini-kpi">
              <div class="mini-kpi-label">Carteira VP</div>
              <div class="mini-kpi-val">${formatBrl(dash.carteira?.valorPresente || cart.totais?.vp)}</div>
              <div class="mini-kpi-sub">${(dash.carteira?.totalTitulos || cart.totais?.total_titulos || 0).toLocaleString('pt-BR')} títulos</div>
            </div>

            <div class="mini-kpi">
              <div class="mini-kpi-label">PDD Total</div>
              <div class="mini-kpi-val" style="color: var(--warning);">${formatBrl(dash.carteira?.pddTotal || cart.totais?.pdd_total)}</div>
              <div class="mini-kpi-sub">${formatPct(dash.carteira?.pddPctPL)} do PL</div>
            </div>

            <div class="mini-kpi">
              <div class="mini-kpi-label">Vencidos</div>
              <div class="mini-kpi-val" style="color: var(--danger);">${formatBrl(dash.carteira?.vencidosValor)}</div>
              <div class="mini-kpi-sub">${formatPct(dash.carteira?.vencidosPctPL)} do PL</div>
            </div>
          </div>
        </div>
    `;

    // Itera pelas seções configuradas na ordem selecionada
    for (const secKey of sectionsOrder) {
      // 1. COTAS & SUBORDINAÇÃO
      if (secKey === 'cotas' && sections.cotas?.enabled !== false && sections.cotas !== false) {
        html += `
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">📊 Composição de Cotas & Subordinação</span>
            <span class="section-count-badge">${(dash.cotas || []).length} classes</span>
          </div>

          <div class="scroll-box">
            <table class="filterable-table">
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Tipo</th>
                  <th class="num">Cota Unit.</th>
                  <th class="num">PL</th>
                  <th class="num">% PL</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
        `;

        for (const c of (dash.cotas || [])) {
          const pctPl = plTotal > 0 ? (c.pl / plTotal) * 100 : 0;
          html += `
                <tr>
                  <td style="font-weight: 700; color: #fff;">${c.classe_nome}</td>
                  <td><span class="badge badge-info" style="text-transform: uppercase;">${c.tipo}</span></td>
                  <td class="num">${(c.cota || 0).toFixed(4)}</td>
                  <td class="num" style="font-weight: 600;">${formatBrl(c.pl)}</td>
                  <td class="num" style="font-weight: 700; color: var(--primary);">${formatPct(pctPl)}</td>
                  <td style="font-size: 0.72rem; color: var(--text-muted);">${c.spread ? `CDI + ${c.spread}%` : '—'}</td>
                </tr>
          `;
        }

        html += `
              </tbody>
            </table>
          </div>
        `;

        // Subordinação regulamentar
        if (dash.subordinao && dash.subordinao.length > 0) {
          html += `
          <div style="margin-top: 0.6rem;">
            <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; margin-bottom: 4px;">
              Enquadramento Regulamentar de Subordinação
            </div>
            <div class="scroll-box" style="max-height: 140px;">
              <table class="filterable-table">
                <thead>
                  <tr>
                    <th>Regra / Limite</th>
                    <th class="num">Exigido</th>
                    <th class="num">Realizado</th>
                    <th class="txt-center">Status</th>
                  </tr>
                </thead>
                <tbody>
          `;

          for (const sub of dash.subordinao) {
            const sign = sub.tipo === 'min' ? '≥' : '≤';
            const badgeClass = sub.enquadrado ? 'badge-success' : 'badge-danger';
            const badgeLabel = sub.enquadrado ? '✓ ENQUADRADO' : '⚠️ DESENQUADRADO';

            html += `
                  <tr>
                    <td style="font-weight: 600;">${sub.descricao}</td>
                    <td class="num">${sign} ${sub.limitePct}%</td>
                    <td class="num" style="font-weight: 700; color: ${sub.enquadrado ? 'var(--success)' : 'var(--danger)'};">${formatPct(sub.realPct)}</td>
                    <td class="txt-center"><span class="badge ${badgeClass}">${badgeLabel}</span></td>
                  </tr>
            `;
          }

          html += `
                </tbody>
              </table>
            </div>
          </div>
          `;
        }

        html += `</div>`;
      }

      // 2. CONCENTRAÇÕES (TOP CEDENTES E SACADOS)
      if (secKey === 'concentracoes' && sections.concentracoes?.enabled !== false && sections.concentracoes !== false) {
        const topCed = (cart.topCedentes && cart.topCedentes.length > 0) ? cart.topCedentes : (dash.topCedentes || []);
        const topSac = (cart.topSacados && cart.topSacados.length > 0) ? cart.topSacados : (dash.topSacados || []);

        html += `
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">🎯 Concentração de Carteira</span>
            <span class="section-count-badge">Top ${topCed.length} Ced. / ${topSac.length} Sac.</span>
          </div>

          <div class="sub-grid">
            <!-- Top Cedentes -->
            <div>
              <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; margin-bottom: 4px;">
                Top Cedentes
              </div>
              <div class="scroll-box scroll-box-lg">
                <table class="filterable-table">
                  <thead>
                    <tr>
                      <th>Cedente</th>
                      <th class="num">Títs</th>
                      <th class="num">VP</th>
                      <th class="num">% PL</th>
                    </tr>
                  </thead>
                  <tbody>
        `;

        for (const ced of topCed) {
          const pct = plTotal > 0 ? (ced.valor / plTotal) * 100 : (ced.pctPL || 0);
          html += `
                    <tr>
                      <td style="min-width: 125px; white-space: normal;">
                        <div style="font-weight: 600; color: #fff; line-height: 1.25; word-break: break-word;">${ced.nome}</div>
                        <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 2px;">${fmtCnpj(ced.cnpj)}</div>
                      </td>
                      <td class="num">${ced.titulos}</td>
                      <td class="num" style="font-weight: 600;">${formatBrl(ced.valor)}</td>
                      <td class="num" style="font-weight: 700; color: var(--primary);">${formatPct(pct)}</td>
                    </tr>
          `;
        }

        html += `
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Top Sacados -->
            <div>
              <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-dim); text-transform: uppercase; margin-bottom: 4px;">
                Top Sacados
              </div>
              <div class="scroll-box scroll-box-lg">
                <table class="filterable-table">
                  <thead>
                    <tr>
                      <th>Sacado</th>
                      <th class="num">Títs</th>
                      <th class="num">VP</th>
                      <th class="num">% PL</th>
                    </tr>
                  </thead>
                  <tbody>
        `;

        for (const sac of topSac) {
          const pct = plTotal > 0 ? (sac.valor / plTotal) * 100 : (sac.pctPL || 0);
          html += `
                    <tr>
                      <td style="min-width: 125px; white-space: normal;">
                        <div style="font-weight: 600; color: #fff; line-height: 1.25; word-break: break-word;">${sac.nome}</div>
                        <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 2px;">${fmtCnpj(sac.cnpj)}</div>
                      </td>
                      <td class="num">${sac.titulos}</td>
                      <td class="num" style="font-weight: 600;">${formatBrl(sac.valor)}</td>
                      <td class="num" style="font-weight: 700; color: var(--primary);">${formatPct(pct)}</td>
                    </tr>
          `;
        }

        html += `
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        `;
      }

      // 3. PDD POR RATING
      if (secKey === 'pdd' && sections.pdd?.enabled !== false && sections.pdd !== false && cart.porNota) {
        html += `
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">⚠️ PDD por Nota de Rating</span>
            <span class="section-count-badge">${(cart.porNota || []).length} notas</span>
          </div>

          <div class="scroll-box">
            <table class="filterable-table">
              <thead>
                <tr>
                  <th>Rating</th>
                  <th class="num">Alíquota</th>
                  <th class="num">Títulos</th>
                  <th class="num">Valor Presente</th>
                  <th class="num">PDD Calculado</th>
                </tr>
              </thead>
              <tbody>
        `;

        for (const n of (cart.porNota || [])) {
          const titulos = n.titulos ?? n.qtd ?? 0;
          const valor = n.valor ?? n.vp ?? 0;
          const pdd = n.pdd ?? 0;
          const aliquota = n.pct_aliquota !== undefined ? `${n.pct_aliquota}%` : (valor > 0 ? `${((pdd / valor) * 100).toFixed(1)}%` : '—');
          const rawNota = String(n.nota).startsWith('Nota') ? n.nota : `Nota ${n.nota}`;

          html += `
                <tr>
                  <td><span class="badge badge-info">${rawNota}</span></td>
                  <td class="num">${aliquota}</td>
                  <td class="num">${titulos.toLocaleString('pt-BR')}</td>
                  <td class="num">${formatBrl(valor)}</td>
                  <td class="num" style="font-weight: 700; color: var(--warning);">${formatBrl(pdd)}</td>
                </tr>
          `;
        }

        html += `
              </tbody>
            </table>
          </div>
        </div>
        `;
      }

      // 4. FAIXAS DE VENCIMENTO
      if (secKey === 'vencidos' && sections.vencidos?.enabled !== false && sections.vencidos !== false && cart.porVencimento) {
        const vpTotal = cart.totais?.vp || 1;

        html += `
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">⏳ Faixas de Vencimento & Inadimplência</span>
            <span class="section-count-badge">${(cart.porVencimento || []).length} faixas</span>
          </div>

          <div class="scroll-box">
            <table class="filterable-table">
              <thead>
                <tr>
                  <th>Faixa de Prazo</th>
                  <th class="num">Títulos</th>
                  <th class="num">Valor Presente</th>
                  <th class="num">% Carteira</th>
                </tr>
              </thead>
              <tbody>
        `;

        for (const v of (cart.porVencimento || [])) {
          const isVencido = String(v.faixa).startsWith('Vencido');
          const color = isVencido ? 'var(--danger)' : '#f8fafc';
          const titulos = v.titulos ?? v.qtd ?? 0;
          const valor = v.valor ?? v.vp ?? 0;
          const pct = vpTotal > 0 ? (valor / vpTotal) * 100 : 0;

          html += `
                <tr>
                  <td style="font-weight: 600; color: ${color};">
                    ${isVencido ? '⚠️ ' : '📅 '} ${v.faixa}
                  </td>
                  <td class="num">${titulos.toLocaleString('pt-BR')}</td>
                  <td class="num" style="font-weight: 600;">${formatBrl(valor)}</td>
                  <td class="num" style="font-weight: 700; color: ${isVencido ? 'var(--danger)' : 'var(--primary)'};">${formatPct(pct)}</td>
                </tr>
          `;
        }

        html += `
              </tbody>
            </table>
          </div>
        </div>
        `;
      }

      // 5. TIPOS DE ATIVO
      if (secKey === 'tiposAtivo' && sections.tiposAtivo?.enabled !== false && sections.tiposAtivo !== false && cart.porTipo) {
        const vpTotal = cart.totais?.vp || 1;

        html += `
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">📑 Decomposição por Tipo de Ativo</span>
            <span class="section-count-badge">${(cart.porTipo || []).length} tipos</span>
          </div>

          <div class="scroll-box">
            <table class="filterable-table">
              <thead>
                <tr>
                  <th>Tipo de Ativo</th>
                  <th class="num">Títulos</th>
                  <th class="num">Valor Presente</th>
                  <th class="num">% Carteira</th>
                </tr>
              </thead>
              <tbody>
        `;

        for (const t of (cart.porTipo || [])) {
          const titulos = t.titulos ?? t.qtd ?? 0;
          const valor = t.valor ?? t.vp ?? 0;
          const tipoNome = t.tipo || t.tipo_ativo || 'Outros';
          const pct = vpTotal > 0 ? (valor / vpTotal) * 100 : 0;

          html += `
                <tr>
                  <td style="font-weight: 600; color: #fff;">${tipoNome}</td>
                  <td class="num">${titulos.toLocaleString('pt-BR')}</td>
                  <td class="num" style="font-weight: 600;">${formatBrl(valor)}</td>
                  <td class="num" style="font-weight: 700; color: var(--primary);">${formatPct(pct)}</td>
                </tr>
          `;
        }

        html += `
              </tbody>
            </table>
          </div>
        </div>
        `;
      }

      // 6. RECEITA APURADA
      if (secKey === 'receita' && sections.receita?.enabled !== false && sections.receita !== false && receitas?.porCedente && receitas.porCedente.length > 0) {
        html += `
        <div class="section-card">
          <div class="section-header">
            <span class="section-title">💵 Receita Apurada no Período</span>
            <span class="section-count-badge">${receitas.porCedente.length} cedentes</span>
          </div>

          <div class="scroll-box">
            <table class="filterable-table">
              <thead>
                <tr>
                  <th>Cedente</th>
                  <th class="num">Lançamentos</th>
                  <th class="num">Valor Bruto</th>
                  <th class="num">Valor Líquido</th>
                </tr>
              </thead>
              <tbody>
        `;

        for (const r of receitas.porCedente) {
          html += `
                <tr>
                  <td style="font-weight: 600; color: #fff;">${r.cedente_nome}</td>
                  <td class="num">${r.lancamentos}</td>
                  <td class="num">${formatBrl(r.bruto)}</td>
                  <td class="num" style="font-weight: 700; color: var(--success);">${formatBrl(r.liquido)}</td>
                </tr>
          `;
        }

        html += `
              </tbody>
            </table>
          </div>
        </div>
        `;
      }
    }

    html += `
      </section> <!-- /fund-column -->
    `;
  }

  html += `
    </main>

    <!-- Footer -->
    <footer class="report-footer">
      <div>Relatório emitido automaticamente pelo sistema <strong>LeptaSys</strong> • Lepta Capital • ${emittedAt}</div>
      <div style="margin-top: 4px; color: var(--text-dim);">Documento confidencial para uso exclusivo da gestão e comitê de crédito.</div>
    </footer>
  </div>
</body>
</html>`;

  return html;
}
