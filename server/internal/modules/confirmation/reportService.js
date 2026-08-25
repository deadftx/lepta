import { getFidcDb } from './fidcDb.js';
import { getDashboardSummary, getCarteiraSummary, fmtCnpj } from './fidcService.js';

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
 * Gera o relatório diário em HTML completo e interativo
 */
export function generateRelatorioDiarioHtml(options = {}) {
  const db = getFidcDb();

  const {
    dataReferencia,
    dataReceita,
    fundo = 'AMBOS',
    sections = {
      cotas: { resumo: true, rentabilidades: true, limites: true },
      concentracoes: { limites: true, cedentes: true, sacados: true, ccbs: true, totalCedentes: true },
      pdd: { resumo: true, cedente: true, variacao: true, gerente: true, rating: true },
      vencidos: { resumo: true, cedente: true },
      tiposAtivo: true,
      receita: true
    },
    sectionsOrder = ['cotas', 'concentracoes', 'pdd', 'vencidos', 'tiposAtivo', 'receita']
  } = options;

  const fundosToProcess = fundo === 'AMBOS'
    ? ['MULTISETORIAL', 'SPECIAL']
    : [fundo];

  // Coleta os dados de cada fundo
  const fundosData = fundosToProcess.map(fundoId => {
    const dash = getDashboardSummary({ fundoId, data: dataReferencia });
    const cart = getCarteiraSummary({ fundoId, data: dash.data });
    return {
      fundoId,
      nome: fundoId === 'MULTISETORIAL' ? 'LEPTA MULTISETORIAL FIDC' : 'LEPTA SPECIAL OPPORTUNITIES FIDC',
      dash,
      cart
    };
  });

  // Data de referência efetiva (usada no cabeçalho)
  const refDateFormatted = formatDatePt(fundosData[0]?.dash?.data || dataReferencia);
  const dataReceitaFormatted = formatDatePt(dataReceita || new Date().toISOString().substring(0, 10));

  // Gera HTML
  let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Diário de Gestão — Lepta Capital (${refDateFormatted})</title>
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #1e293b;
      --card-border: #334155;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --success: #4ade80;
      --warning: #fbbf24;
      --danger: #f87171;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 2rem; }
    .container { max-width: 1280px; margin: 0 auto; }
    
    /* Header */
    .report-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--card-border); padding-bottom: 1.5rem; margin-bottom: 2rem; }
    .brand-title { font-size: 1.6rem; font-weight: 800; color: #fff; letter-spacing: -0.5px; }
    .brand-title span { color: #f97316; }
    .report-subtitle { color: var(--text-muted); font-size: 0.95rem; margin-top: 4px; }
    .report-badge { background: rgba(56, 189, 248, 0.15); border: 1px solid var(--primary); color: var(--primary); padding: 6px 14px; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }
    
    /* Fund Header */
    .fundo-block { margin-bottom: 3rem; background: rgba(15, 23, 42, 0.5); border: 1px solid var(--card-border); border-radius: 12px; padding: 1.5rem; }
    .fundo-title { font-size: 1.3rem; font-weight: 700; color: var(--primary); margin-bottom: 1.25rem; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--card-border); padding-bottom: 0.75rem; }
    
    /* KPIs Grid */
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
    .kpi-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 1.2rem; }
    .kpi-label { font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 600; letter-spacing: 0.5px; }
    .kpi-value { font-size: 1.45rem; font-weight: 800; color: #fff; margin: 6px 0; }
    .kpi-sub { font-size: 0.82rem; color: var(--text-muted); }
    
    /* Sections */
    .section-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.5rem; }
    .section-title { font-size: 1.05rem; font-weight: 700; color: #fff; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; }
    
    /* Tables */
    table { width: 100%; border-collapse: collapse; font-size: 0.88rem; margin-top: 0.5rem; }
    th { text-align: left; padding: 10px 12px; background: rgba(0, 0, 0, 0.25); color: var(--text-muted); font-weight: 600; border-bottom: 1px solid var(--card-border); }
    td { padding: 10px 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    
    /* Badges */
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; }
    .badge-success { background: rgba(74, 222, 128, 0.15); color: var(--success); border: 1px solid rgba(74, 222, 128, 0.3); }
    .badge-danger { background: rgba(248, 113, 113, 0.15); color: var(--danger); border: 1px solid rgba(248, 113, 113, 0.3); }
    
    /* Buttons / Actions */
    .actions-bar { display: flex; gap: 10px; margin-bottom: 1.5rem; }
    .btn-print { background: #2563eb; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .btn-print:hover { background: #1d4ed8; }

    /* Interactive Drilldowns */
    details summary { cursor: pointer; font-weight: 600; color: var(--primary); outline: none; }
    details[open] summary { margin-bottom: 8px; }

    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .actions-bar { display: none; }
      .fundo-block, .section-card, .kpi-card { background: #fff; border: 1px solid #ccc; color: #000; page-break-inside: avoid; }
      .brand-title, .fundo-title, .section-title, .kpi-value { color: #000; }
      .badge-success { color: #15803d; border-color: #15803d; }
      .badge-danger { color: #b91c1c; border-color: #b91c1c; }
      th { background: #eee; color: #333; }
      td { border-bottom: 1px solid #ddd; color: #000; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="report-header">
      <div>
        <div class="brand-title">LEPTA <span>CAPITAL</span></div>
        <div class="report-subtitle">Relatório Diário de Gestão e Monitoramento de FIDCs</div>
      </div>
      <div>
        <span class="report-badge">📅 Posição: ${refDateFormatted}</span>
      </div>
    </div>

    <div class="actions-bar">
      <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
    </div>
`;

  // Renderiza cada fundo
  for (const item of fundosData) {
    const { fundoId, nome, dash, cart } = item;
    const plTotal = dash.plTotal;
    const plVar = dash.plVariacaoPct;
    const varColor = plVar >= 0 ? 'var(--success)' : 'var(--danger)';
    const varSign = plVar >= 0 ? '+' : '';

    html += `
    <div class="fundo-block">
      <div class="fundo-title">
        🏢 ${nome}
      </div>

      <!-- KPIs Executivos -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-label">Patrimônio Líquido (PL)</div>
          <div class="kpi-value">${formatBrl(plTotal)}</div>
          <div class="kpi-sub" style="color: ${varColor}; font-weight: 600;">
            ${varSign}${plVar.toFixed(2)}% vs D-1 (${formatBrl(dash.plPrev)})
          </div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Carteira de Direitos Creditórios</div>
          <div class="kpi-value">${formatBrl(dash.carteira?.valorPresente || cart.totais?.vp)}</div>
          <div class="kpi-sub">${(dash.carteira?.totalTitulos || cart.totais?.total_titulos || 0).toLocaleString('pt-BR')} títulos ativos</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">PDD Total (Provisão)</div>
          <div class="kpi-value" style="color: var(--warning);">${formatBrl(dash.carteira?.pddTotal || cart.totais?.pdd_total)}</div>
          <div class="kpi-sub">${formatPct(dash.carteira?.pddPctPL)} do PL total</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Títulos Vencidos</div>
          <div class="kpi-value" style="color: var(--danger);">${formatBrl(dash.carteira?.vencidosValor)}</div>
          <div class="kpi-sub">${formatPct(dash.carteira?.vencidosPctPL)} do PL total</div>
        </div>
      </div>
    `;

    // 1. Seção: Cotas / Subordinação
    if (sections.cotas) {
      html += `
      <div class="section-card">
        <div class="section-title">📊 Composição das Cotas & Subordinação</div>
        <table>
          <thead>
            <tr>
              <th>Classe</th>
              <th>Tipo</th>
              <th class="num">Cota Unitária</th>
              <th class="num">Patrimônio Líquido (PL)</th>
              <th class="num">% do PL</th>
              <th>Spread Alvo</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const c of (dash.cotas || [])) {
        const pctPl = plTotal > 0 ? (c.pl / plTotal) * 100 : 0;
        html += `
            <tr>
              <td style="font-weight: 700;">${c.classe_nome}</td>
              <td style="text-transform: capitalize;">${c.tipo}</td>
              <td class="num">${(c.cota || 0).toFixed(6)}</td>
              <td class="num" style="font-weight: 600;">${formatBrl(c.pl)}</td>
              <td class="num" style="font-weight: 700; color: var(--primary);">${formatPct(pctPl)}</td>
              <td>${c.spread ? `CDI + ${c.spread}% a.a.` : '—'}</td>
            </tr>
        `;
      }

      html += `
          </tbody>
        </table>

        <!-- Enquadramento de Subordinação -->
        <div style="margin-top: 1.25rem;">
          <div style="font-size: 0.9rem; font-weight: 700; margin-bottom: 6px; color: var(--text-muted);">LIMITES REGULAMENTARES DE SUBORDINAÇÃO</div>
          <table>
            <thead>
              <tr>
                <th>Regra / Limite</th>
                <th class="num">Exigido</th>
                <th class="num">Realizado</th>
                <th class="num">PL Vinculado</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
      `;

      for (const sub of (dash.subordinao || [])) {
        const sign = sub.tipo === 'min' ? '≥' : '≤';
        const badgeClass = sub.enquadrado ? 'badge-success' : 'badge-danger';
        const badgeLabel = sub.enquadrado ? '✓ ENQUADRADO' : '⚠️ DESENQUADRADO';

        html += `
              <tr>
                <td style="font-weight: 600;">${sub.descricao}</td>
                <td class="num">${sign} ${sub.limitePct}%</td>
                <td class="num" style="font-weight: 700;">${formatPct(sub.realPct)}</td>
                <td class="num">${formatBrl(sub.plValor)}</td>
                <td style="text-align: center;"><span class="badge ${badgeClass}">${badgeLabel}</span></td>
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

    // 2. Seção: Concentrações
    if (sections.concentracoes) {
      html += `
      <div class="section-card">
        <div class="section-title">🎯 Concentração de Carteira (Top Cedentes e Sacados)</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 1.5rem;">
          <div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">TOP CEDENTES</div>
            <table>
              <thead>
                <tr>
                  <th>Cedente</th>
                  <th class="num">Títulos</th>
                  <th class="num">Valor Presente</th>
                  <th class="num">% PL</th>
                </tr>
              </thead>
              <tbody>
      `;

      for (const ced of (dash.topCedentes || [])) {
        html += `
                <tr>
                  <td>
                    <div style="font-weight: 600;">${ced.nome}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${fmtCnpj(ced.cnpj)}</div>
                  </td>
                  <td class="num">${ced.titulos}</td>
                  <td class="num" style="font-weight: 600;">${formatBrl(ced.valor)}</td>
                  <td class="num" style="font-weight: 700; color: var(--primary);">${formatPct(ced.pctPL)}</td>
                </tr>
        `;
      }

      html += `
              </tbody>
            </table>
          </div>

          <div>
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 6px;">TOP SACADOS</div>
            <table>
              <thead>
                <tr>
                  <th>Sacado</th>
                  <th class="num">Títulos</th>
                  <th class="num">Valor Presente</th>
                  <th class="num">% PL</th>
                </tr>
              </thead>
              <tbody>
      `;

      for (const sac of (dash.topSacados || [])) {
        html += `
                <tr>
                  <td>
                    <div style="font-weight: 600;">${sac.nome}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${fmtCnpj(sac.cnpj)}</div>
                  </td>
                  <td class="num">${sac.titulos}</td>
                  <td class="num" style="font-weight: 600;">${formatBrl(sac.valor)}</td>
                  <td class="num" style="font-weight: 700; color: var(--primary);">${formatPct(sac.pctPL)}</td>
                </tr>
        `;
      }

      html += `
              </tbody>
            </table>
          </div>
        </div>
      </div>
      `;
    }

    // 3. Seção: PDD e Ratings
    if (sections.pdd && cart.porNota) {
      html += `
      <div class="section-card">
        <div class="section-title">⚠️ Provisão para Devedores Duvidosos (PDD por Rating)</div>
        <table>
          <thead>
            <tr>
              <th>Rating / Nota</th>
              <th class="num">Provisão %</th>
              <th class="num">Qtd Títulos</th>
              <th class="num">Valor Presente</th>
              <th class="num">PDD Calculado</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const n of (cart.porNota || [])) {
        html += `
            <tr>
              <td><span class="badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8;">Nota ${n.nota}</span></td>
              <td class="num">${n.pct_aliquota}%</td>
              <td class="num">${n.qtd}</td>
              <td class="num">${formatBrl(n.vp)}</td>
              <td class="num" style="font-weight: 700; color: var(--warning);">${formatBrl(n.pdd)}</td>
            </tr>
        `;
      }

      html += `
          </tbody>
        </table>
      </div>
      `;
    }

    // 4. Seção: Faixas de Vencimento
    if (sections.vencidos && cart.porVencimento) {
      html += `
      <div class="section-card">
        <div class="section-title">⏳ Faixas de Vencimento e Inadimplência</div>
        <table>
          <thead>
            <tr>
              <th>Faixa de Prazo</th>
              <th class="num">Qtd Títulos</th>
              <th class="num">Valor Presente</th>
              <th class="num">% da Carteira</th>
            </tr>
          </thead>
          <tbody>
      `;

      const vpTotal = cart.totais?.vp || 1;
      for (const v of (cart.porVencimento || [])) {
        const isVencido = v.faixa.startsWith('Vencido');
        const color = isVencido ? 'var(--danger)' : '#f8fafc';
        const pct = (v.vp / vpTotal) * 100;

        html += `
            <tr>
              <td style="font-weight: 600; color: ${color};">${v.faixa}</td>
              <td class="num">${v.qtd}</td>
              <td class="num" style="font-weight: 600;">${formatBrl(v.vp)}</td>
              <td class="num" style="font-weight: 700;">${formatPct(pct)}</td>
            </tr>
        `;
      }

      html += `
          </tbody>
        </table>
      </div>
      `;
    }

    // 5. Seção: Tipos de Ativo
    if (sections.tiposAtivo && cart.porTipo) {
      html += `
      <div class="section-card">
        <div class="section-title">📑 Decomposição por Tipo de Ativo</div>
        <table>
          <thead>
            <tr>
              <th>Tipo de Ativo</th>
              <th class="num">Qtd Títulos</th>
              <th class="num">Valor Presente</th>
              <th class="num">% da Carteira</th>
            </tr>
          </thead>
          <tbody>
      `;

      const vpTotal = cart.totais?.vp || 1;
      for (const t of (cart.porTipo || [])) {
        const pct = (t.vp / vpTotal) * 100;
        html += `
            <tr>
              <td style="font-weight: 600;">${t.tipo_ativo || 'Não Especificado'}</td>
              <td class="num">${t.qtd}</td>
              <td class="num" style="font-weight: 600;">${formatBrl(t.vp)}</td>
              <td class="num" style="font-weight: 700; color: var(--primary);">${formatPct(pct)}</td>
            </tr>
        `;
      }

      html += `
          </tbody>
        </table>
      </div>
      `;
    }

    html += `
    </div> <!-- /fundo-block -->
    `;
  }

  html += `
    <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; margin-top: 3rem; border-top: 1px solid var(--card-border); padding-top: 1.5rem;">
      Relatório gerado automaticamente pelo <strong>LeptaSys</strong> • Lepta Capital • ${new Date().toLocaleString('pt-BR')}
    </div>
  </div>
</body>
</html>`;

  return html;
}
