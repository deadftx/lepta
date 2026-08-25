import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2,
  CheckSquare, X, Eye, Download, Paperclip, RefreshCw, CreditCard, CheckCircle2, CalendarCheck, RotateCcw,
  PauseCircle, PlayCircle
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import { useAuth } from '../../core/AuthContext';
import '../administrative/purchases/PurchaseApproval.css';
import './FinancePaymentCalendar.css';

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
  status: 'PENDENTE' | 'REABERTO' | 'AGUARDANDO_RESPOSTA_SOLICITANTE' | 'AGUARDANDO_RESPOSTA_APROVADOR' | 'APROVADO' | 'PAGAMENTO_PAUSADO' | 'NEGADO' | 'PAGO' | 'REVISAO' | 'SOLICITACAO_CONCLUIDA';
  arquivado?: number;
  data_pagamento?: string | null;
  datas_parcelas?: string | null;
  pausado_em?: string | null;
  pausado_por_id?: string | null;
  pausado_por_nome?: string | null;
  motivo_pausa?: string | null;
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
  itens?: PurchaseItem[];
}

export interface CalendarPaymentItem {
  req: PurchaseRequest;
  isParcela: boolean;
  numeroParcela?: number;
  totalParcelas?: number;
  valorItem: number;
  dataPagamento: string;
  isPaused: boolean;
  motivoPausa?: string | null;
}

interface Attachment {
  id: string;
  nome_arquivo: string;
  tamanho_bytes: number;
  enviado_por_id: string;
  enviado_por_nome: string;
  created_at: string;
}

