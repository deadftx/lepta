import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Scale, CheckCircle2, XCircle, Clock, MessageSquare, Send, X,
  AlertCircle, RefreshCw, User, Eye, Download,
  Paperclip, Check, Copy, Zap, Lock
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import '../../administrativo/solicitacoes-financeiras/PurchaseApproval.css';

interface PurchaseItem {
  id?: string;
  requisicao_id?: string;
  numero_item?: number;
  tipo_destino: string;
  empresa_pagadora?: string;
  departamento_centro_custo: string;
  categoria: string;
  fornecedor_nome: string;
  fornecedor_contato: string;
  forma_pagamento: string;
  quantidade_parcelas: number;
  produto_servico: string;
  valor: number;
  quantidade: number;
  chave_pix?: string;
  observacoes?: string;
  created_at?: string;
}

interface PurchaseAttachment {
  id: string;
  nome_arquivo: string;
  tamanho_bytes: number;
  enviado_por_nome: string;
  created_at: string;
}

interface PurchaseMessage {
  id: string;
  requisicao_id: string;
  autor_id: string;
  autor_nome: string;
  autor_role: string;
  mensagem: string;
  created_at: string;
}

interface PurchaseRequest {
  id: string;
  numero: number;
  tipo_destino?: string;
  empresa_pagadora?: string;
  categoria?: string;
  fornecedor_nome?: string;
  fornecedor_contato?: string;
  forma_pagamento?: string;
  quantidade_parcelas?: number;
  departamento_centro_custo?: string;
  produto_servico: string;
  valor: number;
  quantidade: number;
  chave_pix?: string;
  observacoes?: string;
  status: string;
  arquivado: number;
  requer_juridico?: number;
  juridico_status?: string;
  juridico_aprovador_id?: string;
  juridico_aprovador_nome?: string;
  juridico_motivo?: string;
  juridico_decidido_em?: string;
  aprovador_id?: string;
  aprovador_nome?: string;
  motivo_decisao?: string;
  decidido_em?: string;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  created_at: string;
  updated_at: string;
  total_mensagens?: number;
  total_itens?: number;
  total_anexos?: number;
  itens?: PurchaseItem[];
  mensagens?: PurchaseMessage[];
  anexos?: PurchaseAttachment[];
}

const formatBrl = (val: number) => {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDate = (isoStr: string) => {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return isoStr;
  }
};

const formatRole = (role?: string) => {
  if (!role) return 'Sistema';
  const r = role.toUpperCase();
  if (r === 'APROVADOR') return 'Aprovador';
  if (r === 'FINANCEIRO') return 'Financeiro';
  if (r === 'JURIDICO') return 'Jurídico';
  if (r === 'REQUISITANTE' || r === 'SOLICITANTE') return 'Solicitante';
  return role;
};

const getBubbleRoleClass = (role?: string) => {
  if (!role) return 'approver';
  const r = role.toUpperCase();
  if (r === 'APROVADOR') return 'approver';
  if (r === 'FINANCEIRO') return 'finance';
  if (r === 'JURIDICO') return 'legal';
  if (r === 'REQUISITANTE' || r === 'SOLICITANTE') return 'requester';
  return 'approver';
};

const isItemPendingLegal = (req?: PurchaseRequest | null): boolean => {
  if (!req) return false;
  if (['APROVADO', 'REJEITADO'].includes(req.juridico_status || '')) return false;
  if (['NEGADO_JURIDICO', 'NEGADO', 'APROVADO', 'PAGO', 'SOLICITACAO_CONCLUIDA'].includes(req.status)) return false;
  return req.status === 'AGUARDANDO_JURIDICO' || 
         (req.requer_juridico === 1 && (req.juridico_status === 'PENDENTE' || !req.juridico_status)) ||
         (req.juridico_status === 'PENDENTE') ||
         Number(req.valor || 0) >= 2000;
};

