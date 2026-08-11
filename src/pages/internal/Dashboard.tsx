import { useState, useEffect } from 'react';
import { FileText, Settings, Users, HelpCircle, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Gift, Sun } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import './Dashboard.css';

interface CalendarEvent {
  id: string;
  title: string;
  type: 'Evento' | 'Aniversário' | 'Feriado';
  date: string; // YYYY-MM-DD
  description?: string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const Dashboard = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDayEvents, setSelectedDayEvents] = useState<CalendarEvent[] | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/calendarEvents`);
        const data: CalendarEvent[] = await res.json();
        setEvents(data || []);
      } catch (err) {
        console.error('Erro ao buscar eventos do calendário:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDayEvents(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDayEvents(null);
  };

  const getEventsForDate = (dayNumber: number) => {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(dayNumber).padStart(2, '0');
    const dateFormatted = `${year}-${monthStr}-${dayStr}`;

    return events.filter(e => e.date === dateFormatted);
  };

  const formatEventDateDayMonth = (dateStr: string) => {
    if (!dateStr) return { day: '--', month: '--' };
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const monthShort = MONTH_NAMES[monthIdx] ? MONTH_NAMES[monthIdx].substring(0, 3) : '';
      return { day, month: monthShort };
    }
    return { day: '--', month: '--' };
  };

  const renderBadge = (type: string) => {
    if (type === 'Aniversário') {
      return <span className="badge" style={{ background: 'rgba(255, 153, 0, 0.2)', color: '#ff9900', padding: '2px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Gift size={12} /> Aniversário</span>;
    }
    if (type === 'Feriado') {
      return <span className="badge" style={{ background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', padding: '2px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Sun size={12} /> Feriado</span>;
    }
    return <span className="badge" style={{ background: 'rgba(51, 153, 255, 0.2)', color: '#3399ff', padding: '2px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><CalendarIcon size={12} /> Evento</span>;
  };

  return (
    <>
      <div className="welcome-banner glass">
        <h2>Bem-vindo à Intranet <span className="text-gradient">Lepta</span></h2>
        <p>Seu portal central para comunicações internas, relatórios corporativos e ferramentas administrativas.</p>
      </div>

      <div className="dashboard-grid">
        {/* Card do Calendário Interno (no lugar de comunicados) */}
        <div className="internal-card glass">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CalendarIcon size={20} style={{ color: 'var(--accent-orange)' }} /> Calendário Interno
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button className="icon-btn" onClick={prevMonth} title="Mês anterior">
                <ChevronLeft size={18} />
              </button>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', minWidth: '110px', textAlign: 'center' }}>
                {MONTH_NAMES[month]} {year}
              </span>
              <button className="icon-btn" onClick={nextMonth} title="Próximo mês">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Calendar Month Grid */}
          <div style={{ marginTop: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {WEEKDAYS.map(w => (
                <div key={w}>{w}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {/* Empty slots for previous month overflow */}
              {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
                <div key={`empty-${idx}`} style={{ height: '36px' }} />
              ))}

              {/* Days of current month */}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const dayNum = idx + 1;
                const dayEvents = getEventsForDate(dayNum);
                const hasEvents = dayEvents.length > 0;
                const isToday =
                  new Date().getDate() === dayNum &&
                  new Date().getMonth() === month &&
                  new Date().getFullYear() === year;

                return (
                  <div
                    key={`day-${dayNum}`}
                    onClick={() => hasEvents && setSelectedDayEvents(dayEvents)}
                    style={{
                      height: '38px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      fontWeight: isToday ? 700 : 500,
                      background: isToday
                        ? 'var(--accent-red)'
                        : hasEvents
                        ? 'rgba(255, 153, 0, 0.2)'
                        : 'rgba(255, 255, 255, 0.03)',
                      color: isToday ? '#fff' : hasEvents ? '#ffaa33' : 'var(--text-light)',
                      border: hasEvents ? '1px solid rgba(255, 153, 0, 0.4)' : '1px solid transparent',
                      cursor: hasEvents ? 'pointer' : 'default',
                      position: 'relative'
                    }}
                    title={hasEvents ? `${dayEvents.length} evento(s) neste dia` : ''}
                  >
                    <span>{dayNum}</span>
                    {hasEvents && (
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#ffaa33', marginTop: '2px' }} />
                    )}
                  </div>
                );
              })}
            </div>

            {selectedDayEvents && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,153,0,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.85rem', color: '#ffaa33' }}>Eventos no dia selecionado:</strong>
                  <button className="btn-link" style={{ fontSize: '0.75rem' }} onClick={() => setSelectedDayEvents(null)}>Fechar</button>
                </div>
                {selectedDayEvents.map(evt => (
                  <div key={evt.id} style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2px' }}>
                      {renderBadge(evt.type)}
                      <strong>{evt.title}</strong>
                    </div>
                    {evt.description && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{evt.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card de Acessos Rápidos */}
        <div className="internal-card glass">
          <h3>Acessos Rápidos</h3>
          <div className="quick-links-grid">
            <a href="#" className="quick-link">
              <FileText size={24} />
              <span>Holerite</span>
            </a>
            <a href="#" className="quick-link">
              <Users size={24} />
              <span>Portal RH</span>
            </a>
            <a href="#" className="quick-link">
              <Settings size={24} />
              <span>Sistema ERP</span>
            </a>
            <a href="#" className="quick-link">
              <HelpCircle size={24} />
              <span>Chamados TI</span>
            </a>
          </div>
        </div>

        {/* Card Completo: Próximos eventos, aniversário e feriado */}
        <div className="internal-card glass full-width">
          <h3>Próximos eventos, aniversário e feriado</h3>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Carregando eventos...</p>
          ) : events.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>Nenhum evento cadastrado no calendário.</p>
          ) : (
            <div className="events-list">
              {events.map(evt => {
                const dateObj = formatEventDateDayMonth(evt.date);
                return (
                  <div key={evt.id} className="event-item" style={{ marginBottom: '0.75rem' }}>
                    <div className="event-date">
                      <span className="day">{dateObj.day}</span>
                      <span className="month">{dateObj.month}</span>
                    </div>
                    <div className="event-details" style={{ flexGrow: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '4px' }}>
                        <h4>{evt.title}</h4>
                        {renderBadge(evt.type)}
                      </div>
                      <p>
                        {evt.type === 'Aniversário' && (!evt.description || evt.description.includes('SharePoint'))
                          ? `Aniversário dia ${dateObj.day}/${dateObj.month}`
                          : evt.description || 'Sem descrição adicional'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Dashboard;
