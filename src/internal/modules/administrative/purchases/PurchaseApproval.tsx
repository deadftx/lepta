import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShoppingCart, ShieldCheck, PlusCircle, ListOrdered, CheckCircle2,
  XCircle, Clock, MessageSquare, Send, X, Archive, RotateCcw,
  DollarSign, Package, FileText, AlertCircle, RefreshCw, Sparkles, User,
  Eye, HelpCircle, Edit3
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './PurchaseApproval.css';

interface PurchaseRequest {
  id: string;
  numero: number;
  produto_servico: string;
  valor: number;
  quantidade: number;
  observacoes: string;
  status: 'PENDENTE' | 'REABERTO' | 'AGUARDANDO_RESPOSTA_SOLICITANTE' | 'AGUARDANDO_RESPOSTA_APROVADOR' | 'APROVADO' | 'NEGADO';
  arquivado?: number;
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

export const PurchaseApproval: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'review' | 'new' | 'my_requests' | 'archived'>('new');
  const [isApprover, setIsApprover] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loadingRole, setLoadingRole] = useState(true);

  // Form State
  const [produtoServico, setProdutoServico] = useState('');
  const [valorDisplay, setValorDisplay] = useState('');
  const [valorNumeric, setValorNumeric] = useState<number>(0);
  const [quantidade, setQuantidade] = useState<number>(1);
  const [observacoes, setObservacoes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Data States
  const [reviewQueue, setReviewQueue] = useState<PurchaseRequest[]>([]);
  const [myRequests, setMyRequests] = useState<PurchaseRequest[]>([]);
  const [archivedRequests, setArchivedRequests] = useState<PurchaseRequest[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Review State
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [actionObservation, setActionObservation] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showActionConfirm, setShowActionConfirm] = useState<'APPROVE' | 'DENY' | null>(null);

  // Reopen Modal State
  const [reopenTarget, setReopenTarget] = useState<PurchaseRequest | null>(null);
  const [reopenMessage, setReopenMessage] = useState('');
  const [reopenProduto, setReopenProduto] = useState('');
  const [reopenValorDisplay, setReopenValorDisplay] = useState('');
  const [reopenValorNumeric, setReopenValorNumeric] = useState<number>(0);
  const [reopenQuantidade, setReopenQuantidade] = useState<number>(1);
  const [reopenObservacoes, setReopenObservacoes] = useState('');
  const [reopenLoading, setReopenLoading] = useState(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedRequestRef = useRef<string | null>(null);
  selectedRequestRef.current = selectedRequest?.id || null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Identifica o papel do usuário (Aprovador ou Requisitante)
  const fetchUserRole = useCallback(async () => {
    setLoadingRole(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/meu-papel`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setIsApprover(data.isApprover);
        if (data.isApprover) {
          setActiveTab('review');
        } else {
          setActiveTab('new');
        }
      }
    } catch (err) {
      console.error('Erro ao verificar papel:', err);
    } finally {
      setLoadingRole(false);
    }
  }, []);

  useEffect(() => {
    fetchUserRole();
    // Recupera dados do usuário do localStorage se houver
    try {
      const authStr = localStorage.getItem('lepta_auth_session') || localStorage.getItem('user');
      if (authStr) {
        const u = JSON.parse(authStr);
        if (u.id) setCurrentUserId(u.id);
      }
    } catch {}
  }, [fetchUserRole]);

  // 2. Carrega todos os dados (Fila ativa, Minhas requisições, Arquivadas)
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingData(true);
    try {
      const headers = getAuthHeaders();

      // Fila de revisão (apenas aprovadores)
      if (isApprover) {
        const resQueue = await fetch(`${API_BASE_URL}/api/compras/fila-aprovacao`, { headers });
        if (resQueue.ok) {
          const data = await resQueue.json();
          setReviewQueue(data);
        }
      }

      // Minhas solicitações ativas
      const resMy = await fetch(`${API_BASE_URL}/api/compras/minhas-requisicoes`, { headers });
      if (resMy.ok) {
        const data = await resMy.json();
        setMyRequests(data);
      }

      // Solicitações Arquivadas
      const resArchived = await fetch(`${API_BASE_URL}/api/compras/arquivadas`, { headers });
      if (resArchived.ok) {
        const data = await resArchived.json();
        setArchivedRequests(data);
      }

      // Se houver modal aberto, atualiza silenciosamente os detalhes e mensagens
      if (selectedRequestRef.current) {
        const resReq = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestRef.current}`, { headers });
        if (resReq.ok) {
          const data = await resReq.json();
          setSelectedRequest(prev => {
            if (!prev) return null;
            return {
              ...data,
              // Preserva inputs locais se houver
            };
          });
        }
      }
    } catch (err) {
      console.error('Erro ao sincronizar dados de compras:', err);
    } finally {
      if (!isBackground) setLoadingData(false);
    }
  }, [isApprover]);

  // Carga inicial
  useEffect(() => {
    if (!loadingRole) {
      fetchData(false);
    }
  }, [loadingRole, fetchData]);

  // 3. POLLING EM TEMPO REAL (ONLINE): Atualiza a cada 3 segundos silenciosamente
  useEffect(() => {
    if (loadingRole) return;
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loadingRole, fetchData]);

  // Máscara de moeda R$
  const handleCurrencyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    if (!rawDigits) {
      setValorDisplay('');
      setValorNumeric(0);
      return;
    }
    const num = Number(rawDigits) / 100;
    setValorNumeric(num);
    setValorDisplay(num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  };

  const handleReopenCurrencyInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/\D/g, '');
    if (!rawDigits) {
      setReopenValorDisplay('');
      setReopenValorNumeric(0);
      return;
    }
    const num = Number(rawDigits) / 100;
    setReopenValorNumeric(num);
    setReopenValorDisplay(num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  };

  // Enviar Nova Requisição
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!produtoServico.trim()) {
      setFormError('Informe o Produto ou Serviço.');
      return;
    }
    if (!valorNumeric || valorNumeric <= 0) {
      setFormError('Informe um valor válido maior que zero.');
      return;
    }
    if (!quantidade || quantidade <= 0) {
      setFormError('Informe uma quantidade válida.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          produto_servico: produtoServico.trim(),
          valor: valorNumeric,
          quantidade,
          observacoes: observacoes.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao enviar requisição.');
      }

      setProdutoServico('');
      setValorDisplay('');
      setValorNumeric(0);
      setQuantidade(1);
      setObservacoes('');

      showToast('Requisição de compra enviada com sucesso para aprovação!');
      fetchData(false);
      setActiveTab('my_requests');
    } catch (err: any) {
      setFormError(err.message || 'Erro ao registrar requisição.');
    } finally {
      setSubmitting(false);
    }
  };

  // Abrir Modal de Detalhes
  const handleOpenDetails = async (reqId: string) => {
    setActionLoading(true);
    setShowActionConfirm(null);
    setActionObservation('');
    setNewMessageText('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${reqId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(data);
      }
    } catch (err) {
      console.error('Erro ao abrir detalhes:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Aprovar Requisição (Arquiva como Aprovado)
  const handleApprove = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/aprovar`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ observacoes: actionObservation.trim() })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao aprovar.');
      }

      showToast('Requisição APROVADA e movida para Arquivadas!');
      setSelectedRequest(null);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao aprovar.');
    } finally {
      setActionLoading(false);
    }
  };

  // Negar Requisição (Arquiva como Negado)
  const handleDeny = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/negar`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ observacoes: actionObservation.trim() })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao negar.');
      }

      showToast('Requisição NEGADA e movida para Arquivadas.');
      setSelectedRequest(null);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao negar.');
    } finally {
      setActionLoading(false);
    }
  };

  // Enviar Mensagem na Requisição (Atualiza Status Dinamicamente)
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
        showToast('Mensagem enviada com sucesso!');
        fetchData(true);
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  // Abrir Modal de Reabertura
  const handleOpenReopen = (req: PurchaseRequest) => {
    setReopenTarget(req);
    setReopenMessage('');
    setReopenProduto(req.produto_servico);
    setReopenValorNumeric(req.valor);
    setReopenValorDisplay(req.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    setReopenQuantidade(req.quantidade);
    setReopenObservacoes(req.observacoes || '');
  };

  // Confirmar Reabertura
  const handleConfirmReopen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenTarget) return;

    setReopenLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${reopenTarget.id}/reabrir`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mensagem: reopenMessage.trim(),
          produto_servico: reopenProduto.trim(),
          valor: reopenValorNumeric,
          quantidade: reopenQuantidade,
          observacoes: reopenObservacoes.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao reabrir requisição.');
      }

      showToast('Solicitação REABERTA com sucesso e enviada para a fila ativa!');
      setReopenTarget(null);
      if (selectedRequest?.id === reopenTarget.id) setSelectedRequest(null);
      fetchData(false);
      setActiveTab('my_requests');
    } catch (err: any) {
      alert(err.message || 'Erro ao reabrir solicitação.');
    } finally {
      setReopenLoading(false);
    }
  };

  // Renderizador de Status Badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDENTE':
        return <span className="pa-status-badge pending"><Clock size={12} /> Pendente</span>;
      case 'REABERTO':
        return <span className="pa-status-badge reopened"><RotateCcw size={12} /> Reaberto</span>;
      case 'AGUARDANDO_RESPOSTA_SOLICITANTE':
        return <span className="pa-status-badge waiting-requester"><HelpCircle size={12} /> Aguardando Solicitante</span>;
      case 'AGUARDANDO_RESPOSTA_APROVADOR':
        return <span className="pa-status-badge waiting-approver"><MessageSquare size={12} /> Aguardando Aprovador</span>;
      case 'APROVADO':
        return <span className="pa-status-badge approved"><CheckCircle2 size={12} /> Aprovado</span>;
      case 'NEGADO':
        return <span className="pa-status-badge denied"><XCircle size={12} /> Negado</span>;
      default:
        return <span className="pa-status-badge pending">{status}</span>;
    }
  };

  // Filtros da Fila de Revisão Ativa
  const filteredReviewQueue = useMemo(() => {
    return reviewQueue.filter(item => {
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        item.produto_servico.toLowerCase().includes(q) ||
        item.solicitante_nome.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [reviewQueue, statusFilter, searchQuery]);

  // Filtros de Arquivados
  const filteredArchived = useMemo(() => {
    return archivedRequests.filter(item => {
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        item.produto_servico.toLowerCase().includes(q) ||
        item.solicitante_nome.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [archivedRequests, statusFilter, searchQuery]);

  // Métricas do Topo
  const metrics = useMemo(() => {
    const list = isApprover ? reviewQueue : myRequests;
    const pending = list.filter(r => r.status === 'PENDENTE');
    const reopened = list.filter(r => r.status === 'REABERTO');
    const waiting = list.filter(r => r.status.startsWith('AGUARDANDO_RESPOSTA'));
    const pendingValue = list.reduce((sum, r) => sum + (r.valor * r.quantidade), 0);
    return {
      pendingCount: pending.length,
      reopenedCount: reopened.length,
      waitingCount: waiting.length,
      archivedCount: archivedRequests.length,
      pendingValue
    };
  }, [reviewQueue, myRequests, archivedRequests, isApprover]);

  const formatBrl = (val: number) => Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const formatDate = (iso: string) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="pa-container">
      {/* Header */}
      <div className="pa-header">
        <div className="pa-header-left">
          <div className="pa-icon-badge">
            <ShoppingCart size={26} />
          </div>
          <div>
            <h1>Aprovação de Compras</h1>
            <p className="pa-subtitle">
              Esteira corporativa para solicitação, revisão, aprovação e mensagens de compras.
            </p>
          </div>
        </div>

        <div className="pa-header-badges">
          <div className="pa-live-indicator" title="Atualizando automaticamente sem necessidade de recarregar a página">
            <div className="pa-live-dot" />
            <span>Online</span>
          </div>

          <span className={`pa-role-badge ${isApprover ? 'approver' : 'requester'}`}>
            {isApprover ? (
              <>
                <ShieldCheck size={16} /> Aprovador
              </>
            ) : (
              <>
                <ShoppingCart size={16} /> Requisitante
              </>
            )}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="pa-tabs">
        {isApprover && (
          <button
            type="button"
            className={`pa-tab ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            <ShieldCheck size={18} /> Revisar Requisições
            {reviewQueue.length > 0 && (
              <span className="pa-tab-counter">{reviewQueue.length}</span>
            )}
          </button>
        )}

        <button
          type="button"
          className={`pa-tab ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          <PlusCircle size={18} /> Nova Requisição
        </button>

        <button
          type="button"
          className={`pa-tab ${activeTab === 'my_requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('my_requests')}
        >
          <ListOrdered size={18} /> Minhas Solicitações ({myRequests.length})
        </button>

        <button
          type="button"
          className={`pa-tab ${activeTab === 'archived' ? 'active' : ''}`}
          onClick={() => setActiveTab('archived')}
        >
          <Archive size={18} /> Solicitações Arquivadas ({archivedRequests.length})
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="pa-metrics-grid">
        <div className="pa-metric-card">
          <div>
            <div className="pa-metric-label">Pendentes</div>
            <div className="pa-metric-value">{metrics.pendingCount}</div>
          </div>
          <div className="pa-metric-icon pending">
            <Clock size={22} />
          </div>
        </div>

        <div className="pa-metric-card">
          <div>
            <div className="pa-metric-label">Reabertos</div>
            <div className="pa-metric-value">{metrics.reopenedCount}</div>
          </div>
          <div className="pa-metric-icon reopened">
            <RotateCcw size={22} />
          </div>
        </div>

        <div className="pa-metric-card">
          <div>
            <div className="pa-metric-label">Aguardando Resposta</div>
            <div className="pa-metric-value">{metrics.waitingCount}</div>
          </div>
          <div className="pa-metric-icon waiting">
            <MessageSquare size={22} />
          </div>
        </div>

        <div className="pa-metric-card">
          <div>
            <div className="pa-metric-label">Arquivadas</div>
            <div className="pa-metric-value">{metrics.archivedCount}</div>
          </div>
          <div className="pa-metric-icon archived">
            <Archive size={22} />
          </div>
        </div>

        <div className="pa-metric-card">
          <div>
            <div className="pa-metric-label">Valor Ativo</div>
            <div className="pa-metric-value" style={{ fontSize: '1.25rem' }}>
              {formatBrl(metrics.pendingValue)}
            </div>
          </div>
          <div className="pa-metric-icon total">
            <DollarSign size={22} />
          </div>
        </div>
      </div>

      {/* TAB 1: REVISAR REQUISIÇÕES (PARA APROVADORES) */}
      {activeTab === 'review' && isApprover && (
        <div className="pa-table-card">
          <div className="pa-table-header">
            <h2>
              <ShieldCheck size={18} /> Fila Ativa de Aprovação ({filteredReviewQueue.length})
            </h2>
            <div className="pa-table-filters">
              <select
                className="pa-filter-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos os Status Ativos</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="REABERTO">Reabertos</option>
                <option value="AGUARDANDO_RESPOSTA_APROVADOR">Aguardando Aprovador</option>
                <option value="AGUARDANDO_RESPOSTA_SOLICITANTE">Aguardando Solicitante</option>
              </select>

              <input
                type="text"
                placeholder="Buscar produto ou solicitante..."
                className="pa-search-input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="pa-table-responsive">
            <table className="pa-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto / Serviço</th>
                  <th>Solicitante</th>
                  <th>Qtd</th>
                  <th>Valor Total</th>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loadingData && reviewQueue.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="pa-empty">
                      <RefreshCw size={24} className="pwc-spinner" style={{ margin: '0 auto 8px' }} />
                      <div>Carregando fila de aprovação...</div>
                    </td>
                  </tr>
                ) : filteredReviewQueue.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="pa-empty">
                      Nenhuma requisição de compra ativa encontrada na fila.
                    </td>
                  </tr>
                ) : (
                  filteredReviewQueue.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: '#93c5fd' }}>{item.id}</td>
                      <td style={{ fontWeight: 600 }}>{item.produto_servico}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={14} color="#94a3b8" />
                          <span>{item.solicitante_nome}</span>
                        </div>
                      </td>
                      <td>{item.quantidade}</td>
                      <td style={{ fontWeight: 700, color: '#f8fafc' }}>
                        {formatBrl(item.valor * item.quantidade)}
                      </td>
                      <td>{formatDate(item.created_at)}</td>
                      <td>{renderStatusBadge(item.status)}</td>
                      <td>
                        <button
                          type="button"
                          className="pa-action-btn"
                          onClick={() => handleOpenDetails(item.id)}
                        >
                          <Eye size={14} /> Revisar
                          {Boolean(item.total_mensagens) && (
                            <span style={{ background: '#2563eb', color: '#fff', padding: '1px 6px', borderRadius: '9999px', fontSize: '0.7rem' }}>
                              {item.total_mensagens}
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: NOVA REQUISIÇÃO DE COMPRA */}
      {activeTab === 'new' && (
        <div className="pa-form-card">
          <h2>
            <Package size={22} color="#3b82f6" /> Nova Requisição de Compra
          </h2>
          <p className="pa-form-subtitle">
            Preencha os campos abaixo para submeter a solicitação para a esteira de aprovação.
          </p>

          {formError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} /> {formError}
            </div>
          )}

          <form onSubmit={handleSubmitRequest}>
            <div className="pa-form-grid">
              <div className="pa-form-group full-width">
                <label>
                  Produto / Serviço <span className="pa-required">*</span>
                </label>
                <input
                  type="text"
                  className="pa-input"
                  placeholder="Ex: Licença de Software, Equipamento de TI, Material de Escritório..."
                  value={produtoServico}
                  onChange={e => setProdutoServico(e.target.value)}
                  required
                />
              </div>

              <div className="pa-form-group">
                <label>
                  Valor Unitário Estimado (R$) <span className="pa-required">*</span>
                </label>
                <input
                  type="text"
                  className="pa-input"
                  placeholder="R$ 0,00"
                  value={valorDisplay}
                  onChange={handleCurrencyInput}
                  required
                />
              </div>

              <div className="pa-form-group">
                <label>
                  Quantidade <span className="pa-required">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  className="pa-input"
                  value={quantidade}
                  onChange={e => setQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                  required
                />
              </div>

              <div className="pa-form-group full-width">
                <label>Observações Adicionais (Opcional)</label>
                <textarea
                  className="pa-textarea"
                  placeholder="Justificativa da compra, links de fornecedores, prazos de entrega ou detalhes adicionais..."
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                />
              </div>
            </div>

            {valorNumeric > 0 && (
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '12px 16px', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Valor Total da Requisição:</span>
                <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#34d399' }}>
                  {formatBrl(valorNumeric * quantidade)}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="pa-submit-btn"
            >
              {submitting ? <RefreshCw size={18} className="pwc-spinner" /> : <Send size={18} />}
              {submitting ? 'Enviando Requisição...' : 'Submeter para Aprovação'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: MINHAS SOLICITAÇÕES ATIVAS */}
      {activeTab === 'my_requests' && (
        <div className="pa-table-card">
          <div className="pa-table-header">
            <h2>
              <ListOrdered size={18} /> Minhas Solicitações Ativas ({myRequests.length})
            </h2>
          </div>

          <div className="pa-table-responsive">
            <table className="pa-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto / Serviço</th>
                  <th>Qtd</th>
                  <th>Valor Total</th>
                  <th>Data de Envio</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="pa-empty">
                      Você não possui requisições de compra ativas no momento. (Requisições aprovadas ou negadas ficam em <strong>Solicitações Arquivadas</strong>).
                    </td>
                  </tr>
                ) : (
                  myRequests.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600, color: '#93c5fd' }}>{item.id}</td>
                      <td style={{ fontWeight: 600 }}>{item.produto_servico}</td>
                      <td>{item.quantidade}</td>
                      <td style={{ fontWeight: 700, color: '#f8fafc' }}>
                        {formatBrl(item.valor * item.quantidade)}
                      </td>
                      <td>{formatDate(item.created_at)}</td>
                      <td>{renderStatusBadge(item.status)}</td>
                      <td>
                        <button
                          type="button"
                          className="pa-action-btn"
                          onClick={() => handleOpenDetails(item.id)}
                        >
                          <Eye size={14} /> Detalhes & Chat
                          {Boolean(item.total_mensagens) && (
                            <span style={{ background: '#2563eb', color: '#fff', padding: '1px 6px', borderRadius: '9999px', fontSize: '0.7rem' }}>
                              {item.total_mensagens}
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SOLICITAÇÕES ARQUIVADAS (APROVADAS E NEGADAS) */}
      {activeTab === 'archived' && (
        <div className="pa-table-card">
          <div className="pa-table-header">
            <h2>
              <Archive size={18} /> Solicitações Arquivadas ({filteredArchived.length})
            </h2>
            <div className="pa-table-filters">
              <select
                className="pa-filter-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos os Arquivados</option>
                <option value="APROVADO">Apenas Aprovados</option>
                <option value="NEGADO">Apenas Negados</option>
              </select>

              <input
                type="text"
                placeholder="Buscar produto ou solicitante..."
                className="pa-search-input"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="pa-table-responsive">
            <table className="pa-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Produto / Serviço</th>
                  <th>Solicitante</th>
                  <th>Valor Total</th>
                  <th>Decidido Em</th>
                  <th>Status</th>
                  <th>Decisão / Aprovador</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchived.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="pa-empty">
                      Nenhuma solicitação arquivada encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredArchived.map(item => {
                    const isOwner = item.solicitante_id === currentUserId || isApprover;
                    const canReopen = item.status === 'NEGADO' && isOwner;

                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600, color: '#93c5fd' }}>{item.id}</td>
                        <td style={{ fontWeight: 600 }}>{item.produto_servico}</td>
                        <td>{item.solicitante_nome}</td>
                        <td style={{ fontWeight: 700, color: '#f8fafc' }}>
                          {formatBrl(item.valor * item.quantidade)}
                        </td>
                        <td>{formatDate(item.decidido_em || item.updated_at)}</td>
                        <td>{renderStatusBadge(item.status)}</td>
                        <td>
                          {item.aprovador_nome ? (
                            <div style={{ fontSize: '0.85rem' }}>
                              <span style={{ color: '#cbd5e1' }}>{item.aprovador_nome}</span>
                              {item.motivo_decisao && (
                                <div style={{ color: '#94a3b8', fontSize: '0.75rem', fontStyle: 'italic' }}>
                                  "{item.motivo_decisao}"
                                </div>
                              )}
                            </div>
                          ) : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="pa-action-btn"
                              onClick={() => handleOpenDetails(item.id)}
                            >
                              <Eye size={14} /> Detalhes
                            </button>

                            {canReopen && (
                              <button
                                type="button"
                                className="pa-reopen-btn"
                                onClick={() => handleOpenReopen(item)}
                                title="Reabrir requisição negada com nova mensagem ou ajuste"
                              >
                                <RotateCcw size={13} /> Reabrir
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE REVISÃO DETALHADA E MENSAGENS */}
      {selectedRequest && (
        <div className="pa-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="pa-modal-card" onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header">
              <h3>
                <FileText size={20} color="#3b82f6" /> Requisição: {selectedRequest.id}
                <div style={{ marginLeft: '8px' }}>{renderStatusBadge(selectedRequest.status)}</div>
              </h3>
              <button
                type="button"
                className="pa-modal-close"
                onClick={() => setSelectedRequest(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="pa-modal-body">
              {/* Detalhes da Requisição */}
              <div className="pa-req-details-grid">
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Produto / Serviço</span>
                  <span className="pa-detail-val">{selectedRequest.produto_servico}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Solicitante</span>
                  <span className="pa-detail-val">{selectedRequest.solicitante_nome} ({selectedRequest.solicitante_email || 'Sem e-mail'})</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Valor Unitário</span>
                  <span className="pa-detail-val">{formatBrl(selectedRequest.valor)}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Quantidade & Total</span>
                  <span className="pa-detail-val" style={{ color: '#34d399' }}>
                    {selectedRequest.quantidade}x = {formatBrl(selectedRequest.valor * selectedRequest.quantidade)}
                  </span>
                </div>

                <div className="pa-detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="pa-detail-label">Observações do Solicitante</span>
                  <span className="pa-detail-val" style={{ fontWeight: 400, color: '#cbd5e1' }}>
                    {selectedRequest.observacoes || 'Nenhuma observação informada.'}
                  </span>
                </div>

                {selectedRequest.aprovador_nome && (
                  <div className="pa-detail-item" style={{ gridColumn: 'span 2', background: '#1e293b', padding: '10px 14px', borderRadius: '8px' }}>
                    <span className="pa-detail-label">
                      {selectedRequest.status === 'APROVADO' ? 'Aprovado por' : 'Negado por'}
                    </span>
                    <span className="pa-detail-val">
                      {selectedRequest.aprovador_nome} em {formatDate(selectedRequest.decidido_em || '')}
                    </span>
                    {selectedRequest.motivo_decisao && (
                      <p style={{ marginTop: '4px', fontSize: '0.85rem', color: '#94a3b8' }}>
                        "{selectedRequest.motivo_decisao}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Botão de Reabrir dentro do modal se estiver negada */}
              {selectedRequest.status === 'NEGADO' && (
                <div style={{ background: '#1e293b', padding: '14px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#f87171', fontSize: '0.9rem', fontWeight: 600 }}>
                    Esta solicitação foi negada. Deseja reabri-la para reavaliação?
                  </span>
                  <button
                    type="button"
                    className="pa-reopen-btn"
                    onClick={() => handleOpenReopen(selectedRequest)}
                  >
                    <RotateCcw size={15} /> Reabrir Solicitação
                  </button>
                </div>
              )}

              {/* Ações de Aprovação / Negação (Apenas para Aprovadores em requisições Ativas) */}
              {isApprover && selectedRequest.arquivado !== 1 && selectedRequest.status !== 'APROVADO' && selectedRequest.status !== 'NEGADO' && (
                <div className="pa-actions-bar">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
                      Decisão do Aprovador:
                    </span>
                    <div className="pa-actions-buttons">
                      <button
                        type="button"
                        className="pa-btn-approve"
                        onClick={() => setShowActionConfirm(showActionConfirm === 'APPROVE' ? null : 'APPROVE')}
                      >
                        <CheckCircle2 size={16} /> Aprovar Requisição
                      </button>

                      <button
                        type="button"
                        className="pa-btn-deny"
                        onClick={() => setShowActionConfirm(showActionConfirm === 'DENY' ? null : 'DENY')}
                      >
                        <XCircle size={16} /> Negar Requisição
                      </button>
                    </div>
                  </div>

                  {showActionConfirm && (
                    <div style={{ background: '#111827', padding: '12px', borderRadius: '10px', border: '1px solid #334155', marginTop: '8px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '6px' }}>
                        Observação / Justificativa ({showActionConfirm === 'APPROVE' ? 'Opcional' : 'Recomendada'}):
                      </label>
                      <input
                        type="text"
                        placeholder="Adicione um comentário para o solicitante..."
                        className="pa-input"
                        style={{ width: '100%', marginBottom: '10px' }}
                        value={actionObservation}
                        onChange={e => setActionObservation(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="pa-action-btn"
                          onClick={() => setShowActionConfirm(null)}
                        >
                          Cancelar
                        </button>
                        {showActionConfirm === 'APPROVE' ? (
                          <button
                            type="button"
                            disabled={actionLoading}
                            className="pa-btn-approve"
                            onClick={handleApprove}
                          >
                            {actionLoading ? 'Processando...' : 'Confirmar Aprovação (Mover p/ Arquivo)'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoading}
                            className="pa-btn-deny"
                            onClick={handleDeny}
                          >
                            {actionLoading ? 'Processando...' : 'Confirmar Negação (Mover p/ Arquivo)'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Seção de Mensagens / Esclarecimentos */}
              <div className="pa-chat-section">
                <div className="pa-chat-title">
                  <MessageSquare size={16} color="#3b82f6" /> Histórico de Mensagens e Esclarecimentos ({selectedRequest.mensagens?.length || 0})
                </div>

                <div className="pa-messages-list">
                  {(!selectedRequest.mensagens || selectedRequest.mensagens.length === 0) ? (
                    <p style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '12px' }}>
                      Nenhuma mensagem enviada nesta requisição ainda.
                    </p>
                  ) : (
                    selectedRequest.mensagens.map(msg => (
                      <div
                        key={msg.id}
                        className={`pa-message-bubble ${msg.autor_role.toLowerCase()}`}
                      >
                        <div className="pa-message-meta">
                          <strong>{msg.autor_nome} ({msg.autor_role === 'APROVADOR' ? 'Aprovador' : 'Solicitante'})</strong>
                          <span>{formatDate(msg.created_at)}</span>
                        </div>
                        <div>{msg.mensagem}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Input de Envio de Mensagem */}
                <form onSubmit={handleSendMessage} className="pa-chat-input-row">
                  <input
                    type="text"
                    placeholder="Escrever uma mensagem ou pergunta sobre esta compra..."
                    className="pa-chat-input"
                    value={newMessageText}
                    onChange={e => setNewMessageText(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!newMessageText.trim()}
                    className="pa-chat-send-btn"
                  >
                    <Send size={15} /> Responder
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REABERTURA DE SOLICITAÇÃO NEGADA */}
      {reopenTarget && (
        <div className="pa-modal-overlay" onClick={() => setReopenTarget(null)}>
          <div className="pa-modal-card" onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header">
              <h3>
                <RotateCcw size={20} color="#c084fc" /> Reabrir Solicitação: {reopenTarget.id}
              </h3>
              <button
                type="button"
                className="pa-modal-close"
                onClick={() => setReopenTarget(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmReopen}>
              <div className="pa-modal-body">
                <p style={{ fontSize: '0.9rem', color: '#cbd5e1' }}>
                  Ao reabrir esta solicitação, ela voltará para a fila ativa dos aprovadores com o status <strong>REABERTO</strong>.
                </p>

                <div className="pa-form-group">
                  <label>Mensagem / Justificativa para a Reabertura <span className="pa-required">*</span></label>
                  <textarea
                    className="pa-textarea"
                    placeholder="Explique os ajustes realizados ou a justificativa para nova avaliação..."
                    value={reopenMessage}
                    onChange={e => setReopenMessage(e.target.value)}
                    required
                  />
                </div>

                <div style={{ borderTop: '1px solid #1e293b', paddingTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Edit3 size={16} color="#3b82f6" /> Ajustar Dados da Compra (Opcional)
                  </h4>

                  <div className="pa-form-grid">
                    <div className="pa-form-group full-width">
                      <label>Produto / Serviço</label>
                      <input
                        type="text"
                        className="pa-input"
                        value={reopenProduto}
                        onChange={e => setReopenProduto(e.target.value)}
                        required
                      />
                    </div>

                    <div className="pa-form-group">
                      <label>Valor Unitário (R$)</label>
                      <input
                        type="text"
                        className="pa-input"
                        value={reopenValorDisplay}
                        onChange={handleReopenCurrencyInput}
                        required
                      />
                    </div>

                    <div className="pa-form-group">
                      <label>Quantidade</label>
                      <input
                        type="number"
                        min="1"
                        className="pa-input"
                        value={reopenQuantidade}
                        onChange={e => setReopenQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                        required
                      />
                    </div>

                    <div className="pa-form-group full-width">
                      <label>Observações</label>
                      <textarea
                        className="pa-textarea"
                        value={reopenObservacoes}
                        onChange={e => setReopenObservacoes(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className="pa-action-btn"
                    onClick={() => setReopenTarget(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={reopenLoading || !reopenMessage.trim()}
                    className="pa-btn-approve"
                    style={{ background: '#9333ea' }}
                  >
                    {reopenLoading ? <RefreshCw size={16} className="pwc-spinner" /> : <RotateCcw size={16} />}
                    {reopenLoading ? 'Reabrindo...' : 'Confirmar Reabertura'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="pwc-toast">
          <Sparkles size={18} /> {toastMessage}
        </div>
      )}
    </div>
  );
};

export default PurchaseApproval;