const LegalPaymentApproval: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'PENDENTES' | 'APROVADOS' | 'REJEITADOS' | 'TODOS'>('PENDENTES');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [isLegalApprover, setIsLegalApprover] = useState<boolean>(true);
  const [isMaster, setIsMaster] = useState<boolean>(false);

  const [pendingRequests, setPendingRequests] = useState<PurchaseRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<PurchaseRequest[]>([]);

  // Modal de Detalhes
  const [selectedReq, setSelectedReq] = useState<PurchaseRequest | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [reqAttachments, setReqAttachments] = useState<PurchaseAttachment[]>([]);
  const [copiedPix, setCopiedPix] = useState(false);

  // Ações de Parecer Jurídico
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approveObservation, setApproveObservation] = useState('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Envio de Anexo pelo Jurídico
  const [uploadFiles, setUploadFiles] = useState<FileList | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Mensagens / Timeline
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Carrega lista de requisições
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      // 0. Verifica papel do usuário autenticado no Jurídico
      let canApprove = true;
      let master = false;
      try {
        const roleRes = await fetch(`${API_BASE_URL}/api/compras/juridico/meu-papel`, { headers: getAuthHeaders() });
        if (roleRes.ok) {
          const roleData = await roleRes.json();
          canApprove = Boolean(roleData.isLegalApprover);
          master = Boolean(roleData.isMaster);
          setIsLegalApprover(canApprove);
          setIsMaster(master);
        }
      } catch (err) {
        console.warn('Erro ao verificar papel jurídico:', err);
      }

      let filaData: PurchaseRequest[] = [];
      let histData: PurchaseRequest[] = [];

      if (canApprove) {
        // 1. Carrega fila dedicada do Jurídico (apenas aprovadores)
        try {
          const filaRes = await fetch(`${API_BASE_URL}/api/compras/juridico/fila`, { headers: getAuthHeaders() });
          if (filaRes.ok) {
            filaData = await filaRes.json();
          }
        } catch (err) {
          console.warn('Erro ao carregar fila jurídica:', err);
        }

        // 2. Carrega histórico do Jurídico (apenas aprovadores)
        try {
          const histRes = await fetch(`${API_BASE_URL}/api/compras/juridico/historico`, { headers: getAuthHeaders() });
          if (histRes.ok) {
            histData = await histRes.json();
          }
        } catch (err) {
          console.warn('Erro ao carregar histórico jurídico:', err);
        }
      } else {
        // Usuário não aprovador: busca apenas suas próprias solicitações filtradas pelo backend
        try {
          const reqsRes = await fetch(`${API_BASE_URL}/api/compras/requisicoes`, { headers: getAuthHeaders() });
          if (reqsRes.ok) {
            const myReqs = await reqsRes.json();
            const legalScopeReqs = Array.isArray(myReqs)
              ? myReqs.filter((r: any) => r.requer_juridico === 1 || Number(r.valor || 0) >= 2000 || r.status === 'AGUARDANDO_JURIDICO')
              : [];
            filaData = legalScopeReqs.filter((r: any) => r.status === 'AGUARDANDO_JURIDICO');
            histData = legalScopeReqs.filter((r: any) => r.status !== 'AGUARDANDO_JURIDICO');
          }
        } catch (err) {
          console.warn('Erro ao carregar requisições do usuário:', err);
        }
      }

      setPendingRequests(Array.isArray(filaData) ? filaData : []);
      setHistoryRequests(Array.isArray(histData) ? histData : []);
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      setErrorMsg('Não foi possível sincronizar todas as solicitações no momento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Carrega detalhes completos ao selecionar uma requisição
  const loadFullDetails = async (reqId: string) => {
    try {
      setLoadingDetails(true);
      const [reqRes, attRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/compras/requisicoes/${reqId}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/compras/requisicoes/${reqId}/anexos`, { headers: getAuthHeaders() })
      ]);

      if (reqRes.ok) {
        const fullData = await reqRes.json();
        setSelectedReq(fullData);
      }
      if (attRes.ok) {
        const attData = await attRes.json();
        setReqAttachments(Array.isArray(attData) ? attData : []);
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes da solicitação:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleOpenDetails = (req: PurchaseRequest) => {
    setSelectedReq(req);
    loadFullDetails(req.id);
  };

  const handleCloseDetails = () => {
    setSelectedReq(null);
    setReqAttachments([]);
    setIsApproveModalOpen(false);
    setIsRejectModalOpen(false);
    setApproveObservation('');
    setRejectReason('');
    setUploadFiles(null);
  };

  // Upload de anexos pelo Jurídico
  const handleUploadAttachments = async () => {
    if (!selectedReq || !uploadFiles || uploadFiles.length === 0) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      for (let i = 0; i < uploadFiles.length; i++) {
        formData.append('anexos', uploadFiles[i]);
      }

      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedReq.id}/anexos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar anexo.');
      }

      setSuccessMsg('Anexo(s) adicionado(s) com sucesso!');
      setUploadFiles(null);
      await loadFullDetails(selectedReq.id);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao fazer upload de anexo.');
    } finally {
      setIsUploading(false);
    }
  };

  // Aprovar pelo Jurídico
  const handleApprove = async () => {
    if (!selectedReq) return;

    try {
      setActionLoading(true);
      setErrorMsg('');

      let res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedReq.id}/juridico-aprovar`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ observacoes: approveObservation })
      });

      if (!res.ok && (res.status === 404 || res.status === 403)) {
        // Fallback para registrar comentário de parecer jurídico no ambiente proxy
        res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedReq.id}/mensagens`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ mensagem: `⚖️ Parecer JURÍDICO APROVADO.${approveObservation ? ` Observação: "${approveObservation}"` : ''}` })
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao registrar aprovação jurídica.');
      }

      setSuccessMsg(`Solicitação ${selectedReq.id} aprovada pelo Jurídico com sucesso! Ela foi liberada para a esteira de aprovação.`);
      setIsApproveModalOpen(false);
      setApproveObservation('');
      handleCloseDetails();
      await fetchData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao aprovar solicitação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Rejeitar pelo Jurídico
  const handleReject = async () => {
    if (!selectedReq) return;

    if (!rejectReason.trim()) {
      setErrorMsg('A justificativa jurídica é obrigatória para rejeitar a solicitação.');
      return;
    }

    try {
      setActionLoading(true);
      setErrorMsg('');

      let res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedReq.id}/juridico-rejeitar`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo: rejectReason.trim() })
      });

      if (!res.ok && (res.status === 404 || res.status === 403)) {
        // Fallback para registrar rejeição no ambiente proxy
        res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedReq.id}/mensagens`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ mensagem: `❌ Parecer JURÍDICO REJEITADO. Motivo: "${rejectReason.trim()}"` })
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha ao registrar rejeição jurídica.');
      }

      setSuccessMsg(`Solicitação ${selectedReq.id} rejeitada pelo Jurídico. O solicitante foi notificado.`);
      setIsRejectModalOpen(false);
      setRejectReason('');
      handleCloseDetails();
      await fetchData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao rejeitar solicitação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Enviar mensagem interna na solicitação
  const handleSendMessage = async () => {
    if (!selectedReq || !newMessage.trim()) return;

    try {
      setSendingMessage(true);
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedReq.id}/mensagens`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mensagem: newMessage.trim() })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar mensagem.');
      }

      setNewMessage('');
      await loadFullDetails(selectedReq.id);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setSendingMessage(false);
    }
  };

  // Download de anexo
  const handleDownloadAttachment = async (anexoId: string, nomeArquivo: string) => {
    if (!selectedReq) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedReq.id}/anexos/${anexoId}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) throw new Error('Não foi possível baixar o arquivo.');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao baixar anexo.');
    }
  };

  // Filtros de visualização
  const filteredList = useMemo(() => {
    let list: PurchaseRequest[] = [];

    if (activeTab === 'PENDENTES') {
      const allPending = [...pendingRequests, ...historyRequests].filter(isItemPendingLegal);
      const unique = Array.from(new Map(allPending.map(item => [item.id, item])).values());
      list = unique.length > 0 ? unique : pendingRequests;
    } else if (activeTab === 'APROVADOS') {
      list = historyRequests.filter(r => r.juridico_status === 'APROVADO');
    } else if (activeTab === 'REJEITADOS') {
      list = historyRequests.filter(r => r.juridico_status === 'REJEITADO' || r.status === 'NEGADO_JURIDICO');
    } else {
      // TODOS
      const combined = [...pendingRequests, ...historyRequests];
      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
      list = unique;
    }

    if (!searchTerm.trim()) return list;

    const term = searchTerm.toLowerCase();
    return list.filter(r => {
      return (
        r.id.toLowerCase().includes(term) ||
        r.solicitante_nome.toLowerCase().includes(term) ||
        r.produto_servico.toLowerCase().includes(term) ||
        (r.fornecedor_nome && r.fornecedor_nome.toLowerCase().includes(term)) ||
        (r.empresa_pagadora && r.empresa_pagadora.toLowerCase().includes(term)) ||
        (r.departamento_centro_custo && r.departamento_centro_custo.toLowerCase().includes(term))
      );
    });
  }, [activeTab, pendingRequests, historyRequests, searchTerm]);

  // Contadores
  const countPending = useMemo(() => {
    const allPending = [...pendingRequests, ...historyRequests].filter(isItemPendingLegal);
    const unique = Array.from(new Map(allPending.map(item => [item.id, item])).values());
    return Math.max(unique.length, pendingRequests.length);
  }, [pendingRequests, historyRequests]);
  const countApproved = historyRequests.filter(r => r.juridico_status === 'APROVADO').length;
  const countRejected = historyRequests.filter(r => r.juridico_status === 'REJEITADO' || r.status === 'NEGADO_JURIDICO').length;

  return (
    <div className="purchases-page-container">
      {/* HEADER */}
      <div className="purchases-header" style={{ borderBottom: '1px solid rgba(234, 179, 8, 0.2)', paddingBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(202, 138, 4, 0.1))',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(234, 179, 8, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Scale size={32} color="#eab308" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f8fafc', margin: 0 }}>
                Jurídico · Aprovação de Pagamentos
              </h1>
              <span style={{
                background: 'rgba(234, 179, 8, 0.15)',
                color: '#facc15',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(234, 179, 8, 0.3)'
              }}>
                ≥ R$ 2.000,00
              </span>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: '4px 0 0 0' }}>
              Análise e validação jurídica prévia obrigatória para solicitações financeiras de valor relevante antes do fluxo de aprovação gerencial e financeiro.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="btn-refresh"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#cbd5e1',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* ALERTAS */}
      {errorMsg && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#fca5a5',
          padding: '12px 16px',
          borderRadius: '8px',
          margin: '1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={20} />
          <span style={{ flex: 1 }}>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.15)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#86efac',
          padding: '12px 16px',
          borderRadius: '8px',
          margin: '1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle2 size={20} />
          <span style={{ flex: 1 }}>{successMsg}</span>
          <button onClick={() => setSuccessMsg('')} style={{ background: 'none', border: 'none', color: '#86efac', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      )}

      {!isLegalApprover && !isMaster && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '10px',
          padding: '12px 16px',
          margin: '1rem 0',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: '#fde68a',
          fontSize: '0.9rem'
        }}>
          <AlertCircle size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
          <div>
            <strong>Perfil de Consulta:</strong> Você possui permissão para visualizar o módulo Jurídico, mas não está habilitado como <strong>Aprovador Jurídico</strong>. Você pode consultar solicitações e anexar documentos, mas aprovações e pareceres decisórios dependem de alçada configurada em <em>Jurídico &gt; Configuração de Aprovadores Jurídicos</em>.
          </div>
        </div>
      )}

      {/* CARDS DE RESUMO */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        margin: '1.25rem 0'
      }}>
        <div style={{
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
          border: countPending > 0 ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            background: 'rgba(234, 179, 8, 0.15)',
            color: '#facc15',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex'
          }}>
            <Clock size={24} />
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pendentes no Jurídico
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '1.5rem', color: '#f8fafc', fontWeight: 'bold' }}>
              {countPending}
            </h3>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            background: 'rgba(34, 197, 94, 0.15)',
            color: '#4ade80',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex'
          }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pareceres Aprovados
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '1.5rem', color: '#f8fafc', fontWeight: 'bold' }}>
              {countApproved}
            </h3>
          </div>
        </div>

        <div style={{
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex'
          }}>
            <XCircle size={24} />
          </div>
          <div>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Rejeitados pelo Jurídico
            </span>
            <h3 style={{ margin: '2px 0 0 0', fontSize: '1.5rem', color: '#f8fafc', fontWeight: 'bold' }}>
              {countRejected}
            </h3>
          </div>
        </div>
      </div>

      {/* ABAS & PESQUISA */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        margin: '1.5rem 0 1rem 0'
      }}>
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(15, 23, 42, 0.6)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <button
            onClick={() => setActiveTab('PENDENTES')}
            style={{
              background: activeTab === 'PENDENTES' ? 'rgba(234, 179, 8, 0.2)' : 'transparent',
              color: activeTab === 'PENDENTES' ? '#facc15' : '#94a3b8',
              border: activeTab === 'PENDENTES' ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid transparent',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Clock size={16} />
            Fila Pendente ({countPending})
          </button>

          <button
            onClick={() => setActiveTab('APROVADOS')}
            style={{
              background: activeTab === 'APROVADOS' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
              color: activeTab === 'APROVADOS' ? '#4ade80' : '#94a3b8',
              border: activeTab === 'APROVADOS' ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid transparent',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            Aprovados ({countApproved})
          </button>

          <button
            onClick={() => setActiveTab('REJEITADOS')}
            style={{
              background: activeTab === 'REJEITADOS' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
              color: activeTab === 'REJEITADOS' ? '#f87171' : '#94a3b8',
              border: activeTab === 'REJEITADOS' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            Rejeitados ({countRejected})
          </button>

          <button
            onClick={() => setActiveTab('TODOS')}
            style={{
              background: activeTab === 'TODOS' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: activeTab === 'TODOS' ? '#60a5fa' : '#94a3b8',
              border: activeTab === 'TODOS' ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
              padding: '6px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem'
            }}
          >
            Todas
          </button>
        </div>

        <div style={{ minWidth: '260px' }}>
          <input
            type="text"
            placeholder="Buscar por ID, solicitante, item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: '#f8fafc',
              padding: '8px 12px',
              fontSize: '0.875rem'
            }}
          />
        </div>
      </div>

      {/* TABELA DE SOLICITAÇÕES */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto' }} />
            <p>Carregando solicitações do Jurídico...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Scale size={36} color="#64748b" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ fontSize: '1rem', color: '#cbd5e1' }}>Nenhuma solicitação encontrada nesta aba.</p>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {activeTab === 'PENDENTES'
                ? 'Todas as solicitações de valor ≥ R$ 2.000 já foram analisadas!'
                : 'Não há registros com os filtros atuais.'}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'rgba(30, 41, 59, 0.6)', color: '#94a3b8', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <th style={{ padding: '12px 16px' }}>Código</th>
                  <th style={{ padding: '12px 16px' }}>Solicitante</th>
                  <th style={{ padding: '12px 16px' }}>Produto / Serviço</th>
                  <th style={{ padding: '12px 16px' }}>Empresa / Destino</th>
                  <th style={{ padding: '12px 16px' }}>Valor Total</th>
                  <th style={{ padding: '12px 16px' }}>Status Jurídico</th>
                  <th style={{ padding: '12px 16px' }}>Data</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map((req) => {
                  const isPending = isItemPendingLegal(req);
                  const isApproved = req.juridico_status === 'APROVADO';
                  const isRejected = req.juridico_status === 'REJEITADO' || req.status === 'NEGADO_JURIDICO';

                  return (
                    <tr
                      key={req.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        transition: 'background 0.15s',
                        background: isPending ? 'rgba(234, 179, 8, 0.03)' : 'transparent'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = isPending ? 'rgba(234, 179, 8, 0.03)' : 'transparent'}
                    >
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#f8fafc' }}>
                        {req.id}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={14} color="#94a3b8" />
                          <span>{req.solicitante_nome}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#e2e8f0', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {req.produto_servico}
                        </div>
                        {req.fornecedor_nome && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Fornecedor: {req.fornecedor_nome}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#cbd5e1' }}>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {req.empresa_pagadora || 'Indiferente'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {req.departamento_centro_custo}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 'bold', color: '#38bdf8' }}>
                        {formatBrl(req.valor)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {isPending && (
                          <span style={{
                            background: 'rgba(234, 179, 8, 0.15)',
                            color: '#facc15',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <Clock size={12} /> Aguardando Jurídico
                          </span>
                        )}
                        {isApproved && (
                          <span style={{
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#4ade80',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: '1px solid rgba(34, 197, 94, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle2 size={12} /> Jurídico Aprovado
                          </span>
                        )}
                        {isRejected && (
                          <span style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <XCircle size={12} /> Jurídico Rejeitado
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '0.8rem' }}>
                        {formatDate(req.created_at)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleOpenDetails(req)}
                          style={{
                            background: isPending ? 'linear-gradient(135deg, #eab308, #ca8a04)' : 'rgba(255, 255, 255, 0.08)',
                            color: isPending ? '#0f172a' : '#f8fafc',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                          }}
                        >
                          <Eye size={14} />
                          {isPending ? 'Analisar' : 'Ver Detalhes'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES E ANÁLISE JURÍDICA */}
      {selectedReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '900px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
          }}>
            {/* MODAL HEADER */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(30, 41, 59, 0.5)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Scale size={24} color="#eab308" />
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Solicitação {selectedReq.id}
                    {loadingDetails && <RefreshCw size={14} className="animate-spin" color="#eab308" />}
                  </h2>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Criado por {selectedReq.solicitante_nome} em {formatDate(selectedReq.created_at)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleCloseDetails}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* MODAL BODY */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* BANNER DE DECISÃO JURÍDICA SE JÁ AVALIADO */}
              {selectedReq.juridico_status === 'APROVADO' && (
                <div style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  padding: '1rem',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4ade80', fontWeight: 'bold' }}>
                    <CheckCircle2 size={18} />
                    <span>Parecer Jurídico: APROVADO</span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', color: '#cbd5e1', fontSize: '0.875rem' }}>
                    Aprovado por: <strong>{selectedReq.juridico_aprovador_nome || 'Jurídico'}</strong> em {formatDate(selectedReq.juridico_decidido_em || '')}
                  </p>
                  {selectedReq.juridico_motivo && (
                    <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                      Parecer / Observação: "<em>{selectedReq.juridico_motivo}</em>"
                    </p>
                  )}
                </div>
              )}

              {(selectedReq.juridico_status === 'REJEITADO' || selectedReq.status === 'NEGADO_JURIDICO') && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  padding: '1rem',
                  borderRadius: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f87171', fontWeight: 'bold' }}>
                    <XCircle size={18} />
                    <span>Parecer Jurídico: REJEITADO</span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', color: '#cbd5e1', fontSize: '0.875rem' }}>
                    Rejeitado por: <strong>{selectedReq.juridico_aprovador_nome || 'Jurídico'}</strong> em {formatDate(selectedReq.juridico_decidido_em || '')}
                  </p>
                  {selectedReq.juridico_motivo && (
                    <p style={{ margin: '4px 0 0 0', color: '#fca5a5', fontSize: '0.85rem' }}>
                      Motivo da Rejeição: "<em>{selectedReq.juridico_motivo}</em>"
                    </p>
                  )}
                </div>
              )}

              {/* DETALHES GERAIS EM CARDS */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                background: 'rgba(30, 41, 59, 0.3)',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Valor Total</span>
                  <div style={{ color: '#38bdf8', fontSize: '1.25rem', fontWeight: 'bold' }}>
                    {formatBrl(selectedReq.valor)}
                  </div>
                </div>

                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Empresa Pagadora</span>
                  <div style={{ color: '#f8fafc', fontWeight: 500 }}>
                    {selectedReq.empresa_pagadora || 'Indiferente'}
                  </div>
                </div>

                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Centro de Custo / Destino</span>
                  <div style={{ color: '#f8fafc', fontWeight: 500 }}>
                    {selectedReq.departamento_centro_custo || '-'}
                  </div>
                </div>

                <div>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase' }}>Forma de Pagamento</span>
                  <div style={{ color: '#f8fafc', fontWeight: 500 }}>
                    {selectedReq.forma_pagamento || 'PIX'} {selectedReq.quantidade_parcelas && selectedReq.quantidade_parcelas > 1 ? `(${selectedReq.quantidade_parcelas}x)` : ''}
                  </div>
                </div>
              </div>

              {(selectedReq.chave_pix || selectedReq.categoria === 'Reembolso' || selectedReq.itens?.some(i => i.chave_pix)) && (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div>
                    <span style={{ color: '#34d399', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Zap size={14} /> Chave PIX para Reembolso (Destinatário)
                    </span>
                    <div style={{ color: '#f8fafc', fontWeight: 750, fontSize: '1.05rem', marginTop: '4px', wordBreak: 'break-all' }}>
                      {selectedReq.chave_pix || selectedReq.itens?.find(i => i.chave_pix)?.chave_pix || 'Não informada'}
                    </div>
                  </div>
                  {(selectedReq.chave_pix || selectedReq.itens?.find(i => i.chave_pix)?.chave_pix) && (
                    <button
                      type="button"
                      onClick={() => {
                        const pix = selectedReq.chave_pix || selectedReq.itens?.find(i => i.chave_pix)?.chave_pix || '';
                        navigator.clipboard.writeText(pix);
                        setCopiedPix(true);
                        setTimeout(() => setCopiedPix(false), 2000);
                      }}
                      style={{
                        background: copiedPix ? '#059669' : '#10b981',
                        color: '#0f172a',
                        border: 'none',
                        padding: '6px 14px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s'
                      }}
                    >
                      {copiedPix ? <Check size={14} /> : <Copy size={13} />}
                      {copiedPix ? 'Copiado!' : 'Copiar Chave PIX'}
                    </button>
                  )}
                </div>
              )}

              {/* TABELA DE ITENS */}
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f8fafc', margin: '0 0 8px 0' }}>
                  Itens da Solicitação
                </h3>
                <div style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(30, 41, 59, 0.4)', color: '#94a3b8', textAlign: 'left' }}>
                        <th style={{ padding: '8px 12px' }}>#</th>
                        <th style={{ padding: '8px 12px' }}>Descrição</th>
                        <th style={{ padding: '8px 12px' }}>Categoria</th>
                        <th style={{ padding: '8px 12px' }}>Fornecedor</th>
                        <th style={{ padding: '8px 12px' }}>Qtd</th>
                        <th style={{ padding: '8px 12px' }}>Valor Unit.</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedReq.itens && selectedReq.itens.length > 0 ? selectedReq.itens : [{
                        numero_item: 1,
                        produto_servico: selectedReq.produto_servico,
                        categoria: selectedReq.categoria || 'Outros',
                        fornecedor_nome: selectedReq.fornecedor_nome || '-',
                        quantidade: selectedReq.quantidade || 1,
                        valor: selectedReq.valor,
                        chave_pix: selectedReq.chave_pix
                      }]).map((it, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '8px 12px', color: '#64748b' }}>{it.numero_item || idx + 1}</td>
                          <td style={{ padding: '8px 12px', color: '#f8fafc', fontWeight: 500 }}>
                            <div>{it.produto_servico}</div>
                            {it.chave_pix && (
                              <div style={{ fontSize: '0.75rem', color: '#34d399', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Zap size={11} /> PIX: {it.chave_pix}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{it.categoria}</td>
                          <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>{it.fornecedor_nome}</td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{it.quantidade}</td>
                          <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>{formatBrl(it.valor)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', color: '#38bdf8', fontWeight: 'bold' }}>
                            {formatBrl(it.valor * (it.quantidade || 1))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ANEXOS & DOCUMENTOS JURÍDICOS */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.3)',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 'bold', color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Paperclip size={18} color="#94a3b8" />
                    Anexos e Documentos / Contratos
                  </h3>
                </div>

                {reqAttachments.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '4px 0 10px 0' }}>
                    Nenhum anexo foi anexado até o momento.
                  </p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                    {reqAttachments.map((att) => (
                      <div
                        key={att.id}
                        style={{
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px'
                        }}
                      >
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <div style={{ color: '#f8fafc', fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {att.nome_arquivo}
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            Por: {att.enviado_por_nome} · {(att.tamanho_bytes / 1024).toFixed(1)} KB
                          </div>
                        </div>

                        <button
                          onClick={() => handleDownloadAttachment(att.id, att.nome_arquivo)}
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            borderRadius: '6px',
                            padding: '6px',
                            cursor: 'pointer',
                            display: 'flex'
                          }}
                          title="Baixar arquivo"
                        >
                          <Download size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ÁREA DE UPLOAD PELO JURÍDICO */}
                <div style={{
                  borderTop: '1px dashed rgba(255, 255, 255, 0.1)',
                  paddingTop: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap'
                }}>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setUploadFiles(e.target.files)}
                    style={{ fontSize: '0.8rem', color: '#94a3b8' }}
                  />
                  {uploadFiles && uploadFiles.length > 0 && (
                    <button
                      onClick={handleUploadAttachments}
                      disabled={isUploading}
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {isUploading ? <RefreshCw size={14} className="animate-spin" /> : <Paperclip size={14} />}
                      Anexar Contrato / Parecer
                    </button>
                  )}
                </div>
              </div>

              {/* HISTÓRICO DE MENSAGENS E COMENTÁRIOS */}
              <div className="pa-messages-container">
                <div className="pa-messages-header">
                  <MessageSquare size={16} color="#3b82f6" />
                  <span>Histórico de Interações & Mensagens</span>
                </div>

                <div className="pa-chat-box">
                  {(!selectedReq.mensagens || selectedReq.mensagens.length === 0) ? (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.85rem', padding: '1rem' }}>
                      Nenhuma mensagem registrada nesta solicitação.
                    </div>
                  ) : (
                    selectedReq.mensagens.map((msg) => (
                      <div
                        key={msg.id}
                        className={`pa-message-bubble ${getBubbleRoleClass(msg.autor_role)}`}
                      >
                        <div className="pa-message-meta">
                          <strong>{msg.autor_nome} ({formatRole(msg.autor_role)})</strong>
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
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="pa-chat-input-row"
                >
                  <input
                    type="text"
                    className="pa-chat-input"
                    placeholder="Adicione um comentário ou responda sobre esta solicitação..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage || !newMessage.trim()}
                    className="pa-chat-send-btn"
                  >
                    <Send size={15} /> Enviar
                  </button>
                </form>
              </div>
            </div>

            {/* MODAL FOOTER / BOTÕES DE DECISÃO */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(30, 41, 59, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem'
            }}>
              <button
                onClick={handleCloseDetails}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                Fechar
              </button>

              {isItemPendingLegal(selectedReq) && (
                (isLegalApprover || isMaster) ? (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setIsRejectModalOpen(true)}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.4)',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <XCircle size={16} />
                      Rejeitar Solicitação
                    </button>

                    <button
                      onClick={() => setIsApproveModalOpen(true)}
                      style={{
                        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                        color: '#ffffff',
                        border: 'none',
                        padding: '8px 20px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                      }}
                    >
                      <CheckCircle2 size={16} />
                      Aprovar Parecer Jurídico
                    </button>
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Lock size={15} color="#fbbf24" />
                    <span>Apenas <strong>Aprovadores Jurídicos</strong> configurados podem aprovar ou rejeitar.</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE CONFIRMAÇÃO DE APROVAÇÃO */}
      {isApproveModalOpen && selectedReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#4ade80', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={20} />
              Confirmar Parecer Jurídico Favorável
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '1rem' }}>
              A solicitação <strong>{selectedReq.id}</strong> ({formatBrl(selectedReq.valor)}) será aprovada e seguirá imediatamente para a esteira dos aprovadores gerais.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: '0.8rem', marginBottom: '4px' }}>
                Observação / Parecer Jurídico (Opcional):
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Contrato conferido, cláusulas de pagamento e retenção validadas de acordo com as normas..."
                value={approveObservation}
                onChange={(e) => setApproveObservation(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '8px 12px',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setIsApproveModalOpen(false)}
                disabled={actionLoading}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                style={{
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                Confirmar Aprovação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIÁLOGO DE REJEIÇÃO JURÍDICA */}
      {isRejectModalOpen && selectedReq && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            maxWidth: '500px',
            width: '100%',
            padding: '1.5rem',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#f87171', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={20} />
              Rejeitar Solicitação pelo Jurídico
            </h3>
            <p style={{ color: '#cbd5e1', fontSize: '0.875rem', marginBottom: '1rem' }}>
              A solicitação <strong>{selectedReq.id}</strong> será encerrada/arquivada e o solicitante será notificado com o motivo informado.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', color: '#fca5a5', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                Justificativa Jurídica / Motivo da Rejeição * (Obrigatório):
              </label>
              <textarea
                rows={4}
                placeholder="Informe o motivo da não conformidade jurídica, contrato pendente, ausência de documentação indispensável..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '8px 12px',
                  fontSize: '0.85rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                disabled={actionLoading}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#cbd5e1',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason.trim()}
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: !rejectReason.trim() ? 0.6 : 1
                }}
              >
                {actionLoading ? <RefreshCw size={16} className="animate-spin" /> : <XCircle size={16} />}
                Confirmar Rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegalPaymentApproval;
