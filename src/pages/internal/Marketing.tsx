import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../config/api';
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Gift,
  Sun
} from 'lucide-react';
import './Operations.css';
import './Permissions.css';

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'Evento' | 'Aniversário' | 'Feriado';
  date: string; // YYYY-MM-DD
  description?: string;
  createdBy?: string;
}

const Marketing = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'Evento' | 'Aniversário' | 'Feriado'>('Evento');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/calendarEvents`);
      const data: CalendarEvent[] = await res.json();
      setEvents(data || []);
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleOpenAddModal = () => {
    setEditingEvent(null);
    setTitle('');
    setType('Evento');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (evt: CalendarEvent) => {
    setEditingEvent(evt);
    setTitle(evt.title);
    setType(evt.type);
    setDate(evt.date);
    setDescription(evt.description || '');
    setMessage(null);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (id: string, title: string) => {
    if (!window.confirm(`Deseja remover "${title}" do calendário?`)) return;
    try {
      await fetch(`${API_BASE_URL}/calendarEvents/${id}`, { method: 'DELETE' });
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      console.error('Erro ao remover evento:', err);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title.trim()) {
      setMessage({ type: 'error', text: 'Por favor, informe o título.' });
      return;
    }

    if (!date) {
      setMessage({ type: 'error', text: 'Por favor, selecione uma data.' });
      return;
    }

    const payload: Partial<CalendarEvent> = {
      title: title.trim(),
      type,
      date,
      description: description.trim(),
      createdBy: user?.username || 'Marketing'
    };

    try {
      setSaving(true);
      if (editingEvent) {
        // Edit existing
        const res = await fetch(`${API_BASE_URL}/calendarEvents/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...editingEvent, ...payload })
        });
        const updated = await res.json();
        setEvents(events.map(e => (e.id === updated.id ? updated : e)));
      } else {
        // Create new
        const newEvt = {
          id: `event_${Date.now()}`,
          ...payload
        };
        const res = await fetch(`${API_BASE_URL}/calendarEvents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEvt)
        });
        const saved = await res.json();
        setEvents([...events, saved]);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar no calendário:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar evento no banco de dados.' });
    } finally {
      setSaving(false);
    }
  };

  const renderTypeBadge = (t: string) => {
    if (t === 'Aniversário') {
      return <span className="badge" style={{ background: 'rgba(255, 153, 0, 0.2)', color: '#ff9900', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Gift size={13} /> Aniversário</span>;
    }
    if (t === 'Feriado') {
      return <span className="badge" style={{ background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Sun size={13} /> Feriado</span>;
    }
    return <span className="badge" style={{ background: 'rgba(51, 153, 255, 0.2)', color: '#3399ff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CalendarIcon size={13} /> Evento</span>;
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  return (
    <div className="operations-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Marketing & Calendário Interno</h2>
          <p>Gerencie o calendário corporativo com eventos, aniversários e feriados visíveis na página inicial.</p>
        </div>

        <button
          className="btn-primary"
          onClick={handleOpenAddModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} /> Novo Evento / Feriado
        </button>
      </div>

      <div className="internal-card glass">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Megaphone size={20} style={{ color: 'var(--accent-orange)' }} /> Itens do Calendário Registrados ({events.length})
          </h3>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Carregando eventos do servidor...</p>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <CalendarIcon size={48} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '1rem' }} />
            <h4>Nenhum item no calendário</h4>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Cadastre o primeiro evento, aniversário ou feriado para ser exibido na HOME.
            </p>
            <button className="btn-primary" onClick={handleOpenAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> Novo Registro
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Descrição / Detalhes</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {events.map(evt => (
                  <tr key={evt.id}>
                    <td>
                      <strong style={{ color: 'var(--accent-orange)' }}>{formatDateString(evt.date)}</strong>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-light)' }}>{evt.title}</strong>
                    </td>
                    <td>{renderTypeBadge(evt.type)}</td>
                    <td>{evt.description || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-icon"
                          onClick={() => handleOpenEditModal(evt)}
                          title="Editar"
                        >
                          <Edit size={16} /> Editar
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDeleteEvent(evt.id, evt.title)}
                          title="Excluir"
                          style={{ color: '#ff4757', borderColor: 'rgba(255,71,87,0.3)' }}
                        >
                          <Trash2 size={16} /> Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Adicionar / Editar */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '540px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarIcon size={20} style={{ color: 'var(--accent-orange)' }} />
                {editingEvent ? 'Editar Registro no Calendário' : 'Novo Registro no Calendário'}
              </h3>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {message && (
              <div
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  backgroundColor: message.type === 'success' ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)',
                  color: message.type === 'success' ? '#2ed573' : '#ff4757',
                  border: `1px solid ${message.type === 'success' ? '#2ed573' : '#ff4757'}`
                }}
              >
                {message.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveEvent}>
              <div className="modal-body" style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Título do Evento / Aniversário / Feriado *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="Ex: Aniversário do Colaborador Luan Alvarez"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Tipo *
                    </label>
                    <select
                      className="input-field"
                      style={{ width: '100%', height: '42px' }}
                      value={type}
                      onChange={e => setType(e.target.value as 'Evento' | 'Aniversário' | 'Feriado')}
                    >
                      <option value="Evento">📅 Evento</option>
                      <option value="Aniversário">🎉 Aniversário</option>
                      <option value="Feriado">🏖️ Feriado</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Data *
                    </label>
                    <input
                      type="date"
                      className="input-field"
                      style={{ width: '100%', height: '42px' }}
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Descrição / Horário / Local (opcional)
                  </label>
                  <textarea
                    className="input-field"
                    style={{ width: '100%', height: '80px', resize: 'vertical' }}
                    placeholder="Ex: Sala de Reuniões Principal - 14:00h"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketing;
