import React, { useEffect, useState, useMemo } from 'react';
import {
  Edit, Save, Plus, X, ArrowLeft, Users, Check,
  Search, Shield, Trash2, AlertCircle, CheckCircle2, UserCheck
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import '../../../core/styles/Permissions.css';
import PermissionSelector from '../../../core/PermissionSelector';
import { normalizePermissions } from '../../../core/permissions';

interface Group {
  id: string;
  name: string;
  permissions: string[];
  userIds?: string[];
}

interface SystemUser {
  id: string;
  username: string;
  email?: string;
  role: 'MASTER' | 'USER';
  groupId?: string;
  group_id?: string;
  groupName?: string;
  permissions?: string[];
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

const Groups: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal de edição / criação
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState<'USERS' | 'PERMISSIONS'>('USERS');

  // Feedback
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      // Tenta buscar grupos em /api/groups e /groups
      let groupsData = await fetchJsonSafe(`${API_BASE_URL}/api/groups`, { headers: getAuthHeaders() });
      if (!groupsData) {
        groupsData = await fetchJsonSafe(`${API_BASE_URL}/groups`, { headers: getAuthHeaders() });
      }

      // Tenta buscar usuários em /api/users e /users
      let usersData = await fetchJsonSafe(`${API_BASE_URL}/api/users`, { headers: getAuthHeaders() });
      if (!usersData) {
        usersData = await fetchJsonSafe(`${API_BASE_URL}/users`, { headers: getAuthHeaders() });
      }

      const parsedGroups: Group[] = Array.isArray(groupsData) ? groupsData : [];
      const parsedUsers: SystemUser[] = Array.isArray(usersData) ? usersData : [];

      // Sincroniza userIds em grupos se já associados em usuarios_lepta
      const updatedGroups = parsedGroups.map(g => {
        const directMembers = parsedUsers
          .filter(u => String(u.group_id || u.groupId) === String(g.id))
          .map(u => u.id);
        const mergedUserIds = Array.from(new Set([...(g.userIds || []), ...directMembers]));
        return {
          ...g,
          userIds: mergedUserIds
        };
      });

      setGroups(updatedGroups);
      setUsers(parsedUsers);
    } catch (error: any) {
      console.error("Erro ao buscar dados", error);
      setErrorMsg(error.message || 'Erro ao carregar dados de grupos e usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openNewGroupModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setSelectedPermissions([]);
    setSelectedUserIds([]);
    setUserSearchTerm('');
    setModalTab('USERS');
    setIsModalOpen(true);
  };

  const openEditModal = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setSelectedPermissions(normalizePermissions(group.permissions || []));
    
    // Identifica usuários membros deste grupo
    const memberIds = users
      .filter(u => String(u.group_id || u.groupId) === String(group.id) || (Array.isArray(group.userIds) && group.userIds.includes(u.id)))
      .map(u => u.id);

    setSelectedUserIds(Array.from(new Set([...(group.userIds || []), ...memberIds])));
    setUserSearchTerm('');
    setModalTab('USERS');
    setIsModalOpen(true);
  };

  const handleTogglePermission = (areaId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(areaId) 
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAllUsers = () => {
    setSelectedUserIds(users.map(u => u.id));
  };

  const handleClearAllUsers = () => {
    setSelectedUserIds([]);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      setErrorMsg('O nome do grupo/setor é obrigatório.');
      return;
    }

    try {
      setSaving(true);
      setErrorMsg('');

      const targetId = editingGroup ? editingGroup.id : Date.now().toString();
      const payload: Group = {
        id: targetId,
        name: groupName.trim(),
        permissions: selectedPermissions,
        userIds: selectedUserIds
      };

      let saveRes = await fetch(`${API_BASE_URL}/api/groups${editingGroup ? `/${editingGroup.id}` : ''}`, {
        method: editingGroup ? 'PUT' : 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      if (!saveRes.ok) {
        saveRes = await fetch(`${API_BASE_URL}/groups${editingGroup ? `/${editingGroup.id}` : ''}`, {
          method: editingGroup ? 'PUT' : 'POST',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload)
        });
      }

      // Sincroniza cada usuário adicionado ou removido no banco de usuários para resiliência
      const oldMemberIds = new Set(
        editingGroup
          ? users.filter(u => String(u.group_id || u.groupId) === String(editingGroup.id) || (Array.isArray(editingGroup.userIds) && editingGroup.userIds.includes(u.id))).map(u => u.id)
          : []
      );
      const newMemberIds = new Set(selectedUserIds);

      // Atualiza usuários adicionados
      for (const userId of selectedUserIds) {
        try {
          const userObj = users.find(u => u.id === userId);
          if (userObj && String(userObj.group_id || userObj.groupId) !== targetId) {
            let uRes = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
              method: 'PUT',
              headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify({ ...userObj, group_id: targetId, groupId: targetId })
            });
            if (!uRes.ok) {
              await fetch(`${API_BASE_URL}/users/${userId}`, {
                method: 'PUT',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ ...userObj, group_id: targetId, groupId: targetId })
              });
            }
          }
        } catch {}
      }

      // Atualiza usuários removidos
      for (const oldId of oldMemberIds) {
        if (!newMemberIds.has(oldId)) {
          try {
            const userObj = users.find(u => u.id === oldId);
            if (userObj) {
              let uRes = await fetch(`${API_BASE_URL}/api/users/${oldId}`, {
                method: 'PUT',
                headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ ...userObj, group_id: null, groupId: null })
              });
              if (!uRes.ok) {
                await fetch(`${API_BASE_URL}/users/${oldId}`, {
                  method: 'PUT',
                  headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
                  body: JSON.stringify({ ...userObj, group_id: null, groupId: null })
                });
              }
            }
          } catch {}
        }
      }

      // Atualiza cache de grupos no cliente e dispara evento para reavaliar menus em tempo real
      try {
        const cachedStr = localStorage.getItem('lepta_groups_cache');
        const list = cachedStr ? JSON.parse(cachedStr) : [];
        const nextList = Array.isArray(list)
          ? [payload, ...list.filter((g: any) => String(g.id) !== String(targetId))]
          : [payload];
        localStorage.setItem('lepta_groups_cache', JSON.stringify(nextList));
      } catch {}

      window.dispatchEvent(new Event('lepta_permissions_updated'));

      setSuccessMsg(`Grupo "${payload.name}" salvo com sucesso com ${selectedUserIds.length} membro(s)!`);
      setIsModalOpen(false);
      await fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error: any) {
      console.error("Erro ao salvar grupo:", error);
      setErrorMsg(error.message || 'Erro ao salvar grupo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    const confirmDelete = window.confirm(`Deseja realmente excluir o grupo "${group.name}"? Os usuários perderão os acessos herdados deste grupo.`);
    if (!confirmDelete) return;

    try {
      setLoading(true);
      let delRes = await fetch(`${API_BASE_URL}/api/groups/${group.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!delRes.ok) {
        delRes = await fetch(`${API_BASE_URL}/groups/${group.id}`, {
          method: 'DELETE',
          headers: getAuthHeaders()
        });
      }

      try {
        const cachedStr = localStorage.getItem('lepta_groups_cache');
        if (cachedStr) {
          const list = JSON.parse(cachedStr);
          if (Array.isArray(list)) {
            localStorage.setItem('lepta_groups_cache', JSON.stringify(list.filter((g: any) => String(g.id) !== String(group.id))));
          }
        }
      } catch {}

      window.dispatchEvent(new Event('lepta_permissions_updated'));

      setSuccessMsg(`Grupo "${group.name}" excluído.`);
      await fetchData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir grupo.');
    } finally {
      setLoading(false);
    }
  };

  const filteredModalUsers = useMemo(() => {
    const q = userSearchTerm.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  }, [users, userSearchTerm]);

  return (
    <div className="permissions-page">
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/permissions" className="btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <ArrowLeft size={18} /> Voltar para Usuários & Permissões
        </Link>
      </div>

      {errorMsg && (
        <div className="permissions-feedback error" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="permissions-feedback success" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={18} /> {successMsg}
        </div>
      )}

      <div className="internal-card glass">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3>Gestão de Grupos & Setores</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Vincule colaboradores aos grupos. Os acessos do usuário serão a <strong>união</strong> dos seus acessos individuais com os acessos do grupo.
            </p>
          </div>
          <button className="btn-primary" onClick={openNewGroupModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Novo Grupo
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
            <p>Carregando grupos e colaboradores...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Nome do Grupo / Setor</th>
                  <th>Membros Integrantes</th>
                  <th>Permissões Vinculadas</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>Nenhum grupo cadastrado até o momento.</td></tr>
                ) : (
                  groups.map(group => {
                    const memberUsers = users.filter(u =>
                      String(u.group_id || u.groupId) === String(group.id) ||
                      (Array.isArray(group.userIds) && group.userIds.includes(u.id))
                    );

                    return (
                      <tr key={group.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              background: 'rgba(59, 130, 246, 0.15)',
                              color: '#60a5fa',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Users size={16} />
                            </div>
                            <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{group.name}</strong>
                          </div>
                        </td>
                        <td>
                          {memberUsers.length === 0 ? (
                            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Nenhum membro</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '350px' }}>
                              {memberUsers.slice(0, 4).map(u => (
                                <span key={u.id} style={{
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  color: '#cbd5e1'
                                }}>
                                  {u.username || u.email}
                                </span>
                              ))}
                              {memberUsers.length > 4 && (
                                <span style={{
                                  background: 'rgba(59, 130, 246, 0.2)',
                                  color: '#93c5fd',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600
                                }}>
                                  +{memberUsers.length - 4} mais
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{
                            background: (group.permissions || []).length > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: (group.permissions || []).length > 0 ? '#86efac' : '#94a3b8',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: 600
                          }}>
                            {(group.permissions || []).length} áreas liberadas
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button className="btn-icon" onClick={() => openEditModal(group)} title="Editar Grupo">
                              <Edit size={16} /> Editar
                            </button>
                            <button
                              className="btn-icon"
                              onClick={() => handleDeleteGroup(group)}
                              style={{ color: '#f87171' }}
                              title="Excluir Grupo"
                            >
                              <Trash2 size={16} />
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
        )}
      </div>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE GRUPO */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass" style={{ maxWidth: '780px', width: '95%' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Users size={22} color="#60a5fa" />
                <h3 style={{ margin: 0 }}>{editingGroup ? `Editar Grupo: ${editingGroup.name}` : 'Novo Grupo / Setor'}</h3>
              </div>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>

            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#cbd5e1', fontWeight: 600, fontSize: '0.875rem' }}>
                  Nome do Setor / Grupo *
                </label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Ex: Financeiro, Diretoria, Jurídico, Comercial..." 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px' }}
                />
              </div>

              {/* ABAS DO MODAL */}
              <div style={{
                display: 'flex',
                gap: '8px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '1rem'
              }}>
                <button
                  type="button"
                  onClick={() => setModalTab('USERS')}
                  style={{
                    background: modalTab === 'USERS' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    color: modalTab === 'USERS' ? '#60a5fa' : '#94a3b8',
                    border: 'none',
                    borderBottom: modalTab === 'USERS' ? '2px solid #60a5fa' : '2px solid transparent',
                    padding: '8px 16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <UserCheck size={16} />
                  Membros do Grupo ({selectedUserIds.length})
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('PERMISSIONS')}
                  style={{
                    background: modalTab === 'PERMISSIONS' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                    color: modalTab === 'PERMISSIONS' ? '#60a5fa' : '#94a3b8',
                    border: 'none',
                    borderBottom: modalTab === 'PERMISSIONS' ? '2px solid #60a5fa' : '2px solid transparent',
                    padding: '8px 16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Shield size={16} />
                  Permissões Herdadas ({selectedPermissions.length})
                </button>
              </div>

              {/* CONTEÚDO DA ABA USUÁRIOS */}
              {modalTab === 'USERS' && (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
                      <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Buscar colaboradores por nome ou email..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: '8px',
                          background: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#f8fafc',
                          fontSize: '0.85rem'
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={handleSelectAllUsers}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#cbd5e1',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Selecionar Todos
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllUsers}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.12)',
                          color: '#cbd5e1',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 10px 0' }}>
                    Selecione os usuários que farão parte deste setor. Eles receberão automaticamente todas as permissões deste grupo somadas às suas permissões individuais.
                  </p>

                  <div style={{
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px',
                    background: 'rgba(15, 23, 42, 0.4)'
                  }}>
                    {filteredModalUsers.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                        Nenhum usuário encontrado.
                      </div>
                    ) : (
                      filteredModalUsers.map(u => {
                        const isSelected = selectedUserIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => handleToggleUser(u.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                              transition: 'background 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '4px',
                                border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.2)',
                                background: isSelected ? '#3b82f6' : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff'
                              }}>
                                {isSelected && <Check size={14} />}
                              </div>
                              <div>
                                <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.875rem' }}>{u.username}</span>
                                {u.email && <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '8px' }}>({u.email})</span>}
                              </div>
                            </div>
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: u.role === 'MASTER' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                              color: u.role === 'MASTER' ? '#fde047' : '#94a3b8'
                            }}>
                              {u.role}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* CONTEÚDO DA ABA PERMISSÕES */}
              {modalTab === 'PERMISSIONS' && (
                <div>
                  <p style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem' }}>
                    Áreas liberadas como padrão para este grupo. Qualquer usuário que pertencer a este grupo terá esses menus e ações desbloqueados:
                  </p>
                  <PermissionSelector selected={selectedPermissions} onToggle={handleTogglePermission} />
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveGroup} disabled={saving || !groupName.trim()}>
                <Save size={18} /> {saving ? 'Salvando...' : 'Salvar Grupo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
