import React from 'react';
import {
  Wallet, ShieldAlert, CheckCircle2, AlertTriangle,
  BarChart3, PieChart, Users, ArrowUpRight, ArrowDownRight, Layers
} from 'lucide-react';

interface DashboardProps {
  data: any;
  loading: boolean;
}

export const ConfirmationDashboard: React.FC<DashboardProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
        <p>Carregando indicadores do FIDC...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="cs-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#94a3b8' }}>Nenhum dado encontrado para a data e fundo selecionados.</p>
      </div>
    );
  }

  const formatBrl = (v: number) => {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPct = (v: number) => {
    return `${(v || 0).toFixed(2)}%`;
  };

  return (
    <div>
      {/* ── KPI GRID ── */}
      <div className="cs-kpi-grid">
        <div className="cs-kpi-card">
          <div className="cs-kpi-card-header">
            <span className="cs-kpi-label">Patrimônio Líquido (PL)</span>
            <Wallet size={18} color="#38bdf8" />
          </div>
          <div className="cs-kpi-value">{formatBrl(data.plTotal)}</div>
          <div className={`cs-kpi-sub ${data.plVariacaoPct >= 0 ? 'positive' : 'negative'}`}>
            {data.plVariacaoPct >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {data.plVariacaoPct ? `${data.plVariacaoPct.toFixed(2)}% vs D-1` : 'Sem variação'}
          </div>
        </div>

        <div className="cs-kpi-card">
          <div className="cs-kpi-card-header">
            <span className="cs-kpi-label">Carteira de Direitos Creditórios</span>
            <Layers size={18} color="#818cf8" />
          </div>
          <div className="cs-kpi-value">{formatBrl(data.carteira?.valorPresente)}</div>
          <div className="cs-kpi-sub">
            {data.carteira?.totalTitulos?.toLocaleString('pt-BR')} títulos ativos
          </div>
        </div>

        <div className="cs-kpi-card">
          <div className="cs-kpi-card-header">
            <span className="cs-kpi-label">PDD Total (Provisão)</span>
            <ShieldAlert size={18} color="#fbbf24" />
          </div>
          <div className="cs-kpi-value">{formatBrl(data.carteira?.pddTotal)}</div>
          <div className="cs-kpi-sub">
            {formatPct(data.carteira?.pddPctPL)} do PL total
          </div>
        </div>

        <div className="cs-kpi-card">
          <div className="cs-kpi-card-header">
            <span className="cs-kpi-label">Títulos Vencidos</span>
            <AlertTriangle size={18} color="#f87171" />
          </div>
          <div className="cs-kpi-value">{formatBrl(data.carteira?.vencidosValor)}</div>
          <div className={`cs-kpi-sub ${data.carteira?.vencidosPctPL > 15 ? 'negative' : ''}`}>
            {formatPct(data.carteira?.vencidosPctPL)} do PL total
          </div>
        </div>
      </div>

      {/* ── GRID: SUBORDINAÇÃO & CLASSES DE COTAS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Classes de Cotas */}
        <div className="cs-card">
          <h3 className="cs-card-title">
            <BarChart3 size={18} color="#38bdf8" /> Composição das Classes de Cotas
          </h3>
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Classe</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Valor da Cota</th>
                  <th style={{ textAlign: 'right' }}>Patrimônio Líquido</th>
                  <th style={{ textAlign: 'right' }}>% PL</th>
                </tr>
              </thead>
              <tbody>
                {data.cotas?.map((c: any) => {
                  const pct = data.plTotal > 0 ? (c.pl / data.plTotal) * 100 : 0;
                  return (
                    <tr key={c.classe_id}>
                      <td style={{ fontWeight: 600, color: '#f8fafc' }}>{c.classe_nome}</td>
                      <td>
                        <span className={`cs-badge ${c.tipo}`}>
                          {c.tipo?.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{c.cota?.toFixed(4)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(c.pl)}</td>
                      <td style={{ textAlign: 'right' }}>{pct.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Enquadramento de Subordinação */}
        <div className="cs-card">
          <h3 className="cs-card-title">
            <PieChart size={18} color="#38bdf8" /> Enquadramento de Subordinação
          </h3>
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Regra / Limite</th>
                  <th style={{ textAlign: 'right' }}>Exigido</th>
                  <th style={{ textAlign: 'right' }}>Realizado</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.subordinao?.map((sub: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{sub.descricao}</td>
                    <td style={{ textAlign: 'right' }}>
                      {sub.tipo === 'min' ? '≥ ' : '≤ '}
                      {sub.limitePct}%
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: sub.enquadrado ? '#4ade80' : '#f87171' }}>
                      {formatPct(sub.realPct)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`cs-badge ${sub.enquadrado ? 'success' : 'danger'}`}>
                        {sub.enquadrado ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        {sub.enquadrado ? 'ENQUADRADO' : 'DESENQUADRADO'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── GRID: CONCENTRAÇÃO TOP CEDENTES E SACADOS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Top Cedentes */}
        <div className="cs-card">
          <h3 className="cs-card-title">
            <Users size={18} color="#38bdf8" /> Concentração - Top 5 Cedentes
          </h3>
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Cedente</th>
                  <th style={{ textAlign: 'right' }}>Títulos</th>
                  <th style={{ textAlign: 'right' }}>Valor Presente</th>
                  <th style={{ textAlign: 'right' }}>% PL</th>
                </tr>
              </thead>
              <tbody>
                {data.topCedentes?.map((ced: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{ced.nome}</td>
                    <td style={{ textAlign: 'right' }}>{ced.titulos}</td>
                    <td style={{ textAlign: 'right' }}>{formatBrl(ced.valor)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                      {formatPct(ced.pctPL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Sacados */}
        <div className="cs-card">
          <h3 className="cs-card-title">
            <Users size={18} color="#fbbf24" /> Concentração - Top 5 Sacados
          </h3>
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Sacado</th>
                  <th style={{ textAlign: 'right' }}>Títulos</th>
                  <th style={{ textAlign: 'right' }}>Valor Presente</th>
                  <th style={{ textAlign: 'right' }}>% PL</th>
                </tr>
              </thead>
              <tbody>
                {data.topSacados?.map((sac: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{sac.nome}</td>
                    <td style={{ textAlign: 'right' }}>{sac.titulos}</td>
                    <td style={{ textAlign: 'right' }}>{formatBrl(sac.valor)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>
                      {formatPct(sac.pctPL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDashboard;
