import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../core/AuthContext';
import { API_BASE_URL } from '../../../config/api';
import {
  Plus,
  Edit,
  Trash2,
  Calendar as CalendarIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Gift,
  Sun,
  Upload,
  ClipboardList,
  UserPlus
} from 'lucide-react';
import '../../core/styles/Operations.css';
import '../../core/styles/Permissions.css';

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'Evento' | 'Aniversário' | 'Feriado';
  date: string; // YYYY-MM-DD
  description?: string;
  createdBy?: string;
}

const MONTH_MAP: Record<string, string> = {
  janeiro: '01',
  fevereiro: '02',
  março: '03',
  marco: '03',
  abril: '04',
  maio: '05',
  junho: '06',
  julho: '07',
  agosto: '08',
  setembro: '09',
  outubro: '10',
  novembro: '11',
  dezembro: '12'
};

const Marketing = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [type, setType] = useState<'Evento' | 'Aniversário' | 'Feriado'>('Aniversário');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [pastedText, setPastedText] = useState('');

  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/calendarEvents`);
      const evtsData: CalendarEvent[] = await res.json();
      setEvents(evtsData || []);
    } catch (err) {
      console.error('Erro ao carregar eventos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const birthdaysList = events.filter(e => e.type === 'Aniversário');
  const otherEventsList = events.filter(e => e.type !== 'Aniversário');

  const handleOpenAddBirthdayModal = () => {
    setEditingEvent(null);
    setTitle('');
    setType('Aniversário');
    setDate(new Date().toISOString().split('T')[0]);
    setDescription('');
    setMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenAddEventModal = () => {
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

  const handleDeleteEvent = async (id: string, titleStr: string) => {
    if (!window.confirm(`Deseja remover "${titleStr}" do sistema?`)) return;
    try {
      await fetch(`${API_BASE_URL}/calendarEvents/${id}`, { method: 'DELETE' });
      setEvents(events.filter(e => e.id !== id));
    } catch (err) {
      console.error('Erro ao remover registro:', err);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!title.trim() || !date) {
      setMessage({ type: 'error', text: 'Preencha os campos obrigatórios.' });
      return;
    }

    // Auto-generate description for birthday if empty
    let finalDesc = description.trim();
    if (!finalDesc && type === 'Aniversário' && date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        finalDesc = `Aniversário dia ${parts[2]}/${parts[1]}`;
      }
    }

    const payload: Partial<CalendarEvent> = {
      title: title.trim(),
      type,
      date,
      description: finalDesc,
      createdBy: user?.username || 'Marketing'
    };

    try {
      setSaving(true);
      if (editingEvent) {
        const res = await fetch(`${API_BASE_URL}/calendarEvents/${editingEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...editingEvent, ...payload })
        });
        const updated = await res.json();
        setEvents(events.map(e => (e.id === updated.id ? updated : e)));
      } else {
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
      console.error('Erro ao salvar no banco de dados:', err);
      setMessage({ type: 'error', text: 'Erro ao salvar registro no banco de dados.' });
    } finally {
      setSaving(false);
    }
  };

  // Process Rows from Excel File
  const processExcelRows = async (rows: any[]) => {
    let importedCount = 0;
    const newEvents: CalendarEvent[] = [];

    rows.forEach((row, idx) => {
      const name = row['Nome'] || row['NOME'] || row['nome'] || row['Aniversariantes'] || row['ANIVERSARIANTES'];
      const rawData = row['Data'] || row['DATA'] || row['data'];
      const rawMes = row['Mês'] || row['MES'] || row['mês'] || row['mes'];
      const rawDia = row['Dia'] || row['DIA'] || row['dia'];

      if (!name || String(name).trim().length === 0) return;

      let dayStr = '';
      let monthStr = '';

      if (rawData) {
        const str = String(rawData).trim();
        if (str.includes('/')) {
          const parts = str.split('/');
          dayStr = parts[0].padStart(2, '0');
          monthStr = parts[1].padStart(2, '0');
        }
      }

      if (!dayStr && rawDia) {
        dayStr = String(rawDia).trim().padStart(2, '0');
      }

      if (!monthStr && rawMes) {
        const mKey = String(rawMes).trim().toLowerCase();
        monthStr = MONTH_MAP[mKey] || '01';
      }

      if (name && dayStr && monthStr) {
        const formattedDate = `2026-${monthStr}-${dayStr}`;
        const cleanName = String(name).trim();
        const displayTitle = cleanName.toLowerCase().startsWith('aniversário') ? cleanName : `Aniversário: ${cleanName}`;

        newEvents.push({
          id: `bday_${Date.now()}_${idx}`,
          title: displayTitle,
          type: 'Aniversário',
          date: formattedDate,
          description: `Aniversário dia ${dayStr}/${monthStr}`,
          createdBy: user?.username || 'Marketing'
        });
        importedCount++;
      }
    });

    if (newEvents.length > 0) {
      for (const evt of newEvents) {
        await fetch(`${API_BASE_URL}/calendarEvents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(evt)
        }).catch(() => null);
      }
      await fetchEvents();
      alert(`Sucesso! ${importedCount} aniversariantes foram cadastrados no sistema!`);
    } else {
      alert('Nenhum aniversariante válido foi encontrado na planilha.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        await processExcelRows(rows);
        setIsImportModalOpen(false);
      } catch (err) {
        console.error('Erro ao ler arquivo Excel:', err);
        alert('Erro ao processar a planilha. Certifique-se de ser um arquivo .xlsx/.csv válido.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleParsePastedText = async () => {
    if (!pastedText.trim()) return;

    setImporting(true);
    try {
      const lines = pastedText.split('\n');
      const newEvents: CalendarEvent[] = [];

      lines.forEach((line, idx) => {
        const cols = line.split('\t').map(c => c.trim());
        if (cols.length >= 2) {
          const name = cols[0];
          const dataVal = cols[1];
          if (name && dataVal && dataVal.includes('/')) {
            const parts = dataVal.split('/');
            const dayStr = parts[0].padStart(2, '0');
            const monthStr = parts[1].padStart(2, '0');
            const cleanName = name.trim();
            const displayTitle = cleanName.toLowerCase().startsWith('aniversário') ? cleanName : `Aniversário: ${cleanName}`;

            newEvents.push({
              id: `bday_paste_${Date.now()}_${idx}`,
              title: displayTitle,
              type: 'Aniversário',
              date: `2026-${monthStr}-${dayStr}`,
              description: `Aniversário dia ${dayStr}/${monthStr}`,
              createdBy: user?.username || 'Marketing'
            });
          }
        }
      });

      if (newEvents.length > 0) {
        for (const evt of newEvents) {
          await fetch(`${API_BASE_URL}/calendarEvents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evt)
          }).catch(() => null);
        }
        await fetchEvents();
        alert(`Sucesso! ${newEvents.length} aniversariantes foram cadastrados no sistema!`);
        setPastedText('');
        setIsImportModalOpen(false);
      } else {
        alert('Não foi possível identificar nomes e datas no formato DD/MM. Certifique-se de copiar as colunas Nome e Data da planilha.');
      }
    } catch (err) {
      console.error('Erro ao processar colar dados:', err);
    } finally {
      setImporting(false);
    }
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
      <div className="page-header">
        <div>
          <h2>Gestão do Calendário Interno</h2>
          <p>Gerencie os aniversariantes da empresa, eventos internos e feriados corporativos diretamente no sistema.</p>
        </div>
      </div>

      {/* CARD 1: Aniversariantes do Mês */}
      <div className="internal-card glass" style={{ marginBottom: '2rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ff9900' }}>
            <Gift size={22} /> Aniversariantes do Mês ({birthdaysList.length})
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              className="btn-primary"
              onClick={handleOpenAddBirthdayModal}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, #ff9900 0%, #e67e22 100%)', color: '#fff', fontSize: '0.85rem' }}
            >
              <UserPlus size={15} /> Cadastrar Aniversariante
            </button>

            <button
              className="btn-outline"
              onClick={() => setIsImportModalOpen(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
              title="Importar planilha XLSX ou colar dados de migração"
            >
              <Upload size={15} /> Importar Planilha (.xlsx)
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Carregando aniversariantes...</p>
        ) : birthdaysList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <Gift size={44} style={{ color: '#ff9900', opacity: 0.4, marginBottom: '0.75rem' }} />
            <h4>Nenhum aniversariante cadastrado</h4>
            <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0.4rem auto 1.25rem', fontSize: '0.9rem' }}>
              Clique em <strong>"Cadastrar Aniversariante"</strong> para adicionar colaboradores diretamente no sistema.
            </p>
            <button
              className="btn-primary"
              onClick={handleOpenAddBirthdayModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'linear-gradient(135deg, #ff9900 0%, #e67e22 100%)', color: '#fff' }}
            >
              <UserPlus size={16} /> Cadastrar Aniversariante
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Data de Aniversário</th>
                  <th>Colaborador / Nome</th>
                  <th>Descrição</th>
                  <th>Cadastrado Por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {birthdaysList.map(bday => (
                  <tr key={bday.id}>
                    <td>
                      <strong style={{ color: '#ff9900', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Gift size={15} /> {formatDateString(bday.date)}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-light)' }}>{bday.title}</strong>
                    </td>
                    <td>{bday.description || '-'}</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {bday.createdBy || 'Marketing'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-icon" onClick={() => handleOpenEditModal(bday)} title="Editar" style={{ padding: '4px 8px' }}>
                          <Edit size={14} /> Editar
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDeleteEvent(bday.id, bday.title)}
                          title="Excluir"
                          style={{ color: '#ff4757', borderColor: 'rgba(255,71,87,0.3)', padding: '4px 8px' }}
                        >
                          <Trash2 size={14} /> Excluir
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

      {/* CARD 2: Eventos & Feriados Corporativos */}
      <div className="internal-card glass">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarIcon size={20} style={{ color: 'var(--accent-orange)' }} /> Eventos & Feriados Corporativos ({otherEventsList.length})
          </h3>

          <button
            className="btn-primary"
            onClick={handleOpenAddEventModal}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
          >
            <Plus size={15} /> Cadastrar Evento / Feriado
          </button>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Carregando eventos corporativos...</p>
        ) : otherEventsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
            <CalendarIcon size={44} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '0.75rem' }} />
            <h4>Nenhum evento ou feriado registrado</h4>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
              Cadastre reuniões corporativas, convenções ou feriados operacionais.
            </p>
            <button className="btn-primary" onClick={handleOpenAddEventModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} /> Novo Registro
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Título do Evento</th>
                  <th>Tipo</th>
                  <th>Descrição / Detalhes</th>
                  <th>Cadastrado Por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {otherEventsList.map(evt => (
                  <tr key={evt.id}>
                    <td>
                      <strong style={{ color: 'var(--accent-orange)' }}>{formatDateString(evt.date)}</strong>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-light)' }}>{evt.title}</strong>
                    </td>
                    <td>
                      {evt.type === 'Feriado' ? (
                        <span className="badge" style={{ background: 'rgba(255, 71, 87, 0.2)', color: '#ff4757', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Sun size={13} /> Feriado
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(51, 153, 255, 0.2)', color: '#3399ff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <CalendarIcon size={13} /> Evento
                        </span>
                      )}
                    </td>
                    <td>{evt.description || '-'}</td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                        {evt.createdBy || 'Marketing'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-icon" onClick={() => handleOpenEditModal(evt)} title="Editar" style={{ padding: '4px 8px' }}>
                          <Edit size={14} /> Editar
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleDeleteEvent(evt.id, evt.title)}
                          title="Excluir"
                          style={{ color: '#ff4757', borderColor: 'rgba(255,71,87,0.3)', padding: '4px 8px' }}
                        >
                          <Trash2 size={14} /> Excluir
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

      {/* Modal Importar Planilha ou Colar Células */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '560px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={20} style={{ color: '#2ed573' }} /> Migrar / Importar Aniversariantes (.xlsx)
              </h3>
              <button className="icon-btn" onClick={() => setIsImportModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body" style={{ marginBottom: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ClipboardList size={18} style={{ color: '#ffaa33' }} /> Opção 1: Colar dados de planilha
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  Selecione e copie as colunas <strong>Nome</strong> e <strong>Data (DD/MM)</strong> da planilha (Ctrl+C) e cole abaixo:
                </p>
                <textarea
                  className="input-field"
                  style={{ width: '100%', height: '90px', fontSize: '0.85rem' }}
                  placeholder="Cole aqui (ex: Kaique Luiz Fernandes Da Silva   25/01)"
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleParsePastedText}
                  disabled={!pastedText.trim() || importing}
                  style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}
                >
                  Processar Dados Copiados
                </button>
              </div>

              <div>
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Upload size={18} style={{ color: '#2ed573' }} /> Opção 2: Selecionar Arquivo (.xlsx / .csv)
                </h4>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  style={{ marginTop: '0.5rem' }}
                />
              </div>

              {importing && <p style={{ color: '#2ed573', marginTop: '1rem', textAlign: 'center' }}>Importando dados no sistema...</p>}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-outline" onClick={() => setIsImportModalOpen(false)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar / Editar Evento */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '540px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarIcon size={20} style={{ color: 'var(--accent-orange)' }} />
                {editingEvent ? 'Editar Registro' : type === 'Aniversário' ? 'Cadastrar Aniversariante' : 'Novo Registro no Calendário'}
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
                    {type === 'Aniversário' ? 'Nome do Colaborador *' : 'Título do Evento *'}
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder={type === 'Aniversário' ? 'Ex: Kaique Luiz Fernandes Da Silva' : 'Ex: Reunião Geral de Fechamento'}
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
                      <option value="Aniversário">🎉 Aniversário</option>
                      <option value="Evento">📅 Evento</option>
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
                    {type === 'Aniversário' ? 'Departamento / Observações (opcional)' : 'Descrição / Horário / Local (opcional)'}
                  </label>
                  <textarea
                    className="input-field"
                    style={{ width: '100%', height: '80px', resize: 'vertical' }}
                    placeholder={type === 'Aniversário' ? 'Ex: Departamento de Operações' : 'Ex: Auditório Principal - 14:00h'}
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
