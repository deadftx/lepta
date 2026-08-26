import React, { useState, useEffect, useCallback } from 'react';
import {
  Layers, ShieldAlert, AlertTriangle, PieChart, BarChart2, Upload, X, FileSpreadsheet
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

  // Modal de Importação de Estoque
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [estoqueFile, setEstoqueFile] = useState<File | null>(null);
  const [dataImportacao, setDataImportacao] = useState(dataPosicao || new Date().toISOString().substring(0, 10));
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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

  const handleImportEstoque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!estoqueFile) return;

    setUploading(true);
    setUploadFeedback(null);

    const formData = new FormData();
    formData.append('file', estoqueFile);
    formData.append('fundo_id', fundoId);
    formData.append('data', dataImportacao);

    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/estoque/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setUploadFeedback({ type: 'success', msg: json.message || 'Estoque importado com sucesso!' });
        fetchCarteira();
        setTimeout(() => {
          setIsUploadModalOpen(false);
          setUploadFeedback(null);
          setEstoqueFile(null);
        }, 2500);
      } else {
        setUploadFeedback({ type: 'error', msg: json.error || 'Erro ao importar arquivo de estoque.' });
      }
    } catch (err: any) {
      setUploadFeedback({ type: 'error', msg: err.message || 'Falha de conexão com o servidor.' });
    } finally {
      setUploading(false);
    }
  };

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

  return (
    <div>
      {/* Sub-navegação interna da Carteira & Botão de Importação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '8px' }}>
        <div className="cs-tabs" style={{ margin: 0, border: 'none' }}>
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

        <button
          className="cs-page-btn"
          onClick={() => {
            setDataImportacao(dataPosicao || new Date().toISOString().substring(0, 10));
            setIsUploadModalOpen(true);
          }}
          style={{
            padding: '8px 14px',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(56, 189, 248, 0.15)',
            borderColor: '#38bdf8',
            color: '#38bdf8',
            fontWeight: 700
          }}
        >
          <Upload size={15} /> Importar Estoque (.csv / .xlsx)
        </button>
      </div>

      {/* Modal de Importação de Estoque */}
      {isUploadModalOpen && (
        <div className="cs-modal-overlay">
          <div className="cs-modal-card" style={{ maxWidth: '520px' }}>
            <div className="cs-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="#38bdf8" /> Importar Estoque de Títulos / Financeiro
              </h3>
              <button
                className="cs-icon-btn"
                onClick={() => setIsUploadModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportEstoque} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  FIDC Destino:
                </label>
                <input
                  type="text"
                  className="cs-date-input"
                  value={fundoId === 'MULTISETORIAL' ? 'LEPTA MULTISETORIAL FIDC' : 'LEPTA SPECIAL OPPORTUNITIES FIDC'}
                  disabled
                  style={{ width: '100%', opacity: 0.8 }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Data de Posição do Estoque:
                </label>
                <input
                  type="date"
                  className="cs-date-input"
                  value={dataImportacao}
                  onChange={e => setDataImportacao(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Arquivo de Estoque (.csv ou .xlsx):
                </label>
                <input
                  type="file"
                  accept=".csv, .xlsx"
                  onChange={e => setEstoqueFile(e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    background: '#090d16',
                    border: '1px dashed rgba(56, 189, 248, 0.4)',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.85rem'
                  }}
                  required
                />
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px', lineHeight: 1.4 }}>
                  ✓ O arquivo atualiza o snapshot de carteira e todos os títulos, PDDs e vencimentos no banco da VPS.
                </div>
              </div>

              {uploadFeedback && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    background: uploadFeedback.type === 'success' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                    color: uploadFeedback.type === 'success' ? '#4ade80' : '#f87171',
                    border: `1px solid ${uploadFeedback.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`
                  }}
                >
                  {uploadFeedback.msg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="cs-page-btn"
                  onClick={() => setIsUploadModalOpen(false)}
                  disabled={uploading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cs-page-btn"
                  disabled={uploading || !estoqueFile}
                  style={{ background: '#0284c7', borderColor: '#38bdf8', color: '#fff', fontWeight: 700 }}
                >
                  {uploading ? 'Importando...' : 'Salvar no Banco'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {(!data || data.error) && (
        <div className="cs-card" style={{ textAlign: 'center', padding: '3rem', marginTop: '1rem' }}>
          <p style={{ color: '#94a3b8' }}>{data?.error || 'Nenhum snapshot de carteira disponível para a data selecionada.'}</p>
        </div>
      )}

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