export const FinancePaymentCalendar: React.FC = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  // Navigation
  const [currentDate, setCurrentDate] = useState(new Date());

  // Data
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Day Details Modal
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);

  // Action states
  const [selectedRequestDetails, setSelectedRequestDetails] = useState<PurchaseRequest | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [actionObservation, setActionObservation] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Pausa de Pagamento
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [pauseLoading, setPauseLoading] = useState(false);

  // Dropdown options for adding payment
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  // Batch Selection for conclusion
  const [selectedReqIds, setSelectedReqIds] = useState<Record<string, boolean>>({});

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
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do calendário:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calendar Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = useMemo(() => new Date(year, month + 1, 0).getDate(), [year, month]);
  const firstDayIndex = useMemo(() => new Date(year, month, 1).getDay(), [year, month]);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
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

  // Group payments by scheduled date: YYYY-MM-DD (suporta parcelas individuais e solicitações integrais)
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarPaymentItem[]> = {};

    requests.forEach(req => {
      const isReqPaused = req.status === 'PAGAMENTO_PAUSADO';

      if (Array.isArray(req.parcelas) && req.parcelas.length > 0) {
        req.parcelas.forEach(p => {
          if (p.data_pagamento) {
            const dateStr = p.data_pagamento.substring(0, 10);
            if (!map[dateStr]) map[dateStr] = [];
            map[dateStr].push({
              req,
              isParcela: true,
              numeroParcela: p.numero_parcela,
              totalParcelas: p.total_parcelas || req.quantidade_parcelas || req.parcelas!.length,
              valorItem: p.valor || ((req.valor * req.quantidade) / (req.quantidade_parcelas || 1)),
              dataPagamento: dateStr,
              isPaused: isReqPaused || Boolean(p.pausado),
              motivoPausa: p.motivo_pausa || req.motivo_pausa
            });
          }
        });
      } else if (req.data_pagamento) {
        const dateStr = req.data_pagamento.substring(0, 10);
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push({
          req,
          isParcela: false,
          valorItem: req.valor * req.quantidade,
          dataPagamento: dateStr,
          isPaused: isReqPaused,
          motivoPausa: req.motivo_pausa
        });
      }
    });

    return map;
  }, [requests]);

  // Monthly KPIs
  const monthlyScheduledStats = useMemo(() => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const prefix = `${year}-${formattedMonth}`;
    
    let totalValue = 0;
    let totalCount = 0;
    let pausedCount = 0;
    let pausedValue = 0;

    Object.entries(itemsByDate).forEach(([dt, items]) => {
      if (dt.startsWith(prefix)) {
        items.forEach(it => {
          totalValue += it.valorItem;
          totalCount++;
          if (it.isPaused) {
            pausedCount++;
            pausedValue += it.valorItem;
          }
        });
      }
    });

    return { totalValue, totalCount, pausedCount, pausedValue };
  }, [itemsByDate, year, month]);

  // Approved requests available for scheduling
  const unscheduledApprovedRequests = useMemo(() => {
    return requests.filter(req => req.status === 'APROVADO' && !req.data_pagamento && (!req.parcelas || req.parcelas.length === 0));
  }, [requests]);

  const handleDayClick = (day: number) => {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    const dayStr = `${year}-${formattedMonth}-${formattedDay}`;

    setSelectedDayStr(dayStr);
    setSelectedReqIds({});
    setShowAddDropdown(false);
  };

  // Schedule a request to the active date
  const handleScheduleRequest = async (reqId: string) => {
    if (!selectedDayStr) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${reqId}/data-pagamento`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data_pagamento: selectedDayStr })
      });
      if (res.ok) {
        showToast('Pagamento agendado com sucesso!');
        setShowAddDropdown(false);
        await fetchData(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao agendar.');
      }
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  // Unschedule request (remove payment date)
  const handleUnscheduleRequest = async (reqId: string) => {
    if (!window.confirm('Excluir este agendamento de pagamento?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${reqId}/data-pagamento`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data_pagamento: null })
      });
      if (res.ok) {
        showToast('Agendamento excluído.');
        await fetchData(true);
      } else {
        alert('Erro ao excluir agendamento.');
      }
    } catch (err) {
      console.error('Erro:', err);
    }
  };

  // Batch Conclude selected requests
  const handleBatchConclude = async () => {
    const idsToConclude = Object.keys(selectedReqIds).filter(id => selectedReqIds[id]);
    if (idsToConclude.length === 0) return;
    if (!window.confirm(`Deseja marcar as ${idsToConclude.length} solicitações selecionadas como CONCLUÍDAS?`)) return;

    setActionLoading(true);
    let successCount = 0;
    try {
      for (const id of idsToConclude) {
        const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${id}/concluir`, {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ observacoes: 'Conclusão em lote via Calendário Financeiro' })
        });
        if (res.ok) {
          successCount++;
        }
      }
      showToast(`${successCount} de ${idsToConclude.length} solicitações concluídas com sucesso!`);
      setSelectedReqIds({});
      await fetchData(true);
    } catch (err) {
      console.error(err);
      alert('Erro no processo de conclusão.');
    } finally {
      setActionLoading(false);
    }
  };

  // Detail Modal popup helpers
  const [scheduleInputDate, setScheduleInputDate] = useState<string>('');
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const handleOpenDetailModal = async (reqId: string) => {
    setActionLoading(true);
    setUploadError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${reqId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRequestDetails(data);
        setScheduleInputDate(data.data_pagamento ? data.data_pagamento.substring(0, 10) : '');
        await fetchAttachments(reqId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveScheduleDate = async (newDate: string | null) => {
    if (!selectedRequestDetails) return;
    setScheduleLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestDetails.id}/data-pagamento`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data_pagamento: newDate })
      });
      if (res.ok) {
        const updated = await res.json();
        setSelectedRequestDetails(prev => {
          if (!prev) return null;
          return {
            ...prev,
            data_pagamento: updated.requisicao.data_pagamento
          };
        });
        setScheduleInputDate(newDate || '');

        const isReschedule = Boolean(selectedRequestDetails.data_pagamento && newDate && selectedRequestDetails.data_pagamento.substring(0, 10) !== newDate);
        showToast(
          !newDate 
            ? 'Agendamento cancelado com sucesso!' 
            : isReschedule 
              ? 'Pagamento reagendado com sucesso!' 
              : 'Pagamento agendado com sucesso!'
        );
        await fetchData(true);
      }
    } catch (err) {
      console.error('Erro ao agendar data de pagamento:', err);
    } finally {
      setScheduleLoading(false);
    }
  };

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
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedRequestDetails || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
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
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestDetails.id}/anexos`, {
        method: 'POST',
        headers: getAuthHeaders() as any,
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao enviar anexo.');
      }

      showToast('Anexo adicionado com sucesso!');
      await fetchAttachments(selectedRequestDetails.id);
    } catch (err: any) {
      setUploadError(err.message || 'Falha ao subir arquivo.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownloadAttachment = (anexoId: string, filename: string) => {
    if (!selectedRequestDetails) return;
    const url = `${API_BASE_URL}/api/compras/requisicoes/${selectedRequestDetails.id}/anexos/${anexoId}`;
    
    fetch(url, { headers: getAuthHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Erro no arquivo.');
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
      .catch(err => alert(err.message));
  };

  const handleDeleteAttachment = async (anexoId: string) => {
    if (!selectedRequestDetails) return;
    if (!window.confirm('Excluir anexo?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestDetails.id}/anexos/${anexoId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showToast('Anexo removido!');
        await fetchAttachments(selectedRequestDetails.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Pausar Pagamento
  const handlePausePayment = async () => {
    if (!selectedRequestDetails || !pauseReason.trim()) {
      alert('Por favor, informe o motivo para pausar o pagamento.');
      return;
    }
    setPauseLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestDetails.id}/pausar-pagamento`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo: pauseReason.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRequestDetails(prev => prev ? { ...prev, ...data.requisicao } : null);
        setIsPauseModalOpen(false);
        setPauseReason('');

        // Recarrega detalhes
        const resDetails = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestDetails.id}`, {
          headers: getAuthHeaders()
        });
        if (resDetails.ok) {
          const detailData = await resDetails.json();
          setSelectedRequestDetails(detailData);
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
    if (!selectedRequestDetails) return;
    if (!window.confirm('Deseja retomar o pagamento desta solicitação? O fluxo seguirá normalmente.')) return;
    setPauseLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestDetails.id}/retomar-pagamento`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo: 'Retomado pelo usuário' })
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedRequestDetails(prev => prev ? { ...prev, ...data.requisicao } : null);

        // Recarrega detalhes
        const resDetails = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestDetails.id}`, {
          headers: getAuthHeaders()
        });
        if (resDetails.ok) {
          const detailData = await resDetails.json();
          setSelectedRequestDetails(detailData);
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

  const handleConcludeSingle = async () => {
    if (!selectedRequestDetails) return;
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/requisicoes/${selectedRequestDetails.id}/concluir`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ observacoes: actionObservation.trim() })
      });
      if (res.ok) {
        showToast('Solicitação concluída com sucesso!');
        setSelectedRequestDetails(null);
        await fetchData(true);
      } else {
        const err = await res.json();
        alert(err.error || 'Erro ao concluir.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSelectReq = (reqId: string) => {
    setSelectedReqIds(prev => ({
      ...prev,
      [reqId]: !prev[reqId]
    }));
  };

  // Render elements in calendar
  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    const dayItems = itemsByDate[dateStr] || [];
    const hasPaused = dayItems.some(it => it.isPaused);

    const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
    const totalValue = dayItems.reduce((sum, it) => sum + it.valorItem, 0);

    calendarCells.push(
      <div
        key={`day-${day}`}
        className={`calendar-day ${isToday ? 'today' : ''} ${dayItems.length > 0 ? 'has-events' : ''}`}
        style={hasPaused ? { borderColor: 'rgba(245, 158, 11, 0.45)', background: 'linear-gradient(180deg, rgba(245, 158, 11, 0.05) 0%, rgba(15, 23, 42, 0.6) 100%)' } : {}}
        onClick={() => handleDayClick(day)}
      >
        <div className="day-header">
          <span className="day-number">{day}</span>
          {dayItems.length > 0 && (
            <span className="day-count-badge" style={hasPaused ? { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', borderColor: 'rgba(245, 158, 11, 0.4)' } : {}}>
              <span className="badge-text-full">{dayItems.length} {dayItems.length === 1 ? 'pgto' : 'pgtos'}{hasPaused ? ' (⏸️)' : ''}</span>
              <span className="badge-text-mini">{dayItems.length}</span>
            </span>
          )}
        </div>

        {dayItems.length > 0 && (
          <div className="day-events-list">
            {dayItems.slice(0, 2).map((it, idx) => (
              <div
                key={`${it.req.id}-${idx}`}
                className={`event-chip ${it.isPaused ? 'paused' : ''}`}
                title={`${it.isPaused ? '[DATA PAUSADA] ' : ''}${it.req.fornecedor_nome} ${it.isParcela ? `(P${it.numeroParcela}/${it.totalParcelas})` : ''} - ${formatBrl(it.valorItem)}`}
              >
                <span className="event-chip-title">
                  {it.isParcela ? `P${it.numeroParcela}/${it.totalParcelas} ` : ''}
                  {it.req.fornecedor_nome || it.req.produto_servico}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <span className="event-chip-val">{formatBrl(it.valorItem)}</span>
                  {it.isPaused && <span className="event-chip-paused-badge">⏸️</span>}
                </div>
              </div>
            ))}
            {dayItems.length > 2 && (
              <span style={{ fontSize: '0.68rem', color: '#94a3b8', paddingLeft: '4px' }}>
                +{dayItems.length - 2} outro(s)...
              </span>
            )}
          </div>
        )}

        {/* Mobile Indicator */}
        {dayItems.length > 0 && (
          <div className="day-mobile-indicator">
            <span className="mobile-event-dot"></span>
            <span className="mobile-total-val">{formatBrl(totalValue)}</span>
          </div>
        )}

        {dayItems.length > 0 && (
          <div className="day-footer-total">
            <span>Total Dia:</span>
            <span>{formatBrl(totalValue)}</span>
          </div>
        )}
      </div>
    );
  }

  if (loading && requests.length === 0) {
    return (
      <div className="pa-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: '#38bdf8' }} />
      </div>
    );
  }

  return (
    <div className="pa-container calendar-wrapper">
      {toastMessage && (
        <div className="pa-toast">
          <CheckCircle2 size={18} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="pa-header">
        <div className="pa-header-left">
          <div className="pa-icon-badge" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)', boxShadow: '0 6px 20px rgba(168, 85, 247, 0.35)' }}>
            <CalendarIcon size={28} />
          </div>
          <div>
            <div className="pa-kicker" style={{ color: '#c084fc' }}>
              <CalendarCheck size={14} /> Gestão Financeira
            </div>
            <h1>Calendário de Pagamentos</h1>
            <p className="pa-subtitle">Planejamento visual, agendamento de parcelas e controle de pagamentos pausados</p>
          </div>
        </div>

        <div className="pa-header-badges">
          <button
            type="button"
            className="pa-btn-reopen"
            onClick={() => fetchData(false)}
            title="Atualizar dados"
          >
            <RefreshCw size={14} /> Atualizar
          </button>
        </div>
      </header>

      {/* BARRA DE CONTROLE DO MÊS E KPIS */}
      <div className="calendar-controls-card">
        <div className="calendar-nav-group">
          <button className="calendar-nav-btn" onClick={handlePrevMonth}>
            <ChevronLeft size={16} /> Mês Anterior
          </button>
          <button className="calendar-today-btn" onClick={handleToday}>
            Hoje
          </button>
          <button className="calendar-nav-btn" onClick={handleNextMonth}>
            Próximo Mês <ChevronRight size={16} />
          </button>
        </div>

        <h2 className="calendar-title-heading">
          {monthNames[month]} {year}
        </h2>

        <div className="calendar-kpi-group">
          <div className="calendar-kpi-item">
            <span className="calendar-kpi-label">Total Programado no Mês</span>
            <span className="calendar-kpi-val">{formatBrl(monthlyScheduledStats.totalValue)}</span>
          </div>
          {monthlyScheduledStats.pausedCount > 0 && (
            <div className="calendar-kpi-item">
              <span className="calendar-kpi-label" style={{ color: '#fbbf24' }}>Pausados</span>
              <span className="calendar-kpi-val" style={{ color: '#fbbf24' }}>{monthlyScheduledStats.pausedCount} ({formatBrl(monthlyScheduledStats.pausedValue)})</span>
            </div>
          )}
          <div className="calendar-kpi-item">
            <span className="calendar-kpi-label">Qtd. Pagamentos</span>
            <span className="calendar-kpi-val" style={{ color: '#38bdf8' }}>{monthlyScheduledStats.totalCount}</span>
          </div>
        </div>
      </div>

      {/* GRID DO CALENDÁRIO */}
      <div className="calendar-card">
        <div className="calendar-grid">
          {[
            { full: 'Domingo', short: 'Dom', mini: 'D' },
            { full: 'Segunda', short: 'Seg', mini: 'S' },
            { full: 'Terça', short: 'Ter', mini: 'T' },
            { full: 'Quarta', short: 'Qua', mini: 'Q' },
            { full: 'Quinta', short: 'Qui', mini: 'Q' },
            { full: 'Sexta', short: 'Sex', mini: 'S' },
            { full: 'Sábado', short: 'Sáb', mini: 'S' }
          ].map(w => (
            <div key={w.full} className="calendar-weekday">
              <span className="weekday-full">{w.full}</span>
              <span className="weekday-short">{w.short}</span>
              <span className="weekday-mini">{w.mini}</span>
            </div>
          ))}
          {calendarCells}
        </div>
      </div>

      {/* MODAL / POPOVER DO DIA SELECIONADO */}
      {selectedDayStr && (
        <>
          <div className="popover-backdrop" onClick={() => setSelectedDayStr(null)} />
          <div className="popover-day-modal pa-modal-card" style={{ maxWidth: '580px', margin: 'auto', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1001 }}>
            <div className="popover-header">
              <h3>
                <CalendarIcon size={18} color="#38bdf8" />
                Agendamentos para {selectedDayStr.split('-').reverse().join('/')}
              </h3>
              <button
                type="button"
                className="pa-modal-close"
                onClick={() => setSelectedDayStr(null)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Lista de pagamentos do dia */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {(itemsByDate[selectedDayStr] || []).length === 0 ? (
                <div style={{ padding: '1.5rem 1rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.88rem' }}>
                  Nenhum pagamento agendado para esta data.
                </div>
              ) : (
                (itemsByDate[selectedDayStr] || []).map((item, idx) => {
                  const req = item.req;
                  const isChecked = !!selectedReqIds[req.id];
                  return (
                    <div
                      key={`${req.id}-${idx}`}
                      className={`popover-item ${isChecked ? 'selected' : ''}`}
                      style={item.isPaused ? { borderColor: 'rgba(245, 158, 11, 0.5)', background: 'rgba(245, 158, 11, 0.08)' } : {}}
                    >
                      <div className="popover-item-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {req.status !== 'SOLICITACAO_CONCLUIDA' && !item.isPaused && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectReq(req.id)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                          )}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc' }}>
                                {req.fornecedor_nome || req.produto_servico}
                              </span>
                              {item.isParcela && (
                                <span style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  Parcela {item.numeroParcela}/{item.totalParcelas}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                              {req.produto_servico} • {req.departamento_centro_custo}
                            </div>
                            {item.isPaused && (
                              <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginTop: '2px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <PauseCircle size={12} /> DATA PAUSADA: {item.motivoPausa || req.motivo_pausa || 'Motivo não informado'}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: item.isPaused ? '#fbbf24' : (req.status === 'SOLICITACAO_CONCLUIDA' ? '#34d399' : '#38bdf8') }}>
                            {formatBrl(item.valorItem)}
                          </span>
                          <div>
                            <span
                              className={`pa-status-badge ${item.isPaused ? '' : (req.status === 'SOLICITACAO_CONCLUIDA' ? 'approved' : 'pending')}`}
                              style={item.isPaused ? { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.68rem', padding: '2px 6px' } : { fontSize: '0.68rem', padding: '2px 6px' }}
                            >
                              {item.isPaused ? 'PAGAMENTO PAUSADO' : (req.status === 'SOLICITACAO_CONCLUIDA' ? 'Concluída' : 'Aprovada')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="popover-actions">
                        <button
                          type="button"
                          className="pa-btn-detail"
                          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                          onClick={() => handleOpenDetailModal(req.id)}
                        >
                          <Eye size={13} /> Detalhes
                        </button>
                        {req.status !== 'SOLICITACAO_CONCLUIDA' && !item.isParcela && (
                          <button
                            type="button"
                            className="pa-btn-archive-master"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => handleUnscheduleRequest(req.id)}
                          >
                            <Trash2 size={13} /> Remover Data
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Ações do Dia */}
            <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '14px', position: 'relative' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <button
                  type="button"
                  className="pa-btn-detail"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px 14px', fontSize: '0.88rem' }}
                  onClick={() => setShowAddDropdown(!showAddDropdown)}
                >
                  <Plus size={16} /> Agendar Nova Conta
                </button>

                {showAddDropdown && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '110%',
                      left: 0,
                      width: '100%',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      zIndex: 1002,
                      boxShadow: '0 15px 30px rgba(0,0,0,0.6)'
                    }}
                  >
                    {unscheduledApprovedRequests.length === 0 ? (
                      <p style={{ padding: '14px', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', margin: 0, textAlign: 'center' }}>
                        Nenhuma requisição aprovada pendente de agendamento.
                      </p>
                    ) : (
                      unscheduledApprovedRequests.map(req => (
                        <div
                          key={req.id}
                          onClick={() => handleScheduleRequest(req.id)}
                          style={{
                            padding: '10px 14px',
                            borderBottom: '1px solid #1e293b',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
                            {req.fornecedor_nome || req.produto_servico}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                            <span>{req.produto_servico}</span>
                            <span style={{ color: '#34d399', fontWeight: 700 }}>
                              {formatBrl(req.valor * req.quantidade)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {Object.keys(selectedReqIds).some(id => selectedReqIds[id]) && (
                <button
                  type="button"
                  className="pa-btn-approve"
                  onClick={handleBatchConclude}
                  disabled={actionLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px' }}
                >
                  <CheckSquare size={16} /> Concluir ({Object.keys(selectedReqIds).filter(id => selectedReqIds[id]).length})
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* MODAL DE DETALHES COMPLETOS (AO CLICAR NO OLHO) */}
      {selectedRequestDetails && (
        <div className="pa-modal-overlay" style={{ zIndex: 2000 }} onClick={() => setSelectedRequestDetails(null)}>
          <div className="pa-modal-card" style={{ maxWidth: '780px', zIndex: 2001, position: 'relative' }} onClick={e => e.stopPropagation()}>
            <div className="pa-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <CreditCard size={20} color="#38bdf8" />
                <h3 style={{ margin: 0 }}>Detalhes da Solicitação: {selectedRequestDetails.id}</h3>
                <span
                  className={`pa-status-badge ${selectedRequestDetails.status === 'PAGAMENTO_PAUSADO' ? '' : (selectedRequestDetails.status === 'SOLICITACAO_CONCLUIDA' ? 'approved' : 'pending')}`}
                  style={selectedRequestDetails.status === 'PAGAMENTO_PAUSADO' ? { background: 'rgba(245, 158, 11, 0.2)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.4)' } : {}}
                >
                  {selectedRequestDetails.status === 'PAGAMENTO_PAUSADO' ? 'PAGAMENTO PAUSADO' : (selectedRequestDetails.status === 'SOLICITACAO_CONCLUIDA' ? 'Concluída' : 'Aprovada')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {selectedRequestDetails.status !== 'SOLICITACAO_CONCLUIDA' && selectedRequestDetails.status !== 'PAGO' && selectedRequestDetails.status !== 'PAGAMENTO_PAUSADO' && (
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
                      borderRadius: '8px',
                      fontWeight: 650
                    }}
                    title="Pausar Pagamento com justificativa obrigatória"
                  >
                    <PauseCircle size={14} /> Pausar Pagamento
                  </button>
                )}
                <button
                  type="button"
                  className="pa-modal-close"
                  onClick={() => setSelectedRequestDetails(null)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="pa-modal-body">
              {/* BANNER DE PAUSA */}
              {selectedRequestDetails.status === 'PAGAMENTO_PAUSADO' && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid #f59e0b',
                  borderRadius: '12px',
                  padding: '14px 18px',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '8px', borderRadius: '50%', color: '#f59e0b' }}>
                      <PauseCircle size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, color: '#fbbf24', fontSize: '0.92rem' }}>
                        PAGAMENTO PAUSADO
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: '2px' }}>
                        Pausado por <strong style={{ color: '#fbbf24' }}>{selectedRequestDetails.pausado_por_nome || 'Usuário'}</strong>: <em>"{selectedRequestDetails.motivo_pausa || 'Não informado'}"</em>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="pa-btn-approve"
                    onClick={handleResumePayment}
                    disabled={pauseLoading}
                    style={{
                      background: '#10b981',
                      color: '#0f172a',
                      fontWeight: 750,
                      padding: '8px 16px',
                      fontSize: '0.82rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    title="Retomar fluxo normal de pagamento"
                  >
                    {pauseLoading ? <RefreshCw size={14} className="pwc-spinner" /> : <PlayCircle size={14} />}
                    {pauseLoading ? 'Retomando...' : 'Retomar Pagamento'}
                  </button>
                </div>
              )}

              <div className="pa-req-details-grid">
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Solicitante</span>
                  <span className="pa-detail-val">{selectedRequestDetails.solicitante_nome} ({selectedRequestDetails.solicitante_email || 'Sem e-mail'})</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Centro de Custo</span>
                  <span className="pa-detail-val">{selectedRequestDetails.departamento_centro_custo || 'Não informado'}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Fornecedor / Prestador</span>
                  <span className="pa-detail-val">{selectedRequestDetails.fornecedor_nome || 'Não informado'}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Contato</span>
                  <span className="pa-detail-val">{selectedRequestDetails.fornecedor_contato || 'Não informado'}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Descrição / Produto</span>
                  <span className="pa-detail-val">{selectedRequestDetails.produto_servico}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Quantidade & Valor Unitário</span>
                  <span className="pa-detail-val">{selectedRequestDetails.quantidade}x • {formatBrl(selectedRequestDetails.valor)}</span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Forma de Pagamento</span>
                  <span className="pa-detail-val" style={{ color: '#60a5fa' }}>
                    {selectedRequestDetails.forma_pagamento}
                    {selectedRequestDetails.quantidade_parcelas > 1 ? ` (${selectedRequestDetails.quantidade_parcelas}x)` : ' (À vista)'}
                  </span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Empresa Pagadora</span>
                  <span className="pa-detail-val" style={{ color: '#a5b4fc', fontWeight: 600 }}>
                    {selectedRequestDetails.empresa_pagadora || 'INDIFERENTE'}
                  </span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Valor Total</span>
                  <span className="pa-detail-val" style={{ color: '#34d399', fontWeight: 800, fontSize: '1.1rem' }}>
                    {formatBrl(selectedRequestDetails.valor * selectedRequestDetails.quantidade)}
                  </span>
                </div>

                <div className="pa-detail-item">
                  <span className="pa-detail-label">Data de Criação</span>
                  <span className="pa-detail-val">{formatDate(selectedRequestDetails.created_at)}</span>
                </div>

                {/* Seletor de Data Programada com Botão Agendar / Reagendar */}
                <div className="pa-detail-item" style={{ gridColumn: 'span 2', background: 'rgba(56, 189, 248, 0.08)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span className="pa-detail-label" style={{ color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700 }}>
                      📅 Agendamento de Pagamento (Financeiro)
                    </span>
                    {selectedRequestDetails.data_pagamento && (
                      <span style={{ fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(251, 191, 36, 0.15)', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                        Agendado para: <strong>{selectedRequestDetails.data_pagamento.substring(0, 10).split('-').reverse().join('/')}</strong>
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
                      disabled={selectedRequestDetails.status === 'SOLICITACAO_CONCLUIDA' || scheduleLoading}
                    />

                    {/* Botão Agendar ou Reagendar */}
                    {selectedRequestDetails.data_pagamento ? (
                      <button
                        type="button"
                        onClick={() => handleSaveScheduleDate(scheduleInputDate)}
                        disabled={!scheduleInputDate || scheduleInputDate === selectedRequestDetails.data_pagamento.substring(0, 10) || scheduleLoading}
                        className="pa-btn-detail"
                        style={{
                          background: (scheduleInputDate && scheduleInputDate !== selectedRequestDetails.data_pagamento.substring(0, 10)) ? '#f59e0b' : 'rgba(255,255,255,0.08)',
                          color: (scheduleInputDate && scheduleInputDate !== selectedRequestDetails.data_pagamento.substring(0, 10)) ? '#0f172a' : '#64748b',
                          fontWeight: 750,
                          cursor: (scheduleInputDate && scheduleInputDate !== selectedRequestDetails.data_pagamento.substring(0, 10)) ? 'pointer' : 'not-allowed'
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
                    {selectedRequestDetails.data_pagamento && selectedRequestDetails.status !== 'SOLICITACAO_CONCLUIDA' && (
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
                    {selectedRequestDetails.data_pagamento
                      ? 'Escolha uma nova data acima e clique em "Reagendar Pagamento" para alterar a programação financeira.'
                      : 'Selecione a data no calendário e clique em "Agendar Pagamento" para confirmar.'}
                  </p>
                </div>

                {selectedRequestDetails.observacoes && (
                  <div className="pa-detail-item" style={{ gridColumn: 'span 2' }}>
                    <span className="pa-detail-label">Observações</span>
                    <span className="pa-detail-val" style={{ fontSize: '0.88rem', color: '#cbd5e1', whiteSpace: 'pre-wrap' }}>
                      {selectedRequestDetails.observacoes}
                    </span>
                  </div>
                )}
              </div>

              {/* --- ITENS DISCRIMINADOS DA SOLICITAÇÃO --- */}
              {selectedRequestDetails.itens && selectedRequestDetails.itens.length > 0 && (
                <div style={{ marginTop: '1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📦 Itens da Solicitação ({selectedRequestDetails.itens.length})
                  </h4>
                  <div className="pa-multi-items-modal-list">
                    {selectedRequestDetails.itens.map((it, idx) => (
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

              {/* Anexos */}
              <div className="pa-attachments-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Paperclip size={16} color="#38bdf8" /> Documentos Anexos ({attachments.length})
                  </h4>
                  <label className="pa-btn-detail" style={{ cursor: 'pointer', margin: 0, fontSize: '0.8rem' }}>
                    <Paperclip size={14} /> Anexar Arquivo
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>

                {uploadError && <div style={{ color: '#ef4444', fontSize: '0.82rem', marginBottom: '8px' }}>{uploadError}</div>}
                {uploading && <div style={{ color: '#38bdf8', fontSize: '0.82rem', marginBottom: '8px' }}>Enviando...</div>}

                {attachments.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic', padding: '8px 0' }}>
                    Nenhum documento anexado.
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
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>{att.nome_arquivo}</span>
                            <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                              {(att.tamanho_bytes / 1024).toFixed(1)} KB • Enviado por {att.enviado_por_nome}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="pa-btn-detail"
                            onClick={() => handleDownloadAttachment(att.id, att.nome_arquivo)}
                          >
                            <Download size={14} /> Baixar
                          </button>
                          {(att.enviado_por_id === user?.id || isMaster) && (
                            <button
                              type="button"
                              className="pa-btn-archive-master"
                              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              onClick={() => handleDeleteAttachment(att.id)}
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

              {/* Conclusão Individual */}
              {selectedRequestDetails.status !== 'SOLICITACAO_CONCLUIDA' && (
                <div className="pa-actions-bar">
                  <div className="pa-form-group">
                    <label>Observações da Conclusão (Opcional)</label>
                    <textarea
                      className="pa-textarea"
                      placeholder="Adicione observações sobre a liquidação deste pagamento..."
                      value={actionObservation}
                      onChange={e => setActionObservation(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button
                      type="button"
                      className="pa-btn-approve"
                      onClick={handleConcludeSingle}
                      disabled={actionLoading}
                    >
                      <CheckSquare size={16} /> Marcar como Concluída
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE PAUSAR PAGAMENTO */}
      {isPauseModalOpen && selectedRequestDetails && (
        <div className="pa-modal-overlay" style={{ zIndex: 2050 }} onClick={() => setIsPauseModalOpen(false)}>
          <div className="pa-modal-card" style={{ maxWidth: '520px', zIndex: 2051 }} onClick={e => e.stopPropagation()}>
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
                Ao pausar o pagamento da solicitação <strong style={{ color: '#38bdf8' }}>{selectedRequestDetails.id}</strong>, o status passará para <strong style={{ color: '#fbbf24' }}>PAGAMENTO PAUSADO</strong> e todas as parcelas e datas posteriores ficarão destacadas como pausadas no calendário.
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
                  autoFocus
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
    </div>
  );
};

export default FinancePaymentCalendar;
