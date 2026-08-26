import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, RefreshCw, Calendar, Upload,
  TrendingUp, ArrowRight, ShieldCheck, X
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';

interface ImportStatusProps {
  initialDate?: string;
  onNavigateTab?: (tab: any, fundo?: 'MULTISETORIAL' | 'SPECIAL') => void;
}

export const ConfirmationImportStatus: React.FC<ImportStatusProps> = ({ initialDate, onNavigateTab }) => {
  const [dataConsulta, setDataConsulta] = useState<string>(
    initialDate || new Date().toISOString().substring(0, 10)
  );
  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Modais de Upload Direto
  const [activeUploadModal, setActiveUploadModal] = useState<{
    tipo: 'RECEITA' | 'ESTOQUE' | 'COTAS';
    fundoId: 'MULTISETORIAL' | 'SPECIAL';
    fundoNome: string;
  } | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/importacoes/status?data=${dataConsulta}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const json = await res.json();
        setStatusData(json);
      }
    } catch (err) {
      console.error('Erro ao buscar status de importações:', err);
    } finally {
      setLoading(false);
    }
  }, [dataConsulta]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleOpenUploadModal = (item: any) => {
    setActiveUploadModal({
      tipo: item.tipo,
      fundoId: item.fundoId,
      fundoNome: item.fundoNome
    });
    setSelectedFile(null);
    setFeedbackMsg(null);
  };

  const handleExecuteUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUploadModal || !selectedFile) return;

    setUploading(true);
    setFeedbackMsg(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('fundo_id', activeUploadModal.fundoId);
    formData.append('data', dataConsulta);

    let endpoint = '';
    if (activeUploadModal.tipo === 'RECEITA') {
      endpoint = `${API_BASE_URL}/api/confirmacao/receitas/import-excel`;
    } else if (activeUploadModal.tipo === 'ESTOQUE') {
      endpoint = `${API_BASE_URL}/api/confirmacao/estoque/import`;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setFeedbackMsg({ type: 'success', msg: json.message || 'Arquivo importado com sucesso!' });
        fetchStatus();
        setTimeout(() => {
          setActiveUploadModal(null);
          setFeedbackMsg(null);
        }, 2500);
      } else {
        setFeedbackMsg({ type: 'error', msg: json.error || 'Erro ao processar arquivo.' });
      }
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', msg: err.message || 'Falha de comunicação ao importar.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* ── HEADER DA SEÇÃO ── */}
      <div className="cs-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={24} color="#38bdf8" /> Painel de Validação de Importações Diárias
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Acompanhamento das 6 importações essenciais (Cotas, Estoque e Receitas) para consolidar e validar a posição do dia.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={16} color="#94a3b8" />
              <input
                type="date"
                className="cs-date-input"
                value={dataConsulta}
                onChange={e => setDataConsulta(e.target.value)}
                title="Data de Referência da Posição"
              />
            </div>

            <button
              className="cs-page-btn"
              onClick={fetchStatus}
              title="Recarregar Status"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loading ? 'pwc-spinner' : ''} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Banner de Validação do Dia */}
        {statusData && (
          <div
            style={{
              marginTop: '1rem',
              padding: '10px 14px',
              borderRadius: '8px',
              border: `1px solid ${statusData.diaValido ? 'rgba(74, 222, 128, 0.4)' : 'rgba(251, 191, 36, 0.4)'}`,
              background: statusData.diaValido ? 'rgba(74, 222, 128, 0.1)' : 'rgba(251, 191, 36, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {statusData.diaValido ? (
                <CheckCircle2 size={22} color="#4ade80" />
              ) : (
                <AlertTriangle size={22} color="#fbbf24" />
              )}
              <div>
                <span style={{ fontWeight: 800, fontSize: '0.9rem', color: statusData.diaValido ? '#4ade80' : '#fbbf24' }}>
                  {statusData.diaValido
                    ? `✓ POSIÇÃO DO DIA ${statusData.dataFormatada} 100% VÁLIDA E COMPLETA`
                    : `⚠️ IMPORTAÇÕES PENDENTES PARA ${statusData.dataFormatada} (${statusData.totalPendencias} PENDÊNCIAS)`}
                </span>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '2px' }}>
                  {statusData.diaValido
                    ? 'Todas as 6 importações foram checadas. O relatório diário consolidará esta data como a Posição oficial.'
                    : `Pendências a importar: ${statusData.pendencias.join(', ')}`}
                </div>
              </div>
            </div>

            {onNavigateTab && (
              <button
                className="cs-page-btn"
                onClick={() => onNavigateTab('relatorio')}
                style={{
                  background: statusData.diaValido ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.06)',
                  borderColor: statusData.diaValido ? '#4ade80' : 'rgba(255,255,255,0.1)',
                  color: statusData.diaValido ? '#4ade80' : '#f8fafc'
                }}
              >
                Ir para Relatório Diário <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── GRID DOS 6 CARDS (LAYOUT ESTILO CARD DA PRINT) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {statusData?.itens?.map((item: any) => {
          const isImportado = item.status === 'IMPORTADO';

          return (
            <div
              key={item.id}
              style={{
                background: '#0d131f',
                border: `1px solid ${isImportado ? 'rgba(74, 222, 128, 0.25)' : 'rgba(255, 255, 255, 0.07)'}`,
                borderRadius: '10px',
                padding: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                transition: 'all 0.2s ease',
                boxShadow: isImportado ? '0 0 15px rgba(74, 222, 128, 0.05)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: isImportado ? 'rgba(74, 222, 128, 0.12)' : 'rgba(251, 191, 36, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {isImportado ? (
                    <CheckCircle2 size={20} color="#4ade80" />
                  ) : (
                    <AlertTriangle size={20} color="#fbbf24" />
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: '#ffffff' }}>
                      {item.titulo}
                    </span>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '10px',
                        background: item.fundoNome === 'MULTI' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                        color: item.fundoNome === 'MULTI' ? '#38bdf8' : '#eab308',
                        border: `1px solid ${item.fundoNome === 'MULTI' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`
                      }}
                    >
                      {item.fundoNome}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: isImportado ? '#4ade80' : '#94a3b8',
                      marginTop: '3px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={item.detalhe}
                  >
                    {item.detalhe}
                  </div>

                  {item.atualizadoEm && (
                    <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '2px' }}>
                      Atualizado: {item.atualizadoEm}
                    </div>
                  )}
                </div>
              </div>

              {/* Botões de Ação Rápida */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {item.tipo === 'COTAS' ? (
                  <button
                    className="cs-page-btn"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    onClick={() => onNavigateTab && onNavigateTab('cotas', item.fundoId)}
                    title="Lançar / Gerenciar Cotas"
                  >
                    <TrendingUp size={13} /> Cotas
                  </button>
                ) : (
                  <button
                    className="cs-page-btn"
                    style={{
                      padding: '6px 10px',
                      fontSize: '0.75rem',
                      background: isImportado ? 'rgba(255,255,255,0.05)' : 'rgba(56, 189, 248, 0.15)',
                      borderColor: isImportado ? 'rgba(255,255,255,0.1)' : '#38bdf8',
                      color: isImportado ? '#cbd5e1' : '#38bdf8'
                    }}
                    onClick={() => handleOpenUploadModal(item)}
                    title={`Importar ${item.titulo}`}
                  >
                    <Upload size={13} /> {isImportado ? 'Reimportar' : 'Importar'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MODAL DE IMPORTAÇÃO RÁPIDA (RECEITA OU ESTOQUE) ── */}
      {activeUploadModal && (
        <div className="cs-modal-overlay">
          <div className="cs-modal-card" style={{ maxWidth: '480px' }}>
            <div className="cs-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={18} color="#38bdf8" />
                Importar {activeUploadModal.tipo === 'RECEITA' ? 'Receitas (.xlsx)' : 'Estoque (.csv / .xlsx)'} — {activeUploadModal.fundoNome}
              </h3>
              <button
                className="cs-icon-btn"
                onClick={() => setActiveUploadModal(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Data de Referência:
                </label>
                <input
                  type="date"
                  className="cs-date-input"
                  value={dataConsulta}
                  onChange={e => setDataConsulta(e.target.value)}
                  style={{ width: '100%' }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '4px' }}>
                  Selecione o arquivo ({activeUploadModal.tipo === 'RECEITA' ? '.xlsx padrão' : '.csv ou .xlsx'}):
                </label>
                <input
                  type="file"
                  accept={activeUploadModal.tipo === 'RECEITA' ? '.xlsx' : '.csv, .xlsx'}
                  onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: '#090d16',
                    border: '1px dashed rgba(56, 189, 248, 0.4)',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.8rem'
                  }}
                  required
                />
                {activeUploadModal.tipo === 'RECEITA' && (
                  <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '4px 0 0 0' }}>
                    * O sistema lê automaticamente as colunas: <strong>CedenteNome</strong> (Cedente), <strong>ValorNominalOriginal</strong> (Bruto) e <strong>ValorAquisicao</strong> (Líquido).
                  </p>
                )}
              </div>

              {feedbackMsg && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    background: feedbackMsg.type === 'success' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                    color: feedbackMsg.type === 'success' ? '#4ade80' : '#f87171',
                    border: `1px solid ${feedbackMsg.type === 'success' ? 'rgba(74, 222, 128, 0.3)' : 'rgba(248, 113, 113, 0.3)'}`
                  }}
                >
                  {feedbackMsg.msg}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="cs-page-btn"
                  onClick={() => setActiveUploadModal(null)}
                  disabled={uploading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cs-page-btn"
                  disabled={uploading || !selectedFile}
                  style={{ background: '#0284c7', borderColor: '#38bdf8', color: '#fff', fontWeight: 700 }}
                >
                  {uploading ? 'Processando...' : 'Salvar no Banco'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmationImportStatus;
