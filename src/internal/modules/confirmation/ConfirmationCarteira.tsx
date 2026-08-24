import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers, ShieldAlert, AlertTriangle, PieChart, BarChart2
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';

interface CarteiraProps {
  fundoId: string;
  dataPosicao: string;
}

export const ConfirmationCarteira: React.FC<CarteiraProps> = ({ fundoId, dataPosicao }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'pdd' | 'tipos' | 'vencidos' | 'riscos'>('geral');

  const fetchCarteira = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/confirmacao/carteira?fundo_id=${fundoId}`;
      if (dataPosicao) url += `&data=${dataPosicao}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Erro ao buscar carteira:', err);
    } finally {
      setLoading(false);
    }
  }, [fundoId, dataPosicao]);

  useEffect(() => {
    fetchCarteira();
  }, [fetchCarteira]);

  const formatBrl = (v: number) => {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatPct = (v: number) => {
    return `${(v || 0).toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
        <p>Carregando composição da carteira e estoque...</p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="cs-card" style={{ textAlign: 'center', padding: '3rem' }}>
        <p style={{ color: '#94a3b8' }}>{data?.error || 'Nenhum snapshot de carteira disponível.'}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Sub-navegação interna da Carteira */}
      <div className="cs-tabs" style={{ marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <button
          className={`cs-tab-btn ${activeSubTab === 'geral' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('geral')}
        >
          <Layers size={16} /> Visão Geral
        </button>
        <button
          className={`cs-tab-btn ${activeSubTab === 'pdd' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('pdd')}
        >
          <ShieldAlert size={16} /> PDD por Rating
        </button>
        <button
          className={`cs-tab-btn ${activeSubTab === 'tipos' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('tipos')}
        >
          <PieChart size={16} /> Tipos de Ativo
        </button>
        <button
          className={`cs-tab-btn ${activeSubTab === 'vencidos' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('vencidos')}
        >
          <AlertTriangle size={16} /> Faixas de Vencimento
        </button>
        <button
          className={`cs-tab-btn ${activeSubTab === 'riscos' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('riscos')}
        >
          <BarChart2 size={16} /> Concentração (Cedentes/Sacados)
        </button>
      </div>

      {/* ── 1. VISÃO GERAL ── */}
      {activeSubTab === 'geral' && (
        <div>
          <div className="cs-kpi-grid">
            <div className="cs-kpi-card">
              <div className="cs-kpi-label">Total de Títulos</div>
              <div className="cs-kpi-value">{data.totais?.total_titulos?.toLocaleString('pt-BR')}</div>
              <div className="cs-kpi-sub">Data: {data.data}</div>
            </div>
            <div className="cs-kpi-card">
              <div className="cs-kpi-label">Valor Presente Total</div>
              <div className="cs-kpi-value">{formatBrl(data.totais?.vp)}</div>
              <div className="cs-kpi-sub">Valor de mercado</div>
            </div>
            <div className="cs-kpi-card">
              <div className="cs-kpi-label">Valor Nominal Atual</div>
              <div className="cs-kpi-value">{formatBrl(data.totais?.vna)}</div>
              <div className="cs-kpi-sub">Face dos títulos</div>
            </div>
            <div className="cs-kpi-card">
              <div className="cs-kpi-label">PDD Total</div>
              <div className="cs-kpi-value" style={{ color: '#fbbf24' }}>{formatBrl(data.totais?.pdd_total)}</div>
              <div className="cs-kpi-sub">Provisão calculada</div>
            </div>
          </div>

          <div className="cs-card">
            <h3 className="cs-card-title">
              <Layers size={18} color="#38bdf8" /> Resumo Consolidado do Estoque
            </h3>
            <div className="cs-table-wrapper">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    <th style={{ textAlign: 'right' }}>Valor Consolidado</th>
                    <th style={{ textAlign: 'right' }}>% do PL</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Valor Presente da Carteira (VP)</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(data.totais?.vp)}</td>
                    <td style={{ textAlign: 'right' }}>{data.plTotal ? formatPct((data.totais?.vp / data.plTotal) * 100) : '-'}</td>
                  </tr>
                  <tr>
                    <td>Valor de Aquisição (VA)</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(data.totais?.va)}</td>
                    <td style={{ textAlign: 'right' }}>{data.plTotal ? formatPct((data.totais?.va / data.plTotal) * 100) : '-'}</td>
                  </tr>
                  <tr>
                    <td>Valor Nominal Original (VNO)</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(data.totais?.vno)}</td>
                    <td style={{ textAlign: 'right' }}>-</td>
                  </tr>
                  <tr>
                    <td>PDD por Nota / Rating</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#fbbf24' }}>{formatBrl(data.totais?.pdd_nota)}</td>
                    <td style={{ textAlign: 'right' }}>{data.plTotal ? formatPct((data.totais?.pdd_nota / data.plTotal) * 100) : '-'}</td>
                  </tr>
                  <tr>
                    <td>PDD por Vencimento / Atraso</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#f87171' }}>{formatBrl(data.totais?.pdd_vencido)}</td>
                    <td style={{ textAlign: 'right' }}>{data.plTotal ? formatPct((data.totais?.pdd_vencido / data.plTotal) * 100) : '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. PDD POR RATING ── */}
      {activeSubTab === 'pdd' && (
        <div className="cs-card">
          <h3 className="cs-card-title">
            <ShieldAlert size={18} color="#fbbf24" /> Provisão para Devedores Duvidosos (PDD) por Rating
          </h3>
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Nota / Rating</th>
                  <th style={{ textAlign: 'right' }}>Quantidade de Títulos</th>
                  <th style={{ textAlign: 'right' }}>Valor Presente (R$)</th>
                  <th style={{ textAlign: 'right' }}>PDD Calculada (R$)</th>
                  <th style={{ textAlign: 'right' }}>% PDD s/ Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.porNota?.map((r: any, idx: number) => {
                  const pct = r.valor > 0 ? (r.pdd / r.valor) * 100 : 0;
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: '#f8fafc' }}>
                        <span className="cs-badge warning">{r.nota}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{r.titulos?.toLocaleString('pt-BR')}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(r.valor)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>{formatBrl(r.pdd)}</td>
                      <td style={{ textAlign: 'right' }}>{pct.toFixed(2)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 3. TIPOS DE ATIVO ── */}
      {activeSubTab === 'tipos' && (
        <div className="cs-card">
          <h3 className="cs-card-title">
            <PieChart size={18} color="#38bdf8" /> Distribuição por Tipo de Ativo
          </h3>
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Tipo de Ativo</th>
                  <th style={{ textAlign: 'right' }}>Quantidade</th>
                  <th style={{ textAlign: 'right' }}>Valor Presente (R$)</th>
                  <th style={{ textAlign: 'right' }}>PDD (R$)</th>
                  <th style={{ textAlign: 'right' }}>% do PL</th>
                </tr>
              </thead>
              <tbody>
                {data.porTipo?.map((r: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{r.tipo}</td>
                    <td style={{ textAlign: 'right' }}>{r.titulos?.toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(r.valor)}</td>
                    <td style={{ textAlign: 'right', color: '#fbbf24' }}>{formatBrl(r.pdd)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>{formatPct(r.pctPL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. FAIXAS DE VENCIMENTO ── */}
      {activeSubTab === 'vencidos' && (
        <div className="cs-card">
          <h3 className="cs-card-title">
            <AlertTriangle size={18} color="#f87171" /> Títulos por Faixa de Vencimento e Atraso
          </h3>
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Faixa de Vencimento</th>
                  <th style={{ textAlign: 'right' }}>Quantidade</th>
                  <th style={{ textAlign: 'right' }}>Valor Presente (R$)</th>
                  <th style={{ textAlign: 'right' }}>PDD (R$)</th>
                </tr>
              </thead>
              <tbody>
                {data.porVencimento?.map((r: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>
                      <span className={`cs-badge ${r.faixa?.includes('Vencido') ? 'danger' : 'success'}`}>
                        {r.faixa}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{r.titulos?.toLocaleString('pt-BR')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(r.valor)}</td>
                    <td style={{ textAlign: 'right', color: '#fbbf24' }}>{formatBrl(r.pdd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. RISCOS & CONCENTRAÇÃO ── */}
      {activeSubTab === 'riscos' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
          <div className="cs-card">
            <h3 className="cs-card-title">Top 15 Maiores Cedentes</h3>
            <div className="cs-table-wrapper">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>Cedente</th>
                    <th style={{ textAlign: 'right' }}>Títulos</th>
                    <th style={{ textAlign: 'right' }}>Valor (R$)</th>
                    <th style={{ textAlign: 'right' }}>% PL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCedentes?.map((r: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{r.nome}</td>
                      <td style={{ textAlign: 'right' }}>{r.titulos}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(r.valor)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>{formatPct(r.pctPL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="cs-card">
            <h3 className="cs-card-title">Top 15 Maiores Sacados</h3>
            <div className="cs-table-wrapper">
              <table className="cs-table">
                <thead>
                  <tr>
                    <th>Sacado</th>
                    <th style={{ textAlign: 'right' }}>Títulos</th>
                    <th style={{ textAlign: 'right' }}>Valor (R$)</th>
                    <th style={{ textAlign: 'right' }}>% PL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topSacados?.map((r: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{r.nome}</td>
                      <td style={{ textAlign: 'right' }}>{r.titulos}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(r.valor)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>{formatPct(r.pctPL)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmationCarteira;
