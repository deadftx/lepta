import { useEffect, useState } from 'react';
import { useAuth } from '../../core/AuthContext';
import { API_BASE_URL } from '../../../config/api';
import {
  PieChart,
  Plus,
  Edit,
  Trash2,
  Eye,
  Globe,
  Users,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  Sliders,
  ExternalLink
} from 'lucide-react';
import '../../core/styles/Operations.css';
import '../../core/styles/Permissions.css';

interface Dashboard {
  id: string;
  title: string;
  url: string;
  embedUrl: string;
  description?: string;
  accessType: 'ALL' | 'GROUPS' | 'USERS';
  allowedGroups?: string[];
  allowedUsers?: string[];
  createdBy?: string;
  createdAt?: string;
}

interface Group {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  username: string;
  email?: string;
}

const parsePowerBiUrl = (rawUrl: string): string => {
  if (!rawUrl) return '';

  let cleanUrl = rawUrl.trim();

  // If full HTML iframe snippet was pasted:
  const iframeSrcMatch = cleanUrl.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch && iframeSrcMatch[1]) {
    cleanUrl = iframeSrcMatch[1];
  }

  if (cleanUrl.includes('reportEmbed')) {
    if (!cleanUrl.includes('autoAuth')) {
      cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + 'autoAuth=true';
    }
    return cleanUrl;
  }

  // Parse https://app.powerbi.com/groups/{groupId}/reports/{reportId}/...
  const groupsMatch = cleanUrl.match(/\/groups\/([^\/]+)\/reports\/([^\/]+)/i);
  if (groupsMatch) {
    const groupId = groupsMatch[1];
    const reportId = groupsMatch[2];
    return `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${groupId}&autoAuth=true`;
  }

  return cleanUrl;
};

