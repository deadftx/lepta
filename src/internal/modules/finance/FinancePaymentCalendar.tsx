import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2,
  CheckSquare, X, Eye, Download, Paperclip, RefreshCw, CreditCard
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
  status: 'PENDENTE' | 'REABERTO' | 'AGUARDANDO_RESPOSTA_SOLICITANTE' | 'AGUARDANDO_RESPOSTA_APROVADOR' | 'APROVADO' | 'NEGADO' | 'SOLICITACAO_CONCLUIDA' | 'PAGO' | 'REVISAO';
  arquivado?: number;
  data_pagamento?: string | null;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email: string;
  aprovador_nome: string | null;
  motivo_decisao: string | null;
  decidido_em: string | null;
  created_at: string;
  updated_at: string;
}

interface Attachment {
  id: string;
  nome_arquivo: string;
  tamanho_bytes: number;
  enviado_por_id: string;
  enviado_por_nome: string;
  created_at: string;
}

const FinancePaymentCalendar: React.FC = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  // Navigation
  const [currentDate, setCurrentDate] = useState(new Date());

  // Data
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Day Details Modal
  const [selectedDayStr, setSelectedDayStr] = useState<string | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number; y: number } | null>(null);

  // Action states
  const [selectedRequestDetails, setSelectedRequestDetails] = useState<any | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [actionObservation, setActionObservation] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Dropdown options for adding payment
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  // Batch Selection for conclusion
  const [selectedReqIds, setSelectedReqIds] = useState<Record<string, boolean>>({});

  const showToast = (msg: string) => {
    alert(msg); // simple browser feedback
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
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

  // Group requests by scheduled date: YYYY-MM-DD
  const requestsByDate = useMemo(() => {
    const map: Record<string, PurchaseRequest[]> = {};
    requests.forEach(req => {
      if (req.data_pagamento) {
        const dateStr = req.data_pagamento.substring(0, 10);
        if (!map[dateStr]) map[dateStr] = [];
        map[dateStr].push(req);
      }
    });
    return map;
  }, [requests]);

  // Approved requests available for scheduling
  const unscheduledApprovedRequests = useMemo(() => {
    return requests.filter(req => req.status === 'APROVADO' && !req.data_pagamento);
  }, [requests]);

  const handleDayClick = (day: number, e: React.MouseEvent) => {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    const dayStr = `${year}-${formattedMonth}-${formattedDay}`;

    setSelectedDayStr(dayStr);
    setSelectedReqIds({});
    setShowAddDropdown(false);

    // Calculate click coordinates for dynamic positioning close to pointer
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;

    // Respect screen boundaries (keeps modal in viewport)
    const modalWidth = 460;
    const posX = x + modalWidth > window.innerWidth ? window.innerWidth - modalWidth - 20 : x;
    const posY = y + 300 > window.innerHeight + window.scrollY ? window.innerHeight + window.scrollY - 320 : y;

    setModalPosition({ x: Math.max(10, posX), y: Math.max(10, posY) });
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
        await fetchData();
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
        await fetchData();
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
          body: JSON.stringify({ observacoes: 'Conclusão em lote via Calendário' })
        });
        if (res.ok) {
          successCount++;
        }
      }
      showToast(`${successCount} de ${idsToConclude.length} solicitações concluídas com sucesso!`);
      setSelectedReqIds({});
      await fetchData();
    } catch (err) {
      console.error(err);
      alert('Erro no processo de conclusão.');
    } finally {
      setActionLoading(false);
    }
  };

  // Detail Modal popup helpers
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
        await fetchAttachments(reqId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
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

      showToast('Anexo adicionado!');
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
        await fetchData();
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

  // Toggle selection for conclusion
  const toggleSelectReq = (reqId: string) => {
    setSelectedReqIds(prev => ({
      ...prev,
      [reqId]: !prev[reqId]
    }));
  };

  // Render elements in calendar
  const calendarCells = [];
  // Empty spaces for previous month alignment
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }

  // Days in current month
  for (let day = 1; day <= daysInMonth; day++) {
    const formattedDay = String(day).padStart(2, '0');
    const formattedMonth = String(month + 1).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
    const dayReqs = requestsByDate[dateStr] || [];

    const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

    const totalValue = dayReqs.reduce((sum, r) => sum + (r.valor * r.quantidade), 0);

    calendarCells.push(
      <div
        key={`day-${day}`}
        className={`calendar-day ${isToday ? 'today' : ''} ${dayReqs.length > 0 ? 'has-events' : ''}`}
        onClick={(e) => handleDayClick(day, e)}
      >
        <span className="day-number">{day}</span>
        {dayReqs.length > 0 && (
          <div className="day-events">
            <span className="event-count">{dayReqs.length} agendado(s)</span>
            <span className="event-total">
              {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            </span>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pa-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <RefreshCw className="animate-spin" size={32} style={{ color: '#38bdf8' }} />
      </div>
    );
  }

  return (
    <div className="pa-container">
      <header className="pa-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="pa-header-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="pa-title">Calendário de Pagamentos</h1>
            <p className="pa-subtitle">Agende, remova e conclua solicitações de reembolsos e despesas de forma visual</p>
          </div>
        </div>
      </header>

      {/* Control Header */}
      <div className="pa-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '16px 24px' }}>
        <button className="pa-btn-action-view" onClick={handlePrevMonth} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ChevronLeft size={16} /> Anterior
        </button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
          {monthNames[month]} {year}
        </h2>
        <button className="pa-btn-action-view" onClick={handleNextMonth} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          Próximo <ChevronRight size={16} />
        </button>
      </div>

      {/* Calendar Grid Container */}
      <div className="pa-card" style={{ padding: '20px' }}>
        <div className="calendar-grid">
          {/* Weekday headers */}
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(w => (
            <div key={w} className="calendar-weekday">{w}</div>
          ))}
          {calendarCells}
        </div>
      </div>

      {/* Floating Day Actions Modal */}
      {selectedDayStr && modalPosition && (
        <>
          <div className="pa-modal-backdrop" onClick={() => setSelectedDayStr(null)} style={{ background: 'rgba(0,0,0,0.2)' }} />
          <div
            className="pa-card popover-day-modal"
            style={{
              position: 'absolute',
              top: `${modalPosition.y}px`,
              left: `${modalPosition.x}px`,
              width: '440px',
              zIndex: 999,
              border: '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#f8fafc' }}>
                Agendamentos em {selectedDayStr.split('-').reverse().join('/')}
              </h3>
              <button onClick={() => setSelectedDayStr(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            {/* List of payments scheduled on this date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
              {(requestsByDate[selectedDayStr] || []).length === 0 ? (
                <p style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem', margin: '8px 0' }}>Nenhum pagamento agendado para esta data.</p>
              ) : (
                (requestsByDate[selectedDayStr] || []).map(req => {
                  const isChecked = !!selectedReqIds[req.id];
                  return (
                    <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px' }}>
                      {req.status !== 'SOLICITACAO_CONCLUIDA' && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectReq(req.id)}
                          style={{ cursor: 'pointer' }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {req.fornecedor_nome}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: req.status === 'SOLICITACAO_CONCLUIDA' ? '#34d399' : '#f8fafc' }}>
                            {(req.valor * req.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{req.produto_servico}</span>
                          <span className={`pa-status-badge ${req.status === 'SOLICITACAO_CONCLUIDA' ? 'approved' : 'pending'}`} style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                            {req.status === 'SOLICITACAO_CONCLUIDA' ? 'Concluída' : 'Aprovada'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button onClick={() => handleOpenDetailModal(req.id)} style={{ background: 'none', border: 'none', color: '#38bdf8', padding: '4px', cursor: 'pointer' }} title="Detalhar pagamento">
                          <Eye size={14} />
                        </button>
                        {req.status !== 'SOLICITACAO_CONCLUIDA' && (
                          <button onClick={() => handleUnscheduleRequest(req.id)} style={{ background: 'none', border: 'none', color: '#ef4444', padding: '4px', cursor: 'pointer' }} title="Excluir agendamento">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Actions for this day */}
            <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <button
                  type="button"
                  className="pa-btn-action-view"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px 12px' }}
                  onClick={() => setShowAddDropdown(!showAddDropdown)}
                >
                  <Plus size={14} /> Agendar Novo
                </button>

                {showAddDropdown && (
                  <div className="dropdown-payment-select" style={{ position: 'absolute', bottom: '105%', left: 0, width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', zIndex: 1001, boxShadow: '0 8px 16px rgba(0,0,0,0.5)' }}>
                    {unscheduledApprovedRequests.length === 0 ? (
                      <p style={{ padding: '12px', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', margin: 0 }}>Nenhuma requisição aprovada pendente de agendamento.</p>
                    ) : (
                      unscheduledApprovedRequests.map(req => (
                        <div
                          key={req.id}
                          className="dropdown-item-req"
                          onClick={() => handleScheduleRequest(req.id)}
                          style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                        >
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc' }}>{req.fornecedor_nome}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#64748b' }}>
                            <span>{req.produto_servico}</span>
                            <span style={{ color: '#38bdf8' }}>{(req.valor * req.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
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
                  className="pa-btn-action-approve"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px' }}
                  onClick={handleBatchConclude}
                  disabled={actionLoading}
                >
                  <CheckSquare size={14} /> Concluir
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* detailed view modal */}
      {selectedRequestDetails && (
        <div className="pa-modal-overlay">
          <div className="pa-modal-card" style={{ maxWidth: '680px' }}>
            <div className="pa-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CreditCard size={18} style={{ color: '#38bdf8' }} />
                <h3 className="pa-modal-title">Solicitação Nº {selectedRequestDetails.numero}</h3>
              </div>
              <button className="pa-modal-close" onClick={() => setSelectedRequestDetails(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="pa-modal-body" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <div className="pa-req-details-grid">
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Fornecedor / Prestador</span>
                  <span className="pa-detail-val">{selectedRequestDetails.fornecedor_nome || '-'}</span>
                </div>
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Contato</span>
                  <span className="pa-detail-val">{selectedRequestDetails.fornecedor_contato || '-'}</span>
                </div>
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Forma de Pagamento</span>
                  <span className="pa-detail-val">{selectedRequestDetails.forma_pagamento} ({selectedRequestDetails.quantidade_parcelas}x)</span>
                </div>
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Centro de Custo</span>
                  <span className="pa-detail-val">{selectedRequestDetails.departamento_centro_custo || '-'}</span>
                </div>
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Produto / Serviço</span>
                  <span className="pa-detail-val">{selectedRequestDetails.produto_servico}</span>
                </div>
                <div className="pa-detail-item">
                  <span className="pa-detail-label">Valor Total</span>
                  <span className="pa-detail-val" style={{ color: '#34d399', fontWeight: 700 }}>
                    {(selectedRequestDetails.valor * selectedRequestDetails.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <div className="pa-detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="pa-detail-label">Observações</span>
                  <span className="pa-detail-val" style={{ fontWeight: 400 }}>{selectedRequestDetails.observacoes || 'Nenhuma.'}</span>
                </div>
              </div>

              {/* Anexos */}
              <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Paperclip size={14} /> Documentos Anexos
                  </h4>
                  <label className="pa-btn-action-view" style={{ cursor: 'pointer', margin: 0, padding: '2px 6px', fontSize: '0.7rem' }}>
                    Anexar Arquivo
                    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
                  </label>
                </div>
                {uploadError && <div style={{ color: '#ef4444', fontSize: '0.7rem', marginBottom: '6px' }}>{uploadError}</div>}
                {uploading && <div style={{ color: '#38bdf8', fontSize: '0.7rem', marginBottom: '6px' }}>Enviando...</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {attachments.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>Nenhum anexo disponível.</span>
                  ) : (
                    attachments.map(att => (
                      <div key={att.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>{att.nome_arquivo}</span>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleDownloadAttachment(att.id, att.nome_arquivo)} style={{ background: 'none', border: 'none', color: '#38bdf8', cursor: 'pointer' }}><Download size={12} /></button>
                          {(att.enviado_por_id === user?.id || isMaster) && (
                            <button onClick={() => handleDeleteAttachment(att.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {selectedRequestDetails.status !== 'SOLICITACAO_CONCLUIDA' && (
                <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '15px' }}>
                  <textarea
                    className="pa-textarea"
                    placeholder="Adicione observações de pagamento (opcional)..."
                    value={actionObservation}
                    onChange={e => setActionObservation(e.target.value)}
                    style={{ fontSize: '0.8rem', minHeight: '50px' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                    <button className="pa-btn-action-approve" onClick={handleConcludeSingle} disabled={actionLoading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckSquare size={14} /> Concluir Solicitação
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancePaymentCalendar;
