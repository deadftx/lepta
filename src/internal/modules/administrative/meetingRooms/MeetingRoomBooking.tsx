import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, Users, Building, Plus,
  CalendarCheck, AlertCircle, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, RefreshCw, User, FileText,
  Briefcase, Globe, X, Info
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import { useAuth } from '../../../core/AuthContext';
import './MeetingRoomBooking.css';

export interface AgendamentoSala {
  id: string;
  titulo: string;
  data: string; // YYYY-MM-DD
  horario_inicio: string; // HH:MM
  horario_fim: string; // HH:MM
  sala: 'Sala da Diretoria' | 'Sala 1';
  tipo_reuniao: 'Interna' | 'Externa';
  empresa?: string;
  participantes?: string;
  observacoes?: string;
  solicitante_id: string;
  solicitante_nome: string;
  solicitante_email?: string;
  status: 'CONFIRMADO' | 'CANCELADO';
  cancelado_por?: string;
  motivo_cancelamento?: string;
  created_at: string;
  updated_at: string;
}

export interface StatsSalas {
  reunioesHoje: number;
  totalMes: number;
  salaDiretoriaFuturas: number;
  sala1Futuras: number;
  today: string;
  currentMonth: string;
}

export default function MeetingRoomBooking() {
  const { user } = useAuth();

  // Estados principais
  const [agendamentos, setAgendamentos] = useState<AgendamentoSala[]>([]);
  const [stats, setStats] = useState<StatsSalas | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filtros de visualização
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'AGENDA'>('CALENDAR');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterSala, setFilterSala] = useState<string>('TODAS');
  const [filterTipo, setFilterTipo] = useState<string>('TODOS');
  const [filterMinhas, setFilterMinhas] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<AgendamentoSala | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Formulário de novo agendamento
  const [formSala, setFormSala] = useState<'Sala da Diretoria' | 'Sala 1'>('Sala da Diretoria');
  const [formData, setFormData] = useState(() => new Date().toISOString().split('T')[0]);
  const [formHorarioInicio, setFormHorarioInicio] = useState('09:00');
  const [formHorarioFim, setFormHorarioFim] = useState('10:00');
  const [formTipo, setFormTipo] = useState<'Interna' | 'Externa'>('Interna');
  const [formTitulo, setFormTitulo] = useState('');
  const [formEmpresa, setFormEmpresa] = useState('');
  const [formParticipantes, setFormParticipantes] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Checagem em tempo real de disponibilidade
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<any | null>(null);

  // Carrega agendamentos da API
  const fetchAgendamentos = useCallback(async () => {
    try {
      setRefreshing(true);
      setError('');

      const params = new URLSearchParams();
      if (selectedMonth) params.append('mes', selectedMonth);
      if (filterSala !== 'TODAS') params.append('sala', filterSala);
      if (filterTipo !== 'TODOS') params.append('tipo_reuniao', filterTipo);
      if (filterMinhas) params.append('apenas_minhas', 'true');

      const [resAgendamentos, resStats] = await Promise.all([
        fetch(`${API_BASE_URL}/api/administrative/meeting-rooms?${params.toString()}`, {
          headers: getAuthHeaders()
        }),
        fetch(`${API_BASE_URL}/api/administrative/meeting-rooms/stats`, {
          headers: getAuthHeaders()
        })
      ]);

      if (!resAgendamentos.ok) throw new Error('Falha ao carregar agendamentos.');
      const dataAgendamentos = await resAgendamentos.json();
      setAgendamentos(dataAgendamentos);

      if (resStats.ok) {
        const dataStats = await resStats.json();
        setStats(dataStats);
      }
    } catch (err: any) {
      console.error('Erro ao buscar dados das salas:', err);
      setError(err?.message || 'Erro ao carregar agendamentos.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedMonth, filterSala, filterTipo, filterMinhas]);

  useEffect(() => {
    fetchAgendamentos();
  }, [fetchAgendamentos]);

  // Checagem de disponibilidade em tempo real no formulário
  useEffect(() => {
    if (!isModalOpen || !formData || !formHorarioInicio || !formHorarioFim || !formSala) {
      setConflictInfo(null);
      return;
    }

    if (formHorarioInicio >= formHorarioFim) {
      setConflictInfo(null);
      return;
    }

    let isSubscribed = true;
    const checkAvailability = async () => {
      setCheckingAvailability(true);
      try {
        const params = new URLSearchParams({
          sala: formSala,
          data: formData,
          horario_inicio: formHorarioInicio,
          horario_fim: formHorarioFim
        });

        const res = await fetch(`${API_BASE_URL}/api/administrative/meeting-rooms/check-availability?${params.toString()}`, {
          headers: getAuthHeaders()
        });

        if (res.ok && isSubscribed) {
          const data = await res.json();
          if (!data.available && data.conflict) {
            setConflictInfo(data.conflict);
          } else {
            setConflictInfo(null);
          }
        }
      } catch (err) {
        console.warn('Erro ao checar conflito:', err);
      } finally {
        if (isSubscribed) setCheckingAvailability(false);
      }
    };

    const timeout = setTimeout(checkAvailability, 300);
    return () => {
      isSubscribed = false;
      clearTimeout(timeout);
    };
  }, [isModalOpen, formSala, formData, formHorarioInicio, formHorarioFim]);

  // Criação de novo agendamento
  const handleCreateAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formTitulo.trim()) {
      setFormError('Por favor, informe o título/assunto da reunião.');
      return;
    }
    if (!formData) {
      setFormError('Por favor, selecione a data.');
      return;
    }
    if (!formHorarioInicio || !formHorarioFim) {
      setFormError('Por favor, informe o horário de início e fim.');
      return;
    }
    if (formHorarioInicio >= formHorarioFim) {
      setFormError('O horário de término deve ser posterior ao horário de início.');
      return;
    }
    if (formTipo === 'Externa' && !formEmpresa.trim()) {
      setFormError('Para reuniões externas, informe o nome da empresa.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/administrative/meeting-rooms`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          titulo: formTitulo.trim(),
          data: formData,
          horario_inicio: formHorarioInicio,
          horario_fim: formHorarioFim,
          sala: formSala,
          tipo_reuniao: formTipo,
          empresa: formEmpresa.trim(),
          participantes: formParticipantes.trim(),
          observacoes: formObservacoes.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao agendar sala de reunião.');
      }

      setIsModalOpen(false);
      setSuccessMsg(`Reunião agendada com sucesso na ${formSala}!`);
      setTimeout(() => setSuccessMsg(''), 4000);

      // Limpa formulário
      setFormTitulo('');
      setFormEmpresa('');
      setFormParticipantes('');
      setFormObservacoes('');
      setConflictInfo(null);

      // Atualiza lista
      fetchAgendamentos();
    } catch (err: any) {
      setFormError(err?.message || 'Não foi possível agendar a reunião.');
    } finally {
      setSubmitting(false);
    }
  };

  // Cancelamento de agendamento
  const handleCancelAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgendamento) return;

    setSubmittingCancel(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/administrative/meeting-rooms/${selectedAgendamento.id}/cancel`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo: cancelMotivo.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cancelar agendamento.');
      }

      setIsCancelModalOpen(false);
      setIsDetailModalOpen(false);
      setSelectedAgendamento(null);
      setCancelMotivo('');
      setSuccessMsg('Agendamento cancelado com sucesso.');
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchAgendamentos();
    } catch (err: any) {
      alert(err?.message || 'Erro ao cancelar agendamento.');
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Navegação de mês
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(year, month - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(year, month, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleCurrentMonth = () => {
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setSelectedDay(d.toISOString().split('T')[0]);
  };

  // Formatação do nome do mês atual
  const formattedMonthName = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // Geração dos dias do calendário mensal
  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const firstDayIndex = new Date(year, month - 1, 1).getDay(); // 0 = Domingo
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    const days = [];

    // Dias do mês anterior para preencher a primeira semana
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevM = month - 1 === 0 ? 12 : month - 1;
      const prevY = month - 1 === 0 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      days.push({ dayNumber: dayNum, dateStr, isCurrentMonth: false });
    }

    // Dias do mês atual
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dayNumber: i, dateStr, isCurrentMonth: true });
    }

    // Dias do próximo mês para fechar a grade (múltiplo de 7)
    const remainingDays = 42 - days.length; // Grade padrão de 6 linhas
    for (let i = 1; i <= remainingDays; i++) {
      const nextM = month + 1 === 13 ? 1 : month + 1;
      const nextY = month + 1 === 13 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ dayNumber: i, dateStr, isCurrentMonth: false });
    }

    return days;
  }, [selectedMonth]);

  // Agrupa reuniões por dia para renderização rápida no calendário
  const agendamentosPorDia = useMemo(() => {
    const map = new Map<string, AgendamentoSala[]>();
    agendamentos.forEach(item => {
      if (item.status === 'CANCELADO') return;
      const list = map.get(item.data) || [];
      list.push(item);
      map.set(item.data, list);
    });
    return map;
  }, [agendamentos]);

  // Lista filtrada para a visualização de Agenda / Linha do Tempo
  const agendaList = useMemo(() => {
    let list = [...agendamentos];
    if (selectedDay) {
      list = list.filter(item => item.data === selectedDay);
    }
    return list.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.horario_inicio.localeCompare(b.horario_inicio);
    });
  }, [agendamentos, selectedDay]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="meeting-rooms-container">
      {/* Header */}
      <div className="mr-header">
        <div className="mr-header-left">
          <div className="mr-icon-badge">
            <CalendarCheck size={28} />
          </div>
          <div>
            <h1>Agendar Sala de Reunião</h1>
            <p>Controle de reservas e disponibilidade das salas da Lepta</p>
          </div>
        </div>
        <div className="mr-header-actions">
          <button 
            className="mr-btn-secondary" 
            onClick={fetchAgendamentos} 
            disabled={refreshing}
            title="Atualizar dados"
          >
            <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
            Atualizar
          </button>
          <button 
            className="mr-btn-primary"
            onClick={() => {
              setFormData(selectedDay || todayStr);
              setFormError('');
              setIsModalOpen(true);
            }}
          >
            <Plus size={18} />
            Novo Agendamento
          </button>
        </div>
      </div>

      {/* Alertas */}
      {successMsg && (
        <div className="mr-alert mr-alert-success">
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="mr-alert mr-alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="mr-stats-grid">
        <div className="mr-stat-card">
          <div className="mr-stat-icon icon-blue">
            <Calendar size={22} />
          </div>
          <div className="mr-stat-info">
            <span className="mr-stat-label">Reuniões Hoje</span>
            <span className="mr-stat-value">{stats?.reunioesHoje ?? 0}</span>
          </div>
        </div>

        <div className="mr-stat-card">
          <div className="mr-stat-icon icon-emerald">
            <CalendarCheck size={22} />
          </div>
          <div className="mr-stat-info">
            <span className="mr-stat-label">Total no Mês</span>
            <span className="mr-stat-value">{stats?.totalMes ?? 0}</span>
          </div>
        </div>

        <div className="mr-stat-card">
          <div className="mr-stat-icon icon-purple">
            <Briefcase size={22} />
          </div>
          <div className="mr-stat-info">
            <span className="mr-stat-label">Sala da Diretoria</span>
            <span className="mr-stat-value">{stats?.salaDiretoriaFuturas ?? 0}</span>
            <span className="mr-stat-sub">agendamentos futuros</span>
          </div>
        </div>

        <div className="mr-stat-card">
          <div className="mr-stat-icon icon-indigo">
            <Users size={22} />
          </div>
          <div className="mr-stat-info">
            <span className="mr-stat-label">Sala 1</span>
            <span className="mr-stat-value">{stats?.sala1Futuras ?? 0}</span>
            <span className="mr-stat-sub">agendamentos futuros</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Controles */}
      <div className="mr-controls-card">
        <div className="mr-controls-left">
          {/* Navegação de Mês */}
          <div className="mr-month-nav">
            <button className="mr-nav-btn" onClick={handlePrevMonth} title="Mês anterior">
              <ChevronLeft size={18} />
            </button>
            <span className="mr-month-title">{formattedMonthName}</span>
            <button className="mr-nav-btn" onClick={handleNextMonth} title="Próximo mês">
              <ChevronRight size={18} />
            </button>
            <button className="mr-btn-today" onClick={handleCurrentMonth}>
              Hoje
            </button>
          </div>

          {/* Filtro por Sala */}
          <div className="mr-filter-group">
            <button
              className={`mr-filter-pill ${filterSala === 'TODAS' ? 'active' : ''}`}
              onClick={() => setFilterSala('TODAS')}
            >
              Todas as Salas
            </button>
            <button
              className={`mr-filter-pill pill-purple ${filterSala === 'Sala da Diretoria' ? 'active' : ''}`}
              onClick={() => setFilterSala('Sala da Diretoria')}
            >
              <Briefcase size={14} /> Sala da Diretoria
            </button>
            <button
              className={`mr-filter-pill pill-blue ${filterSala === 'Sala 1' ? 'active' : ''}`}
              onClick={() => setFilterSala('Sala 1')}
            >
              <Users size={14} /> Sala 1
            </button>
          </div>

          {/* Filtro por Tipo */}
          <div className="mr-filter-group">
            <button
              className={`mr-filter-pill ${filterTipo === 'TODOS' ? 'active' : ''}`}
              onClick={() => setFilterTipo('TODOS')}
            >
              Todos os Tipos
            </button>
            <button
              className={`mr-filter-pill pill-green ${filterTipo === 'Interna' ? 'active' : ''}`}
              onClick={() => setFilterTipo('Interna')}
            >
              <Building size={14} /> Interna
            </button>
            <button
              className={`mr-filter-pill pill-amber ${filterTipo === 'Externa' ? 'active' : ''}`}
              onClick={() => setFilterTipo('Externa')}
            >
              <Globe size={14} /> Externa
            </button>
          </div>

          {/* Checkbox Apenas Minhas */}
          <label className="mr-checkbox-label">
            <input
              type="checkbox"
              checked={filterMinhas}
              onChange={e => setFilterMinhas(e.target.checked)}
            />
            <span>Apenas minhas</span>
          </label>
        </div>

        {/* Alternância de Modo (Calendário vs Agenda) */}
        <div className="mr-view-toggle">
          <button
            className={`mr-toggle-btn ${viewMode === 'CALENDAR' ? 'active' : ''}`}
            onClick={() => setViewMode('CALENDAR')}
          >
            <Calendar size={16} />
            Grade Calendário
          </button>
          <button
            className={`mr-toggle-btn ${viewMode === 'AGENDA' ? 'active' : ''}`}
            onClick={() => setViewMode('AGENDA')}
          >
            <Clock size={16} />
            Lista Agenda
          </button>
        </div>
      </div>

      {/* Corpo Principal: Calendário ou Agenda */}
      {loading ? (
        <div className="mr-loading-card">
          <RefreshCw size={32} className="spin mr-spinner" />
          <p>Carregando agenda de salas...</p>
        </div>
      ) : viewMode === 'CALENDAR' ? (
        <div className="mr-calendar-wrapper">
          {/* Cabeçalho dos dias da semana */}
          <div className="mr-weekdays-header">
            {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(d => (
              <div key={d} className="mr-weekday-cell">{d}</div>
            ))}
          </div>

          {/* Grade de dias */}
          <div className="mr-days-grid">
            {calendarDays.map((day, idx) => {
              const dayMeetings = agendamentosPorDia.get(day.dateStr) || [];
              const isToday = day.dateStr === todayStr;
              const isSelected = day.dateStr === selectedDay;

              return (
                <div
                  key={idx}
                  className={`mr-day-cell ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => {
                    setSelectedDay(day.dateStr);
                  }}
                >
                  <div className="mr-day-top">
                    <span className="mr-day-num">{day.dayNumber}</span>
                    {isToday && <span className="mr-today-tag">Hoje</span>}
                    <button
                      className="mr-day-add-btn"
                      title="Agendar neste dia"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFormData(day.dateStr);
                        setIsModalOpen(true);
                      }}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  {/* Badges de reuniões no dia */}
                  <div className="mr-day-meetings">
                    {dayMeetings.slice(0, 3).map(m => (
                      <div
                        key={m.id}
                        className={`mr-meeting-badge ${m.sala === 'Sala da Diretoria' ? 'badge-diretoria' : 'badge-sala1'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAgendamento(m);
                          setIsDetailModalOpen(true);
                        }}
                        title={`${m.sala} (${m.horario_inicio} - ${m.horario_fim}): ${m.titulo} - Solicitante: ${m.solicitante_nome}`}
                      >
                        <span className="mr-badge-time">{m.horario_inicio}</span>
                        <span className="mr-badge-title">{m.titulo}</span>
                      </div>
                    ))}
                    {dayMeetings.length > 3 && (
                      <div className="mr-meeting-more">
                        +{dayMeetings.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Painel inferior: Detalhes do Dia Selecionado */}
          {selectedDay && (
            <div className="mr-selected-day-panel">
              <div className="mr-sd-header">
                <div>
                  <h3>
                    Reuniões para {new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </h3>
                  <p>{agendamentosPorDia.get(selectedDay)?.length || 0} agendamento(s) confirmado(s)</p>
                </div>
                <button
                  className="mr-btn-primary mr-btn-sm"
                  onClick={() => {
                    setFormData(selectedDay);
                    setIsModalOpen(true);
                  }}
                >
                  <Plus size={16} /> Agendar neste dia
                </button>
              </div>

              {(!agendamentosPorDia.get(selectedDay) || agendamentosPorDia.get(selectedDay)!.length === 0) ? (
                <div className="mr-empty-day">
                  <Calendar size={32} />
                  <p>Nenhuma reunião agendada para esta data. Salas livres para agendamento!</p>
                </div>
              ) : (
                <div className="mr-day-cards-grid">
                  {agendamentosPorDia.get(selectedDay)!.map(m => (
                    <div 
                      key={m.id} 
                      className={`mr-card-item ${m.sala === 'Sala da Diretoria' ? 'card-diretoria' : 'card-sala1'}`}
                      onClick={() => {
                        setSelectedAgendamento(m);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      <div className="mr-card-top">
                        <span className={`mr-room-pill ${m.sala === 'Sala da Diretoria' ? 'pill-purple' : 'pill-blue'}`}>
                          {m.sala === 'Sala da Diretoria' ? <Briefcase size={13} /> : <Users size={13} />}
                          {m.sala}
                        </span>
                        <span className={`mr-type-pill ${m.tipo_reuniao === 'Interna' ? 'pill-green' : 'pill-amber'}`}>
                          {m.tipo_reuniao === 'Interna' ? <Building size={13} /> : <Globe size={13} />}
                          {m.tipo_reuniao}
                        </span>
                      </div>

                      <h4 className="mr-card-title">{m.titulo}</h4>

                      <div className="mr-card-details">
                        <div className="mr-detail-row">
                          <Clock size={14} />
                          <span>{m.horario_inicio} às {m.horario_fim}</span>
                        </div>
                        {m.empresa && (
                          <div className="mr-detail-row">
                            <Building size={14} />
                            <span>Empresa: <strong>{m.empresa}</strong></span>
                          </div>
                        )}
                        <div className="mr-detail-row">
                          <User size={14} />
                          <span>Solicitante: <strong>{m.solicitante_nome}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Visualização em Lista / Linha do Tempo */
        <div className="mr-agenda-wrapper">
          <div className="mr-agenda-header">
            <h3>Linha do Tempo de Agendamentos</h3>
            {selectedDay && (
              <button className="mr-btn-clear-filter" onClick={() => setSelectedDay(null)}>
                Limpar filtro de dia ({selectedDay})
              </button>
            )}
          </div>

          {agendaList.length === 0 ? (
            <div className="mr-empty-card">
              <Calendar size={48} />
              <h4>Nenhum agendamento encontrado</h4>
              <p>Nenhuma reunião encontrada para os filtros selecionados.</p>
              <button 
                className="mr-btn-primary"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus size={16} /> Criar Primeiro Agendamento
              </button>
            </div>
          ) : (
            <div className="mr-timeline-list">
              {agendaList.map(m => {
                const isPast = m.data < todayStr;
                const isOwner = user?.id === m.solicitante_id || user?.role === 'MASTER';

                return (
                  <div key={m.id} className={`mr-timeline-card ${m.sala === 'Sala da Diretoria' ? 'border-purple' : 'border-blue'}`}>
                    <div className="mr-tl-left">
                      <div className="mr-tl-date">
                        <span className="mr-tl-day">{new Date(m.data + 'T00:00:00').getDate()}</span>
                        <span className="mr-tl-month">{new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}</span>
                      </div>
                      <div className="mr-tl-time">
                        <Clock size={14} />
                        <span>{m.horario_inicio} - {m.horario_fim}</span>
                      </div>
                    </div>

                    <div className="mr-tl-body">
                      <div className="mr-tl-pills">
                        <span className={`mr-room-pill ${m.sala === 'Sala da Diretoria' ? 'pill-purple' : 'pill-blue'}`}>
                          {m.sala === 'Sala da Diretoria' ? <Briefcase size={13} /> : <Users size={13} />}
                          {m.sala}
                        </span>
                        <span className={`mr-type-pill ${m.tipo_reuniao === 'Interna' ? 'pill-green' : 'pill-amber'}`}>
                          {m.tipo_reuniao === 'Interna' ? <Building size={13} /> : <Globe size={13} />}
                          Reunião {m.tipo_reuniao}
                        </span>
                        {m.empresa && (
                          <span className="mr-company-pill">
                            <Building size={13} /> {m.empresa}
                          </span>
                        )}
                      </div>

                      <h4 className="mr-tl-title">{m.titulo}</h4>

                      {m.participantes && (
                        <p className="mr-tl-participants">
                          <Users size={14} /> <strong>Participantes:</strong> {m.participantes}
                        </p>
                      )}

                      {m.observacoes && (
                        <p className="mr-tl-notes">
                          <Info size={14} /> {m.observacoes}
                        </p>
                      )}

                      <div className="mr-tl-footer">
                        <span className="mr-tl-requester">
                          Solicitado por: <strong>{m.solicitante_nome}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="mr-tl-actions">
                      <button
                        className="mr-btn-icon"
                        title="Ver detalhes"
                        onClick={() => {
                          setSelectedAgendamento(m);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        <FileText size={16} />
                      </button>
                      {isOwner && !isPast && (
                        <button
                          className="mr-btn-icon icon-danger"
                          title="Cancelar reunião"
                          onClick={() => {
                            setSelectedAgendamento(m);
                            setIsCancelModalOpen(true);
                          }}
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: NOVO AGENDAMENTO */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="mr-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="mr-modal-content" onClick={e => e.stopPropagation()}>
            <div className="mr-modal-header">
              <div className="mr-modal-header-icon">
                <CalendarCheck size={24} />
              </div>
              <div>
                <h2>Novo Agendamento de Sala</h2>
                <p>Reserve uma sala de reunião para alinhamentos ou encontros com clientes</p>
              </div>
              <button className="mr-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAgendamento} className="mr-form">
              {formError && (
                <div className="mr-form-alert mr-alert-error">
                  <AlertCircle size={18} />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Escolha da Sala */}
              <div className="mr-form-group">
                <label className="mr-label">Qual sala você deseja utilizar? *</label>
                <div className="mr-room-cards-selector">
                  <div
                    className={`mr-room-select-card ${formSala === 'Sala da Diretoria' ? 'selected card-purple' : ''}`}
                    onClick={() => setFormSala('Sala da Diretoria')}
                  >
                    <div className="mr-rsc-icon">
                      <Briefcase size={22} />
                    </div>
                    <div className="mr-rsc-info">
                      <h4>Sala da Diretoria</h4>
                      <p>Reuniões estratégicas, diretoria e apresentações executivas</p>
                    </div>
                  </div>

                  <div
                    className={`mr-room-select-card ${formSala === 'Sala 1' ? 'selected card-blue' : ''}`}
                    onClick={() => setFormSala('Sala 1')}
                  >
                    <div className="mr-rsc-icon">
                      <Users size={22} />
                    </div>
                    <div className="mr-rsc-info">
                      <h4>Sala 1</h4>
                      <p>Reuniões de equipe, alinhamentos diários e fornecedores</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Data e Horários */}
              <div className="mr-form-row">
                <div className="mr-form-group flex-1">
                  <label className="mr-label">Data da Reunião *</label>
                  <input
                    type="date"
                    className="mr-input"
                    value={formData}
                    min={todayStr}
                    onChange={e => setFormData(e.target.value)}
                    required
                  />
                </div>

                <div className="mr-form-group flex-1">
                  <label className="mr-label">Horário de Início *</label>
                  <input
                    type="time"
                    className="mr-input"
                    value={formHorarioInicio}
                    onChange={e => setFormHorarioInicio(e.target.value)}
                    required
                  />
                </div>

                <div className="mr-form-group flex-1">
                  <label className="mr-label">Horário de Término *</label>
                  <input
                    type="time"
                    className="mr-input"
                    value={formHorarioFim}
                    onChange={e => setFormHorarioFim(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Banner de Verificação de Conflito em Tempo Real */}
              <div className="mr-availability-check">
                {checkingAvailability ? (
                  <div className="mr-av-status av-checking">
                    <RefreshCw size={15} className="spin" />
                    <span>Verificando disponibilidade da sala...</span>
                  </div>
                ) : conflictInfo ? (
                  <div className="mr-av-status av-conflict">
                    <XCircle size={18} />
                    <div>
                      <strong>Horário Indisponível na {formSala}!</strong>
                      <p>
                        Já existe agendamento das <strong>{conflictInfo.horario_inicio} às {conflictInfo.horario_fim}</strong> por {conflictInfo.solicitante_nome} ({conflictInfo.titulo}).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mr-av-status av-available">
                    <CheckCircle2 size={16} />
                    <span>🟢 {formSala} está livre nesta data e horário!</span>
                  </div>
                )}
              </div>

              {/* 3. Tipo de Reunião (Interna ou Externa) */}
              <div className="mr-form-group">
                <label className="mr-label">Reunião Interna ou Externa? *</label>
                <div className="mr-type-radio-group">
                  <label className={`mr-type-radio ${formTipo === 'Interna' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="tipo_reuniao"
                      value="Interna"
                      checked={formTipo === 'Interna'}
                      onChange={() => setFormTipo('Interna')}
                    />
                    <Building size={16} />
                    <div>
                      <strong>Reunião Interna</strong>
                      <span>Apenas equipe interna Lepta</span>
                    </div>
                  </label>

                  <label className={`mr-type-radio ${formTipo === 'Externa' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="tipo_reuniao"
                      value="Externa"
                      checked={formTipo === 'Externa'}
                      onChange={() => setFormTipo('Externa')}
                    />
                    <Globe size={16} />
                    <div>
                      <strong>Reunião Externa</strong>
                      <span>Com clientes, parceiros ou fornecedores</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 4. Título e Empresa */}
              <div className="mr-form-row">
                <div className="mr-form-group flex-2">
                  <label className="mr-label">Título / Assunto da Reunião *</label>
                  <input
                    type="text"
                    className="mr-input"
                    placeholder="Ex: Alinhamento Semanal de Operações, Apresentação FIDC..."
                    value={formTitulo}
                    onChange={e => setFormTitulo(e.target.value)}
                    required
                  />
                </div>

                <div className="mr-form-group flex-1">
                  <label className="mr-label">
                    Nome da Empresa {formTipo === 'Externa' ? '*' : '(Opcional)'}
                  </label>
                  <input
                    type="text"
                    className="mr-input"
                    placeholder={formTipo === 'Externa' ? 'Ex: Banco Master, Grafeno...' : 'Ex: Lepta Gestora'}
                    value={formEmpresa}
                    onChange={e => setFormEmpresa(e.target.value)}
                    required={formTipo === 'Externa'}
                  />
                </div>
              </div>

              {/* 5. Participantes */}
              <div className="mr-form-group">
                <label className="mr-label">Participantes</label>
                <input
                  type="text"
                  className="mr-input"
                  placeholder="Ex: Arthur, Gabriel, Diretor Financeiro, Representante Banco..."
                  value={formParticipantes}
                  onChange={e => setFormParticipantes(e.target.value)}
                />
              </div>

              {/* 6. Observações / Recursos */}
              <div className="mr-form-group">
                <label className="mr-label">Observações / Recursos Necessários</label>
                <textarea
                  className="mr-textarea"
                  rows={2}
                  placeholder="Ex: Ligar projetor/TV, preparar café para 4 pessoas, videoconferência via Teams..."
                  value={formObservacoes}
                  onChange={e => setFormObservacoes(e.target.value)}
                />
              </div>

              {/* Ações do Modal */}
              <div className="mr-modal-footer">
                <button
                  type="button"
                  className="mr-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mr-btn-primary"
                  disabled={submitting || !!conflictInfo}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} className="spin" /> Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} /> Confirmar Agendamento
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETALHES DA REUNIÃO */}
      {/* ========================================================================= */}
      {isDetailModalOpen && selectedAgendamento && (
        <div className="mr-modal-overlay" onClick={() => setIsDetailModalOpen(false)}>
          <div className="mr-modal-content mr-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="mr-modal-header">
              <div className="mr-modal-header-icon">
                <Info size={24} />
              </div>
              <div>
                <h2>Detalhes do Agendamento</h2>
                <p>{selectedAgendamento.sala}</p>
              </div>
              <button className="mr-modal-close" onClick={() => setIsDetailModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="mr-detail-body">
              <div className="mr-detail-block">
                <span className="mr-db-label">Assunto / Título:</span>
                <h3 className="mr-db-value-lg">{selectedAgendamento.titulo}</h3>
              </div>

              <div className="mr-detail-grid">
                <div className="mr-detail-item">
                  <span className="mr-db-label">Data:</span>
                  <span className="mr-db-val">
                    {new Date(selectedAgendamento.data + 'T00:00:00').toLocaleDateString('pt-BR', { dateStyle: 'full' })}
                  </span>
                </div>

                <div className="mr-detail-item">
                  <span className="mr-db-label">Horário:</span>
                  <span className="mr-db-val font-bold">
                    {selectedAgendamento.horario_inicio} às {selectedAgendamento.horario_fim}
                  </span>
                </div>

                <div className="mr-detail-item">
                  <span className="mr-db-label">Sala:</span>
                  <span className={`mr-room-pill ${selectedAgendamento.sala === 'Sala da Diretoria' ? 'pill-purple' : 'pill-blue'}`}>
                    {selectedAgendamento.sala}
                  </span>
                </div>

                <div className="mr-detail-item">
                  <span className="mr-db-label">Tipo:</span>
                  <span className={`mr-type-pill ${selectedAgendamento.tipo_reuniao === 'Interna' ? 'pill-green' : 'pill-amber'}`}>
                    Reunião {selectedAgendamento.tipo_reuniao}
                  </span>
                </div>

                {selectedAgendamento.empresa && (
                  <div className="mr-detail-item">
                    <span className="mr-db-label">Empresa:</span>
                    <span className="mr-db-val font-semibold">{selectedAgendamento.empresa}</span>
                  </div>
                )}

                <div className="mr-detail-item">
                  <span className="mr-db-label">Solicitado por:</span>
                  <span className="mr-db-val">{selectedAgendamento.solicitante_nome}</span>
                </div>
              </div>

              {selectedAgendamento.participantes && (
                <div className="mr-detail-block">
                  <span className="mr-db-label">Participantes:</span>
                  <p className="mr-db-text">{selectedAgendamento.participantes}</p>
                </div>
              )}

              {selectedAgendamento.observacoes && (
                <div className="mr-detail-block">
                  <span className="mr-db-label">Observações / Recursos:</span>
                  <p className="mr-db-text">{selectedAgendamento.observacoes}</p>
                </div>
              )}
            </div>

            <div className="mr-modal-footer">
              <button
                type="button"
                className="mr-btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Fechar
              </button>
              {(user?.id === selectedAgendamento.solicitante_id || user?.role === 'MASTER') && (
                <button
                  type="button"
                  className="mr-btn-danger"
                  onClick={() => setIsCancelModalOpen(true)}
                >
                  <XCircle size={16} /> Cancelar Reunião
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CANCELAR AGENDAMENTO */}
      {/* ========================================================================= */}
      {isCancelModalOpen && selectedAgendamento && (
        <div className="mr-modal-overlay" onClick={() => setIsCancelModalOpen(false)}>
          <div className="mr-modal-content mr-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="mr-modal-header">
              <div className="mr-modal-header-icon icon-danger-bg">
                <XCircle size={24} />
              </div>
              <div>
                <h2>Cancelar Agendamento</h2>
                <p>Liberar a {selectedAgendamento.sala} para outros colaboradores</p>
              </div>
              <button className="mr-modal-close" onClick={() => setIsCancelModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCancelAgendamento} className="mr-form">
              <p className="mr-cancel-warning">
                Tem certeza que deseja cancelar a reunião <strong>"{selectedAgendamento.titulo}"</strong> no dia <strong>{selectedAgendamento.data}</strong> ({selectedAgendamento.horario_inicio} às {selectedAgendamento.horario_fim})?
              </p>

              <div className="mr-form-group">
                <label className="mr-label">Motivo do cancelamento (opcional):</label>
                <input
                  type="text"
                  className="mr-input"
                  placeholder="Ex: Reunião remarcada, cliente desmarcou..."
                  value={cancelMotivo}
                  onChange={e => setCancelMotivo(e.target.value)}
                />
              </div>

              <div className="mr-modal-footer">
                <button
                  type="button"
                  className="mr-btn-secondary"
                  onClick={() => setIsCancelModalOpen(false)}
                  disabled={submittingCancel}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="mr-btn-danger"
                  disabled={submittingCancel}
                >
                  {submittingCancel ? 'Cancelando...' : 'Confirmar Cancelamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
