import React, { useEffect, useState, useMemo } from 'react';
import type { User } from '../../../core/AuthContext';
import {
  Edit, Save, X, Users, UserPlus, Unlock, Trash2,
  AlertCircle, CheckCircle2, Shield, Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import '../../../core/styles/Permissions.css';
import PermissionSelector from '../../../core/PermissionSelector';
import { normalizePermissions, allPermissionIds } from '../../../core/permissions';

interface Group {
  id: string;
  name: string;
  permissions: string[];
  userIds?: string[];
}

const fetchJsonSafe = async (url: string, init?: RequestInit) => {
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
};

const Permissions: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal de edição de permissões
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      let usersData = await fetchJsonSafe(`${API_BASE_URL}/api/users`, { headers: getAuthHeaders() });
      if (!usersData) {
        usersData = await fetchJsonSafe(`${API_BASE_URL}/users`, { headers: getAuthHeaders() });
      }

      let groupsData = await fetchJsonSafe(`${API_BASE_URL}/api/groups`, { headers: getAuthHeaders() });
      if (!groupsData) {
        groupsData = await fetchJsonSafe(`${API_BASE_URL}/groups`, { headers: getAuthHeaders() });
      }

      setUsers(Array.isArray(usersData) ? usersData : []);
      setGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (error: any) {
      console.error("Erro ao buscar dados", error);
      setError(error.message || 'Não foi possível carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const groupMap = useMemo(() => {
    const map = new Map<string, Group>();
    groups.forEach(g => map.set(String(g.id), g));
    return map;
  }, [groups]);

  const handleEditClick = (user: User) => {
    setError('');
    setSuccess('');
    setEditingUser(user);

    // Identifica grupo atual do usuário
    const currentGroupId = user.groupId || user.group_id || '';
    setSelectedGroupId(currentGroupId ? String(currentGroupId) : '');

    // Permissões diretas/individuais
    const direct = user.directPermissions && user.directPermissions.length > 0
      ? user.directPermissions
      : user.permissions;
    setSelectedPermissions(normalizePermissions(direct));
  };

  const currentGroupPermissions = useMemo(() => {
    if (!selectedGroupId) return [];
    const grp = groupMap.get(selectedGroupId);
    return grp ? normalizePermissions(grp.permissions || []) : [];
  }, [selectedGroupId, groupMap]);

  const handleTogglePermission = (areaId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(areaId) 
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // 1. Salva permissões diretas do usuário
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${editingUser.id}/permissions`, {
        method: 'PUT',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ permissions: selectedPermissions })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar as permissões.');

      // 2. Se o grupo foi alterado, atualiza o usuário no banco
      const oldGroupId = editingUser.groupId || editingUser.group_id || '';
      if (selectedGroupId !== oldGroupId) {
        const updatePayload = {
          ...editingUser,
          group_id: selectedGroupId || null,
          groupId: selectedGroupId || null
        };
        let uRes = await fetch(`${API_BASE_URL}/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(updatePayload)
        });
        if (!uRes.ok) {
          await fetch(`${API_BASE_URL}/users/${editingUser.id}`, {
            method: 'PUT',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(updatePayload)
          });
        }
      }

      window.dispatchEvent(new Event('lepta_permissions_updated'));

      setSuccess(`Permissões e setor de ${editingUser.username} atualizados com sucesso!`);
      setEditingUser(null);
      await fetchData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (error: any) {
      console.error("Erro ao salvar", error);
      setError(error.message || 'Não foi possível salvar as permissões.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlock = async (user: User) => {
    const token = localStorage.getItem('lepta_auth_token');
    const response = await fetch(`${API_BASE_URL}/api/auth/admin/unlock/${user.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      setUsers(current => current.map(item => item.id === user.id
        ? { ...item, accessLocked: false, fullyLocked: false }
        : item));
      setSuccess(`Usuário ${user.username} desbloqueado.`);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleDeleteUser = async () => {
    if (!editingUser) return;
    const confirmed = window.confirm(`Excluir definitivamente o usuário "${editingUser.username}"?`);
    if (!confirmed) return;

    const response = await fetch(`${API_BASE_URL}/users/${editingUser.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('lepta_auth_token')}` }
    });
    if (!response.ok) {
      window.alert('Não foi possível excluir o usuário.');
      return;
    }
    setUsers(current => current.filter(user => user.id !== editingUser.id));
    setEditingUser(null);
    setSuccess('Usuário excluído.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  return (
    <div className="permissions-page">
      <div className="internal-card glass">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3>Gestão de Permissões de Usuários</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Cada usuário possui seus acessos individuais <strong>somados</strong> aos acessos do seu Setor/Grupo.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/permissions/create-user" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
              <UserPlus size={18} /> Criar Usuário
            </Link>
            <Link to="/permissions/groups" className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
              <Users size={18} /> Configurar Grupos & Setores
            </Link>
          </div>
        </div>

        {error && (
          <div className="permissions-feedback error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} /> {error}
          </div>
        )}
        {success && (
          <div className="permissions-feedback success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} /> {success}
          </div>
        )}

        {/* BUSCA */}
        <div style={{ margin: '1rem 0 1.25rem 0' }}>
          <input
            type="text"
            placeholder="Filtrar usuários por nome, email ou identificador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontSize: '0.875rem'
            }}
          />
        </div>

        {loading ? (
          <p>Carregando usuários e permissões...</p>
        ) : (
          <div className="table-responsive">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Setor / Grupo</th>
                  <th>Perfil</th>
                  <th>Acessos Efetivos</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>Nenhum usuário encontrado.</td></tr>
                ) : (
                  filteredUsers.map(user => {
                    const userGroupId = user.groupId || user.group_id;
                    const group = userGroupId ? groupMap.get(String(userGroupId)) : null;
                    const groupPerms = group ? normalizePermissions(group.permissions || []) : [];
                    const directPerms = user.directPermissions && user.directPermissions.length > 0
                      ? user.directPermissions
                      : user.permissions || [];
                    const totalPerms = user.role === 'MASTER'
                      ? allPermissionIds.length
                      : normalizePermissions([...directPerms, ...groupPerms]).length;

                    return (
                      <tr key={user.id}>
                        <td>
                          <strong style={{ color: '#f8fafc' }}>{user.username}</strong>
                        </td>
                        <td>{user.email || '-'}</td>
                        <td>
                          {group ? (
                            <span style={{
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#93c5fd',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px'
                            }}>
                              <Users size={13} /> {group.name}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Sem Setor</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${user.role === 'MASTER' ? 'master' : 'user'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{
                              background: 'rgba(34, 197, 94, 0.15)',
                              color: '#86efac',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              fontWeight: 600
                            }}>
                              {user.role === 'MASTER' ? 'Acesso Total (Master)' : `${totalPerms} áreas`}
                            </span>
                            {group && user.role !== 'MASTER' && (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                ({directPerms.length} ind. + {groupPerms.length} grupo)
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            {(user.accessLocked || user.fullyLocked) && (
                              <button className="btn-icon" onClick={() => handleUnlock(user)} title="Desbloquear usuário">
                                <Unlock size={16} /> Desbloquear
                              </button>
                            )}
                            {user.role !== 'MASTER' && (
                              <button className="btn-icon" onClick={() => handleEditClick(user)}>
                                <Edit size={16} /> Configurar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE CONFIGURAÇÃO DE ACESSOS */}
      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '800px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Shield size={22} color="#60a5fa" />
                <h3 style={{ margin: 0 }}>Configurar Acessos: {editingUser.username}</h3>
              </div>
              <button className="icon-btn" onClick={() => setEditingUser(null)}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              {/* SELETOR DE GRUPO/SETOR */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.25rem'
              }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#cbd5e1', fontWeight: 600, fontSize: '0.875rem' }}>
                  Setor / Grupo Vinculado
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    background: '#0f172a',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#f8fafc',
                    fontSize: '0.875rem'
                  }}
                >
                  <option value="">Nenhum (Somente Permissões Individuais)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({(g.permissions || []).length} áreas liberadas pelo grupo)
                    </option>
                  ))}
                </select>

                {currentGroupPermissions.length > 0 && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '0.8rem',
                    color: '#93c5fd',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Info size={14} />
                    Este usuário herdará automaticamente {currentGroupPermissions.length} permissões do grupo selecionado.
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                  Permissões Individuais Adicionais:
                </p>
                <p style={{ margin: '4px 0 12px 0', fontSize: '0.8rem', color: '#94a3b8' }}>
                  Marque as áreas adicionais exclusivas deste usuário. O acesso final será a <strong>soma</strong> das permissões individuais com as do grupo.
                </p>
              </div>

              <PermissionSelector selected={selectedPermissions} onToggle={handleTogglePermission} />
            </div>

            <div className="modal-footer">
              <button className="btn-danger" onClick={handleDeleteUser}>
                <Trash2 size={16} /> Excluir usuário
              </button>
              <span className="modal-footer-spacer" />
              <button className="btn-outline" onClick={() => setEditingUser(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSavePermissions} disabled={saving}>
                <Save size={16} /> {saving ? 'Salvando no banco...' : 'Salvar Acessos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Permissions;
