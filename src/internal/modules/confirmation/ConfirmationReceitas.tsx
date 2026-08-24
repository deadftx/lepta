import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Plus, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';

interface ReceitasProps {
  fundoId: string;
}

export const ConfirmationReceitas: React.FC<ReceitasProps> = ({ fundoId }) => {
  const [data, setData] = useState<any>({ lancamentos: [], porCedente: [] });
  const [loading, setLoading] = useState(true);
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState(new Date().toISOString().substring(0, 10));
  const [modalCedente, setModalCedente] = useState('');
  const [modalBruto, setModalBruto] = useState('');
  const [modalLiquido, setModalLiquido] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const fetchReceitas = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/confirmacao/receitas?fundo_id=${fundoId}`;
      if (ano) url += `&ano=${ano}`;
      if (mes) url += `&mes=${mes}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Erro ao buscar receitas:', err);
    } finally {
      setLoading(false);
    }
  }, [fundoId, ano, mes]);

  useEffect(() => {
    fetchReceitas();
  }, [fetchReceitas]);

  const handleSaveReceita = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/receitas`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fundo_id: fundoId,
          data: modalData,
          cedente_nome: modalCedente,
          valor_bruto: Number(modalBruto) || 0,
          valor_liquido: Number(modalLiquido) || 0
        })
      });

      if (res.ok) {
        setToastMsg('Receita lançada com sucesso!');
        setIsModalOpen(false);
        setModalCedente('');
        setModalBruto('');
        setModalLiquido('');
        fetchReceitas();
        setTimeout(() => setToastMsg(null), 4000);
      }
    } catch (err) {
      console.error('Erro ao lançar receita:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const formatBrl = (v: number) => {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const totalBruto = data.lancamentos?.reduce((s: number, r: any) => s + (r.valor_bruto || 0), 0);
  const totalLiquido = data.lancamentos?.reduce((s: number, r: any) => s + (r.valor_liquido || 0), 0);

  return (
    <div>
      <div className="cs-search-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Filtrar Ano/Mês:</label>
          <input
            type="number"
            className="cs-date-input"
            style={{ width: '90px' }}
            placeholder="Ano"
            value={ano}
            onChange={e => setAno(e.target.value)}
          />
          <select
            className="cs-date-input"
            value={mes}
            onChange={e => setMes(e.target.value)}
          >
            <option value="">Todos os Meses</option>
            <option value="01">Janeiro</option>
            <option value="02">Fevereiro</option>
            <option value="03">Março</option>
            <option value="04">Abril</option>
            <option value="05">Maio</option>
            <option value="06">Junho</option>
            <option value="07">Julho</option>
            <option value="08">Agosto</option>
            <option value="09">Setembro</option>
            <option value="10">Outubro</option>
            <option value="11">Novembro</option>
            <option value="12">Dezembro</option>
          </select>
          <button className="cs-page-btn" onClick={fetchReceitas}>
            <RefreshCw size={14} /> Filtrar
          </button>
        </div>

        <button className="cs-btn-save" onClick={() => setIsModalOpen(true)} style={{ padding: '8px 18px', fontSize: '0.88rem' }}>
          <Plus size={16} /> Lançar Receita
        </button>
      </div>

      {toastMsg && (
        <div className="cs-badge success" style={{ padding: '10px 16px', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }}>
          <CheckCircle2 size={16} /> {toastMsg}
        </div>
      )}

      {/* KPI Cards de Receita */}
      <div className="cs-kpi-grid">
        <div className="cs-kpi-card">
          <div className="cs-kpi-label">Receita Bruta Total</div>
          <div className="cs-kpi-value">{formatBrl(totalBruto)}</div>
          <div className="cs-kpi-sub">{data.lancamentos?.length || 0} lançamentos</div>
        </div>

        <div className="cs-kpi-card">
          <div className="cs-kpi-label">Receita Líquida Total</div>
          <div className="cs-kpi-value" style={{ color: '#4ade80' }}>{formatBrl(totalLiquido)}</div>
          <div className="cs-kpi-sub">Resultado líquido apurado</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        {/* Lançamentos Detalhados */}
        <div className="cs-card">
          <h3 className="cs-card-title">
            <DollarSign size={18} color="#38bdf8" /> Lançamentos de Receita
          </h3>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
              <p>Carregando receitas...</p>
            </div>
          ) : (
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cedente</th>
                  <th style={{ textAlign: 'right' }}>Valor Bruto</th>
                  <th style={{ textAlign: 'right' }}>Valor Líquido</th>
                </tr>
              </thead>
              <tbody>
                {data.lancamentos?.map((r: any) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{r.data}</td>
                    <td>{r.cedente_nome}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatBrl(r.valor_bruto)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>{formatBrl(r.valor_liquido)}</td>
                  </tr>
                ))}
                {data.lancamentos?.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                      Nenhum lançamento encontrado para o período.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>

        {/* Agrupamento por Cedente */}
        <div className="cs-card">
          <h3 className="cs-card-title">
            <DollarSign size={18} color="#fbbf24" /> Receita por Cedente
          </h3>
          <div className="cs-table-wrapper">
            <table className="cs-table">
              <thead>
                <tr>
                  <th>Cedente</th>
                  <th style={{ textAlign: 'right' }}>Lançamentos</th>
                  <th style={{ textAlign: 'right' }}>Bruto</th>
                  <th style={{ textAlign: 'right' }}>Líquido</th>
                </tr>
              </thead>
              <tbody>
                {data.porCedente?.map((r: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600, color: '#f8fafc' }}>{r.cedente_nome}</td>
                    <td style={{ textAlign: 'right' }}>{r.lancamentos}</td>
                    <td style={{ textAlign: 'right' }}>{formatBrl(r.bruto)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#4ade80' }}>{formatBrl(r.liquido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de Lançamento */}
      {isModalOpen && (
        <div className="cs-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="cs-modal" onClick={e => e.stopPropagation()}>
            <div className="cs-modal-header">
              <h3 className="cs-modal-title">Novo Lançamento de Receita</h3>
              <button className="cs-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveReceita}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Data:
                </label>
                <input
                  type="date"
                  className="cs-search-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={modalData}
                  onChange={e => setModalData(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                  Nome do Cedente:
                </label>
                <input
                  type="text"
                  placeholder="Razão social do cedente"
                  className="cs-search-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={modalCedente}
                  onChange={e => setModalCedente(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Valor Bruto (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 5000.00"
                    className="cs-search-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={modalBruto}
                    onChange={e => setModalBruto(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    Valor Líquido (R$):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 4800.00"
                    className="cs-search-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={modalLiquido}
                    onChange={e => setModalLiquido(e.target.value)}
                    required
                  />
                </div>
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
                  {submitting ? 'Salvando...' : 'Lançar Receita'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmationReceitas;
