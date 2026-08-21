import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Clock, Send, X, DollarSign, AlertCircle, RefreshCw,
  Eye, CreditCard, ArrowDownLeft, ArrowUpRight, CheckSquare, RotateCcw, Paperclip, Trash2, Download, CheckCircle2
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import { useAuth } from '../../core/AuthContext';
import '../administrative/purchases/PurchaseApproval.css';

interface PurchaseRequest {
  id: string;
  numero: number;
  fornecedor_nome: string;
  fornecedor_contato: string;
  forma_pagamento: string;
  quantidade_parcelas: number;
  departamento_centro_custo: string;
  produto_servico: string;
  valor: number;
  quantidade: number;
  observacoes: string;
  status: 'PENDENTE' | 'REABERTO' | 'AGUARDANDO_RESPOSTA_SOLICITANTE' | 'AGUARDANDO_RESPOSTA_APROVADOR' | 'APROVADO' | 'NEGADO' | 'PAGO' | 'REVISAO' | 'SOLICITACAO_CONCLUIDA';
  data_pagamento?: string | null;
  arquivado?: number;
  arquivado_manualmente?: number;
  arquivado_por?: string | null;
  arquivado_em?: string | null;
  motivo_arquivamento?: string | null;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  aprovador_id: string | null;
  aprovador_nome: string | null;
  motivo_decisao: string | null;
  decidido_em: string | null;
  created_at: string;
  updated_at: string;
  total_mensagens?: number;
  mensagens?: PurchaseMessage[];
}

interface PurchaseMessage {
  id: string;
  requisicao_id: string;
  autor_id: string;
  autor_nome: string;
  autor_role: 'APROVADOR' | 'REQUISITANTE';
  mensagem: string;
  created_at: string;
}

interface Attachment {
  id: string;
  nome_arquivo: string;
  tamanho_bytes: number;
  enviado_por_id: string;
  enviado_por_nome: string;
  created_at: string;
}

