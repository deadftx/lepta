import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Plus, RefreshCw, CheckCircle2, X
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';

interface CotasProps {
  fundoId: string;
  classes: any[];
}

export const ConfirmationCotas: React.FC<CotasProps> = ({ fundoId, classes }) => {
  const [cotas, setCotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState(new Date().toISOString().substring(0, 10));
  const [modalValores, setModalValores] = useState<{ [key: string]: { cota: string; pl: string } }>({});
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchCotas = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/confirmacao/cotas?fundo_id=${fundoId}&limit=120`;
      if (dataInicio) url += `&data_inicio=${dataInicio}`;
      if (dataFim) url += `&data_fim=${dataFim}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCotas(data);
      }
    } catch (err) {
      console.error('Erro ao buscar cotas:', err);
    } finally {
      setLoading(false);
    }
  }, [fundoId, dataInicio, dataFim]);

  useEffect(() => {
    fetchCotas();
  }, [fetchCotas]);

  const handleOpenModal = () => {
    const initial: any = {};
    classes.filter(c => c.fundo_id === fundoId).forEach(c => {
      initial[c.id] = { cota: '', pl: '' };
    });
    setModalValores(initial);
    setIsModalOpen(true);
  };

  const handleSaveCotas = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payloadClasses = Object.entries(modalValores).map(([classe_id, vals]) => ({
        classe_id,
        cota: Number(vals.cota) || 0,
        pl: Number(vals.pl) || 0
      }));

      const res = await fetch(`${API_BASE_URL}/api/confirmacao/cotas`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fundo_id: fundoId,
          data: modalData,
          classes_cotas: payloadClasses
        })
      });

      if (res.ok) {
        setToastMsg('Cotas cadastradas com sucesso!');
        setIsModalOpen(false);
        fetchCotas();
        setTimeout(() => setToastMsg(null), 4000);
      }
    } catch (err) {
      console.error('Erro ao salvar cotas:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatBrl = (v: number) => {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    const parts = d.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return d;
  };

  const fundoClasses = classes.filter(c => c.fundo_id === fundoId);

  return (
    <div>
      <div className="cs-search-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Período:</label>
          <input
            type="date"
            className="cs-date-input"
            value={dataInicio}
            onChange={e => setDataInicio(e.target.value)}
          />
          <span style={{ color: '#64748b' }}>até</span>
          <input
            type="date"
            className="cs-date-input"
            value={dataFim}
            onChange={e => setDataFim(e.target.value)}
          />
          <button className="cs-page-btn" onClick={fetchCotas}>
            <RefreshCw size={14} /> Filtrar
          </button>
        </div>

        <button className="cs-btn-save" onClick={handleOpenModal} style={{ padding: '8px 18px', fontSize: '0.88rem' }}>
          <Plus size={16} /> Lançar Cota Diária
        </button>
      </div>

      {toastMsg && (
        <div className="cs-badge success" style={{ padding: '10px 16px', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }}>
          <CheckCircle2 size={16} /> {toastMsg}
        </div>
      )}

      <div className="cs-card">
        <h3 className="cs-card-title">
          <TrendingUp size={18} color="#38bdf8" /> Histórico de Cotas e Patrimônio Líquido
        </h3>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
            <p>Carregando histórico de cotas...</p>
          </div>
        ) : (
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Classe</th>
                  <th>Tipo</th>
                  <th style={{ textAlign: 'right' }}>Valor da Cota</th>
                  <th style={{ textAlign: 'right' }}>Patrimônio Líquido</th>
                  <th style={{ textAlign: 'right' }}>CDI Anual</th>
                  <th style={{ textAlign: 'right' }}>Spread Alvo</th>
                </tr>
              </thead>
              <tbody>
                {cotas.map((r, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{formatDate(r.data)}</td>
                    <td style={{ fontWeight: 600 }}>{r.classe_nome}</td>
                    <td>
                      <span className={`cs-badge ${r.tipo}`}>
                        {r.tipo?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{r.cota?.toFixed(4)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(r.pl)}</td>
                    <td style={{ textAlign: 'right', color: '#38bdf8' }}>
                      {r.cdi_anual ? `${r.cdi_anual.toFixed(2)}% a.a.` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                      {r.spread ? `+ ${r.spread}%` : '—'}
                    </td>
                  </tr>
                ))}
                {cotas.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      Nenhum registro de cota encontrado para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Lançamento de Cotas */}
      {isModalOpen && (
        <div className="cs-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="cs-modal" onClick={e => e.stopPropagation()}>
            <div className="cs-modal-header">
              <h3 className="cs-modal-title">Lançamento de Cotas Diárias</h3>
              <button className="cs-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCotas}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Data de Competência:
                </label>
                <input
                  type="date"
                  className="cs-search-input"
                  style={{ width: '100%' }}
                  value={modalData}
                  onChange={e => setModalData(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {fundoClasses.map(c => (
                  <div key={c.id} style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '12px', borderRadius: '10px' }}>
                    <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{c.nome}</span>
                      <span className={`cs-badge ${c.tipo}`}>{c.tipo}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                          Valor da Cota:
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="Ex: 1054.3210"
                          className="cs-search-input"
                          style={{ width: '100%' }}
                          value={modalValores[c.id]?.cota || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setModalValores(prev => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], cota: val }
                            }));
                          }}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                          Patrimônio Líquido (R$):
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Ex: 15400250.00"
                          className="cs-search-input"
                          style={{ width: '100%' }}
                          value={modalValores[c.id]?.pl || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setModalValores(prev => ({
                              ...prev,
                              [c.id]: { ...prev[c.id], pl: val }
                            }));
                          }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="cs-page-btn"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cs-btn-save"
                  disabled={submitting}
                  style={{ padding: '8px 20px' }}
                >
                  {submitting ? 'Salvando...' : 'Salvar Cotas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmationCotas;
