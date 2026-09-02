import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Edit2,
  ExternalLink,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  UserRound,
  Users,
  X
} from 'lucide-react';
import { API_BASE_URL } from '../../../../config/api';
import './ManagerRegistration.css';

export interface ManagerAccount {
  id: string;
  nome: string;
  email: string;
  cargo: 'SUPERINTENDENTE' | 'GERENTE' | string;
  superintendente_id?: string | null;
  superintendente_nome?: string | null;
  ativo?: number;
  totalCedentes?: number;
  created_at?: string;
  updated_at?: string;
}

export interface LinkedCedente {
  documento: string;
  nome: string;
  email: string;
  telefone: string;
  tipo?: string;
  gerente?: string;
  superintendente?: string;
  ua?: string;
  source?: string;
}

const ManagerRegistration = () => {
  const navigate = useNavigate();
  const [managers, setManagers] = useState<ManagerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cargoFilter, setCargoFilter] = useState('TODOS');

  // Modal Novo / Edição
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<ManagerAccount | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cargo: 'GERENTE',
    superintendente_id: '',
    superintendente_nome: ''
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Modal / Drawer de Cedentes Vinculados
  const [selectedManagerForCedentes, setSelectedManagerForCedentes] = useState<ManagerAccount | null>(null);
  const [cedentesList, setCedentesList] = useState<LinkedCedente[]>([]);
  const [loadingCedentes, setLoadingCedentes] = useState(false);
  const [cedenteSearchTerm, setCedenteSearchTerm] = useState('');

  const token = () => localStorage.getItem('lepta_auth_token');
  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token()}`
  });

  const fetchManagers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/gerentes`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Não foi possível carregar os gerentes.');
      const data = await res.json();
      if (Array.isArray(data)) {
        setManagers(data);
      }
    } catch (err: any) {
      console.error('Erro ao buscar gerentes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAndRefresh = async () => {
    try {
      setLoading(true);
      await fetch(`${API_BASE_URL}/api/gerentes/sync`, {
        method: 'POST',
        headers: authHeaders()
      }).catch(() => {});
      await fetchManagers();
    } catch (err: any) {
      console.error('Erro ao sincronizar:', err);
      await fetchManagers();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManagers();
  }, []);

  const openCreateModal = () => {
    setEditingManager(null);
    const defaultSup = managers.find(m => m.cargo === 'SUPERINTENDENTE');
    setFormData({
      nome: '',
      email: '',
      cargo: 'GERENTE',
      superintendente_id: defaultSup?.id || '',
      superintendente_nome: defaultSup?.nome || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (manager: ManagerAccount) => {
    setEditingManager(manager);
    setFormData({
      nome: manager.nome,
      email: manager.email,
      cargo: manager.cargo,
      superintendente_id: manager.superintendente_id || '',
      superintendente_nome: manager.superintendente_nome || ''
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.nome.trim()) {
      setFormError('Informe o nome do gestor.');
      return;
    }
    if (!formData.email.trim()) {
      setFormError('Informe o e-mail corporativo.');
      return;
    }

    try {
      setSaving(true);
      const url = editingManager
        ? `${API_BASE_URL}/api/gerentes/${editingManager.id}`
        : `${API_BASE_URL}/api/gerentes`;
      const method = editingManager ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders(),
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao salvar gestor.');
      }

      setIsModalOpen(false);
      await fetchManagers();
    } catch (err: any) {
      setFormError(err.message || 'Erro de conexão com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (manager: ManagerAccount) => {
    if (!window.confirm(`Deseja realmente remover o gestor ${manager.nome}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/gerentes/${manager.id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (res.ok) {
        await fetchManagers();
      }
    } catch (err) {
      console.error('Erro ao excluir gerente:', err);
    }
  };

  const openCedentesModal = async (manager: ManagerAccount) => {
    setSelectedManagerForCedentes(manager);
    setCedenteSearchTerm('');
    try {
      setLoadingCedentes(true);
      const res = await fetch(`${API_BASE_URL}/api/gerentes/${manager.id}/cedentes`, {
        headers: authHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setCedentesList(data.cedentes || []);
      }
    } catch (err) {
      console.error('Erro ao carregar cedentes do gerente:', err);
    } finally {
      setLoadingCedentes(false);
    }
  };

  // Superintendentes disponíveis para associação
  const superintendentes = managers.filter(m => m.cargo === 'SUPERINTENDENTE');

  // Filtragem da lista
  const filteredManagers = managers.filter(m => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      m.nome.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term) ||
      (m.superintendente_nome || '').toLowerCase().includes(term);

    const matchesCargo = cargoFilter === 'TODOS' || m.cargo === cargoFilter;
    return matchesSearch && matchesCargo;
  });

  const totalGerentes = managers.filter(m => m.cargo === 'GERENTE').length;
  const totalSuperintendentes = managers.filter(m => m.cargo === 'SUPERINTENDENTE').length;
  const totalCedentes = managers.reduce((acc, m) => acc + (m.totalCedentes || 0), 0);

  const formatDoc = (doc: string) => {
    const clean = (doc || '').replace(/\D/g, '');
    if (clean.length === 14) return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (clean.length === 11) return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return doc || '-';
  };

  return (
    <div className="manager-registration-page">
      {/* Header */}
      <div className="manager-header">
        <div>
          <h2 className="manager-title">
            Cadastro de <span className="text-gradient">Gerentes & Gestores</span>
          </h2>
          <p className="manager-subtitle">
            Gerenciamento da estrutura comercial e vinculação direta aos cedentes cadastrados.
          </p>
        </div>
        <div className="manager-header-actions">
          <button className="btn-refresh-managers" onClick={handleSyncAndRefresh} title="Sincronizar e atualizar dados (API BitFin + Banco)">
            <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
          </button>
          <button className="btn-add-manager" onClick={openCreateModal}>
            <Plus size={18} /> Novo Gestor
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div className="manager-metrics-grid">
        <div className="manager-metric-card glass">
          <div className="metric-icon-box blue">
            <UserCheck size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Gerentes de Contas</span>
            <span className="metric-value">{totalGerentes}</span>
          </div>
        </div>

        <div className="manager-metric-card glass">
          <div className="metric-icon-box purple">
            <UserRound size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Superintendentes</span>
            <span className="metric-value">{totalSuperintendentes}</span>
          </div>
        </div>

        <div className="manager-metric-card glass">
          <div className="metric-icon-box emerald">
            <Building2 size={24} />
          </div>
          <div className="metric-info">
            <span className="metric-label">Cedentes Vinculados</span>
            <span className="metric-value">{totalCedentes}</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="manager-filter-bar glass">
        <div className="manager-search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome, e-mail ou superintendente..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search-btn" onClick={() => setSearchTerm('')}>
              <X size={15} />
            </button>
          )}
        </div>

        <div className="manager-cargo-filters">
          <button
            className={`cargo-filter-btn ${cargoFilter === 'TODOS' ? 'active' : ''}`}
            onClick={() => setCargoFilter('TODOS')}
          >
            Todos ({managers.length})
          </button>
          <button
            className={`cargo-filter-btn ${cargoFilter === 'GERENTE' ? 'active' : ''}`}
            onClick={() => setCargoFilter('GERENTE')}
          >
            Gerentes ({totalGerentes})
          </button>
          <button
            className={`cargo-filter-btn ${cargoFilter === 'SUPERINTENDENTE' ? 'active' : ''}`}
            onClick={() => setCargoFilter('SUPERINTENDENTE')}
          >
            Superintendentes ({totalSuperintendentes})
          </button>
        </div>
      </div>

      {/* Tabela de Gerentes */}
      <div className="manager-table-container glass">
        <table className="manager-table">
          <thead>
            <tr>
              <th>Gestor</th>
              <th>E-mail Corporativo</th>
              <th>Cargo</th>
              <th>Superintendente Responsável</th>
              <th style={{ textAlign: 'center' }}>Cedentes na Carteira</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="table-loading-cell">
                  <RefreshCw size={24} className="spin-animation" />
                  <span>Carregando gerentes cadastrados...</span>
                </td>
              </tr>
            ) : filteredManagers.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-empty-cell">
                  <Users size={36} />
                  <p>Nenhum gestor encontrado com os filtros atuais.</p>
                </td>
              </tr>
            ) : (
              filteredManagers.map(manager => {
                const initials = manager.nome
                  .split(' ')
                  .map(n => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();

                return (
                  <tr key={manager.id} className="manager-row">
                    <td>
                      <div
                        className="manager-cell-clickable"
                        onClick={() => openCedentesModal(manager)}
                        title="Clique para ver os cedentes deste gestor"
                      >
                        <div className={`manager-avatar ${manager.cargo === 'SUPERINTENDENTE' ? 'super' : ''}`}>
                          {initials}
                        </div>
                        <div className="manager-name-box">
                          <strong className="manager-name-text">{manager.nome}</strong>
                          <span className="manager-hint-click">Ver cedentes associados</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <a href={`mailto:${manager.email}`} className="manager-email-link" title="Enviar e-mail">
                        <Mail size={14} /> {manager.email}
                      </a>
                    </td>
                    <td>
                      <span className={`badge-cargo ${manager.cargo.toLowerCase()}`}>
                        {manager.cargo === 'SUPERINTENDENTE' ? 'Superintendente' : 'Gerente de Contas'}
                      </span>
                    </td>
                    <td>
                      {manager.cargo === 'SUPERINTENDENTE' ? (
                        <span className="text-muted-dash">—</span>
                      ) : manager.superintendente_nome ? (
                        <span className="superintendente-badge">
                          <UserRound size={13} /> {manager.superintendente_nome}
                        </span>
                      ) : (
                        <span className="text-muted-dash">Não atribuído</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn-cedentes-badge"
                        onClick={() => openCedentesModal(manager)}
                        title="Abrir lista de cedentes"
                      >
                        <Building2 size={13} />
                        <span>{manager.totalCedentes || 0} cedente(s)</span>
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-actions">
                        <button
                          className="btn-action edit"
                          onClick={() => openEditModal(manager)}
                          title="Editar Gestor"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          className="btn-action delete"
                          onClick={() => handleDelete(manager)}
                          title="Excluir Gestor"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de Criação / Edição de Gerente */}
      {isModalOpen && (
        <div className="manager-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="manager-modal-content glass" onClick={e => e.stopPropagation()}>
            <div className="manager-modal-header">
              <h3>{editingManager ? 'Editar Gestor' : 'Novo Gestor'}</h3>
              <button className="btn-modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="manager-modal-form">
              {formError && <div className="manager-form-error">{formError}</div>}

              <div className="form-group">
                <label>Nome Completo *</label>
                <input
                  type="text"
                  placeholder="Ex: André Barroco"
                  value={formData.nome}
                  onChange={e => setFormData({ ...formData, nome: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>E-mail Corporativo (@lepta.com.br) *</label>
                <input
                  type="email"
                  placeholder="Ex: andre.barroco@lepta.com.br"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Cargo / Função *</label>
                <select
                  value={formData.cargo}
                  onChange={e => setFormData({ ...formData, cargo: e.target.value })}
                >
                  <option value="GERENTE">Gerente de Contas</option>
                  <option value="SUPERINTENDENTE">Superintendente Comercial</option>
                </select>
              </div>

              {formData.cargo === 'GERENTE' && (
                <div className="form-group">
                  <label>Superintendente Responsável</label>
                  <select
                    value={formData.superintendente_id}
                    onChange={e => {
                      const supId = e.target.value;
                      const sup = superintendentes.find(s => s.id === supId);
                      setFormData({
                        ...formData,
                        superintendente_id: supId,
                        superintendente_nome: sup ? sup.nome : ''
                      });
                    }}
                  >
                    <option value="">Selecione um superintendente...</option>
                    {superintendentes.map(sup => (
                      <option key={sup.id} value={sup.id}>
                        {sup.nome} ({sup.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="manager-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-modal-save" disabled={saving}>
                  {saving ? 'Salvando...' : editingManager ? 'Atualizar Gestor' : 'Cadastrar Gestor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal / Gaveta de Cedentes do Gerente */}
      {selectedManagerForCedentes && (
        <div className="manager-modal-overlay" onClick={() => setSelectedManagerForCedentes(null)}>
          <div className="manager-modal-content cedentes-modal-content glass" onClick={e => e.stopPropagation()}>
            <div className="manager-modal-header">
              <div>
                <h3>Cedentes Vinculados</h3>
                <p className="cedentes-modal-subtitle">
                  Gestor: <strong>{selectedManagerForCedentes.nome}</strong> ({selectedManagerForCedentes.cargo === 'SUPERINTENDENTE' ? 'Superintendente' : 'Gerente de Contas'})
                  {selectedManagerForCedentes.superintendente_nome && ` • Super: ${selectedManagerForCedentes.superintendente_nome}`}
                </p>
              </div>
              <button className="btn-modal-close" onClick={() => setSelectedManagerForCedentes(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Barra de busca interna de cedentes */}
            <div className="cedentes-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Filtrar por nome ou CNPJ/CPF..."
                value={cedenteSearchTerm}
                onChange={e => setCedenteSearchTerm(e.target.value)}
              />
              {cedenteSearchTerm && (
                <button onClick={() => setCedenteSearchTerm('')}>
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Lista / Tabela de Cedentes */}
            <div className="cedentes-table-container">
              {loadingCedentes ? (
                <div className="cedentes-loading">
                  <RefreshCw size={24} className="spin-animation" />
                  <span>Consultando cedentes vinculados na base...</span>
                </div>
              ) : cedentesList.length === 0 ? (
                <div className="cedentes-empty">
                  <Building2 size={36} />
                  <h4>Nenhum cedente vinculado a este gestor</h4>
                  <p>
                    Para vincular um cedente, acerte o campo "Gerente (Gestor)" diretamente no{' '}
                    <button
                      className="link-btn"
                      onClick={() => {
                        setSelectedManagerForCedentes(null);
                        navigate('/intelligence/cadastro-clientes');
                      }}
                    >
                      Cadastro de Clientes
                    </button>
                    .
                  </p>
                </div>
              ) : (
                <table className="cedentes-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Razão Social / Nome</th>
                      <th>Contatos</th>
                      <th style={{ textAlign: 'right' }}>Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cedentesList
                      .filter(c => {
                        const t = cedenteSearchTerm.toLowerCase();
                        return (
                          c.nome.toLowerCase().includes(t) ||
                          c.documento.toLowerCase().includes(t) ||
                          (c.email || '').toLowerCase().includes(t)
                        );
                      })
                      .map(cedente => (
                        <tr key={cedente.documento}>
                          <td>
                            <code className="doc-code">{formatDoc(cedente.documento)}</code>
                          </td>
                          <td>
                            <strong>{cedente.nome}</strong>
                          </td>
                          <td>
                            <div className="cedente-contact-cell">
                              {cedente.email && cedente.email !== '-' && (
                                <span><Mail size={12} /> {cedente.email}</span>
                              )}
                              {cedente.telefone && cedente.telefone !== '-' && (
                                <span>{cedente.telefone}</span>
                              )}
                              {(!cedente.email || cedente.email === '-') && (!cedente.telefone || cedente.telefone === '-') && (
                                <span className="text-muted-dash">—</span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn-open-client"
                              onClick={() => {
                                setSelectedManagerForCedentes(null);
                                navigate(`/intelligence/cadastro-clientes?search=${encodeURIComponent(cedente.documento || cedente.nome)}`);
                              }}
                              title="Abrir no Cadastro de Clientes"
                            >
                              <ExternalLink size={13} />
                              <span>Abrir</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="cedentes-modal-footer">
              <span>Total: {cedentesList.length} cedente(s)</span>
              <button className="btn-modal-cancel" onClick={() => setSelectedManagerForCedentes(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerRegistration;
