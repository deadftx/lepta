import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Clock, Users, Building, Plus,
  CalendarCheck, AlertCircle, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, RefreshCw, User, FileText,
  Briefcase, Globe, X, Info, Map as MapIcon
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import { useAuth } from '../../../core/AuthContext';
import FloorPlanMeetingRooms from './FloorPlanMeetingRooms';
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
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Modais
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFloorPlanModalOpen, setIsFloorPlanModalOpen] = useState(false);
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

  // Lista de reuniões para o dia selecionado no painel lateral
  const selectedDayMeetings = useMemo(() => {
    return agendamentosPorDia.get(selectedDay) || [];
  }, [agendamentosPorDia, selectedDay]);

  // Lista filtrada para a visualização de Agenda Geral
  const agendaList = useMemo(() => {
    let list = [...agendamentos];
    return list.sort((a, b) => {
      if (a.data !== b.data) return a.data.localeCompare(b.data);
      return a.horario_inicio.localeCompare(b.horario_inicio);
    });
  }, [agendamentos]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="mr-onepage-container">
      {/* 1. Header Compacto com Micro-Stats Integrados */}
      <header className="mr-topbar">
        <div className="mr-topbar-left">
          <div className="mr-icon-badge-sm">
            <CalendarCheck size={20} />
          </div>
          <div>
            <h1 className="mr-title">Agendar Sala de Reunião</h1>
            <p className="mr-desc">Controle de reservas e disponibilidade das salas da Lepta</p>
          </div>
        </div>

        {/* Micro-Stats Pills */}
        <div className="mr-micro-stats">
          <div className="mr-stat-pill pill-blue" title="Reuniões agendadas para hoje">
            <span className="mr-sp-label">Hoje</span>
            <span className="mr-sp-val">{stats?.reunioesHoje ?? 0}</span>
          </div>
          <div className="mr-stat-pill pill-green" title="Total de reuniões no mês">
            <span className="mr-sp-label">Mês</span>
            <span className="mr-sp-val">{stats?.totalMes ?? 0}</span>
          </div>
          <div className="mr-stat-pill pill-purple" title="Agendamentos futuros na Sala da Diretoria">
            <Briefcase size={12} />
            <span className="mr-sp-label">Diretoria</span>
            <span className="mr-sp-val">{stats?.salaDiretoriaFuturas ?? 0}</span>
          </div>
          <div className="mr-stat-pill pill-indigo" title="Agendamentos futuros na Sala 1">
            <Users size={12} />
            <span className="mr-sp-label">Sala 1</span>
            <span className="mr-sp-val">{stats?.sala1Futuras ?? 0}</span>
          </div>
        </div>

        {/* Ações Rápidas */}
        <div className="mr-topbar-actions">
          <button 
            className="mr-btn-secondary mr-btn-compact" 
            onClick={() => setIsFloorPlanModalOpen(true)}
            title="Ver planta interativa do escritório"
          >
            <MapIcon size={14} />
            <span>Planta das Salas</span>
          </button>
          <button 
            className="mr-btn-secondary mr-btn-compact" 
            onClick={fetchAgendamentos} 
            disabled={refreshing}
            title="Atualizar dados"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>Atualizar</span>
          </button>
          <button 
            className="mr-btn-primary mr-btn-compact"
            onClick={() => {
              setFormData(selectedDay || todayStr);
              setFormError('');
              setIsModalOpen(true);
            }}
          >
            <Plus size={16} />
            <span>Novo Agendamento</span>
          </button>
        </div>
      </header>

      {/* Alertas Flutuantes Rápidos */}
      {successMsg && (
        <div className="mr-alert-compact mr-alert-success">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="mr-alert-compact mr-alert-error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* 2. Barra de Filtros e Controles (Linha Única) */}
      <div className="mr-filter-bar">
        <div className="mr-filter-bar-left">
          {/* Navegação de Mês */}
          <div className="mr-month-nav-compact">
            <button className="mr-nav-btn-sm" onClick={handlePrevMonth} title="Mês anterior">
              <ChevronLeft size={16} />
            </button>
            <span className="mr-month-title-sm">{formattedMonthName}</span>
            <button className="mr-nav-btn-sm" onClick={handleNextMonth} title="Próximo mês">
              <ChevronRight size={16} />
            </button>
            <button className="mr-btn-today-sm" onClick={handleCurrentMonth}>
              Hoje
            </button>
          </div>

          {/* Filtro por Sala */}
          <div className="mr-filter-pills-group">
            <button
              className={`mr-fp ${filterSala === 'TODAS' ? 'active' : ''}`}
              onClick={() => setFilterSala('TODAS')}
            >
              Todas as Salas
            </button>
            <button
              className={`mr-fp pill-purple ${filterSala === 'Sala da Diretoria' ? 'active' : ''}`}
              onClick={() => setFilterSala('Sala da Diretoria')}
            >
              <Briefcase size={12} /> Sala da Diretoria
            </button>
            <button
              className={`mr-fp pill-blue ${filterSala === 'Sala 1' ? 'active' : ''}`}
              onClick={() => setFilterSala('Sala 1')}
            >
              <Users size={12} /> Sala 1
            </button>
          </div>

          {/* Filtro por Tipo */}
          <div className="mr-filter-pills-group">
            <button
              className={`mr-fp ${filterTipo === 'TODOS' ? 'active' : ''}`}
              onClick={() => setFilterTipo('TODOS')}
            >
              Todos os Tipos
            </button>
            <button
              className={`mr-fp pill-green ${filterTipo === 'Interna' ? 'active' : ''}`}
              onClick={() => setFilterTipo('Interna')}
            >
              <Building size={12} /> Interna
            </button>
            <button
              className={`mr-fp pill-amber ${filterTipo === 'Externa' ? 'active' : ''}`}
              onClick={() => setFilterTipo('Externa')}
            >
              <Globe size={12} /> Externa
            </button>
          </div>

          {/* Checkbox Apenas Minhas */}
          <label className="mr-checkbox-compact">
            <input
              type="checkbox"
              checked={filterMinhas}
              onChange={e => setFilterMinhas(e.target.checked)}
            />
            <span>Apenas minhas</span>
          </label>
        </div>

        {/* Alternância de Modo */}
        <div className="mr-mode-toggle">
          <button
            className={`mr-mt-btn ${viewMode === 'CALENDAR' ? 'active' : ''}`}
            onClick={() => setViewMode('CALENDAR')}
          >
            <Calendar size={14} />
            <span>Grade Calendário</span>
          </button>
          <button
            className={`mr-mt-btn ${viewMode === 'AGENDA' ? 'active' : ''}`}
            onClick={() => setViewMode('AGENDA')}
          >
            <Clock size={14} />
            <span>Lista Agenda</span>
          </button>
        </div>
      </div>

      {/* 3. Área de Conteúdo Principal (100% Viewport, Split Screen no modo Calendário) */}
      <div className="mr-main-viewport">
        {loading ? (
          <div className="mr-loading-viewport">
            <RefreshCw size={28} className="spin mr-spinner" />
            <span>Carregando agenda de salas...</span>
          </div>
        ) : viewMode === 'CALENDAR' ? (
          /* MODO CALENDÁRIO COM PAINEL LATERAL INTEGRADO (ONE-PAGE) */
          <div className="mr-calendar-split-container">
            {/* LADO ESQUERDO: Grade do Calendário Mensal */}
            <div className="mr-calendar-pane">
              <div className="mr-weekdays-row">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <div key={d} className="mr-weekday-col">{d}</div>
                ))}
              </div>

              <div className="mr-calendar-grid-fill">
                {calendarDays.map((day, idx) => {
                  const dayMeetings = agendamentosPorDia.get(day.dateStr) || [];
                  const isToday = day.dateStr === todayStr;
                  const isSelected = day.dateStr === selectedDay;

                  return (
                    <div
                      key={idx}
                      className={`mr-day-box ${!day.isCurrentMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => setSelectedDay(day.dateStr)}
                    >
                      <div className="mr-day-box-top">
                        <span className="mr-day-number">{day.dayNumber}</span>
                        {isToday && <span className="mr-tag-hoje">Hoje</span>}
                        <button
                          className="mr-quick-add"
                          title="Agendar neste dia"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData(day.dateStr);
                            setIsModalOpen(true);
                          }}
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      <div className="mr-day-box-badges">
                        {dayMeetings.slice(0, 2).map((m: AgendamentoSala) => (
                          <div
                            key={m.id}
                            className={`mr-micro-badge ${m.sala === 'Sala da Diretoria' ? 'badge-diretoria' : 'badge-sala1'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAgendamento(m);
                              setIsDetailModalOpen(true);
                            }}
                            title={`${m.sala} (${m.horario_inicio} - ${m.horario_fim}): ${m.titulo}`}
                          >
                            <span className="mr-mb-time">{m.horario_inicio}</span>
                            <span className="mr-mb-title">{m.titulo}</span>
                          </div>
                        ))}
                        {dayMeetings.length > 2 && (
                          <div className="mr-micro-more">
                            +{dayMeetings.length - 2} mais
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LADO DIREITO: Painel Lateral com Reuniões do Dia Selecionado */}
            <aside className="mr-day-sidebar">
              <div className="mr-dsb-header">
                <div>
                  <h3 className="mr-dsb-date">
                    {new Date(selectedDay + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  </h3>
                  <span className="mr-dsb-count">
                    {selectedDayMeetings.length} reunião(ões) confirmada(s)
                  </span>
                </div>
                <button
                  className="mr-btn-primary mr-btn-sm"
                  onClick={() => {
                    setFormData(selectedDay);
                    setIsModalOpen(true);
                  }}
                  title="Agendar reunião para o dia selecionado"
                >
                  <Plus size={14} /> Agendar
                </button>
              </div>

              <div className="mr-dsb-scroll-list">
                {selectedDayMeetings.length === 0 ? (
                  <div className="mr-dsb-empty">
                    <Calendar size={32} />
                    <h4>Salas Livres</h4>
                    <p>Nenhum agendamento para este dia.</p>
                    <button
                      className="mr-btn-secondary mr-btn-sm"
                      onClick={() => {
                        setFormData(selectedDay);
                        setIsModalOpen(true);
                      }}
                    >
                      <Plus size={14} /> Reservar Horário
                    </button>
                  </div>
                ) : (
                  selectedDayMeetings.map((m: AgendamentoSala) => {
                    const isOwner = user?.id === m.solicitante_id || user?.role === 'MASTER';

                    return (
                      <div 
                        key={m.id} 
                        className={`mr-dsb-card ${m.sala === 'Sala da Diretoria' ? 'card-diretoria' : 'card-sala1'}`}
                        onClick={() => {
                          setSelectedAgendamento(m);
                          setIsDetailModalOpen(true);
                        }}
                      >
                        <div className="mr-dsb-card-top">
                          <span className={`mr-rpill ${m.sala === 'Sala da Diretoria' ? 'pill-purple' : 'pill-blue'}`}>
                            {m.sala === 'Sala da Diretoria' ? <Briefcase size={11} /> : <Users size={11} />}
                            {m.sala}
                          </span>
                          <span className={`mr-tpill ${m.tipo_reuniao === 'Interna' ? 'pill-green' : 'pill-amber'}`}>
                            {m.tipo_reuniao}
                          </span>
                        </div>

                        <h4 className="mr-dsb-card-title">{m.titulo}</h4>

                        <div className="mr-dsb-card-rows">
                          <div className="mr-row-item">
                            <Clock size={12} />
                            <span><strong>{m.horario_inicio} às {m.horario_fim}</strong></span>
                          </div>
                          {m.empresa && (
                            <div className="mr-row-item">
                              <Building size={12} />
                              <span>Empresa: {m.empresa}</span>
                            </div>
                          )}
                          <div className="mr-row-item">
                            <User size={12} />
                            <span>Solicitante: {m.solicitante_nome}</span>
                          </div>
                        </div>

                        <div className="mr-dsb-card-actions">
                          <button
                            className="mr-link-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAgendamento(m);
                              setIsDetailModalOpen(true);
                            }}
                          >
                            <FileText size={12} /> Detalhes
                          </button>
                          {isOwner && m.data >= todayStr && (
                            <button
                              className="mr-link-btn text-danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedAgendamento(m);
                                setIsCancelModalOpen(true);
                              }}
                            >
                              <XCircle size={12} /> Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>
          </div>
        ) : (
          /* MODO LISTA AGENDA */
          <div className="mr-agenda-fill-container">
            <div className="mr-agenda-scrollable">
              {agendaList.length === 0 ? (
                <div className="mr-empty-card">
                  <Calendar size={40} />
                  <h4>Nenhum agendamento encontrado</h4>
                  <p>Nenhuma reunião encontrada para os filtros selecionados.</p>
                  <button className="mr-btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={16} /> Criar Primeiro Agendamento
                  </button>
                </div>
              ) : (
                <div className="mr-agenda-compact-grid">
                  {agendaList.map((m: AgendamentoSala) => {
                    const isPast = m.data < todayStr;
                    const isOwner = user?.id === m.solicitante_id || user?.role === 'MASTER';

                    return (
                      <div key={m.id} className={`mr-agenda-card ${m.sala === 'Sala da Diretoria' ? 'border-purple' : 'border-blue'}`}>
                        <div className="mr-ac-left">
                          <span className="mr-ac-day">{new Date(m.data + 'T00:00:00').getDate()}</span>
                          <span className="mr-ac-month">{new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase()}</span>
                          <span className="mr-ac-time"><Clock size={11} /> {m.horario_inicio}-{m.horario_fim}</span>
                        </div>

                        <div className="mr-ac-body">
                          <div className="mr-ac-pills">
                            <span className={`mr-rpill ${m.sala === 'Sala da Diretoria' ? 'pill-purple' : 'pill-blue'}`}>
                              {m.sala}
                            </span>
                            <span className={`mr-tpill ${m.tipo_reuniao === 'Interna' ? 'pill-green' : 'pill-amber'}`}>
                              {m.tipo_reuniao}
                            </span>
                            {m.empresa && (
                              <span className="mr-cpill">
                                <Building size={11} /> {m.empresa}
                              </span>
                            )}
                          </div>

                          <h4 className="mr-ac-title">{m.titulo}</h4>

                          {m.participantes && (
                            <p className="mr-ac-desc">
                              <Users size={12} /> <strong>Part.:</strong> {m.participantes}
                            </p>
                          )}

                          <span className="mr-ac-user">
                            Por: <strong>{m.solicitante_nome}</strong>
                          </span>
                        </div>

                        <div className="mr-ac-actions">
                          <button
                            className="mr-btn-icon"
                            title="Ver detalhes"
                            onClick={() => {
                              setSelectedAgendamento(m);
                              setIsDetailModalOpen(true);
                            }}
                          >
                            <FileText size={15} />
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
                              <XCircle size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: NOVO AGENDAMENTO COM PLANTA INTERATIVA */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="mr-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="mr-modal-content mr-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mr-modal-header">
              <div className="mr-modal-header-icon">
                <CalendarCheck size={22} />
              </div>
              <div>
                <h2>Novo Agendamento de Sala</h2>
                <p>Selecione a sala pela planta interativa ou pelos cards abaixo</p>
              </div>
              <button className="mr-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAgendamento} className="mr-form">
              {formError && (
                <div className="mr-form-alert mr-alert-error">
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. Escolha da Sala com Planta Interativa Integrada */}
              <div className="mr-form-group">
                <label className="mr-label">Selecione a Sala na Planta ou nos Cards: *</label>
                
                {/* Planta Interativa */}
                <FloorPlanMeetingRooms
                  selectedRoom={formSala}
                  onSelectRoom={setFormSala}
                />

                {/* Cards Seletores de Sala */}
                <div className="mr-room-cards-selector" style={{ marginTop: '0.65rem' }}>
                  <div
                    className={`mr-room-select-card ${formSala === 'Sala da Diretoria' ? 'selected card-purple' : ''}`}
                    onClick={() => setFormSala('Sala da Diretoria')}
                  >
                    <div className="mr-rsc-icon">
                      <Briefcase size={20} />
                    </div>
                    <div className="mr-rsc-info">
                      <h4>Sala da Diretoria</h4>
                      <p>Reuniões estratégicas e diretoria (inferior direita na planta)</p>
                    </div>
                  </div>

                  <div
                    className={`mr-room-select-card ${formSala === 'Sala 1' ? 'selected card-blue' : ''}`}
                    onClick={() => setFormSala('Sala 1')}
                  >
                    <div className="mr-rsc-icon">
                      <Users size={20} />
                    </div>
                    <div className="mr-rsc-info">
                      <h4>Sala 1</h4>
                      <p>Reuniões de equipe e alinhamentos (superior central na planta)</p>
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
                  <label className="mr-label">Horário Início *</label>
                  <input
                    type="time"
                    className="mr-input"
                    value={formHorarioInicio}
                    onChange={e => setFormHorarioInicio(e.target.value)}
                    required
                  />
                </div>

                <div className="mr-form-group flex-1">
                  <label className="mr-label">Horário Término *</label>
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
                    <RefreshCw size={14} className="spin" />
                    <span>Verificando disponibilidade da sala...</span>
                  </div>
                ) : conflictInfo ? (
                  <div className="mr-av-status av-conflict">
                    <XCircle size={16} />
                    <div>
                      <strong>Horário Indisponível na {formSala}!</strong>
                      <p>
                        Já reservada das <strong>{conflictInfo.horario_inicio} às {conflictInfo.horario_fim}</strong> por {conflictInfo.solicitante_nome} ({conflictInfo.titulo}).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mr-av-status av-available">
                    <CheckCircle2 size={15} />
                    <span>🟢 {formSala} está livre nesta data e horário!</span>
                  </div>
                )}
              </div>

              {/* 3. Tipo de Reunião (Interna ou Externa) */}
              <div className="mr-form-group">
                <label className="mr-label">Tipo de Reunião *</label>
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
                      <span>Apenas equipe Lepta</span>
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
                      <span>Clientes e parceiros</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 4. Título e Empresa */}
              <div className="mr-form-row">
                <div className="mr-form-group flex-2">
                  <label className="mr-label">Título / Assunto *</label>
                  <input
                    type="text"
                    className="mr-input"
                    placeholder="Ex: Alinhamento Operacional, Apresentação FIDC..."
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
                    placeholder={formTipo === 'Externa' ? 'Ex: Banco Master, Grafeno...' : 'Ex: Lepta'}
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
                  placeholder="Ex: Arthur, Gabriel, Diretor Financeiro..."
                  value={formParticipantes}
                  onChange={e => setFormParticipantes(e.target.value)}
                />
              </div>

              {/* 6. Observações */}
              <div className="mr-form-group">
                <label className="mr-label">Observações / Recursos</label>
                <input
                  type="text"
                  className="mr-input"
                  placeholder="Ex: Projetor/TV ligado, café para 4 pessoas, Teams..."
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
                  {submitting ? 'Salvando...' : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PLANTA INTERATIVA DO ESCRITÓRIO (VISUALIZAÇÃO / SELEÇÃO)          */}
      {/* ========================================================================= */}
      {isFloorPlanModalOpen && (
        <div className="mr-modal-overlay" onClick={() => setIsFloorPlanModalOpen(false)}>
          <div className="mr-modal-content mr-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="mr-modal-header">
              <div className="mr-modal-header-icon">
                <MapIcon size={22} />
              </div>
              <div>
                <h2>Planta do Escritório — Salas de Reunião</h2>
                <p>Localização espacial e acesso rápido para agendamentos</p>
              </div>
              <button className="mr-modal-close" onClick={() => setIsFloorPlanModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="mr-detail-body">
              <FloorPlanMeetingRooms
                selectedRoom={filterSala}
                onSelectRoom={(room) => {
                  setFilterSala(room);
                  setFormSala(room);
                }}
              />

              <div className="mr-room-cards-selector" style={{ marginTop: '0.5rem' }}>
                <div
                  className={`mr-room-select-card ${filterSala === 'Sala da Diretoria' ? 'selected card-purple' : ''}`}
                  onClick={() => {
                    setFilterSala('Sala da Diretoria');
                    setFormSala('Sala da Diretoria');
                  }}
                >
                  <div className="mr-rsc-icon">
                    <Briefcase size={20} />
                  </div>
                  <div className="mr-rsc-info">
                    <h4>Sala da Diretoria</h4>
                    <p>Reuniões estratégicas e diretoria (inferior direita)</p>
                  </div>
                </div>

                <div
                  className={`mr-room-select-card ${filterSala === 'Sala 1' ? 'selected card-blue' : ''}`}
                  onClick={() => {
                    setFilterSala('Sala 1');
                    setFormSala('Sala 1');
                  }}
                >
                  <div className="mr-rsc-icon">
                    <Users size={20} />
                  </div>
                  <div className="mr-rsc-info">
                    <h4>Sala 1</h4>
                    <p>Reuniões de equipe e fornecedores (superior central)</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mr-modal-footer">
              <button
                type="button"
                className="mr-btn-secondary"
                onClick={() => setIsFloorPlanModalOpen(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="mr-btn-primary"
                onClick={() => {
                  setIsFloorPlanModalOpen(false);
                  setFormData(selectedDay || todayStr);
                  setIsModalOpen(true);
                }}
              >
                <Plus size={16} /> Agendar nesta Sala
              </button>
            </div>
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
                <Info size={22} />
              </div>
              <div>
                <h2>Detalhes do Agendamento</h2>
                <p>{selectedAgendamento.sala}</p>
              </div>
              <button className="mr-modal-close" onClick={() => setIsDetailModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="mr-detail-body">
              <div className="mr-detail-block">
                <span className="mr-db-label">Assunto:</span>
                <h3 className="mr-db-value-lg">{selectedAgendamento.titulo}</h3>
              </div>

              <div className="mr-detail-grid">
                <div className="mr-detail-item">
                  <span className="mr-db-label">Data:</span>
                  <span className="mr-db-val font-semibold">
                    {new Date(selectedAgendamento.data + 'T00:00:00').toLocaleDateString('pt-BR', { dateStyle: 'full' })}
                  </span>
                </div>

                <div className="mr-detail-item">
                  <span className="mr-db-label">Horário:</span>
                  <span className="mr-db-val text-indigo font-bold">
                    {selectedAgendamento.horario_inicio} às {selectedAgendamento.horario_fim}
                  </span>
                </div>

                <div className="mr-detail-item">
                  <span className="mr-db-label">Sala:</span>
                  <span className={`mr-rpill ${selectedAgendamento.sala === 'Sala da Diretoria' ? 'pill-purple' : 'pill-blue'}`}>
                    {selectedAgendamento.sala}
                  </span>
                </div>

                <div className="mr-detail-item">
                  <span className="mr-db-label">Tipo:</span>
                  <span className={`mr-tpill ${selectedAgendamento.tipo_reuniao === 'Interna' ? 'pill-green' : 'pill-amber'}`}>
                    {selectedAgendamento.tipo_reuniao}
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
                <XCircle size={22} />
              </div>
              <div>
                <h2>Cancelar Agendamento</h2>
                <p>Liberar a {selectedAgendamento.sala} para outros colaboradores</p>
              </div>
              <button className="mr-modal-close" onClick={() => setIsCancelModalOpen(false)}>
                <X size={18} />
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