const BI = () => {
  const { user } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State for Import / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);

  // Modal State for Preview
  const [previewDashboard, setPreviewDashboard] = useState<Dashboard | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAccessType, setFormAccessType] = useState<'ALL' | 'GROUPS' | 'USERS'>('ALL');
  const [formAllowedGroups, setFormAllowedGroups] = useState<string[]>([]);
  const [formAllowedUsers, setFormAllowedUsers] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const authHeaders = { Authorization: `Bearer ${localStorage.getItem('lepta_auth_token')}` };
      const [dashRes, groupsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/power-bi-dashboards`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/groups`),
        fetch(`${API_BASE_URL}/users`, { headers: authHeaders })
      ]);

      if (!dashRes.ok) throw new Error('Não foi possível consultar os dashboards salvos.');

      const dashData: Dashboard[] = await dashRes.json();
      const groupsData: Group[] = await groupsRes.json();
      const usersData: UserItem[] = await usersRes.json();

      setDashboards(dashData || []);
      setGroups(groupsData || []);
      setUsersList(usersData || []);
    } catch (err) {
      console.error('Erro ao carregar dados do BI:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenImportModal = () => {
    setEditingDashboard(null);
    setFormTitle('');
    setFormUrl('');
    setFormDescription('');
    setFormAccessType('ALL');
    setFormAllowedGroups([]);
    setFormAllowedUsers([]);
    setMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (dash: Dashboard) => {
    setEditingDashboard(dash);
    setFormTitle(dash.title);
    setFormUrl(dash.url);
    setFormDescription(dash.description || '');
    setFormAccessType(dash.accessType);
    setFormAllowedGroups(dash.allowedGroups || []);
    setFormAllowedUsers(dash.allowedUsers || []);
    setMessage(null);
    setIsModalOpen(true);
  };

  const handleDeleteDashboard = async (id: string, title: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o dashboard "${title}"?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/power-bi-dashboards/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('lepta_auth_token')}` }
      });
      if (!response.ok) throw new Error('Não foi possível excluir o dashboard.');
      setDashboards(dashboards.filter(d => d.id !== id));
    } catch (err) {
      console.error('Erro ao deletar dashboard:', err);
    }
  };

  const handleToggleGroup = (groupId: string) => {
    setFormAllowedGroups(prev =>
      prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
    );
  };

  const handleToggleUser = (userId: string) => {
    setFormAllowedUsers(prev =>
      prev.includes(userId) ? prev.filter(u => u !== userId) : [...prev, userId]
    );
  };

  const handleSaveDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!formTitle.trim()) {
      setMessage({ type: 'error', text: 'Por favor, informe o nome do dashboard.' });
      return;
    }

    if (!formUrl.trim()) {
      setMessage({ type: 'error', text: 'Por favor, insira o link do Power BI.' });
      return;
    }

    const embedUrl = parsePowerBiUrl(formUrl);

    const payload: Partial<Dashboard> = {
      title: formTitle.trim(),
      url: formUrl.trim(),
      embedUrl,
      description: formDescription.trim(),
      accessType: formAccessType,
      allowedGroups: formAccessType === 'GROUPS' ? formAllowedGroups : [],
      allowedUsers: formAccessType === 'USERS' ? formAllowedUsers : [],
      createdBy: user?.username || 'equipe_bi',
      createdAt: editingDashboard ? editingDashboard.createdAt : new Date().toISOString()
    };

    try {
      setSaving(true);
      const authToken = localStorage.getItem('lepta_auth_token');
      if (editingDashboard) {
        // Edit existing
        const res = await fetch(`${API_BASE_URL}/api/power-bi-dashboards/${editingDashboard.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ ...editingDashboard, ...payload })
        });
        if (!res.ok) throw new Error('Não foi possível atualizar o dashboard.');
        const updated = await res.json();
        setDashboards(dashboards.map(d => (d.id === updated.id ? updated : d)));
      } else {
        // Create new
        const newDash = {
          id: `dash_${Date.now()}`,
          ...payload
        };
        const res = await fetch(`${API_BASE_URL}/api/power-bi-dashboards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
          body: JSON.stringify(newDash)
        });
        if (!res.ok) throw new Error('Não foi possível salvar o dashboard.');
        const saved = await res.json();
        setDashboards([...dashboards, saved]);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Erro ao salvar dashboard:', err);
      setMessage({ type: 'error', text: 'Falha ao salvar no banco de dados.' });
    } finally {
      setSaving(false);
    }
  };

  const renderAccessBadge = (dash: Dashboard) => {
    if (dash.accessType === 'ALL') {
      return <span className="badge" style={{ background: 'rgba(46, 213, 115, 0.2)', color: '#2ed573' }}>🌐 Todos os Usuários</span>;
    }
    if (dash.accessType === 'GROUPS') {
      const count = dash.allowedGroups?.length || 0;
      return <span className="badge" style={{ background: 'rgba(51, 153, 255, 0.2)', color: '#3399ff' }}>👥 {count} Grupo(s)</span>;
    }
    if (dash.accessType === 'USERS') {
      const count = dash.allowedUsers?.length || 0;
      return <span className="badge" style={{ background: 'rgba(255, 153, 0, 0.2)', color: '#ff9900' }}>👤 {count} Usuário(s)</span>;
    }
    return null;
  };

  return (
    <div className="operations-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2>Business Intelligence</h2>
          <p>Ferramenta de gestão, cadastro e atribuição de permissões dos dashboards do Power BI.</p>
        </div>

        <button
          className="btn-primary"
          onClick={handleOpenImportModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <Plus size={18} /> Importar Dashboard
        </button>
      </div>

      {/* Main Table / Management View */}
      <div className="internal-card glass">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={20} style={{ color: 'var(--accent-orange)' }} /> Dashboards Cadastrados ({dashboards.length})
          </h3>
        </div>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Carregando dados do servidor...</p>
        ) : dashboards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <PieChart size={48} style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: '1rem' }} />
            <h4>Nenhum dashboard cadastrado</h4>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Importe o primeiro dashboard do Power BI para disponibilizá-lo na intranet.
            </p>
            <button className="btn-primary" onClick={handleOpenImportModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> Importar Primeiro Dashboard
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Nome do Dashboard</th>
                  <th>Permissão de Acesso</th>
                  <th>Criado Por</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {dashboards.map(dash => (
                  <tr key={dash.id}>
                    <td>
                      <strong style={{ color: 'var(--text-light)', display: 'block' }}>{dash.title}</strong>
                      {dash.description && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{dash.description}</span>
                      )}
                    </td>
                    <td>{renderAccessBadge(dash)}</td>
                    <td>{dash.createdBy || 'Sistema'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn-icon"
                          onClick={() => setPreviewDashboard(dash)}
                          title="Visualizar / Testar Relatório"
                        >
                          <Eye size={16} /> Testar
                        </button>

                        <button
                          className="btn-icon"
                          onClick={() => handleOpenEditModal(dash)}
                          title="Editar Dashboard"
                        >
                          <Edit size={16} /> Editar
                        </button>

                        <button
                          className="btn-icon"
                          onClick={() => handleDeleteDashboard(dash.id, dash.title)}
                          title="Excluir Dashboard"
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

      {/* Modal Importar / Editar Dashboard */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '640px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PieChart size={20} style={{ color: 'var(--accent-orange)' }} />
                {editingDashboard ? 'Editar Dashboard' : 'Importar Dashboard do Power BI'}
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

            <form onSubmit={handleSaveDashboard}>
              <div className="modal-body" style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Nome do Dashboard *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="Ex: Relatório Geral de Operações"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    required
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Link do Power BI (URL ou snippet iframe) *
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ width: '100%' }}
                    placeholder="https://app.powerbi.com/groups/.../reports/..."
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Cole o link do Power BI. O sistema converterá automaticamente para exibição.
                  </span>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Descrição do Relatório (opcional)
                  </label>
                  <textarea
                    className="input-field"
                    style={{ width: '100%', height: '70px', resize: 'vertical' }}
                    placeholder="Informações adicionais para a equipe..."
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                  />
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem', marginTop: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-light)' }}>
                    Configurar Permissão de Acesso ao Relatório:
                  </label>

                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    <label className="permission-item" style={{ flex: 1, margin: 0 }}>
                      <input
                        type="radio"
                        name="accessType"
                        checked={formAccessType === 'ALL'}
                        onChange={() => setFormAccessType('ALL')}
                      />
                      <Globe size={16} /> <span>Todos os Usuários</span>
                    </label>

                    <label className="permission-item" style={{ flex: 1, margin: 0 }}>
                      <input
                        type="radio"
                        name="accessType"
                        checked={formAccessType === 'GROUPS'}
                        onChange={() => setFormAccessType('GROUPS')}
                      />
                      <Users size={16} /> <span>Por Grupos/Setores</span>
                    </label>

                    <label className="permission-item" style={{ flex: 1, margin: 0 }}>
                      <input
                        type="radio"
                        name="accessType"
                        checked={formAccessType === 'USERS'}
                        onChange={() => setFormAccessType('USERS')}
                      />
                      <User size={16} /> <span>Usuários Específicos</span>
                    </label>
                  </div>

                  {formAccessType === 'GROUPS' && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                      <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                        Marque os grupos/setores permitidos:
                      </p>
                      {groups.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nenhum grupo cadastrado.</p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                          {groups.map(g => (
                            <label key={g.id} className="permission-item" style={{ padding: '6px 10px' }}>
                              <input
                                type="checkbox"
                                checked={formAllowedGroups.includes(g.id)}
                                onChange={() => handleToggleGroup(g.id)}
                              />
                              <span>{g.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {formAccessType === 'USERS' && (
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px' }}>
                      <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>
                        Marque os usuários permitidos:
                      </p>
                      {usersList.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nenhum usuário encontrado.</p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                          {usersList.map(u => (
                            <label key={u.id} className="permission-item" style={{ padding: '6px 10px' }}>
                              <input
                                type="checkbox"
                                checked={formAllowedUsers.includes(u.id)}
                                onChange={() => handleToggleUser(u.id)}
                              />
                              <span>{u.username} ({u.email || 'Sem e-mail'})</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Dashboard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {previewDashboard && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '900px', width: '95%', padding: '1.5rem' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Eye size={20} style={{ color: 'var(--accent-orange)' }} />
                Pré-visualização: {previewDashboard.title}
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <a
                  href={previewDashboard.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-icon"
                  style={{ textDecoration: 'none', padding: '4px 10px', fontSize: '0.85rem' }}
                >
                  <ExternalLink size={14} /> Abrir no Power BI
                </a>
                <button className="icon-btn" onClick={() => setPreviewDashboard(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ marginBottom: 0 }}>
              <iframe
                title={previewDashboard.title}
                src={previewDashboard.embedUrl}
                style={{
                  width: '100%',
                  height: '600px',
                  border: 'none',
                  borderRadius: '8px',
                  background: '#fff'
                }}
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BI;
