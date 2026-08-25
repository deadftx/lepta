import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Clock, Send, X, RefreshCw,
  Eye, CreditCard, ArrowDownLeft, CheckSquare, RotateCcw, Paperclip, Trash2, Download, CheckCircle2, User, FileSpreadsheet, CalendarCheck,
  PauseCircle, PlayCircle, Save, AlertTriangle
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import { useAuth } from '../../core/AuthContext';
import '../administrative/purchases/PurchaseApproval.css';

export interface PurchaseItem {
  id?: string;
  requisicao_id?: string;
  numero_item?: number;
  tipo_destino?: string;
  empresa_pagadora?: string;
  departamento_centro_custo?: string;
  categoria?: string;
  fornecedor_nome?: string;
  fornecedor_contato?: string;
  forma_pagamento?: string;
  quantidade_parcelas?: number;
  produto_servico: string;
  valor: number;
  quantidade: number;
  observacoes?: string;
  created_at?: string;
}

export interface PurchaseParcela {
  id?: string;
  requisicao_id?: string;
  numero_parcela: number;
  total_parcelas?: number;
  valor?: number;
  data_pagamento?: string | null;
  status?: string;
  pausado?: number;
  pausado_em?: string | null;
  motivo_pausa?: string | null;
}

export interface PurchaseMessage {
  id: string;
  requisicao_id: string;
  autor_id: string;
  autor_nome: string;
  autor_role: 'REQUISITANTE' | 'APROVADOR' | 'FINANCEIRO';
  mensagem: string;
  tipo?: 'COMENTARIO' | 'SOLICITACAO_REVISAO' | 'REABERTURA' | 'ANEXO';
  created_at: string;
}

export interface PurchaseRequest {
  id: string;
  numero: number;
  tipo_destino?: string;
  empresa_pagadora?: string;
  categoria?: string;
  fornecedor_nome: string;
  fornecedor_contato: string;
  forma_pagamento: string;
  quantidade_parcelas: number;
  departamento_centro_custo: string;
  produto_servico: string;
  valor: number;
  quantidade: number;
  observacoes: string;
  status: 'PENDENTE' | 'REABERTO' | 'AGUARDANDO_RESPOSTA_SOLICITANTE' | 'AGUARDANDO_RESPOSTA_APROVADOR' | 'APROVADO' | 'PAGAMENTO_PAUSADO' | 'NEGADO' | 'SOLICITACAO_CONCLUIDA' | 'PAGO' | 'REVISAO';
  arquivado?: number;
  data_pagamento?: string | null;
  datas_parcelas?: string | null;
  pausado_em?: string | null;
  pausado_por_id?: string | null;
  pausado_por_nome?: string | null;
  motivo_pausa?: string | null;
  status_anterior?: string | null;
  parcelas?: PurchaseParcela[];
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  aprovador_id: string | null;
  aprovador_nome: string | null;
  motivo_decisao: string | null;
  decidido_em: string | null;
  created_at: string;
  updated_at: string;
  total_anexos?: number;
  total_mensagens?: number;
  itens?: PurchaseItem[];
  mensagens?: PurchaseMessage[];
}

interface Attachment {
  id: string;
  nome_arquivo: string;
  tamanho_bytes: number;
  enviado_por_id: string;
  enviado_por_nome: string;
  created_at: string;
}