const FinanceRefundsExpenses: React.FC = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const [activeTab, setActiveTab] = useState<'pending_payment' | 'paid'>('pending_payment');

  // Data States
  const [financeQueue, setFinanceQueue] = useState<PurchaseRequest[]>([]);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Detail State
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [actionObservation, setActionObservation] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Pay / Return modals
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [returnMotive, setReturnMotive] = useState('');
  const [returnError, setReturnError] = useState('');

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedRequestRef = useRef<string | null>(null);

  useEffect(() => {
    selectedRequestRef.current = selectedRequest?.id || null;
  }, [selectedRequest]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carrega anexos da requisição
  const fetchAttachments = async (reqId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${reqId}/anexos`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAttachments(data);
      }
    } catch (err) {
      console.error('Erro ao buscar anexos:', err);
    }
  };

  // Carrega fila do financeiro
  const fetchData = useCallback(async (_isBackground = false) => {
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/compras/financeiro-fila`, { headers });
      if (res.ok) {
        const data = await res.json();
        setFinanceQueue(data);
      }

      // Se houver modal aberto, atualiza silenciosamente os detalhes
      if (selectedRequestRef.current) {
        const resReq = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestRef.current}`, { headers });
        if (resReq.ok) {
          const data = await resReq.json();
          setSelectedRequest(prev => {
            if (!prev) return null;
            return {
              ...data,
              mensagens: data.mensagens
            };
          });
        }
        await fetchAttachments(selectedRequestRef.current);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do financeiro:', err);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Polling em tempo real online: atualiza a cada 3 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData(true);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Abrir Modal de Detalhes
  const handleOpenDetails = async (reqId: string) => {
    setActionLoading(true);
    setShowPayConfirm(false);
    setShowReturnConfirm(false);
    setActionObservation('');
    setNewMessageText('');
    setReturnMotive('');
    setReturnError('');
    setUploadError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${reqId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(data);
        await fetchAttachments(reqId);
      }
    } catch (err) {
      console.error('Erro ao abrir detalhes:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Marcar como Concluída
  const handleMarkAsConcluded = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/concluir`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ observacoes: actionObservation.trim() })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao concluir solicitação.');
      }

      showToast('Solicitação concluída com sucesso!');
      setSelectedRequest(null);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao concluir solicitação.');
    } finally {
      setActionLoading(false);
      setShowPayConfirm(false);
    }
  };

  // Devolver para Revisão
  const handleReturnToRevision = async () => {
    if (!selectedRequest) return;
    if (!returnMotive.trim()) {
      setReturnError('O motivo da devolução é obrigatório.');
      return;
    }
    setReturnError('');
    setActionLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/devolver-revisao`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo: returnMotive.trim() })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao devolver para revisão.');
      }

      showToast('Solicitação devolvida para reaprovação necessária!');
      setSelectedRequest(null);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao devolver para revisão.');
    } finally {
      setActionLoading(false);
      setShowReturnConfirm(false);
    }
  };

  // Enviar Mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest || !newMessageText.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/mensagens`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mensagem: newMessageText.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(prev => prev ? {
          ...prev,
          status: data.novoStatus || prev.status,
          mensagens: [...(prev.mensagens || []), data.mensagem]
        } : null);
        setNewMessageText('');
        showToast('Mensagem enviada!');
        fetchData(true);
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  // Adicionar Anexo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRequest || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // Limite de 20MB
    const limit = 20 * 1024 * 1024;
    if (file.size > limit) {
      setUploadError('O arquivo excede o limite máximo de 20MB.');
      return;
    }
    setUploadError('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/anexos`, {
        method: 'POST',
        headers: getAuthHeaders() as any,
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar anexo.');
      }

      showToast('Anexo adicionado com sucesso!');
      fetchAttachments(selectedRequest.id);
      fetchData(true);
    } catch (err: any) {
      setUploadError(err.message || 'Falha ao subir arquivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remover Anexo
  const handleDeleteAttachment = async (anexoId: string) => {
    if (!selectedRequest) return;
    if (!window.confirm('Tem certeza que deseja remover este anexo?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/anexos/${anexoId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showToast('Anexo removido!');
        fetchAttachments(selectedRequest.id);
        fetchData(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao remover anexo.');
      }
    } catch (err) {
      console.error('Erro ao deletar anexo:', err);
    }
  };

  // Baixar Anexo
  const handleDownloadAttachment = (anexoId: string, filename: string) => {
    if (!selectedRequest) return;
    const url = `${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/anexos/${anexoId}`;
    
    fetch(url, { headers: getAuthHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Não foi possível obter o arquivo.');
        return res.blob();
      })
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      })
      .catch(err => {
        alert(err.message || 'Erro ao baixar anexo.');
      });
  };

  // Formatador de Moeda
  const formatBrl = (val: number) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Formatador de Data
  const formatDate = (isoStr: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  // Filtros de busca
  const filteredQueue = useMemo(() => {
    return financeQueue.filter(item => {
      const matchTab = activeTab === 'pending_payment'
        ? item.status === 'APROVADO'
        : (item.status === 'SOLICITACAO_CONCLUIDA' || item.status === 'PAGO');
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (item.produto_servico && item.produto_servico.toLowerCase().includes(q)) ||
        (item.fornecedor_nome && item.fornecedor_nome.toLowerCase().includes(q)) ||
        (item.departamento_centro_custo && item.departamento_centro_custo.toLowerCase().includes(q)) ||
        (item.solicitante_nome && item.solicitante_nome.toLowerCase().includes(q)) ||
        item.id.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [financeQueue, activeTab, searchQuery]);

  // Métricas do Topo
  const metrics = useMemo(() => {
    const pending = financeQueue.filter(r => r.status === 'APROVADO');
    const paid = financeQueue.filter(r => r.status === 'SOLICITACAO_CONCLUIDA' || r.status === 'PAGO');
    const pendingValue = pending.reduce((sum, r) => sum + (r.valor * r.quantidade), 0);
    const paidValue = paid.reduce((sum, r) => sum + (r.valor * r.quantidade), 0);
    return {
      pendingCount: pending.length,
      paidCount: paid.length,
      pendingValue,
      paidValue
    };
  }, [financeQueue]);

  return (
    <div className="pa-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="pa-toast">
          <CheckCircle2 size={18} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <div className="pa-header">
        <div className="pa-header-left">
          <div className="pa-icon-badge" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
            <DollarSign size={28} />
          </div>
          <div>
            <div className="pa-kicker">Financeiro • Pagamentos & Reembolsos</div>
            <h1>Reembolsos e Despesas</h1>
            <p className="pa-subtitle">
              Esteira financeira para liquidação de solicitações de compras aprovadas e devoluções para a esteira administrativa.
            </p>
          </div>
        </div>

        <div className="pa-header-badges">
          <div className="pa-live-indicator">
            <span className="pa-live-dot" /> SQLite Sincronizado
          </div>
          <span className="pa-role-badge approver" style={{ background: 'rgba(52, 211, 153, 0.2)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)' }}>
            <CheckSquare size={14} /> Financeiro
          </span>
        </div>
      </div>

      {/* MÉTRICAS KPI */}
      <div className="pa-kpi-grid">
        <div className="pa-kpi-card">
          <div className="pa-kpi-header">
            <span>Aprovados Pendentes</span>
            <div className="pa-kpi-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="pa-kpi-val" style={{ color: '#fbbf24' }}>
            {metrics.pendingCount}
          </div>
          <p className="pa-kpi-sub">Aguardando liquidação</p>
        </div>

        <div className="pa-kpi-card">
          <div className="pa-kpi-header">
            <span>Valor Pendente</span>
            <div className="pa-kpi-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="pa-kpi-val" style={{ color: '#fbbf24' }}>
            {formatBrl(metrics.pendingValue)}
          </div>
          <p className="pa-kpi-sub">Total a ser pago</p>
        </div>

        <div className="pa-kpi-card">
          <div className="pa-kpi-header">
            <span>Pagos Realizados</span>
            <div className="pa-kpi-icon-box" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
              <CheckSquare size={18} />
            </div>
          </div>
          <div className="pa-kpi-val" style={{ color: '#34d399' }}>
            {metrics.paidCount}
          </div>
          <p className="pa-kpi-sub">Processados com sucesso</p>
        </div>

        <div className="pa-kpi-card">
          <div className="pa-kpi-header">
            <span>Valor Pago</span>
            <div className="pa-kpi-icon-box" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="pa-kpi-val" style={{ color: '#34d399' }}>
            {formatBrl(metrics.paidValue)}
          </div>
          <p className="pa-kpi-sub">Liquidação total acumulada</p>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO */}
      <div className="pa-tabs">
        <button
          className={`pa-tab ${activeTab === 'pending_payment' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending_payment')}
        >
          <Clock size={18} /> Aprovados para Pagar ({metrics.pendingCount})
        </button>

        <button
          className={`pa-tab ${activeTab === 'paid' ? 'active' : ''}`}
          onClick={() => setActiveTab('paid')}
        >
          <CheckSquare size={18} /> Pagos ({metrics.paidCount})
        </button>
      </div>

      {/* FILA DE PEDIDOS */}
      <div className="pa-table-card">
        <div className="pa-table-header">
          <h2>
            {activeTab === 'pending_payment' ? (
              <>
                <Clock size={18} color="#fbbf24" /> Solicitações Pendentes de Pagamento ({filteredQueue.length})
              </>
            ) : (
              <>
                <CheckSquare size={18} color="#34d399" /> Histórico de Pagamentos ({filteredQueue.length})
              </>
            )}
          </h2>

          <div className="pa-table-controls">
            <input
              type="text"
              className="pa-search-input"
              placeholder="Buscar fornecedor, solicitante, centro de custo..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredQueue.length === 0 ? (
          <div className="pa-empty-state">
            <AlertCircle size={32} />
            <p>Nenhuma solicitação encontrada.</p>
          </div>
        ) : (
          <div className="pa-table-responsive">
            <table className="pa-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Solicitante</th>
                  <th>Descrição / Finalidade</th>
                  <th>Fornecedor</th>
                  <th>Forma Pagamento</th>
                  <th>Valor Total</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueue.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span className="pa-req-code">{item.id}</span>
                    </td>
                    <td>
                      <div className="pa-td-user">
                        <strong>{item.solicitante_nome}</strong>
                        <span>{item.departamento_centro_custo}</span>
                      </div>
                    </td>
                    <td>
                      <div className="pa-td-desc">
                        <strong>{item.produto_servico}</strong>
                        <span>Qtd: {item.quantidade} • Criado em {formatDate(item.created_at)} {item.data_pagamento ? `• 📅 Pgto: ${item.data_pagamento.substring(0, 10).split('-').reverse().join('/')}` : ''}</span>
                      </div>
                    </td>
                    <td>
                      <div className="pa-td-desc">
                        <strong>{item.fornecedor_nome}</strong>
                        <span>{item.fornecedor_contato}</span>
                      </div>
                    </td>
                    <td>
                      <span className="pa-payment-method">
                        {item.forma_pagamento}
                        {item.quantidade_parcelas > 1 ? ` (${item.quantidade_parcelas}x)` : ''}
                      </span>
                    </td>
                    <td>
                      <strong className="pa-req-value">
                        {formatBrl(item.valor * item.quantidade)}
                      </strong>
                    </td>
                    <td>
                      <button
                        className="pa-btn-action-view"
                        onClick={() => handleOpenDetails(item.id)}
                        title="Ver Detalhes e Ações"
                      >
                        <Eye size={15} /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES DA REQUISIÇÃO (FINANCEIRO) */}
      {selectedRequest && (
        <div className="pa-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="pa-modal-card pa-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header">
              <h3>
                <CreditCard size={20} /> Detalhes da Solicitação: {selectedRequest.id}
              </h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="pa-status-badge approved">
                  {selectedRequest.status}
                </span>
                <button
                  type="button"
                  className="pa-modal-close"
                  onClick={() => setSelectedRequest(null)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="pa-modal-body pa-details-layout">
              {/* Painel Esquerdo: Dados da Solicitação */}
              <div className="pa-details-panel">
                <div className="pa-detail-section-title">Informações do Pedido</div>
                
                <div className="pa-detail-grid">
                  <div className="pa-detail-item">
                    <label>Solicitante</label>
                    <p>{selectedRequest.solicitante_nome} ({selectedRequest.solicitante_email})</p>
                  </div>
                  <div className="pa-detail-item">
                    <label>Departamento / Centro de Custo</label>
                    <p>{selectedRequest.departamento_centro_custo}</p>
                  </div>
                  <div className="pa-detail-item">
                    <label>Produto / Serviço</label>
                    <p><strong>{selectedRequest.produto_servico}</strong></p>
                  </div>
                  <div className="pa-detail-item">
                    <label>Quantidade</label>
                    <p>{selectedRequest.quantidade}</p>
                  </div>
                  <div className="pa-detail-item">
                    <label>Valor Unitário</label>
                    <p>{formatBrl(selectedRequest.valor)}</p>
                  </div>
                  <div className="pa-detail-item">
                    <label>Valor Total</label>
                    <p className="pa-highlight-value">{formatBrl(selectedRequest.valor * selectedRequest.quantidade)}</p>
                  </div>
                  <div className="pa-detail-item">
                    <label>Fornecedor / Prestador</label>
                    <p>{selectedRequest.fornecedor_nome}</p>
                  </div>
                  <div className="pa-detail-item">
                    <label>Contato do Fornecedor</label>
                    <p>{selectedRequest.fornecedor_contato}</p>
                  </div>
                  <div className="pa-detail-item">
                    <label>Forma de Pagamento</label>
                    <p>{selectedRequest.forma_pagamento} {selectedRequest.quantidade_parcelas > 1 ? `(${selectedRequest.quantidade_parcelas} parcelas)` : '(À vista)'}</p>
                  </div>
                  <div className="pa-detail-item">
                    <label>Data de Criação</label>
                    <p>{formatDate(selectedRequest.created_at)}</p>
                  </div>
                  {selectedRequest.aprovador_nome && (
                    <>
                      <div className="pa-detail-item">
                        <label>Aprovado Por</label>
                        <p>{selectedRequest.aprovador_nome}</p>
                      </div>
                      <div className="pa-detail-item">
                        <label>Data da Decisão</label>
                        <p>{formatDate(selectedRequest.decidido_em || '')}</p>
                      </div>
                    </>
                  )}
                  <div className="pa-detail-item">
                    <label>Data Programada de Pagamento</label>
                    <input
                      type="date"
                      className="pa-input"
                      value={selectedRequest.data_pagamento ? selectedRequest.data_pagamento.substring(0, 10) : ''}
                      onChange={async (e) => {
                        const newDate = e.target.value || null;
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/data-pagamento`, {
                            method: 'PUT',
                            headers: {
                              ...getAuthHeaders(),
                              'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ data_pagamento: newDate })
                          });
                          if (res.ok) {
                            const updated = await res.json();
                            setSelectedRequest(prev => {
                              if (!prev) return null;
                              return {
                                ...prev,
                                data_pagamento: updated.requisicao.data_pagamento
                              };
                            });
                            fetchData(true);
                          }
                        } catch (err) {
                          console.error('Erro ao salvar data de pagamento:', err);
                        }
                      }}
                      style={{ padding: '4px 8px', fontSize: '0.85rem', background: '#0f172a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#f8fafc', width: '100%', boxSizing: 'border-box' }}
                      disabled={selectedRequest.status === 'SOLICITACAO_CONCLUIDA'}
                    />
                  </div>
                </div>

                {selectedRequest.observacoes && (
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Observações do Solicitante</label>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                      {selectedRequest.observacoes}
                    </div>
                  </div>
                )}

                {/* --- SEÇÃO DE ANEXOS --- */}
                <div style={{ marginTop: '1.5rem' }}>
                  <div className="pa-detail-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Anexos do Processo ({attachments.length})</span>
                    <label className="pa-btn-action-view" style={{ cursor: 'pointer', margin: 0, padding: '4px 8px', fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                      <Paperclip size={12} style={{ marginRight: '4px' }} /> Anexar
                      <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>

                  {uploadError && (
                    <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>
                      {uploadError}
                    </div>
                  )}

                  {uploading && (
                    <div style={{ color: '#38bdf8', fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <RefreshCw size={12} className="animate-spin" /> Enviando anexo...
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {attachments.length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic', margin: 0 }}>Nenhum documento anexado.</p>
                    ) : (
                      attachments.map(att => (
                        <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '75%' }}>
                            <strong style={{ fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.nome_arquivo}</strong>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {(att.tamanho_bytes / 1024 / 1024).toFixed(2)} MB • Por {att.enviado_por_nome}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => handleDownloadAttachment(att.id, att.nome_arquivo)}
                              style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer', padding: '4px' }}
                              title="Baixar Arquivo"
                            >
                              <Download size={14} />
                            </button>
                            {(att.enviado_por_id === user?.id || isMaster) && (
                              <button
                                type="button"
                                onClick={() => handleDeleteAttachment(att.id)}
                                style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                                title="Remover Arquivo"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* --- AÇÕES DO FINANCEIRO --- */}
                {selectedRequest.status === 'APROVADO' && (
                  <div style={{ marginTop: '2rem', display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="pa-btn-approve"
                      style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '6px' }}
                      onClick={() => {
                        setShowPayConfirm(true);
                        setShowReturnConfirm(false);
                      }}
                    >
                      <CheckSquare size={16} /> Concluir Solicitação
                    </button>

                    <button
                      type="button"
                      className="pa-btn-deny"
                      style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                      onClick={() => {
                        setShowReturnConfirm(true);
                        setShowPayConfirm(false);
                      }}
                    >
                      <RotateCcw size={16} /> Devolver para Revisão
                    </button>
                  </div>
                )}
              </div>

              {/* Painel Direito: Histórico e Chat da Requisição */}
              <div className="pa-chat-panel">
                <div className="pa-detail-section-title">Histórico & Observações</div>

                {/* Formulários rápidos de ação flutuantes dentro do chat */}
                {showPayConfirm && (
                  <div style={{ background: 'rgba(52, 211, 153, 0.08)', border: '1px solid rgba(52, 211, 153, 0.3)', padding: '16px', borderRadius: '10px', marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#34d399', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckSquare size={16} /> Concluir Solicitação
                    </h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                      Confirme que esta solicitação foi liquidada. Ela será marcada como concluída e arquivada.
                    </p>
                    <textarea
                      className="pa-textarea"
                      placeholder="Observações de encerramento da solicitação. Opcional."
                      style={{ fontSize: '0.8rem', minHeight: '60px' }}
                      value={actionObservation}
                      onChange={e => setActionObservation(e.target.value)}
                    />
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="pa-btn-outline"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        onClick={() => setShowPayConfirm(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="pa-btn-approve"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        onClick={handleMarkAsConcluded}
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Registrando...' : 'Concluir'}
                      </button>
                    </div>
                  </div>
                )}

                {showReturnConfirm && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '16px', borderRadius: '10px', marginBottom: '1rem' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: '#ef4444', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <RotateCcw size={16} /> Devolver para Revisão
                    </h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                      Esta requisição sairá da fila do financeiro e voltará para os Aprovadores Administrativos revisarem e editarem. <strong>Motivo obrigatório.</strong>
                    </p>
                    <textarea
                      className="pa-textarea"
                      placeholder="Descreva detalhadamente o motivo da devolução e o que precisa ser corrigido..."
                      style={{ fontSize: '0.8rem', minHeight: '60px' }}
                      value={returnMotive}
                      onChange={e => {
                        setReturnMotive(e.target.value);
                        setReturnError('');
                      }}
                      required
                    />
                    {returnError && (
                      <div style={{ color: '#ef4444', fontSize: '0.75rem', marginTop: '4px' }}>
                        {returnError}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="pa-btn-outline"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        onClick={() => setShowReturnConfirm(false)}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="pa-btn-deny"
                        style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#ef4444' }}
                        onClick={handleReturnToRevision}
                        disabled={actionLoading}
                      >
                        {actionLoading ? 'Processando...' : 'Devolver ao Admin'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Box de mensagens */}
                <div className="pa-chat-box">
                  {(!selectedRequest.mensagens || selectedRequest.mensagens.length === 0) ? (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: '1rem' }}>
                      Nenhuma mensagem registrada nesta solicitação.
                    </div>
                  ) : (
                    selectedRequest.mensagens.map(msg => (
                      <div
                        key={msg.id}
                        className={`pa-message-bubble ${msg.autor_role === 'APROVADOR' ? 'approver' : 'requester'}`}
                      >
                        <div className="pa-message-meta">
                          <strong>{msg.autor_nome} ({msg.autor_role === 'APROVADOR' ? 'Aprovador' : 'Solicitante'})</strong>
                          <span>{formatDate(msg.created_at)}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                          {msg.mensagem}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Input para nova mensagem */}
                <form onSubmit={handleSendMessage} className="pa-chat-input-row">
                  <input
                    type="text"
                    className="pa-chat-input"
                    placeholder="Adicione um comentário ou responda sobre esta solicitação..."
                    value={newMessageText}
                    onChange={e => setNewMessageText(e.target.value)}
                  />
                  <button type="submit" disabled={!newMessageText.trim()} className="pa-chat-send-btn">
                    <Send size={15} /> Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceRefundsExpenses;
