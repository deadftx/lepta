import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  SlidersHorizontal, ShieldCheck, ShoppingCart, UserCheck,
  Search, AlertCircle, RefreshCw, Sparkles, Lock, Users
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './PurchaseWorkflowConfig.css';

interface UserPurchaseConfig {
  id: string;
  username: string;
  email: string;
  globalRole: string;
  groupId?: string | null;
  groupName?: string | null;
  hasAdminAccess: boolean;
  purchasesRole: 'APROVADOR' | 'REQUISITANTE';
  directPurchasesRole?: 'APROVADOR' | 'REQUISITANTE';
  inheritedFromGroup?: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface GroupPurchaseConfig {
  id: string;
  name: string;
  permissions?: string[];
  purchasesRole: 'APROVADOR' | 'REQUISITANTE';
  memberCount: number;
  members?: Array<{ id: string; username: string; email: string }>;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const PurchaseWorkflowConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'GROUPS' | 'USERS'>('GROUPS');
  const [users, setUsers] = useState<UserPurchaseConfig[]>([]);
  const [groups, setGroups] = useState<GroupPurchaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, groupsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/compras/configuracao/usuarios`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/compras/configuracao/grupos`, { headers: getAuthHeaders() })
      ]);

      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(Array.isArray(usersData) ? usersData : []);
      }

      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        setGroups(Array.isArray(groupsData) ? groupsData : []);
      } else {
        // Fallback: busca /groups genérico
        const rawGroupsRes = await fetch(`${API_BASE_URL}/groups`, { headers: getAuthHeaders() });
        if (rawGroupsRes.ok) {
          const rawGroups = await rawGroupsRes.json();
          setGroups(Array.isArray(rawGroups) ? rawGroups.map(g => ({
            id: g.id,
            name: g.name,
            permissions: g.permissions,
            purchasesRole: 'REQUISITANTE',
            memberCount: Array.isArray(g.userIds) ? g.userIds.length : 0,
            updatedAt: null,
            updatedBy: null
          })) : []);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar configuração de aprovadores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Alterar papel de usuário individual
  const handleUserRoleChange = async (userId: string, newRole: 'APROVADOR' | 'REQUISITANTE') => {
    setSavingId(userId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/configuracao/usuarios/${userId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ papel: newRole })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao atualizar papel do usuário.');
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, purchasesRole: newRole, directPurchasesRole: newRole } : u));
      setToastMessage(`Usuário definido como ${newRole === 'APROVADOR' ? 'Aprovador' : 'Requisitante'} com sucesso!`);
      setTimeout(() => setToastMessage(null), 3500);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar alteração.');
    } finally {
      setSavingId(null);
    }
  };

  // Alterar papel de grupo inteiro
  const handleGroupRoleChange = async (groupId: string, newRole: 'APROVADOR' | 'REQUISITANTE') => {
    setSavingId(groupId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/configuracao/grupos/${groupId}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ papel: newRole })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao atualizar papel do grupo.');
      }

      setGroups(prev => prev.map(g => g.id === groupId ? { ...g, purchasesRole: newRole } : g));
      setToastMessage(`Grupo configurado como ${newRole === 'APROVADOR' ? 'Setor Aprovador' : 'Setor Requisitante'}!`);
      setTimeout(() => setToastMessage(null), 3500);
      await fetchData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar alteração.');
    } finally {
      setSavingId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.groupName && u.groupName.toLowerCase().includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const filteredGroups = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return groups;
    return groups.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.id.toLowerCase().includes(q)
    );
  }, [groups, searchTerm]);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const approverUsers = users.filter(u => u.purchasesRole === 'APROVADOR').length;
    const requesterUsers = users.filter(u => u.purchasesRole === 'REQUISITANTE').length;
    const totalGroups = groups.length;
    const approverGroups = groups.filter(g => g.purchasesRole === 'APROVADOR').length;
    return { totalUsers, approverUsers, requesterUsers, totalGroups, approverGroups };
  }, [users, groups]);

  return (
    <div className="pwc-container">
      {/* Header */}
      <div className="pwc-header">
        <div className="pwc-header-top">
          <div className="pwc-icon-badge">
            <SlidersHorizontal size={24} />
          </div>
          <div>
            <h1>Configuração de Esteira de Compras</h1>
            <p className="pwc-subtitle">
              Defina quem atua como <strong>Aprovador</strong> e quem atua como <strong>Requisitante</strong>. Você pode liberar um <strong>grupo/setor inteiro</strong> ou configurar <strong>usuários individualmente</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="pwc-info-cards">
        <div className="pwc-info-card approver">
          <div className="pwc-card-icon">
            <ShieldCheck size={24} />
          </div>
          <div className="pwc-card-body">
            <h3>Aprovadores ({stats.approverUsers} colaboradores)</h3>
            <p>
              Membros de <strong>{stats.approverGroups} grupos aprovadores</strong> + aprovadores individuais. Podem revisar solicitações e aprovar pagamentos.
            </p>
          </div>
        </div>

        <div className="pwc-info-card requester">
          <div className="pwc-card-icon">
            <ShoppingCart size={24} />
          </div>
          <div className="pwc-card-body">
            <h3>Requisitantes ({stats.requesterUsers} colaboradores)</h3>
            <p>
              Podem criar requisições financeiras e acompanhar o histórico de aprovação de seus pedidos.
            </p>
          </div>
        </div>
      </div>

      {/* TABS DE SELEÇÃO: GRUPOS VS USUÁRIOS */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginBottom: '1rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        paddingBottom: '4px'
      }}>
        <button
          type="button"
          onClick={() => { setActiveTab('GROUPS'); setSearchTerm(''); }}
          style={{
            background: activeTab === 'GROUPS' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            color: activeTab === 'GROUPS' ? '#60a5fa' : '#94a3b8',
            border: 'none',
            borderBottom: activeTab === 'GROUPS' ? '3px solid #60a5fa' : '3px solid transparent',
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <Users size={18} />
          Por Setores / Grupos ({groups.length})
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('USERS'); setSearchTerm(''); }}
          style={{
            background: activeTab === 'USERS' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
            color: activeTab === 'USERS' ? '#60a5fa' : '#94a3b8',
            border: 'none',
            borderBottom: activeTab === 'USERS' ? '3px solid #60a5fa' : '3px solid transparent',
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            fontWeight: 600,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          <UserCheck size={18} />
          Por Usuários Individuais ({users.length})
        </button>
      </div>

      {/* Table Card */}
      <div className="pwc-table-card">
        <div className="pwc-table-header">
          <h2>
            {activeTab === 'GROUPS' ? (
              <>
                <Users size={18} /> Setores & Grupos ({filteredGroups.length})
              </>
            ) : (
              <>
                <UserCheck size={18} /> Usuários do Sistema ({filteredUsers.length})
              </>
            )}
          </h2>
          <div className="pwc-search-box">
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder={activeTab === 'GROUPS' ? 'Buscar setor/grupo...' : 'Buscar por nome, setor ou e-mail...'}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="pwc-loading">
            <RefreshCw size={32} className="pwc-spinner" />
            <p style={{ marginTop: '12px' }}>Carregando dados da esteira...</p>
          </div>
        ) : error ? (
          <div className="pwc-loading" style={{ color: '#f87171' }}>
            <AlertCircle size={32} />
            <p style={{ marginTop: '12px' }}>{error}</p>
          </div>
        ) : activeTab === 'GROUPS' ? (
          /* TABELA DE GRUPOS */
          <div className="pwc-table-responsive">
            <table className="pwc-table">
              <thead>
                <tr>
                  <th>Setor / Grupo</th>
                  <th>Colaboradores Integrantes</th>
                  <th>Status do Grupo</th>
                  <th>Papel na Esteira</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      Nenhum grupo encontrado. Crie novos grupos no menu <strong>Administração & Permissões</strong>.
                    </td>
                  </tr>
                ) : (
                  filteredGroups.map(group => {
                    const isApprover = group.purchasesRole === 'APROVADOR';
                    const isSaving = savingId === group.id;

                    return (
                      <tr key={group.id}>
                        <td>
                          <div className="pwc-user-cell">
                            <div className="pwc-avatar" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
                              <Users size={16} />
                            </div>
                            <div>
                              <strong style={{ color: '#f8fafc', fontSize: '0.95rem' }}>{group.name}</strong>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: {group.id}</div>
                            </div>
                          </div>
                        </td>

                        <td>
                          {group.memberCount === 0 ? (
                            <span style={{ color: '#64748b', fontSize: '0.85rem' }}>Sem colaboradores vinculados</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                color: '#cbd5e1',
                                fontWeight: 600
                              }}>
                                {group.memberCount} membro(s)
                              </span>
                              {group.members && group.members.length > 0 && (
                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                  ({group.members.slice(0, 3).map(m => m.username).join(', ')}{group.members.length > 3 ? '...' : ''})
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td>
                          <span className={`pwc-badge ${isApprover ? 'active' : 'inactive'}`}>
                            {isApprover ? (
                              <>
                                <ShieldCheck size={12} /> Todos os Membros Aprovam
                              </>
                            ) : (
                              'Apenas Requisitantes'
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="pwc-role-toggle">
                            <button
                              type="button"
                              disabled={isSaving}
                              className={`pwc-role-btn ${isApprover ? 'active approver' : ''}`}
                              onClick={() => handleGroupRoleChange(group.id, 'APROVADOR')}
                              title="Tornar todos os membros deste grupo aprovadores"
                            >
                              <ShieldCheck size={14} /> Grupo Aprovador
                            </button>
                            <button
                              type="button"
                              disabled={isSaving}
                              className={`pwc-role-btn ${!isApprover ? 'active requester' : ''}`}
                              onClick={() => handleGroupRoleChange(group.id, 'REQUISITANTE')}
                            >
                              <ShoppingCart size={14} /> Requisitante
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
        ) : (
          /* TABELA DE USUÁRIOS */
          <div className="pwc-table-responsive">
            <table className="pwc-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Setor / Grupo</th>
                  <th>Papel na Esteira de Compras</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      Nenhum usuário encontrado com os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const isMaster = user.globalRole === 'MASTER';
                    const isSaving = savingId === user.id;

                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="pwc-user-cell">
                            <div className="pwc-avatar">
                              {user.username.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="pwc-user-name">
                                {user.username}
                                {isMaster && <span className="pwc-master-tag">Master</span>}
                              </div>
                              <div className="pwc-user-email">ID: {user.id}</div>
                            </div>
                          </div>
                        </td>

                        <td>{user.email || <span style={{ color: '#64748b' }}>—</span>}</td>

                        <td>
                          {user.groupName ? (
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
                              gap: '4px'
                            }}>
                              <Users size={12} /> {user.groupName}
                            </span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.8rem' }}>Sem Setor</span>
                          )}
                        </td>

                        <td>
                          {isMaster ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fef08a' }}>
                              <Lock size={15} />
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Aprovador Nato (Master)</span>
                            </div>
                          ) : user.inheritedFromGroup ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{
                                background: 'rgba(34, 197, 94, 0.15)',
                                color: '#86efac',
                                border: '1px solid rgba(34, 197, 94, 0.3)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px'
                              }}>
                                <ShieldCheck size={14} /> Aprovador (Herdado do grupo {user.inheritedFromGroup})
                              </span>
                            </div>
                          ) : (
                            <div className="pwc-role-toggle">
                              <button
                                type="button"
                                disabled={isSaving}
                                className={`pwc-role-btn ${user.purchasesRole === 'APROVADOR' ? 'active approver' : ''}`}
                                onClick={() => handleUserRoleChange(user.id, 'APROVADOR')}
                              >
                                <ShieldCheck size={14} /> Aprovador
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                className={`pwc-role-btn ${user.purchasesRole === 'REQUISITANTE' ? 'active requester' : ''}`}
                                onClick={() => handleUserRoleChange(user.id, 'REQUISITANTE')}
                              >
                                <ShoppingCart size={14} /> Requisitante
                              </button>
                            </div>
                          )}
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

      {/* Toast */}
      {toastMessage && (
        <div className="pwc-toast">
          <Sparkles size={18} /> {toastMessage}
        </div>
      )}
    </div>
  );
};

export default PurchaseWorkflowConfig;