export const FinanceRefundsExpenses: React.FC = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  // Tabs: 'fila' (Aprovadas/Pausadas aguardando pagamento) | 'concluidos' (Pagas)
  const [activeTab, setActiveTab] = useState<'fila' | 'concluidos'>('fila');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormaPagamento, setFilterFormaPagamento] = useState<string>('TODAS');

  // Requests
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Detalhes
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [messages, setMessages] = useState<PurchaseMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Agendamento / Reagendamento de Pagamento (À Vista ou Global)
  const [scheduleInputDate, setScheduleInputDate] = useState<string>('');
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Parcelas individuais (datas e valores)
  const [parcelasInput, setParcelasInput] = useState<{ [numero: number]: string }>({});
  const [parcelasValoresInput, setParcelasValoresInput] = useState<{ [numero: number]: number }>({});
  const [isDivergenceModalOpen, setIsDivergenceModalOpen] = useState(false);

  // Pausa de Pagamento
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseLoading, setPauseLoading] = useState(false);

  // Ações do Financeiro
  const [actionLoading, setActionLoading] = useState(false);
  const [actionType, setActionType] = useState<'CONCLUIR' | 'REVISAO' | null>(null);
  const [actionMotivo, setActionMotivo] = useState('');

  // Exclusão Permanente Master (com validação de senha do usuário)
  const [deleteModalRequest, setDeleteModalRequest] = useState<PurchaseRequest | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/financeiro-fila`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data: PurchaseRequest[] = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Erro ao buscar fila do financeiro:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const fetchAttachments = async (requisicaoId: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${requisicaoId}/anexos`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setAttachments(data);
      }
    } catch (err) {
      console.error('Erro ao carregar anexos:', err);
    }
  };

  const [searchParams] = useSearchParams();

  const handleOpenDetails = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${id}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(data);
        setScheduleInputDate(data.data_pagamento ? data.data_pagamento.substring(0, 10) : '');
        
        // Inicializa inputs de parcelas (datas e valores)
        const totalParc = Math.max(1, data.quantidade_parcelas || 1);
        const valorTotalReq = (data.valor || 0) * (data.quantidade || 1);
        const valorPadrao = Number((valorTotalReq / totalParc).toFixed(2));

        const initialParcelas: { [num: number]: string } = {};
        const initialValores: { [num: number]: number } = {};

        if (Array.isArray(data.parcelas) && data.parcelas.length > 0) {
          data.parcelas.forEach((p: any) => {
            initialParcelas[p.numero_parcela] = p.data_pagamento ? p.data_pagamento.substring(0, 10) : '';
            initialValores[p.numero_parcela] = p.valor != null ? Number(p.valor) : valorPadrao;
          });
        } else if (data.datas_parcelas) {
          try {
            const parsed = JSON.parse(data.datas_parcelas);
            if (Array.isArray(parsed)) {
              parsed.forEach((p: any) => {
                initialParcelas[p.numero_parcela] = p.data_pagamento ? p.data_pagamento.substring(0, 10) : '';
                initialValores[p.numero_parcela] = p.valor != null ? Number(p.valor) : valorPadrao;
              });
            }
          } catch (_) {}
        }

        // Garante que todas as parcelas de 1 até totalParc possuam valor e data inicializados
        for (let i = 1; i <= totalParc; i++) {
          if (initialValores[i] === undefined) initialValores[i] = valorPadrao;
          if (initialParcelas[i] === undefined) initialParcelas[i] = '';
        }

        setParcelasInput(initialParcelas);
        setParcelasValoresInput(initialValores);

        setMessages(data.mensagens || []);
        setActionType(null);
        setActionMotivo('');
        setAttachmentError('');
        setIsPauseModalOpen(false);
        setIsDivergenceModalOpen(false);
        setPauseReason('');
        fetchAttachments(id);
      }
    } catch (err) {
      console.error('Erro ao abrir detalhes:', err);
    }
  };

  // Abre automaticamente a solicitação se houver ?id= ou ?solicitacao= na URL (vindo de e-mail / notificação)
  useEffect(() => {
    const targetId = searchParams.get('id') || searchParams.get('solicitacao');
    if (targetId) {
      handleOpenDetails(targetId);
    }
  }, [searchParams]);

  const handleSaveScheduleDate = async (newDate: string | null) => {
    if (!selectedRequest) return;
    setScheduleLoading(true);
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
        setScheduleInputDate(newDate || '');

        // Recarrega mensagens para exibir a entrada no histórico de mensagens
        const resDetails = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}`, {
          headers: getAuthHeaders()
        });
        if (resDetails.ok) {
          const detailData = await resDetails.json();
          setMessages(detailData.mensagens || []);
        }

        const isReschedule = Boolean(selectedRequest.data_pagamento && newDate && selectedRequest.data_pagamento.substring(0, 10) !== newDate);
        showToast(
          !newDate 
            ? 'Agendamento cancelado com sucesso!' 
            : isReschedule 
              ? 'Pagamento reagendado com sucesso!' 
              : 'Pagamento agendado com sucesso!'
        );
        fetchData(true);
      }
    } catch (err) {
      console.error('Erro ao agendar data de pagamento:', err);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Cálculos de totais e validação das parcelas
  const totalParcelasCount = Math.max(1, selectedRequest?.quantidade_parcelas || 1);
  const valorTotalSolicitacao = Number(((selectedRequest?.valor || 0) * (selectedRequest?.quantidade || 1)).toFixed(2));
  
  const somaParcelasAtual = useMemo(() => {
    let sum = 0;
    for (let i = 1; i <= totalParcelasCount; i++) {
      sum += Number(parcelasValoresInput[i] || 0);
    }
    return Number(sum.toFixed(2));
  }, [parcelasValoresInput, totalParcelasCount]);

  const diferencaParcelas = Number((somaParcelasAtual - valorTotalSolicitacao).toFixed(2));
  const valoresParcelasBatem = Math.abs(diferencaParcelas) < 0.01;

  // Alteração de valor individual de parcela
  const handleParcelaValorChange = (numero: number, rawValue: string) => {
    const sanitized = rawValue.replace(/[^\d.,]/g, '').replace(',', '.');
    const parsed = parseFloat(sanitized);
    setParcelasValoresInput(prev => ({
      ...prev,
      [numero]: isNaN(parsed) ? 0 : parsed
    }));
  };

  // Divide o valor total igualmente entre todas as parcelas
  const handleResetEqualInstallments = () => {
    if (!selectedRequest) return;
    const total = Math.max(1, selectedRequest.quantidade_parcelas || 1);
    const valorTotal = (selectedRequest.valor || 0) * (selectedRequest.quantidade || 1);
    const valorPadrao = Number((valorTotal / total).toFixed(2));
    const newMap: { [num: number]: number } = {};
    for (let i = 1; i <= total; i++) {
      newMap[i] = valorPadrao;
    }
    setParcelasValoresInput(newMap);
    showToast('Valores distribuídos igualmente!');
  };

  // Ao clicar em Salvar: se valores divergirem, abre modal custom; se baterem, salva direto
  const handleSaveParcelasClick = () => {
    if (!selectedRequest) return;
    if (!valoresParcelasBatem) {
      setIsDivergenceModalOpen(true);
    } else {
      executeSaveParcelasDates();
    }
  };

  // Salvar cronograma de parcelas individuais (datas e valores)
  const executeSaveParcelasDates = async () => {
    if (!selectedRequest) return;
    setScheduleLoading(true);
    setIsDivergenceModalOpen(false);

    try {
      const total = Math.max(1, selectedRequest.quantidade_parcelas || 1);
      const valorTotal = (selectedRequest.valor || 0) * (selectedRequest.quantidade || 1);
      const valorParcelaPadrao = Number((valorTotal / total).toFixed(2));

      const payloadParcelas = [];
      for (let i = 1; i <= total; i++) {
        payloadParcelas.push({
          numero_parcela: i,
          total_parcelas: total,
          valor: parcelasValoresInput[i] != null ? Number(parcelasValoresInput[i]) : valorParcelaPadrao,
          data_pagamento: parcelasInput[i] || null
        });
      }

      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/parcelas-datas`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ parcelas: payloadParcelas })
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(prev => prev ? { ...prev, ...data.requisicao, parcelas: data.parcelas } : null);
        
        // Recarrega mensagens
        const resDetails = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}`, {
          headers: getAuthHeaders()
        });
        if (resDetails.ok) {
          const detailData = await resDetails.json();
          setMessages(detailData.mensagens || []);
        }

        showToast('Cronograma de parcelas e valores salvo com sucesso!');
        fetchData(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao salvar parcelas.');
      }
    } catch (err) {
      console.error('Erro ao salvar parcelas:', err);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Helper para autopreencher datas mensais a partir da primeira
  const handleAutoFillMonthlyDates = () => {
    if (!selectedRequest) return;
    const total = Math.max(1, selectedRequest.quantidade_parcelas || 1);
    const baseStr = parcelasInput[1] || selectedRequest.data_pagamento?.substring(0, 10) || new Date().toISOString().substring(0, 10);
    const [bYear, bMonth, bDay] = baseStr.split('-').map(Number);

    const newMap: { [num: number]: string } = {};
    for (let i = 1; i <= total; i++) {
      const d = new Date(bYear, (bMonth - 1) + (i - 1), bDay);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      newMap[i] = `${y}-${m}-${day}`;
    }
    setParcelasInput(newMap);
    showToast('Datas mensais sugeridas! Clique em "Salvar Datas das Parcelas" para confirmar.');
  };

  // Pausar Pagamento com Motivo Obrigatório
  const handlePausePayment = async () => {
    if (!selectedRequest || !pauseReason.trim()) {
      alert('Por favor, informe o motivo para pausar o pagamento.');
      return;
    }
    setPauseLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/pausar-pagamento`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo: pauseReason.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(prev => prev ? { ...prev, ...data.requisicao } : null);
        setIsPauseModalOpen(false);
        setPauseReason('');

        // Recarrega mensagens
        const resDetails = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}`, {
          headers: getAuthHeaders()
        });
        if (resDetails.ok) {
          const detailData = await resDetails.json();
          setMessages(detailData.mensagens || []);
        }

        showToast('Pagamento PAUSADO com sucesso.');
        fetchData(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao pausar pagamento.');
      }
    } catch (err) {
      console.error('Erro ao pausar pagamento:', err);
    } finally {
      setPauseLoading(false);
    }
  };

  // Retomar Pagamento
  const handleResumePayment = async () => {
    if (!selectedRequest) return;
    if (!window.confirm('Deseja retomar o pagamento desta solicitação? As datas e parcelas voltarão ao fluxo normal.')) return;
    setPauseLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/retomar-pagamento`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo: 'Retomado pelo usuário' })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRequest(prev => prev ? { ...prev, ...data.requisicao } : null);

        // Recarrega mensagens
        const resDetails = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}`, {
          headers: getAuthHeaders()
        });
        if (resDetails.ok) {
          const detailData = await resDetails.json();
          setMessages(detailData.mensagens || []);
        }

        showToast('Pagamento RETOMADO com sucesso!');
        fetchData(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao retomar pagamento.');
      }
    } catch (err) {
      console.error('Erro ao retomar pagamento:', err);
    } finally {
      setPauseLoading(false);
    }
  };

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
        body: JSON.stringify({
          mensagem: newMessageText.trim(),
          tipo: 'COMENTARIO'
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.mensagem]);
        setNewMessageText('');
      }
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRequest || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      setAttachmentError('O arquivo excede o limite de 20MB.');
      return;
    }
    setAttachmentError('');
    setUploadingAttachment(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/anexos`, {
        method: 'POST',
        headers: getAuthHeaders() as any,
        body: formData
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao enviar anexo.');
      }

      showToast('Documento anexado com sucesso!');
      await fetchAttachments(selectedRequest.id);
    } catch (err: any) {
      setAttachmentError(err.message || 'Erro ao enviar o anexo.');
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadAttachment = (anexoId: string, nomeArquivo: string) => {
    if (!selectedRequest) return;
    const url = `${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/anexos/${anexoId}`;
    
    fetch(url, { headers: getAuthHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Não foi possível baixar o anexo.');
        return res.blob();
      })
      .then(blob => {
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.setAttribute('download', nomeArquivo);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
      })
      .catch(err => {
        alert(err.message || 'Erro no download');
      });
  };

  const handleDeleteAttachment = async (anexoId: string) => {
    if (!selectedRequest) return;
    if (!window.confirm('Tem certeza que deseja excluir este anexo?')) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/anexos/${anexoId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (res.ok) {
        showToast('Anexo removido.');
        await fetchAttachments(selectedRequest.id);
      }
    } catch (err) {
      console.error('Erro ao excluir anexo:', err);
    }
  };

  const handleExecuteAction = async () => {
    if (!selectedRequest || !actionType) return;

    if (actionType === 'REVISAO' && !actionMotivo.trim()) {
      alert('É obrigatório informar o motivo da necessidade de reaprovação.');
      return;
    }

    setActionLoading(true);
    try {
      let endpoint = '';
      let body: any = {};

      if (actionType === 'CONCLUIR') {
        endpoint = `${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/concluir`;
        body = { observacoes: actionMotivo.trim() };
      } else if (actionType === 'REVISAO') {
        endpoint = `${API_BASE_URL}/api/compras/requisicoes/${selectedRequest.id}/devolver-revisao`;
        body = { motivo: actionMotivo.trim() };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        showToast(
          actionType === 'CONCLUIR' 
            ? 'Solicitação concluída com sucesso!' 
            : 'Solicitação devolvida para reaprovação administrativa!'
        );
        setSelectedRequest(null);
        await fetchData();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Erro ao processar ação.');
      }
    } catch (err) {
      console.error('Erro na ação do financeiro:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Exclusão Permanente Master (com validação de senha do usuário)
  const handleConfirmDeleteMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteModalRequest || !deletePassword.trim()) return;

    setDeleteLoading(true);
    setDeleteError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${deleteModalRequest.id}/excluir-master`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: deletePassword })
      });

      const data = await res.json();
      if (res.ok) {
        showToast('Solicitação excluída permanentemente com sucesso!');
        setDeleteModalRequest(null);
        setDeletePassword('');
        if (selectedRequest?.id === deleteModalRequest.id) {
          setSelectedRequest(null);
        }
        await fetchData(true);
      } else {
        setDeleteError(data.error || 'Senha incorreta ou erro ao excluir solicitação.');
      }
    } catch (err) {
      console.error('Erro ao excluir solicitação:', err);
      setDeleteError('Erro de conexão ao processar exclusão.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const formatBrl = (val: number) => {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  // KPIs
  const totalApprovedWaitingPayment = useMemo(() => {
    return requests
      .filter(r => r.status === 'APROVADO' || r.status === 'PAGAMENTO_PAUSADO')
      .reduce((sum, r) => sum + (r.valor * r.quantidade), 0);
  }, [requests]);

  const totalCompletedValue = useMemo(() => {
    return requests
      .filter(r => r.status === 'SOLICITACAO_CONCLUIDA' || r.status === 'PAGO')
      .reduce((sum, r) => sum + (r.valor * r.quantidade), 0);
  }, [requests]);

  const countWaitingPayment = useMemo(() => {
    return requests.filter(r => r.status === 'APROVADO').length;
  }, [requests]);

  const countPaused = useMemo(() => {
    return requests.filter(r => r.status === 'PAGAMENTO_PAUSADO').length;
  }, [requests]);

  const countCompleted = useMemo(() => {
    return requests.filter(r => r.status === 'SOLICITACAO_CONCLUIDA' || r.status === 'PAGO').length;
  }, [requests]);

  // Filtros
  const filteredQueue = useMemo(() => {
    return requests.filter(r => {
      if (activeTab === 'fila') {
        if (r.status !== 'APROVADO' && r.status !== 'PAGAMENTO_PAUSADO') return false;
      } else {
        if (r.status !== 'SOLICITACAO_CONCLUIDA' && r.status !== 'PAGO') return false;
      }

      if (filterFormaPagamento !== 'TODAS' && r.forma_pagamento !== filterFormaPagamento) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = (r.id || '').toLowerCase().includes(q);
        const matchSolicitante = (r.solicitante_nome || '').toLowerCase().includes(q);
        const matchFornecedor = (r.fornecedor_nome || '').toLowerCase().includes(q);
        const matchCentro = (r.departamento_centro_custo || '').toLowerCase().includes(q);
        const matchProduto = (r.produto_servico || '').toLowerCase().includes(q);
        if (!matchId && !matchSolicitante && !matchFornecedor && !matchCentro && !matchProduto) {
          return false;
        }
      }

      return true;
    });
  }, [requests, activeTab, filterFormaPagamento, searchQuery]);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'APROVADO':
        return <span className="pa-status-badge approved"><CheckCircle2 size={12} /> Aprovado (Pendente Pagamento)</span>;
      case 'PAGAMENTO_PAUSADO':
        return <span className="pa-status-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' }}><PauseCircle size={12} /> Pagamento Pausado</span>;
      case 'SOLICITACAO_CONCLUIDA':
      case 'PAGO':
        return <span className="pa-status-badge approved" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)' }}><CheckCircle2 size={12} /> Solicitação Concluída</span>;
      case 'REVISAO':
        return <span className="pa-status-badge waiting-approver" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}><RotateCcw size={12} /> Reaprovação Necessária</span>;
      default:
        return <span className="pa-status-badge pending">{status}</span>;
    }
  };

  if (loading && requests.length === 0) {
    return (
      <div className="pa-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: '#38bdf8' }} />
      </div>
    );
  }

  return (
    <div className="pa-container">
      {toastMessage && (
        <div className="pa-toast">
          <CheckCircle2 size={18} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="pa-header">
        <div className="pa-header-left">
          <div className="pa-icon-badge" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', boxShadow: '0 6px 20px rgba(2, 132, 199, 0.35)' }}>
            <CreditCard size={28} />
          </div>
          <div>
            <div className="pa-kicker" style={{ color: '#38bdf8' }}>
              <CreditCard size={14} /> Módulo Financeiro
            </div>
            <h1>Reembolsos e Despesas</h1>
            <p className="pa-subtitle">Fila de pagamentos aprovados, liquidação de despesas e conciliação em tempo real</p>
          </div>
        </div>

        <div className="pa-header-badges">
          <div className="pa-badge-live">
            <span className="pa-live-dot"></span> Sincronizado
          </div>
          <button
            type="button"
            className="pa-btn-reopen"
            onClick={() => fetchData(false)}
            title="Atualizar agora"
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </header>

      {/* CARDS DE KPIS */}
      <div className="pa-kpi-grid">
        <div className="pa-kpi-card" style={{ borderColor: 'rgba(56, 189, 248, 0.3)' }}>
          <div className="pa-kpi-header">
            <span className="pa-kpi-title">Aguardando Pagamento</span>
            <div className="pa-kpi-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
              <ArrowDownLeft size={20} />
            </div>
          </div>
          <div className="pa-kpi-value" style={{ color: '#38bdf8' }}>
            {countWaitingPayment}
          </div>
          <div className="pa-kpi-footer">
            <span>Total a pagar: <strong>{formatBrl(totalApprovedWaitingPayment)}</strong></span>
          </div>
        </div>

        <div className="pa-kpi-card" style={{ borderColor: 'rgba(52, 211, 153, 0.3)' }}>
          <div className="pa-kpi-header">
            <span className="pa-kpi-title">Solicitações Concluídas</span>
            <div className="pa-kpi-icon" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="pa-kpi-value" style={{ color: '#34d399' }}>
            {countCompleted}
          </div>
          <div className="pa-kpi-footer">
            <span>Total liquidado: <strong>{formatBrl(totalCompletedValue)}</strong></span>
          </div>
        </div>

        {countPaused > 0 && (
          <div className="pa-kpi-card" style={{ borderColor: 'rgba(245, 158, 11, 0.4)', background: 'rgba(245, 158, 11, 0.05)' }}>
            <div className="pa-kpi-header">
              <span className="pa-kpi-title" style={{ color: '#fbbf24' }}>Pagamentos Pausados</span>
              <div className="pa-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
                <PauseCircle size={20} />
              </div>
            </div>
            <div className="pa-kpi-value" style={{ color: '#fbbf24' }}>
              {countPaused}
            </div>
            <div className="pa-kpi-footer">
              <span>Requer acompanhamento</span>
            </div>
          </div>
        )}

        <div className="pa-kpi-card">
          <div className="pa-kpi-header">
            <span className="pa-kpi-title">Total de Solicitações</span>
            <div className="pa-kpi-icon">
              <FileSpreadsheet size={20} />
            </div>
          </div>
          <div className="pa-kpi-value">
            {requests.length}
          </div>
          <div className="pa-kpi-footer">
            <span>Volume total no módulo</span>
          </div>
        </div>
      </div>

      {/* ABAS */}
      <div className="pa-tabs-container">
        <button
          className={`pa-tab ${activeTab === 'fila' ? 'active' : ''}`}
          onClick={() => setActiveTab('fila')}
        >
          <Clock size={16} />
          Fila para Pagamento ({countWaitingPayment})
        </button>
        <button
          className={`pa-tab ${activeTab === 'concluidos' ? 'active' : ''}`}
          onClick={() => setActiveTab('concluidos')}
        >
          <CheckCircle2 size={16} />
          Solicitações Concluídas ({countCompleted})
        </button>
      </div>

      {/* TABELA DE REQUISIÇÕES */}
      <div className="pa-table-card">
        <div className="pa-table-header">
          <h2>
            {activeTab === 'fila' ? 'Despesas & Reembolsos Aprovados' : 'Histórico de Solicitações Concluídas'}
          </h2>

          <div className="pa-table-controls">
            <input
              type="text"
              className="pa-search-input"
              placeholder="Buscar fornecedor, solicitante, código..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />

            <select
              className="pa-select"
              style={{ width: 'auto', padding: '8px 14px' }}
              value={filterFormaPagamento}
              onChange={e => setFilterFormaPagamento(e.target.value)}
            >
              <option value="TODAS">Forma de Pagamento: Todas</option>
              <option value="PIX">PIX</option>
              <option value="BOLETO">Boleto</option>
              <option value="CREDITO">Crédito</option>
            </select>
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
                <th>Empresa</th>
                <th>Centro de Custo</th>
                <th>Solicitante</th>
                <th>Valor Total</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                    Nenhuma solicitação encontrada para o filtro atual.
                  </td>
                </tr>
              ) : (
                filteredQueue.map(item => (
                  <tr key={item.id}>
                    <td data-label="Código">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="pa-code-badge">{item.id}</span>
                        {(item.total_anexos || 0) > 0 && (
                          <span className="pa-attachment-count-badge" title={`${item.total_anexos} anexo(s) anexado(s)`}>
                            <Paperclip size={11} /> {item.total_anexos}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Fornecedor">
                      <strong>{item.fornecedor_nome || '-'}</strong>
                      {item.fornecedor_contato && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.fornecedor_contato}</div>
                      )}
                    </td>
                    <td data-label="Descrição">
                      <div><strong>{item.produto_servico}</strong></div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Qtd: {item.quantidade} • Criado em {formatDate(item.created_at)}
                        {item.data_pagamento && (
                          <span style={{ color: '#fbbf24', marginLeft: '6px', fontWeight: 600 }}>
                            • 📅 Pgto: {item.data_pagamento.substring(0, 10).split('-').reverse().join('/')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Pagamento">
                      <span style={{ fontWeight: 600, color: '#60a5fa' }}>{item.forma_pagamento || '-'}</span>
                      {item.quantidade_parcelas > 1 && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.quantidade_parcelas}x parcelas</div>
                      )}
                    </td>
                    <td data-label="Empresa">
                      <span style={{ fontSize: '0.8rem', color: item.empresa_pagadora && item.empresa_pagadora !== 'INDIFERENTE' ? '#a5b4fc' : '#94a3b8' }}>
                        {item.empresa_pagadora || 'INDIFERENTE'}
                      </span>
                    </td>
                    <td data-label="Centro de Custo">{item.departamento_centro_custo || '-'}</td>
                    <td data-label="Solicitante">
                      <div className="pa-solicitante-cell">
                        <User size={14} color="#94a3b8" />
                        <span>{item.solicitante_nome}</span>
                      </div>
                    </td>
                    <td data-label="Valor Total">
                      <span className="pa-price-highlight">
                        {formatBrl(item.valor * item.quantidade)}
                      </span>
                    </td>
                    <td data-label="Status">
                      {renderStatusBadge(item.status)}
                    </td>
                    <td data-label="Ações">
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="pa-btn-detail"
                          onClick={() => handleOpenDetails(item.id)}
                          title="Ver Detalhes e Ações"
                        >
                          <Eye size={15} /> Detalhes
                        </button>
                        {isMaster && (
                          <button
                            className="pa-btn-archive-master"
                            style={{ padding: '6px 10px', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                            onClick={() => { setDeleteModalRequest(item); setDeletePassword(''); setDeleteError(''); }}
                            title="Excluir Permanentemente (Exclusivo Master)"
                          >
                            <Trash2 size={13} />
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

      {/* MODAL DE DETALHES DA REQUISIÇÃO (FINANCEIRO) */}
      {selectedRequest && (
        <div className="pa-modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="pa-modal-card" style={{ maxWidth: '840px' }} onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <CreditCard size={20} color="#38bdf8" />
                <h3 style={{ margin: 0 }}>Detalhes da Solicitação: {selectedRequest.id}</h3>
                {renderStatusBadge(selectedRequest.status)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isMaster && (
                  <button
                    type="button"
                    className="pa-btn-archive-master"
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => { setDeleteModalRequest(selectedRequest); setDeletePassword(''); setDeleteError(''); }}
                    title="Excluir Solicitação Permanentemente (Exclusivo Master)"
                  >
                    <Trash2 size={13} /> Excluir
                  </button>
                )}
                {selectedRequest.status !== 'SOLICITACAO_CONCLUIDA' && selectedRequest.status !== 'PAGO' && selectedRequest.status !== 'PAGAMENTO_PAUSADO' && (
                  <button
                    type="button"
                    className="pa-btn-action-deny"
                    onClick={() => {
                      setPauseReason('');
                      setIsPauseModalOpen(true);
                    }}
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#fbbf24',
                      borderColor: '#f59e0b',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      borderRadius: '8px'
                    }}
                    title="Pausar Pagamento com justificativa obrigatória"
                  >
                    <PauseCircle size={14} /> Pausar Pagamento
                  </button>
                )}
                <button
                  type="button"
                  className="pa-modal-close"
                  onClick={() => setSelectedRequest(null)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="pa-modal-body">
              {/* BANNER DE PAGAMENTO PAUSADO */}
              {selectedRequest.status === 'PAGAMENTO_PAUSADO' && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '8px', borderRadius: '50%', color: '#f59e0b' }}>
                      <PauseCircle size={26} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '0.98rem' }}>
                        PAGAMENTO PAUSADO
                      </div>
                      <div style={{ fontSize: '0.84rem', color: '#e2e8f0', marginTop: '2px' }}>
                        Pausado por <strong style={{ color: '#fbbf24' }}>{selectedRequest.pausado_por_nome || 'Usuário'}</strong> {selectedRequest.pausado_em ? `em ${formatDate(selectedRequest.pausado_em)}` : ''}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '4px', fontStyle: 'italic' }}>
                        Motivo: "{selectedRequest.motivo_pausa || 'Não informado'}"
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="pa-btn-approve"
                    onClick={handleResumePayment}
                    disabled={pauseLoading}
                    style={{ padding: '8px 16px', fontSize: '0.85rem', background: '#10b981', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                  >
                    <PlayCircle size={15} /> Retomar Pagamento
                  </button>
                </div>
              )}

              {/* GRID DE DETALHES */}
              <div className="pa-req-details-grid">
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Solicitante</span>
                  <span className="pa-detail-val">{selectedRequest.solicitante_nome} ({selectedRequest.solicitante_email || 'Sem e-mail'})</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Centro de Custo / Departamento</span>
                  <span className="pa-detail-val">{selectedRequest.departamento_centro_custo || 'Não informado'}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Fornecedor / Prestador</span>
                  <span className="pa-detail-val">{selectedRequest.fornecedor_nome || 'Não informado'}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Contato do Fornecedor</span>
                  <span className="pa-detail-val">{selectedRequest.fornecedor_contato || 'Não informado'}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Descrição / Produto / Serviço</span>
                  <span className="pa-detail-val">{selectedRequest.produto_servico}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Quantidade & Valor Unitário</span>
                  <span className="pa-detail-val">{selectedRequest.quantidade}x • {formatBrl(selectedRequest.valor)} un.</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Forma de Pagamento</span>
                  <span className="pa-detail-val" style={{ color: '#60a5fa' }}>
                    {selectedRequest.forma_pagamento}
                    {selectedRequest.quantidade_parcelas > 1 ? ` (${selectedRequest.quantidade_parcelas}x)` : ' (À vista)'}
                  </span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Empresa Pagadora</span>
                  <span className="pa-detail-val" style={{ color: '#a5b4fc', fontWeight: 600 }}>
                    {selectedRequest.empresa_pagadora || 'INDIFERENTE'}
                  </span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Valor Total</span>
                  <span className="pa-detail-val" style={{ color: '#34d399', fontWeight: 800, fontSize: '1.1rem' }}>
                    {formatBrl(selectedRequest.valor * selectedRequest.quantidade)}
                  </span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Data de Criação</span>
                  <span className="pa-detail-val">{formatDate(selectedRequest.created_at)}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Aprovado Por</span>
                  <span className="pa-detail-val">{selectedRequest.aprovador_nome || '-'} {selectedRequest.decidido_em ? `em ${formatDate(selectedRequest.decidido_em)}` : ''}</span>
                </div>

                {/* Seletor de Data Programada / Parcelas */}
                {selectedRequest.quantidade_parcelas > 1 ? (
                  <div className="pa-detail-item" style={{ gridColumn: 'span 2', background: selectedRequest.status === 'PAGAMENTO_PAUSADO' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(56, 189, 248, 0.08)', padding: '16px', borderRadius: '12px', border: selectedRequest.status === 'PAGAMENTO_PAUSADO' ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(56, 189, 248, 0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                      <div>
                        <span className="pa-detail-label" style={{ color: selectedRequest.status === 'PAGAMENTO_PAUSADO' ? '#fbbf24' : '#38bdf8', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CalendarCheck size={16} /> Cronograma de Pagamento por Parcela ({selectedRequest.quantidade_parcelas}x)
                        </span>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          Defina a data e o valor de cada parcela individualmente:
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="pa-btn-detail"
                          onClick={handleResetEqualInstallments}
                          disabled={selectedRequest.status === 'SOLICITACAO_CONCLUIDA' || scheduleLoading}
                          style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Divide o valor total igualmente entre todas as parcelas"
                        >
                          ⚖️ Dividir Igualmente
                        </button>
                        <button
                          type="button"
                          className="pa-btn-detail"
                          onClick={handleAutoFillMonthlyDates}
                          disabled={selectedRequest.status === 'SOLICITACAO_CONCLUIDA' || scheduleLoading}
                          style={{ padding: '5px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Preenche automaticamente datas mensais (D+30) a partir da primeira"
                        >
                          ⚡ Preencher Mensal (D+30)
                        </button>
                      </div>
                    </div>

                    {/* TOTAL DO PAGAMENTO / CONFERÊNCIA DINÂMICA */}
                    <div style={{
                      background: valoresParcelasBatem ? 'rgba(52, 211, 153, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                      border: valoresParcelasBatem ? '1px solid rgba(52, 211, 153, 0.35)' : '1px solid rgba(245, 158, 11, 0.45)',
                      borderRadius: '10px',
                      padding: '10px 14px',
                      marginBottom: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Valor da Solicitação</div>
                          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: '#f8fafc' }}>{formatBrl(valorTotalSolicitacao)}</div>
                        </div>
                        <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.1)' }} />
                        <div>
                          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Soma das Parcelas</div>
                          <div style={{ fontSize: '0.98rem', fontWeight: 800, color: valoresParcelasBatem ? '#34d399' : '#fbbf24' }}>
                            {formatBrl(somaParcelasAtual)}
                          </div>
                        </div>
                      </div>

                      <div>
                        {valoresParcelasBatem ? (
                          <span style={{
                            background: 'rgba(52, 211, 153, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(52, 211, 153, 0.35)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <CheckCircle2 size={13} color="#34d399" />
                            Soma Total Bate Exatamente
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(245, 158, 11, 0.18)',
                            color: '#fbbf24',
                            border: '1px solid rgba(245, 158, 11, 0.45)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}>
                            <AlertTriangle size={13} color="#fbbf24" />
                            Divergência: {diferencaParcelas > 0 ? '+' : ''}{formatBrl(diferencaParcelas)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
                      {Array.from({ length: selectedRequest.quantidade_parcelas }).map((_, i) => {
                        const num = i + 1;
                        const isPaused = selectedRequest.status === 'PAGAMENTO_PAUSADO';

                        return (
                          <div
                            key={num}
                            style={{
                              background: isPaused ? 'rgba(245, 158, 11, 0.08)' : 'rgba(15, 23, 42, 0.6)',
                              border: isPaused ? '1px dashed rgba(245, 158, 11, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
                              padding: '10px 12px',
                              borderRadius: '8px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: isPaused ? '#fbbf24' : '#f8fafc', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {isPaused && <PauseCircle size={12} color="#fbbf24" />}
                                Parcela {num}/{selectedRequest.quantidade_parcelas}
                              </span>
                              {isPaused && (
                                <span style={{ fontSize: '0.68rem', color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                                  Pausada
                                </span>
                              )}
                            </div>

                            <div>
                              <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                                Valor da Parcela (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                className="pa-input"
                                value={parcelasValoresInput[num] != null ? parcelasValoresInput[num] : ''}
                                onChange={e => handleParcelaValorChange(num, e.target.value)}
                                placeholder="0,00"
                                style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: '0.85rem', color: '#34d399', fontWeight: 700 }}
                                disabled={selectedRequest.status === 'SOLICITACAO_CONCLUIDA' || scheduleLoading}
                              />
                            </div>

                            <div>
                              <label style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginBottom: '3px', fontWeight: 600 }}>
                                Data Programada
                              </label>
                              <input
                                type="date"
                                className="pa-input"
                                value={parcelasInput[num] || ''}
                                onChange={e => setParcelasInput({ ...parcelasInput, [num]: e.target.value })}
                                style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', fontSize: '0.85rem' }}
                                disabled={selectedRequest.status === 'SOLICITACAO_CONCLUIDA' || scheduleLoading}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px' }}>
                      <button
                        type="button"
                        className="pa-btn-approve"
                        onClick={handleSaveParcelasClick}
                        disabled={scheduleLoading || selectedRequest.status === 'SOLICITACAO_CONCLUIDA'}
                        style={{
                          padding: '8px 18px',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: valoresParcelasBatem ? '#10b981' : '#f59e0b',
                          color: '#0f172a',
                          fontWeight: 750
                        }}
                      >
                        {scheduleLoading ? <RefreshCw size={14} className="pwc-spinner" /> : <Save size={14} />}
                        {scheduleLoading ? 'Salvando...' : 'Salvar Datas das Parcelas'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pa-detail-item" style={{ gridColumn: 'span 2', background: selectedRequest.status === 'PAGAMENTO_PAUSADO' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(56, 189, 248, 0.08)', padding: '16px', borderRadius: '12px', border: selectedRequest.status === 'PAGAMENTO_PAUSADO' ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(56, 189, 248, 0.25)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                      <span className="pa-detail-label" style={{ color: selectedRequest.status === 'PAGAMENTO_PAUSADO' ? '#fbbf24' : '#38bdf8', fontSize: '0.85rem', fontWeight: 700 }}>
                        📅 Agendamento de Pagamento (Financeiro)
                      </span>
                      {selectedRequest.data_pagamento && (
                        <span style={{ fontSize: '0.8rem', color: selectedRequest.status === 'PAGAMENTO_PAUSADO' ? '#fbbf24' : '#60a5fa', background: selectedRequest.status === 'PAGAMENTO_PAUSADO' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(96, 165, 250, 0.15)', padding: '3px 8px', borderRadius: '6px', border: selectedRequest.status === 'PAGAMENTO_PAUSADO' ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(96, 165, 250, 0.3)' }}>
                          {selectedRequest.status === 'PAGAMENTO_PAUSADO' ? '⏸️ Data Pausada: ' : 'Agendado para: '}
                          <strong>{selectedRequest.data_pagamento.substring(0, 10).split('-').reverse().join('/')}</strong>
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px', flexWrap: 'wrap' }}>
                      <input
                        type="date"
                        className="pa-input"
                        value={scheduleInputDate}
                        onChange={(e) => setScheduleInputDate(e.target.value)}
                        style={{ maxWidth: '200px', padding: '8px 12px', fontSize: '0.9rem' }}
                        disabled={selectedRequest.status === 'SOLICITACAO_CONCLUIDA' || scheduleLoading}
                      />

                      {/* Botão Agendar ou Reagendar */}
                      {selectedRequest.data_pagamento ? (
                        <button
                          type="button"
                          onClick={() => handleSaveScheduleDate(scheduleInputDate)}
                          disabled={!scheduleInputDate || scheduleInputDate === selectedRequest.data_pagamento.substring(0, 10) || scheduleLoading}
                          className="pa-btn-detail"
                          style={{
                            background: (scheduleInputDate && scheduleInputDate !== selectedRequest.data_pagamento.substring(0, 10)) ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                            color: (scheduleInputDate && scheduleInputDate !== selectedRequest.data_pagamento.substring(0, 10)) ? '#0f172a' : '#64748b',
                            fontWeight: 750,
                            cursor: (scheduleInputDate && scheduleInputDate !== selectedRequest.data_pagamento.substring(0, 10)) ? 'pointer' : 'not-allowed'
                          }}
                        >
                          {scheduleLoading ? <RefreshCw size={14} className="pwc-spinner" /> : <RotateCcw size={14} />}
                          {scheduleLoading ? 'Salvando...' : 'Reagendar Pagamento'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSaveScheduleDate(scheduleInputDate)}
                          disabled={!scheduleInputDate || scheduleLoading}
                          className="pa-btn-approve"
                          style={{
                            padding: '8px 14px',
                            fontSize: '0.85rem',
                            cursor: scheduleInputDate ? 'pointer' : 'not-allowed',
                            opacity: scheduleInputDate ? 1 : 0.5
                          }}
                        >
                          {scheduleLoading ? <RefreshCw size={14} className="pwc-spinner" /> : <CalendarCheck size={14} />}
                          {scheduleLoading ? 'Agendando...' : 'Agendar Pagamento'}
                        </button>
                      )}

                      {/* Botão de Cancelar / Remover Agendamento se já houver */}
                      {selectedRequest.data_pagamento && selectedRequest.status !== 'SOLICITACAO_CONCLUIDA' && (
                        <button
                          type="button"
                          onClick={() => handleSaveScheduleDate(null)}
                          disabled={scheduleLoading}
                          className="pa-btn-action-deny"
                          style={{ padding: '8px 12px', fontSize: '0.82rem', borderRadius: '8px' }}
                          title="Remover data agendada"
                        >
                          <X size={14} /> Cancelar Agendamento
                        </button>
                      )}
                    </div>

                    <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                      {selectedRequest.data_pagamento
                        ? 'Escolha uma nova data acima e clique em "Reagendar Pagamento" para alterar a programação financeira.'
                        : 'Selecione a data no calendário e clique em "Agendar Pagamento" para confirmar.'}
                    </p>
                  </div>
                )}

                {selectedRequest.observacoes && (
                  <div className="pa-detail-item" style={{ gridColumn: 'span 2' }}>
                    <span className="pa-detail-label">Observações da Proposta</span>
                    <span className="pa-detail-val" style={{ fontSize: '0.88rem', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                      {selectedRequest.observacoes}
                    </span>
                  </div>
                )}
              </div>

              {/* --- ITENS DISCRIMINADOS DA SOLICITAÇÃO --- */}
              {selectedRequest.itens && selectedRequest.itens.length > 0 && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📦 Itens da Solicitação ({selectedRequest.itens.length})
                  </h4>
                  <div className="pa-multi-items-modal-list">
                    {selectedRequest.itens.map((it, idx) => (
                      <div key={it.id || idx} className="pa-modal-item-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="pa-code-badge">Item #{it.numero_item || idx + 1}</span>
                            <span className="pa-category-badge">🏷️ {it.categoria || 'Outros'}</span>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                              📍 {it.tipo_destino === 'EMPRESA' ? 'Empresa' : it.tipo_destino === 'CLIENTE' ? 'Cliente' : it.tipo_destino === 'CENTRO_DE_CUSTO' ? 'Centro de Custo' : 'Departamento'}: <strong style={{ color: '#cbd5e1' }}>{it.departamento_centro_custo || '-'}</strong>
                            </span>
                          </div>
                          <div style={{ fontSize: '1rem', fontWeight: 750, color: '#34d399' }}>
                            {formatBrl((it.valor || 0) * (it.quantidade || 1))}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc' }}>
                          {it.produto_servico}
                        </div>

                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#94a3b8' }}>
                          <span>🏢 Fornecedor: <strong style={{ color: '#cbd5e1' }}>{it.fornecedor_nome || '-'}</strong> ({it.fornecedor_contato || '-'})</span>
                          <span>💳 Pagamento: <strong style={{ color: '#60a5fa' }}>{it.forma_pagamento || '-'}{(it.quantidade_parcelas && it.quantidade_parcelas > 1) ? ` (${it.quantidade_parcelas}x)` : ''}</strong></span>
                          <span>🔢 Qtd: <strong style={{ color: '#cbd5e1' }}>{it.quantidade || 1} un</strong> x {formatBrl(it.valor)}</span>
                        </div>

                        {it.observacoes && (
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }}>
                            📝 {it.observacoes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SEÇÃO DE ANEXOS */}
              <div className="pa-attachments-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Paperclip size={16} color="#38bdf8" /> Documentos Anexos ({attachments.length})
                  </h4>
                  <label className="pa-btn-detail" style={{ cursor: 'pointer', margin: 0, fontSize: '0.8rem' }}>
                    <Paperclip size={14} /> Anexar Arquivo (Max 20MB)
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                      disabled={uploadingAttachment}
                    />
                  </label>
                </div>

                {attachmentError && (
                  <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '8px' }}>{attachmentError}</div>
                )}
                {uploadingAttachment && (
                  <div style={{ color: '#38bdf8', fontSize: '0.82rem', marginBottom: '8px' }}>Enviando anexo...</div>
                )}

                {attachments.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', padding: '8px 0' }}>
                    Nenhum documento anexado a esta solicitação.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {attachments.map(att => (
                      <div
                        key={att.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid #1e293b',
                          borderRadius: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Paperclip size={14} color="#38bdf8" />
                          <div>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                              {att.nome_arquivo}
                            </span>
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                              {(att.tamanho_bytes / 1024).toFixed(1)} KB • Enviado por {att.enviado_por_nome} em {formatDate(att.created_at)}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="pa-btn-detail"
                            onClick={() => handleDownloadAttachment(att.id, att.nome_arquivo)}
                            title="Baixar anexo"
                          >
                            <Download size={14} /> Baixar
                          </button>
                          {(att.enviado_por_id === user?.id || isMaster) && (
                            <button
                              type="button"
                              className="pa-btn-archive-master"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleDeleteAttachment(att.id)}
                              title="Excluir anexo"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* AÇÕES DO FINANCEIRO (CONCLUIR / DEVOLVER PARA REVISÃO) */}
              {selectedRequest.status === 'APROVADO' && (
                <div className="pa-actions-bar">
                  <div className="pa-actions-buttons">
                    <button
                      type="button"
                      className="pa-btn-approve"
                      onClick={() => setActionType(actionType === 'CONCLUIR' ? null : 'CONCLUIR')}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      <CheckSquare size={16} /> Solicitação Concluída (Paga)
                    </button>
                    <button
                      type="button"
                      className="pa-btn-deny"
                      onClick={() => setActionType(actionType === 'REVISAO' ? null : 'REVISAO')}
                      style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)' }}
                    >
                      <RotateCcw size={16} /> Devolver para Reaprovação
                    </button>
                  </div>

                  {actionType && (
                    <div className="pa-confirm-box">
                      <h4>
                        {actionType === 'CONCLUIR' 
                          ? 'Confirmar Conclusão da Solicitação' 
                          : 'Devolver Solicitação para Reaprovação Administrativa'}
                      </h4>
                      <p>
                        {actionType === 'CONCLUIR'
                          ? 'Ao confirmar, o status será alterado para SOLICITAÇÃO CONCLUÍDA e o registro será arquivado no histórico de pagamentos.'
                          : 'A solicitação sairá da fila do financeiro e retornará para a fila do Administrativo com o status REAPROVAÇÃO NECESSÁRIA.'}
                      </p>

                      <div className="pa-form-group">
                        <label>
                          {actionType === 'REVISAO' ? 'Motivo da Reaprovação *' : 'Observações da Liquidação (Opcional)'}
                        </label>
                        <textarea
                          className="pa-textarea"
                          rows={3}
                          placeholder={
                            actionType === 'REVISAO' 
                              ? 'Descreva detalhadamente o que precisa ser revisto pelo Administrativo...' 
                              : 'Observações sobre o comprovante, data ou dados bancários...'
                          }
                          value={actionMotivo}
                          onChange={e => setActionMotivo(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                        <button
                          type="button"
                          className={actionType === 'CONCLUIR' ? 'pa-btn-approve' : 'pa-btn-deny'}
                          onClick={handleExecuteAction}
                          disabled={actionLoading}
                        >
                          {actionLoading ? 'Processando...' : (actionType === 'CONCLUIR' ? 'Confirmar Conclusão' : 'Confirmar Devolução')}
                        </button>
                        <button
                          type="button"
                          className="pa-btn-detail"
                          onClick={() => setActionType(null)}
                          disabled={actionLoading}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* HISTÓRICO & CHAT */}
              <div className="pa-chat-section">
                <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💬 Linha do Tempo & Mensagens ({messages.length})
                </h4>

                <div className="pa-chat-messages" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {messages.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                      Nenhuma mensagem ou histórico registrado até o momento.
                    </div>
                  ) : (
                    messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`pa-chat-bubble ${msg.autor_role.toLowerCase()}`}
                      >
                        <div className="pa-chat-bubble-header">
                          <span className="pa-chat-author">{msg.autor_nome} ({msg.autor_role})</span>
                          <span className="pa-chat-time">{formatDate(msg.created_at)}</span>
                        </div>
                        <p className="pa-chat-text" style={{ margin: '4px 0 0 0', fontSize: '0.88rem' }}>
                          {msg.mensagem}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="pa-chat-input-row">
                  <input
                    type="text"
                    className="pa-input"
                    placeholder="Adicione um comentário ou responda sobre esta solicitação..."
                    value={newMessageText}
                    onChange={e => setNewMessageText(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button type="submit" disabled={!newMessageText.trim()} className="pa-submit-btn" style={{ padding: '10px 18px' }}>
                    <Send size={15} /> Enviar
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CUSTOMIZADO: AVISO DE DIVERGÊNCIA DE VALORES NAS PARCELAS */}
      {isDivergenceModalOpen && selectedRequest && (
        <div className="pa-modal-overlay" onClick={() => setIsDivergenceModalOpen(false)}>
          <div className="pa-modal-card" style={{ maxWidth: '520px', border: '1px solid rgba(245, 158, 11, 0.45)' }} onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header" style={{ borderBottomColor: 'rgba(245, 158, 11, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(245, 158, 11, 0.15)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color="#fbbf24" />
                </div>
                <h3 style={{ margin: 0, color: '#fbbf24' }}>Atenção: Divergência de Valores</h3>
              </div>
              <button
                type="button"
                className="pa-modal-close"
                onClick={() => setIsDivergenceModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="pa-modal-body">
              <p style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: 1.5, margin: '0 0 14px 0' }}>
                O valor total da soma das parcelas está <strong>diferente</strong> do valor requisitado na solicitação.
              </p>

              <div style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8' }}>Valor Requisitado na Solicitação:</span>
                  <strong style={{ color: '#f8fafc' }}>{formatBrl(valorTotalSolicitacao)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: '#94a3b8' }}>Soma das {totalParcelasCount} Parcelas:</span>
                  <strong style={{ color: '#fbbf24' }}>{formatBrl(somaParcelasAtual)}</strong>
                </div>
                <div style={{ width: '100%', height: '1px', background: 'rgba(255, 255, 255, 0.08)' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>Diferença:</span>
                  <strong style={{ color: diferencaParcelas > 0 ? '#fbbf24' : '#ef4444' }}>
                    {diferencaParcelas > 0 ? '+' : ''}{formatBrl(diferencaParcelas)}
                  </strong>
                </div>
              </div>

              <p style={{ color: '#cbd5e1', fontSize: '0.85rem', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
                Deseja salvar o cronograma com essa divergência ou voltar para ajustar os valores das parcelas?
              </p>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="pa-btn-action-deny"
                  onClick={() => setIsDivergenceModalOpen(false)}
                  disabled={scheduleLoading}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Voltar e Ajustar
                </button>
                <button
                  type="button"
                  className="pa-btn-approve"
                  onClick={executeSaveParcelasDates}
                  disabled={scheduleLoading}
                  style={{
                    background: '#f59e0b',
                    color: '#0f172a',
                    fontWeight: 750,
                    padding: '8px 18px',
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {scheduleLoading ? <RefreshCw size={14} className="pwc-spinner" /> : <Save size={14} />}
                  {scheduleLoading ? 'Salvando...' : 'Confirmar e Salvar Assim Mesmo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAUSAR PAGAMENTO */}
      {isPauseModalOpen && selectedRequest && (
        <div className="pa-modal-overlay" onClick={() => setIsPauseModalOpen(false)}>
          <div className="pa-modal-card" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <PauseCircle size={22} color="#f59e0b" />
                <h3 style={{ margin: 0, color: '#f8fafc' }}>Pausar Pagamento</h3>
              </div>
              <button
                type="button"
                className="pa-modal-close"
                onClick={() => setIsPauseModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="pa-modal-body">
              <p style={{ color: '#cbd5e1', fontSize: '0.88rem', margin: '0 0 12px 0' }}>
                Ao pausar o pagamento da solicitação <strong style={{ color: '#38bdf8' }}>{selectedRequest.id}</strong>, o status passará para <strong style={{ color: '#fbbf24' }}>PAGAMENTO PAUSADO</strong> e as datas posteriores ficarão destacadas como pausadas no calendário.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc' }}>
                  Motivo da Pausa <span style={{ color: '#ef4444' }}>* (Obrigatório)</span>
                </label>
                <textarea
                  className="pa-input"
                  rows={4}
                  placeholder="Explique detalhadamente o motivo da pausa no pagamento..."
                  value={pauseReason}
                  onChange={e => setPauseReason(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  className="pa-btn-action-deny"
                  onClick={() => setIsPauseModalOpen(false)}
                  disabled={pauseLoading}
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="pa-btn-approve"
                  onClick={handlePausePayment}
                  disabled={!pauseReason.trim() || pauseLoading}
                  style={{
                    background: '#f59e0b',
                    color: '#0f172a',
                    fontWeight: 750,
                    padding: '8px 18px',
                    fontSize: '0.85rem',
                    cursor: pauseReason.trim() ? 'pointer' : 'not-allowed',
                    opacity: pauseReason.trim() ? 1 : 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {pauseLoading ? <RefreshCw size={14} className="pwc-spinner" /> : <PauseCircle size={14} />}
                  {pauseLoading ? 'Pausando...' : 'Confirmar Pausa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXCLUSÃO DEFINITIVA (EXCLUSIVO MASTER COM CONFIRMAÇÃO DE SENHA) */}
      {deleteModalRequest && (
        <div className="pa-modal-overlay" onClick={() => { if (!deleteLoading) setDeleteModalRequest(null); }}>
          <div className="pa-modal-card" style={{ maxWidth: '520px', border: '1px solid rgba(239, 68, 68, 0.4)' }} onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header" style={{ borderBottomColor: 'rgba(239, 68, 68, 0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={20} color="#ef4444" />
                </div>
                <h3 style={{ margin: 0, color: '#f87171' }}>Excluir Solicitação Definitivamente</h3>
              </div>
              <button
                type="button"
                className="pa-modal-close"
                disabled={deleteLoading}
                onClick={() => setDeleteModalRequest(null)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmDeleteMaster}>
              <div className="pa-modal-body">
                <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '10px', padding: '12px 14px', marginBottom: '1rem' }}>
                  <p style={{ color: '#fca5a5', fontSize: '0.88rem', margin: 0, lineHeight: 1.5 }}>
                    ⚠️ <strong>Atenção Master:</strong> Esta ação é <strong>irreversível</strong>. A solicitação <strong style={{ color: '#ffffff' }}>{deleteModalRequest.id}</strong> ({deleteModalRequest.produto_servico}), todos os seus anexos, parcelas e mensagens serão apagados permanentemente do banco de dados.
                  </p>
                </div>

                <div className="pa-form-group">
                  <label style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.88rem' }}>
                    Confirme sua Senha de Usuário <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    className="pa-input"
                    placeholder="Digite sua senha de login para confirmar..."
                    value={deletePassword}
                    onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                    autoFocus
                    required
                    style={{ width: '100%', boxSizing: 'border-box', marginTop: '6px' }}
                  />
                  {deleteError && (
                    <div style={{ color: '#f87171', fontSize: '0.82rem', marginTop: '6px', fontWeight: 600 }}>
                      ⚠️ {deleteError}
                    </div>
                  )}
                </div>

                <div className="pa-confirm-actions" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    type="button"
                    className="pa-btn-cancel"
                    disabled={deleteLoading}
                    onClick={() => setDeleteModalRequest(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={deleteLoading || !deletePassword.trim()}
                    className="pa-btn-archive-master"
                    style={{
                      background: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 700,
                      padding: '8px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: (!deletePassword.trim() || deleteLoading) ? 'not-allowed' : 'pointer',
                      opacity: (!deletePassword.trim() || deleteLoading) ? 0.5 : 1
                    }}
                  >
                    {deleteLoading ? <RefreshCw size={15} className="pwc-spinner" /> : <Trash2 size={15} />}
                    {deleteLoading ? 'Excluindo...' : 'Confirmar Exclusão'}
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

export default FinanceRefundsExpenses;
