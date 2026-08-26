import React, { useState, useEffect, useCallback } from 'react';
import { DollarSign, Plus, CheckCircle2, RefreshCw, X, Upload, FileSpreadsheet } from 'lucide-react';
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

  // Modal de Importação Excel (.xlsx)
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelDataPosicao, setExcelDataPosicao] = useState(new Date().toISOString().substring(0, 10));
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelFeedback, setExcelFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

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

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) return;

    setUploadingExcel(true);
    setExcelFeedback(null);

    const formData = new FormData();
    formData.append('file', excelFile);
    formData.append('fundo_id', fundoId);
    formData.append('data', excelDataPosicao);

    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/receitas/import-excel`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setExcelFeedback({ type: 'success', msg: json.message || 'Planilha importada com sucesso!' });
        setToastMsg(`Planilha importada com sucesso! (${json.count} lançamentos adicionados)`);
        fetchReceitas();
        setTimeout(() => {
          setIsExcelModalOpen(false);
          setExcelFeedback(null);
          setExcelFile(null);
        }, 2000);
      } else {
        setExcelFeedback({ type: 'error', msg: json.error || 'Erro ao importar planilha.' });
      }
    } catch (err: any) {
      setExcelFeedback({ type: 'error', msg: err.message || 'Falha de conexão com o servidor.' });
    } finally {
      setUploadingExcel(false);
    }
  };

  const formatBrl = (v: number) => {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const totalBruto = data.lancamentos?.reduce((s: number, r: any) => s + (r.valor_bruto || 0), 0);
  const totalLiquido = data.lancamentos?.reduce((s: number, r: any) => s + (r.valor_liquido || 0), 0);

  return (
    <div>
      <div className="cs-search-row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
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

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="cs-page-btn"
            onClick={() => setIsExcelModalOpen(true)}
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
            <Upload size={16} /> Importar Planilha (.xlsx)
          </button>

          <button className="cs-btn-save" onClick={() => setIsModalOpen(true)} style={{ padding: '8px 18px', fontSize: '0.88rem' }}>
            <Plus size={16} /> Novo Lançamento Manual
          </button>
        </div>
      </div>

      {/* Modal de Importação Excel de Receita */}
      {isExcelModalOpen && (
        <div className="cs-modal-overlay">
          <div className="cs-modal-card" style={{ maxWidth: '500px' }}>
            <div className="cs-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="#38bdf8" /> Importar Receita via Planilha Excel
              </h3>
              <button
                className="cs-icon-btn"
                onClick={() => setIsExcelModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleImportExcel} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Data de Lançamento / Posição:
                </label>
                <input
                  type="date"
                  className="cs-date-input"
                  value={excelDataPosicao}
                  onChange={e => setExcelDataPosicao(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Arquivo Excel (.xlsx padrão):
                </label>
                <input
                  type="file"
                  accept=".xlsx"
                  onChange={e => setExcelFile(e.target.files?.[0] || null)}
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
                  ✓ O sistema lê automaticamente as colunas da planilha padrão:
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    <li><strong>CedenteNome</strong> (Nome do Cedente)</li>
                    <li><strong>ValorNominalOriginal</strong> (Valor Bruto)</li>
                    <li><strong>ValorAquisicao</strong> (Valor Líquido)</li>
                  </ul>
                </div>
              </div>

              {excelFeedback && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    background: excelFeedback.type === 'success' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                    color: excelFeedback.type === 'success' ? '#4ade80' : '#f87171',
                    border: `1px solid ${excelFeedback.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`
                  }}
                >
                  {excelFeedback.msg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="cs-page-btn"
                  onClick={() => setIsExcelModalOpen(false)}
                  disabled={uploadingExcel}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cs-page-btn"
                  disabled={uploadingExcel || !excelFile}
                  style={{ background: '#0284c7', borderColor: '#38bdf8', color: '#fff', fontWeight: 700 }}
                >
                  {uploadingExcel ? 'Importando...' : 'Salvar no Banco'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
