import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ShieldCheck, ListOrdered, CheckCircle2, PlusCircle,
  XCircle, Clock, MessageSquare, Send, X, Archive, RotateCcw,
  DollarSign, AlertCircle, RefreshCw, User,
  Eye, HelpCircle, CreditCard, Check, ShieldAlert
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import { useAuth } from '../../../core/AuthContext';
import './PurchaseApproval.css';

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
  status: 'PENDENTE' | 'REABERTO' | 'AGUARDANDO_RESPOSTA_SOLICITANTE' | 'AGUARDANDO_RESPOSTA_APROVADOR' | 'APROVADO' | 'NEGADO';
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

export const PurchaseApproval: React.FC = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const [activeTab, setActiveTab] = useState<'review' | 'new' | 'my_requests' | 'archived'>('new');
  const [isApprover, setIsApprover] = useState<boolean>(false);
  const [loadingRole, setLoadingRole] = useState(true);

  // Form State
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [fornecedorContato, setFornecedorContato] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'DINHEIRO' | 'DEBITO' | 'CREDITO'>('PIX');
  const [quantidadeParcelas, setQuantidadeParcelas] = useState<number>(1);
  const [departamentoCentroCusto, setDepartamentoCentroCusto] = useState('');
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
  const [, setLoadingData] = useState(false);

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
  const [reopenFornecedorNome, setReopenFornecedorNome] = useState('');
  const [reopenFornecedorContato, setReopenFornecedorContato] = useState('');
  const [reopenFormaPagamento, setReopenFormaPagamento] = useState<'PIX' | 'DINHEIRO' | 'DEBITO' | 'CREDITO'>('PIX');
  const [reopenQuantidadeParcelas, setReopenQuantidadeParcelas] = useState<number>(1);
  const [reopenDepartamento, setReopenDepartamento] = useState('');
  const [reopenProduto, setReopenProduto] = useState('');
  const [reopenValorDisplay, setReopenValorDisplay] = useState('');
  const [reopenValorNumeric, setReopenValorNumeric] = useState<number>(0);
  const [reopenQuantidade, setReopenQuantidade] = useState<number>(1);
  const [reopenObservacoes, setReopenObservacoes] = useState('');
  const [reopenLoading, setReopenLoading] = useState(false);

  // Master Manual Archive Modal State
  const [manualArchiveTarget, setManualArchiveTarget] = useState<PurchaseRequest | null>(null);
  const [manualArchiveType, setManualArchiveType] = useState<'ARCHIVE' | 'UNARCHIVE'>('ARCHIVE');
  const [manualArchiveMotivo, setManualArchiveMotivo] = useState('');
  const [manualArchiveLoading, setManualArchiveLoading] = useState(false);

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
  }, [fetchUserRole]);

  // 2. Carrega todos os dados do SQLite (Fila ativa, Minhas solicitações, Arquivadas)
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoadingData(true);
    try {
      const headers = getAuthHeaders();

      // Fila de revisão (apenas aprovadores e master)
      if (isApprover || isMaster) {
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

      // Se houver modal aberto, atualiza silenciosamente os detalhes e mensagens do SQLite
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
      }
    } catch (err) {
      console.error('Erro ao sincronizar dados de solicitações:', err);
    } finally {
      if (!isBackground) setLoadingData(false);
    }
  }, [isApprover, isMaster]);

  // Carga inicial
  useEffect(() => {
    if (!loadingRole) {
      fetchData(false);
    }
  }, [loadingRole, fetchData]);

  // Polling em tempo real online: atualiza a cada 3 segundos
  useEffect(() => {
    if (loadingRole) return;
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchData(true);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [loadingRole, fetchData]);

  // Máscaras de Moeda R$
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

  // Enviar Nova Solicitação
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fornecedorNome.trim()) {
      setFormError('Informe o Nome do Fornecedor / Prestador de serviço.');
      return;
    }
    if (!fornecedorContato.trim()) {
      setFormError('Informe o Contato do Fornecedor / Prestador de serviço.');
      return;
    }
    if (!formaPagamento) {
      setFormError('Selecione a Forma de Pagamento.');
      return;
    }
    if (!departamentoCentroCusto.trim()) {
      setFormError('Informe o Departamento / Centro de Custo / Empresa / Cliente.');
      return;
    }
    if (!produtoServico.trim()) {
      setFormError('Informe a Descrição do Produto ou Serviço.');
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
          fornecedor_nome: fornecedorNome.trim(),
          fornecedor_contato: fornecedorContato.trim(),
          forma_pagamento: formaPagamento,
          quantidade_parcelas: Math.max(1, quantidadeParcelas || 1),
          departamento_centro_custo: departamentoCentroCusto.trim(),
          produto_servico: produtoServico.trim(),
          valor: valorNumeric,
          quantidade,
          observacoes: observacoes.trim()
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao enviar solicitação.');
      }

      setFornecedorNome('');
      setFornecedorContato('');
      setFormaPagamento('PIX');
      setQuantidadeParcelas(1);
      setDepartamentoCentroCusto('');
      setProdutoServico('');
      setValorDisplay('');
      setValorNumeric(0);
      setQuantidade(1);
      setObservacoes('');

      showToast('Solicitação registrada no banco SQLite e enviada para aprovação!');
      fetchData(false);
      setActiveTab('my_requests');
    } catch (err: any) {
      setFormError(err.message || 'Erro ao registrar solicitação.');
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

  // Aprovar Solicitação
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

      showToast('Solicitação APROVADA e gravada no SQLite com sucesso!');
      setSelectedRequest(null);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao aprovar.');
    } finally {
      setActionLoading(false);
    }
  };

  // Negar Solicitação
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

      showToast('Solicitação NEGADA e arquivada.');
      setSelectedRequest(null);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao negar.');
    } finally {
      setActionLoading(false);
    }
  };

  // Arquivar / Desarquivar Manualmente (Exclusivo para Lepta Master)
  const handleOpenManualArchive = (req: PurchaseRequest, arquivar: boolean) => {
    setManualArchiveTarget(req);
    setManualArchiveType(arquivar ? 'ARCHIVE' : 'UNARCHIVE');
    setManualArchiveMotivo('');
  };

  const handleConfirmManualArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualArchiveTarget) return;

    setManualArchiveLoading(true);
    try {
      const isArchiving = manualArchiveType === 'ARCHIVE';
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${manualArchiveTarget.id}/arquivar-manual`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          arquivado: isArchiving,
          motivo: manualArchiveMotivo.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao processar arquivamento manual.');
      }

      showToast(isArchiving ? 'Solicitação arquivada manualmente pelo Master!' : 'Solicitação desarquivada e retornada à fila!');
      setManualArchiveTarget(null);
      if (selectedRequest?.id === manualArchiveTarget.id) setSelectedRequest(null);
      fetchData(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao processar ação de Master.');
    } finally {
      setManualArchiveLoading(false);
    }
  };

  // Enviar Mensagem na Solicitação
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
        showToast('Mensagem gravada no banco SQLite!');
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
    setReopenFornecedorNome(req.fornecedor_nome || '');
    setReopenFornecedorContato(req.fornecedor_contato || '');
    setReopenFormaPagamento((req.forma_pagamento as any) || 'PIX');
    setReopenQuantidadeParcelas(req.quantidade_parcelas || 1);
    setReopenDepartamento(req.departamento_centro_custo || '');
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
          fornecedor_nome: reopenFornecedorNome.trim(),
          fornecedor_contato: reopenFornecedorContato.trim(),
          forma_pagamento: reopenFormaPagamento,
          quantidade_parcelas: reopenQuantidadeParcelas,
          departamento_centro_custo: reopenDepartamento.trim(),
          produto_servico: reopenProduto.trim(),
          valor: reopenValorNumeric,
          quantidade: reopenQuantidade,
          observacoes: reopenObservacoes.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao reabrir solicitação.');
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

  // Renderizador de Badge de Status
  const renderStatusBadge = (status: string, arquivadoManualmente?: number) => {
    if (arquivadoManualmente === 1) {
      return (
        <span className="pa-status-badge" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
          <Archive size={12} /> Arquivado por Master
        </span>
      );
    }
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
        (item.produto_servico && item.produto_servico.toLowerCase().includes(q)) ||
        (item.fornecedor_nome && item.fornecedor_nome.toLowerCase().includes(q)) ||
        (item.departamento_centro_custo && item.departamento_centro_custo.toLowerCase().includes(q)) ||
        (item.solicitante_nome && item.solicitante_nome.toLowerCase().includes(q)) ||
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
        (item.produto_servico && item.produto_servico.toLowerCase().includes(q)) ||
        (item.fornecedor_nome && item.fornecedor_nome.toLowerCase().includes(q)) ||
        (item.departamento_centro_custo && item.departamento_centro_custo.toLowerCase().includes(q)) ||
        (item.solicitante_nome && item.solicitante_nome.toLowerCase().includes(q)) ||
        item.id.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [archivedRequests, statusFilter, searchQuery]);

  // Métricas do Topo
  const metrics = useMemo(() => {
    const list = isApprover || isMaster ? reviewQueue : myRequests;
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
  }, [reviewQueue, myRequests, archivedRequests, isApprover, isMaster]);

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
          <div className="pa-icon-badge">
            <CreditCard size={28} />
          </div>
          <div>
            <div className="pa-kicker">Financeiro • Gestão de Pagamentos & Compras</div>
            <h1>Solicitações Financeiras</h1>
            <p className="pa-subtitle">
              Esteira corporativa para solicitação de pagamentos, fornecedores, centro de custo e esteira de aprovação.
            </p>
          </div>
        </div>

        <div className="pa-header-badges">
          <div className="pa-live-indicator">
            <span className="pa-live-dot" /> SQLite Sincronizado
          </div>
          {isMaster ? (
            <span className="pa-role-badge" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.4)' }}>
              <ShieldAlert size={14} /> Lepta Master
            </span>
          ) : isApprover ? (
            <span className="pa-role-badge approver">
              <ShieldCheck size={14} /> Aprovador
            </span>
          ) : (
            <span className="pa-role-badge requester">
              <User size={14} /> Requisitante
            </span>
          )}
        </div>
      </div>

      {/* MÉTRICAS KPI */}
      <div className="pa-kpi-grid">
        <div className="pa-kpi-card">
          <div className="pa-kpi-header">
            <span>Fila Pendente</span>
            <div className="pa-kpi-icon-box" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="pa-kpi-val" style={{ color: '#fbbf24' }}>
            {metrics.pendingCount}
          </div>
          <p className="pa-kpi-sub">Aguardando primeira decisão</p>
        </div>

        <div className="pa-kpi-card">
          <div className="pa-kpi-header">
            <span>Reabertos</span>
            <div className="pa-kpi-icon-box" style={{ background: 'rgba(192, 132, 252, 0.15)', color: '#c084fc' }}>
              <RotateCcw size={18} />
            </div>
          </div>
          <div className="pa-kpi-val" style={{ color: '#c084fc' }}>
            {metrics.reopenedCount}
          </div>
          <p className="pa-kpi-sub">Recursos reenviados</p>
        </div>

        <div className="pa-kpi-card">
          <div className="pa-kpi-header">
            <span>Em Discussão</span>
            <div className="pa-kpi-icon-box" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <MessageSquare size={18} />
            </div>
          </div>
          <div className="pa-kpi-val" style={{ color: '#38bdf8' }}>
            {metrics.waitingCount}
          </div>
          <p className="pa-kpi-sub">Com mensagens pendentes</p>
        </div>

        <div className="pa-kpi-card">
          <div className="pa-kpi-header">
            <span>Total em Fila</span>
            <div className="pa-kpi-icon-box" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="pa-kpi-val" style={{ color: '#34d399' }}>
            {formatBrl(metrics.pendingValue)}
          </div>
          <p className="pa-kpi-sub">Volume total sob análise</p>
        </div>
      </div>

      {/* TABS DE NAVEGAÇÃO */}
      <div className="pa-tabs">
        {(isApprover || isMaster) && (
          <button
            className={`pa-tab ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => setActiveTab('review')}
          >
            <ShieldCheck size={18} /> Fila de Aprovação
            {reviewQueue.length > 0 && (
              <span className="pa-tab-counter">{reviewQueue.length}</span>
            )}
          </button>
        )}

        <button
          className={`pa-tab ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          <PlusCircle size={18} /> Nova Solicitação
        </button>

        <button
          className={`pa-tab ${activeTab === 'my_requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('my_requests')}
        >
          <ListOrdered size={18} /> Minhas Solicitações ({myRequests.length})
        </button>

        <button
          className={`pa-tab ${activeTab === 'archived' ? 'active' : ''}`}
          onClick={() => setActiveTab('archived')}
        >
          <Archive size={18} /> Solicitações Arquivadas ({archivedRequests.length})
        </button>
      </div>

      {/* TAB 1: FILA DE APROVAÇÃO ATIVA (APROVADORES E MASTER) */}
      {(isApprover || isMaster) && activeTab === 'review' && (
        <div className="pa-table-card">
          <div className="pa-table-header">
            <h2>
              <ShieldCheck size={18} /> Fila de Decisão Ativa ({filteredReviewQueue.length})
            </h2>

            <div className="pa-table-controls">
              <select
                className="pa-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos os Status</option>
                <option value="PENDENTE">Pendentes</option>
                <option value="REABERTO">Reabertos</option>
                <option value="AGUARDANDO_RESPOSTA_APROVADOR">Aguardando Aprovador</option>
                <option value="AGUARDANDO_RESPOSTA_SOLICITANTE">Aguardando Solicitante</option>
              </select>

              <input
                type="text"
                className="pa-search-input"
                placeholder="Buscar fornecedor, solicitante, centro de custo..."
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
                  <th>Fornecedor / Prestador</th>
                  <th>Descrição / Serviço</th>
                  <th>Pagamento</th>
                  <th>Centro de Custo</th>
                  <th>Solicitante</th>
                  <th>Valor Total</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredReviewQueue.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="pa-empty">
                      Nenhuma solicitação pendente no momento.
                    </td>
                  </tr>
                ) : (
                  filteredReviewQueue.map(item => (
                    <tr key={item.id}>
                      <td><span className="pa-code-badge">{item.id}</span></td>
                      <td>
                        <strong>{item.fornecedor_nome || '-'}</strong>
                        {item.fornecedor_contato && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.fornecedor_contato}</div>
                        )}
                      </td>
                      <td>{item.produto_servico}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#60a5fa' }}>{item.forma_pagamento || '-'}</span>
                        {item.quantidade_parcelas > 1 && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.quantidade_parcelas}x parcelas</div>
                        )}
                      </td>
                      <td>{item.departamento_centro_custo || '-'}</td>
                      <td>
                        <div className="pa-solicitante-cell">
                          <User size={14} color="#94a3b8" />
                          <span>{item.solicitante_nome}</span>
                        </div>
                      </td>
                      <td>
                        <span className="pa-price-highlight">
                          {formatBrl(item.valor * item.quantidade)}
                        </span>
                      </td>
                      <td>{renderStatusBadge(item.status, item.arquivado_manualmente)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="pa-btn-detail"
                            onClick={() => handleOpenDetails(item.id)}
                            title="Avaliar Solicitação"
                          >
                            <Eye size={15} /> Analisar
                          </button>
                          {isMaster && (
                            <button
                              className="pa-btn-archive-master"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleOpenManualArchive(item, true)}
                              title="Arquivar Manualmente (Exclusivo Master)"
                            >
                              <Archive size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: NOVA SOLICITAÇÃO FINANCEIRA */}
      {activeTab === 'new' && (
        <div className="pa-form-card">
          <h2>
            <CreditCard size={22} color="#3b82f6" /> Nova Solicitação Financeira
          </h2>
          <p className="pa-form-subtitle">
            Preencha os campos abaixo para submeter a solicitação de pagamento / serviço para a esteira de aprovação.
          </p>

          {/* Vínculo automático do Colaborador Responsável da Sessão */}
          <div className="pa-user-session-card">
            <div className="pa-user-session-avatar">
              <User size={22} />
            </div>
            <div className="pa-user-session-info">
              <span className="pa-user-session-label">Colaborador Responsável (Sessão Ativa)</span>
              <span className="pa-user-session-name">
                {user?.username || 'Usuário Conectado'} {user?.email ? `(${user.email})` : ''}
              </span>
              <span className="pa-user-session-note">
                Vínculo preenchido automaticamente a partir do seu login no sistema.
              </span>
            </div>
          </div>

          {formError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '12px 16px', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} /> {formError}
            </div>
          )}

          <form onSubmit={handleSubmitRequest}>
            <div className="pa-form-grid">
              {/* Nome do Fornecedor */}
              <div className="pa-form-group">
                <label>
                  Nome do Fornecedor / Prestador de Serviço <span className="pa-required">*</span>
                </label>
                <input
                  type="text"
                  className="pa-input"
                  placeholder="Ex: Tech Soluções LTDA, João Silva ME..."
                  value={fornecedorNome}
                  onChange={e => setFornecedorNome(e.target.value)}
                  required
                />
              </div>

              {/* Contato do Fornecedor */}
              <div className="pa-form-group">
                <label>
                  Contato do Fornecedor / Prestador de Serviço <span className="pa-required">*</span>
                </label>
                <input
                  type="text"
                  className="pa-input"
                  placeholder="Ex: (11) 99999-9999 / financeiro@fornecedor.com.br"
                  value={fornecedorContato}
                  onChange={e => setFornecedorContato(e.target.value)}
                  required
                />
              </div>

              {/* Forma de Pagamento */}
              <div className="pa-form-group">
                <label>
                  Forma de Pagamento <span className="pa-required">*</span>
                </label>
                <div className="pa-payment-grid">
                  {(['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO'] as const).map(op => (
                    <button
                      key={op}
                      type="button"
                      className={`pa-payment-option-btn ${formaPagamento === op ? 'active' : ''}`}
                      onClick={() => setFormaPagamento(op)}
                    >
                      {op === 'PIX' && '⚡ PIX'}
                      {op === 'DINHEIRO' && '💵 Dinheiro'}
                      {op === 'DEBITO' && '💳 Débito'}
                      {op === 'CREDITO' && '💳 Crédito'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantidade de Parcelas */}
              <div className="pa-form-group">
                <label>
                  Quantidade de Parcelas <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>(Opcional)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  className="pa-input"
                  placeholder="1x (à vista)"
                  value={quantidadeParcelas}
                  onChange={e => setQuantidadeParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>

              {/* Departamento / Centro de Custo */}
              <div className="pa-form-group full-width">
                <label>
                  Departamento / Centro de Custo / Empresa / Cliente <span className="pa-required">*</span>
                </label>
                <input
                  type="text"
                  className="pa-input"
                  placeholder="Ex: Financeiro / Matriz / Cliente XYZ / Operações"
                  value={departamentoCentroCusto}
                  onChange={e => setDepartamentoCentroCusto(e.target.value)}
                  required
                />
              </div>

              {/* Descrição do Produto ou Serviço */}
              <div className="pa-form-group full-width">
                <label>
                  Descrição do Produto / Serviço <span className="pa-required">*</span>
                </label>
                <input
                  type="text"
                  className="pa-input"
                  placeholder="Ex: Licença de Software, Manutenção de Equipamento, Honorários..."
                  value={produtoServico}
                  onChange={e => setProdutoServico(e.target.value)}
                  required
                />
              </div>

              {/* Valor Unitário Estimado */}
              <div className="pa-form-group">
                <label>
                  Valor Estimado (R$) <span className="pa-required">*</span>
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

              {/* Quantidade */}
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

              {/* Observações */}
              <div className="pa-form-group full-width">
                <label>Observações Adicionais (Opcional)</label>
                <textarea
                  className="pa-textarea"
                  placeholder="Justificativa da solicitação, links, dados bancários/chave Pix do fornecedor ou detalhes adicionais..."
                  value={observacoes}
                  onChange={e => setObservacoes(e.target.value)}
                />
              </div>
            </div>

            {/* Resumo Financeiro ao vivo */}
            {valorNumeric > 0 && (
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', padding: '14px 18px', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Resumo da Solicitação:</span>
                  <div style={{ color: '#60a5fa', fontWeight: 600, fontSize: '0.9rem' }}>
                    {formaPagamento} {quantidadeParcelas > 1 ? `• ${quantidadeParcelas}x parcelas de ${formatBrl((valorNumeric * quantidade) / quantidadeParcelas)}` : '• À vista'}
                  </div>
                </div>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Valor Total:</span>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#34d399' }}>
                    {formatBrl(valorNumeric * quantidade)}
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="pa-submit-btn"
            >
              {submitting ? <RefreshCw size={18} className="pwc-spinner" /> : <Send size={18} />}
              {submitting ? 'Gravando no SQLite...' : 'Submeter Solicitação para Aprovação'}
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
                  <th>Fornecedor / Prestador</th>
                  <th>Descrição / Serviço</th>
                  <th>Pagamento</th>
                  <th>Centro de Custo</th>
                  <th>Valor Total</th>
                  <th>Data de Envio</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="pa-empty">
                      Você não possui solicitações ativas no momento.
                    </td>
                  </tr>
                ) : (
                  myRequests.map(item => (
                    <tr key={item.id}>
                      <td><span className="pa-code-badge">{item.id}</span></td>
                      <td>
                        <strong>{item.fornecedor_nome || '-'}</strong>
                        {item.fornecedor_contato && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.fornecedor_contato}</div>
                        )}
                      </td>
                      <td>{item.produto_servico}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#60a5fa' }}>{item.forma_pagamento || '-'}</span>
                        {item.quantidade_parcelas > 1 && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.quantidade_parcelas}x</div>
                        )}
                      </td>
                      <td>{item.departamento_centro_custo || '-'}</td>
                      <td>
                        <span className="pa-price-highlight">
                          {formatBrl(item.valor * item.quantidade)}
                        </span>
                      </td>
                      <td>{formatDate(item.created_at)}</td>
                      <td>{renderStatusBadge(item.status, item.arquivado_manualmente)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="pa-btn-detail"
                            onClick={() => handleOpenDetails(item.id)}
                            title="Visualizar Detalhes"
                          >
                            <Eye size={15} /> Detalhes
                          </button>
                          {isMaster && (
                            <button
                              className="pa-btn-archive-master"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleOpenManualArchive(item, true)}
                              title="Arquivar Manualmente (Exclusivo Master)"
                            >
                              <Archive size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SOLICITAÇÕES ARQUIVADAS */}
      {activeTab === 'archived' && (
        <div className="pa-table-card">
          <div className="pa-table-header">
            <h2>
              <Archive size={18} /> Solicitações Arquivadas ({filteredArchived.length})
            </h2>

            <div className="pa-table-controls">
              <select
                className="pa-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos os Arquivados</option>
                <option value="APROVADO">Aprovados</option>
                <option value="NEGADO">Negados</option>
              </select>

              <input
                type="text"
                className="pa-search-input"
                placeholder="Buscar fornecedor, solicitante, centro de custo..."
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
                  <th>Fornecedor / Prestador</th>
                  <th>Descrição / Serviço</th>
                  <th>Pagamento</th>
                  <th>Centro de Custo</th>
                  <th>Solicitante</th>
                  <th>Valor Total</th>
                  <th>Decisão / Arquivamento</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredArchived.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="pa-empty">
                      Nenhuma solicitação arquivada encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredArchived.map(item => {
                    const isOwner = item.solicitante_id === user?.id || isApprover || isMaster;
                    return (
                      <tr key={item.id}>
                        <td><span className="pa-code-badge">{item.id}</span></td>
                        <td>
                          <strong>{item.fornecedor_nome || '-'}</strong>
                        </td>
                        <td>{item.produto_servico}</td>
                        <td>{item.forma_pagamento || '-'}</td>
                        <td>{item.departamento_centro_custo || '-'}</td>
                        <td>{item.solicitante_nome}</td>
                        <td>
                          <span className="pa-price-highlight">
                            {formatBrl(item.valor * item.quantidade)}
                          </span>
                        </td>
                        <td>
                          {item.arquivado_manualmente === 1 ? (
                            <span className="pa-master-tag">
                              Por {item.arquivado_por || 'Master'}
                            </span>
                          ) : (
                            formatDate(item.decidido_em || item.updated_at)
                          )}
                        </td>
                        <td>{renderStatusBadge(item.status, item.arquivado_manualmente)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="pa-btn-detail"
                              onClick={() => handleOpenDetails(item.id)}
                            >
                              <Eye size={15} /> Ver
                            </button>

                            {/* Se negada e for dono ou master -> Reabrir */}
                            {item.status === 'NEGADO' && isOwner && (
                              <button
                                className="pa-btn-reopen"
                                onClick={() => handleOpenReopen(item)}
                                title="Reabrir Solicitação"
                              >
                                <RotateCcw size={14} /> Reabrir
                              </button>
                            )}

                            {/* Se Master -> Desarquivar Manualmente */}
                            {isMaster && (
                              <button
                                className="pa-btn-unarchive-master"
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                                onClick={() => handleOpenManualArchive(item, false)}
                                title="Desarquivar Solicitação (Master)"
                              >
                                <RotateCcw size={13} /> Desarquivar
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

      {/* MODAL DE DETALHES, HISTÓRICO E DECISÃO */}
      {selectedRequest && (
        <div className="pa-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="pa-modal-card" onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header">
              <h3>
                <CreditCard size={20} color="#3b82f6" /> Solicitação: {selectedRequest.id}
                <div style={{ marginLeft: '8px' }}>
                  {renderStatusBadge(selectedRequest.status, selectedRequest.arquivado_manualmente)}
                </div>
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
              {/* Detalhes da Solicitação */}
              <div className="pa-req-details-grid">
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Fornecedor / Prestador</span>
                  <span className="pa-detail-val">{selectedRequest.fornecedor_nome || 'Não informado'}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Contato do Fornecedor</span>
                  <span className="pa-detail-val">{selectedRequest.fornecedor_contato || 'Não informado'}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Forma de Pagamento & Parcelas</span>
                  <span className="pa-detail-val" style={{ color: '#60a5fa' }}>
                    {selectedRequest.forma_pagamento || '-'}
                    {selectedRequest.quantidade_parcelas > 1 ? ` (${selectedRequest.quantidade_parcelas}x de ${formatBrl((selectedRequest.valor * selectedRequest.quantidade) / selectedRequest.quantidade_parcelas)})` : ' (À vista)'}
                  </span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Centro de Custo / Cliente</span>
                  <span className="pa-detail-val">{selectedRequest.departamento_centro_custo || 'Não informado'}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Colaborador Responsável</span>
                  <span className="pa-detail-val">{selectedRequest.solicitante_nome} ({selectedRequest.solicitante_email || 'Sem e-mail'})</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Descrição / Produto / Serviço</span>
                  <span className="pa-detail-val">{selectedRequest.produto_servico}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Valor Unitário</span>
                  <span className="pa-detail-val">{formatBrl(selectedRequest.valor)}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Quantidade & Total</span>
                  <span className="pa-detail-val" style={{ color: '#34d399', fontWeight: 700 }}>
                    {selectedRequest.quantidade}x = {formatBrl(selectedRequest.valor * selectedRequest.quantidade)}
                  </span>
                </div>

                <div className="pa-detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="pa-detail-label">Observações Adicionais</span>
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

                {selectedRequest.arquivado_manualmente === 1 && (
                  <div className="pa-detail-item" style={{ gridColumn: 'span 2', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '10px 14px', borderRadius: '8px' }}>
                    <span className="pa-detail-label" style={{ color: '#c084fc' }}>
                      Arquivamento Manual (Lepta Master)
                    </span>
                    <span className="pa-detail-val">
                      Arquivado por <strong>{selectedRequest.arquivado_por || 'Master'}</strong> em {formatDate(selectedRequest.arquivado_em || '')}
                    </span>
                    {selectedRequest.motivo_arquivamento && (
                      <p style={{ marginTop: '4px', fontSize: '0.85rem', color: '#d8b4fe' }}>
                        "{selectedRequest.motivo_arquivamento}"
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

              {/* Ações de Aprovação / Negação (Apenas para Aprovadores em solicitações Ativas) */}
              {(isApprover || isMaster) && selectedRequest.arquivado !== 1 && selectedRequest.status !== 'APROVADO' && selectedRequest.status !== 'NEGADO' && (
                <div className="pa-actions-bar">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc' }}>
                      Decisão do Aprovador:
                    </span>
                    <div className="pa-actions-buttons">
                      <button
                        type="button"
                        className="pa-btn-approve"
                        onClick={() => setShowActionConfirm(showActionConfirm === 'APPROVE' ? null : 'APPROVE')}
                      >
                        <CheckCircle2 size={16} /> Aprovar Solicitação
                      </button>

                      <button
                        type="button"
                        className="pa-btn-deny"
                        onClick={() => setShowActionConfirm(showActionConfirm === 'DENY' ? null : 'DENY')}
                      >
                        <XCircle size={16} /> Negar Solicitação
                      </button>
                    </div>
                  </div>

                  {showActionConfirm && (
                    <div className="pa-confirm-box">
                      <h4>
                        {showActionConfirm === 'APPROVE' ? 'Confirmar Aprovação da Solicitação' : 'Confirmar Negação da Solicitação'}
                      </h4>
                      <p>
                        {showActionConfirm === 'APPROVE'
                          ? 'A solicitação será marcada como APROVADA, gravada no SQLite e o solicitante será notificado.'
                          : 'A solicitação será marcada como NEGADA no SQLite. O solicitante poderá reabri-la caso deseje.'}
                      </p>
                      <textarea
                        className="pa-textarea"
                        placeholder={showActionConfirm === 'APPROVE' ? 'Observações de aprovação (opcional)...' : 'Motivo da recusa (recomendado)...'}
                        value={actionObservation}
                        onChange={e => setActionObservation(e.target.value)}
                      />
                      <div className="pa-confirm-actions">
                        <button
                          type="button"
                          className="pa-btn-cancel"
                          onClick={() => setShowActionConfirm(null)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          className={showActionConfirm === 'APPROVE' ? 'pa-btn-confirm-approve' : 'pa-btn-confirm-deny'}
                          onClick={showActionConfirm === 'APPROVE' ? handleApprove : handleDeny}
                        >
                          {actionLoading ? <RefreshCw size={15} className="pwc-spinner" /> : <Check size={15} />}
                          {showActionConfirm === 'APPROVE' ? 'Sim, Aprovar' : 'Sim, Negar'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Botão de Ação Exclusiva Master: Arquivar / Desarquivar Manualmente */}
              {isMaster && (
                <div style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(168, 85, 247, 0.3)', padding: '14px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginTop: '1rem' }}>
                  <div>
                    <span style={{ color: '#c084fc', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Controle Lepta Master
                    </span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                      Você possui autoridade Master para arquivar ou desarquivar manualmente esta solicitação a qualquer momento.
                    </p>
                  </div>
                  {selectedRequest.arquivado === 1 ? (
                    <button
                      type="button"
                      className="pa-btn-unarchive-master"
                      onClick={() => handleOpenManualArchive(selectedRequest, false)}
                    >
                      <RotateCcw size={15} /> Desarquivar Solicitação
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="pa-btn-archive-master"
                      onClick={() => handleOpenManualArchive(selectedRequest, true)}
                    >
                      <Archive size={15} /> Arquivar Manualmente
                    </button>
                  )}
                </div>
              )}

              {/* HISTÓRICO DE MENSAGENS E COMENTÁRIOS */}
              <div className="pa-messages-container">
                <div className="pa-messages-header">
                  <MessageSquare size={16} color="#3b82f6" />
                  <span>Histórico de Interações & Mensagens</span>
                </div>

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
                <div style={{ background: 'rgba(192, 132, 252, 0.1)', border: '1px solid rgba(192, 132, 252, 0.3)', padding: '12px 16px', borderRadius: '10px', marginBottom: '1.5rem', color: '#e9d5ff', fontSize: '0.85rem' }}>
                  Ao reabrir esta solicitação, ela voltará para a esteira ativa dos aprovadores com o status <strong>REABERTO</strong>.
                </div>

                <div className="pa-form-grid">
                  <div className="pa-form-group">
                    <label>Fornecedor / Prestador</label>
                    <input
                      type="text"
                      className="pa-input"
                      value={reopenFornecedorNome}
                      onChange={e => setReopenFornecedorNome(e.target.value)}
                      required
                    />
                  </div>

                  <div className="pa-form-group">
                    <label>Contato do Fornecedor</label>
                    <input
                      type="text"
                      className="pa-input"
                      value={reopenFornecedorContato}
                      onChange={e => setReopenFornecedorContato(e.target.value)}
                      required
                    />
                  </div>

                  <div className="pa-form-group">
                    <label>Forma de Pagamento</label>
                    <div className="pa-payment-grid">
                      {(['PIX', 'DINHEIRO', 'DEBITO', 'CREDITO'] as const).map(op => (
                        <button
                          key={op}
                          type="button"
                          className={`pa-payment-option-btn ${reopenFormaPagamento === op ? 'active' : ''}`}
                          onClick={() => setReopenFormaPagamento(op)}
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pa-form-group">
                    <label>Parcelas</label>
                    <input
                      type="number"
                      min="1"
                      className="pa-input"
                      value={reopenQuantidadeParcelas}
                      onChange={e => setReopenQuantidadeParcelas(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>

                  <div className="pa-form-group full-width">
                    <label>Departamento / Centro de Custo</label>
                    <input
                      type="text"
                      className="pa-input"
                      value={reopenDepartamento}
                      onChange={e => setReopenDepartamento(e.target.value)}
                      required
                    />
                  </div>

                  <div className="pa-form-group full-width">
                    <label>Descrição do Produto / Serviço</label>
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
                    <label>Motivo da Reabertura / Justificativa <span className="pa-required">*</span></label>
                    <textarea
                      className="pa-textarea"
                      placeholder="Explique o motivo da reabertura, novos valores negociados ou justificativas adicionais..."
                      value={reopenMessage}
                      onChange={e => setReopenMessage(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="pa-confirm-actions" style={{ marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="pa-btn-cancel"
                    onClick={() => setReopenTarget(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={reopenLoading || !reopenMessage.trim()}
                    className="pa-reopen-btn"
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

      {/* MODAL DE ARQUIVAMENTO MANUAL (EXCLUSIVO MASTER) */}
      {manualArchiveTarget && (
        <div className="pa-modal-overlay" onClick={() => setManualArchiveTarget(null)}>
          <div className="pa-modal-card" style={{ maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header">
              <h3>
                <ShieldAlert size={20} color="#c084fc" />
                {manualArchiveType === 'ARCHIVE' ? 'Arquivar Solicitação Manualmente' : 'Desarquivar Solicitação'}
              </h3>
              <button
                type="button"
                className="pa-modal-close"
                onClick={() => setManualArchiveTarget(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmManualArchive}>
              <div className="pa-modal-body">
                <p style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  {manualArchiveType === 'ARCHIVE'
                    ? `Deseja arquivar manualmente a solicitação ${manualArchiveTarget.id} (${manualArchiveTarget.produto_servico})? Ela será movida para a aba de arquivadas.`
                    : `Deseja desarquivar a solicitação ${manualArchiveTarget.id} e retorná-la para a esteira ativa de decisões?`}
                </p>

                <div className="pa-form-group" style={{ marginTop: '1rem' }}>
                  <label>Motivo / Observação do Master (Opcional)</label>
                  <textarea
                    className="pa-textarea"
                    placeholder="Informe uma justificativa para registro de auditoria no SQLite..."
                    value={manualArchiveMotivo}
                    onChange={e => setManualArchiveMotivo(e.target.value)}
                  />
                </div>

                <div className="pa-confirm-actions" style={{ marginTop: '1.5rem' }}>
                  <button
                    type="button"
                    className="pa-btn-cancel"
                    onClick={() => setManualArchiveTarget(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={manualArchiveLoading}
                    className={manualArchiveType === 'ARCHIVE' ? 'pa-btn-archive-master' : 'pa-btn-unarchive-master'}
                  >
                    {manualArchiveLoading ? <RefreshCw size={16} className="pwc-spinner" /> : <Check size={16} />}
                    {manualArchiveLoading ? 'Processando...' : (manualArchiveType === 'ARCHIVE' ? 'Confirmar Arquivamento' : 'Confirmar Desarquivamento')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchaseApproval;
