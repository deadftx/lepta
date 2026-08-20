import React, { useState, useEffect, useMemo } from 'react';
import {
  SlidersHorizontal, ShieldCheck, ShoppingCart, UserCheck,
  Search, Check, AlertCircle, RefreshCw, Sparkles, Lock
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './PurchaseWorkflowConfig.css';

interface UserPurchaseConfig {
  id: string;
  username: string;
  email: string;
  globalRole: string;
  hasAdminAccess: boolean;
  purchasesRole: 'APROVADOR' | 'REQUISITANTE';
  updatedAt: string | null;
  updatedBy: string | null;
}

export const PurchaseWorkflowConfig: React.FC = () => {
  const [users, setUsers] = useState<UserPurchaseConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/configuracao/usuarios`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Não foi possível carregar os usuários.');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar configuração.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleRoleChange = async (userId: string, newRole: 'APROVADOR' | 'REQUISITANTE') => {
    setSavingUserId(userId);
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

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, purchasesRole: newRole } : u));
      setToastMessage(`Papel atualizado para ${newRole === 'APROVADOR' ? 'Aprovador' : 'Requisitante'} com sucesso!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar alteração.');
    } finally {
      setSavingUserId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.id.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const stats = useMemo(() => {
    const total = users.length;
    const approvers = users.filter(u => u.purchasesRole === 'APROVADOR').length;
    const requesters = users.filter(u => u.purchasesRole === 'REQUISITANTE').length;
    return { total, approvers, requesters };
  }, [users]);

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
              Defina quais usuários atuam como <strong>Aprovadores</strong> e quais atuam como <strong>Requisitantes</strong> na esteira de compras.
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
            <h3>Aprovadores ({stats.approvers})</h3>
            <p>
              Podem <strong>Revisar</strong> a fila de requisições (Aprovar, Negar e Enviar mensagens de esclarecimento) e também podem <strong>Requisitar compras</strong>.
            </p>
          </div>
        </div>

        <div className="pwc-info-card requester">
          <div className="pwc-card-icon">
            <ShoppingCart size={24} />
          </div>
          <div className="pwc-card-body">
            <h3>Requisitantes ({stats.requesters})</h3>
            <p>
              Podem <strong>Criar requisições de compra</strong> e acompanhar o histórico/status de aprovação de seus próprios pedidos.
            </p>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="pwc-table-card">
        <div className="pwc-table-header">
          <h2>
            <UserCheck size={18} /> Usuários do Sistema ({filteredUsers.length})
          </h2>
          <div className="pwc-search-box">
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="pwc-loading">
            <RefreshCw size={32} className="pwc-spinner" />
            <p style={{ marginTop: '12px' }}>Carregando usuários e permissões...</p>
          </div>
        ) : error ? (
          <div className="pwc-loading" style={{ color: '#f87171' }}>
            <AlertCircle size={32} />
            <p style={{ marginTop: '12px' }}>{error}</p>
          </div>
        ) : (
          <div className="pwc-table-responsive">
            <table className="pwc-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Menu Administrativo</th>
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
                    const isSaving = savingUserId === user.id;

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
                          <span className={`pwc-badge ${user.hasAdminAccess ? 'active' : 'inactive'}`}>
                            {user.hasAdminAccess ? (
                              <>
                                <Check size={12} /> Acesso Ativo
                              </>
                            ) : (
                              'Sem Permissão'
                            )}
                          </span>
                        </td>

                        <td>
                          {isMaster ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fef08a' }}>
                              <Lock size={15} />
                              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Aprovador Nato (Master)</span>
                            </div>
                          ) : (
                            <div className="pwc-role-toggle">
                              <button
                                type="button"
                                disabled={isSaving}
                                className={`pwc-role-btn ${user.purchasesRole === 'APROVADOR' ? 'active approver' : ''}`}
                                onClick={() => handleRoleChange(user.id, 'APROVADOR')}
                              >
                                <ShieldCheck size={14} /> Aprovador
                              </button>
                              <button
                                type="button"
                                disabled={isSaving}
                                className={`pwc-role-btn ${user.purchasesRole === 'REQUISITANTE' ? 'active requester' : ''}`}
                                onClick={() => handleRoleChange(user.id, 'REQUISITANTE')}
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
