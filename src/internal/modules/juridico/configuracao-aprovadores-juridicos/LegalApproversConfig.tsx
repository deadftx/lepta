import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Scale, ShieldCheck, UserX, Search,
  RefreshCw, Sparkles, AlertCircle, CheckCircle2, Lock
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './LegalApproversConfig.css';

interface LegalUserConfig {
  id: string;
  username: string;
  email: string;
  globalRole: string;
  groupId?: string | null;
  groupName?: string | null;
  legalRole: 'APROVADOR_JURIDICO' | 'NAO_APROVADOR';
  isMaster: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const LegalApproversConfig: React.FC = () => {
  const [users, setUsers] = useState<LegalUserConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/juridico/configuracao/usuarios`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao carregar lista de usuários com acesso ao Jurídico.');
      }

      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Erro de conexão ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = async (user: LegalUserConfig, newRole: 'APROVADOR_JURIDICO' | 'NAO_APROVADOR') => {
    if (user.isMaster) {
      return;
    }

    setSavingId(user.id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/compras/juridico/configuracao/usuarios/${user.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ papel: newRole })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao atualizar papel jurídico do usuário.');
      }

      const data = await res.json();
      setUsers(prev => prev.map(u => u.id === user.id ? {
        ...u,
        legalRole: newRole,
        updatedAt: data.updated_at || new Date().toISOString(),
        updatedBy: data.updated_by || 'Você'
      } : u));

      setToastMessage(
        newRole === 'APROVADOR_JURIDICO'
          ? `"${user.username}" agora é um Aprovador Jurídico.`
          : `"${user.username}" agora é Não Aprovador.`
      );
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Erro ao atualizar papel.');
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

  const stats = useMemo(() => {
    const total = users.length;
    const approvers = users.filter(u => u.legalRole === 'APROVADOR_JURIDICO').length;
    const nonApprovers = users.filter(u => u.legalRole === 'NAO_APROVADOR').length;
    return { total, approvers, nonApprovers };
  }, [users]);

  const formatDateTime = (isoStr: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="lac-container">
      {toastMessage && (
        <div className="lac-toast">
          <Sparkles size={18} />
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="lac-header">
        <div className="lac-header-top">
          <div className="lac-icon-badge">
            <Scale size={26} />
          </div>
          <div>
            <h1>Configuração de Aprovadores Jurídicos</h1>
            <p className="lac-subtitle">
              Defina quem possui alçada para emitir parecer e aprovação jurídica nas solicitações de compras e contratos.
              Somente usuários com acesso ao módulo Jurídico são elegíveis e listados abaixo.
            </p>
          </div>
        </div>
      </div>

      {/* Notice Info Box */}
      <div className="lac-notice-box">
        <AlertCircle size={20} />
        <div>
          <strong>Regras de Acesso e Segurança:</strong> Aprovadores jurídicos aprovam exclusivamente o que compete ao Jurídico. Usuários que não forem aprovadores gerais enxergam apenas suas próprias solicitações de compras + as solicitações de escopo jurídico.
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="lac-info-cards">
        <div className="lac-info-card approver">
          <div className="lac-card-icon">
            <ShieldCheck size={24} />
          </div>
          <div className="lac-card-body">
            <h3>Aprovadores Jurídicos ({stats.approvers})</h3>
            <p>
              Colaboradores com autorização para emitir parecer técnico e deferir ou indeferir validações jurídicas da esteira.
            </p>
          </div>
        </div>

        <div className="lac-info-card non-approver">
          <div className="lac-card-icon">
            <UserX size={24} />
          </div>
          <div className="lac-card-body">
            <h3>Não Aprovadores ({stats.nonApprovers})</h3>
            <p>
              Possuem acesso ao módulo Jurídico para visualização e acompanhamento de seus processos, sem poder decisório de aprovação.
            </p>
          </div>
        </div>
      </div>

      {/* Tabela de Usuários */}
      <div className="lac-table-card">
        <div className="lac-table-toolbar">
          <div className="lac-search-box">
            <Search size={18} className="lac-search-icon" />
            <input
              type="text"
              className="lac-search-input"
              placeholder="Buscar usuário por nome, email ou grupo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <button className="lac-refresh-btn" onClick={fetchUsers} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'lac-spinning' : ''} />
            Atualizar Lista
          </button>
        </div>

        {error && (
          <div style={{ padding: '1.5rem', color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="lac-loading-container">
            <RefreshCw size={32} className="lac-spinning" />
            <span>Carregando usuários do Jurídico...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="lac-empty-state">
            <Scale size={40} className="lac-empty-icon" />
            <p>Nenhum usuário com acesso ao módulo Jurídico encontrado.</p>
          </div>
        ) : (
          <table className="lac-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Setor / Grupo</th>
                <th>Status Atual</th>
                <th>Última Atualização</th>
                <th style={{ textAlign: 'center' }}>Definição do Papel</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => {
                const isApprover = u.legalRole === 'APROVADOR_JURIDICO';
                const isSaving = savingId === u.id;

                return (
                  <tr key={u.id}>
                    <td>
                      <div className="lac-user-cell">
                        <span className="lac-user-name">
                          {u.username}
                          {u.isMaster && <span className="lac-badge-master">MASTER</span>}
                        </span>
                        <span className="lac-user-email">{u.email}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: '#cbd5e1' }}>
                        {u.groupName || 'Sem grupo'}
                      </span>
                    </td>
                    <td>
                      <span className={`lac-status-badge ${isApprover ? 'approver' : 'non-approver'}`}>
                        {isApprover ? <CheckCircle2 size={14} /> : <UserX size={14} />}
                        {isApprover ? 'Aprovador Jurídico' : 'Não Aprovador'}
                      </span>
                    </td>
                    <td>
                      <span className="lac-audit-text">
                        {u.updatedAt ? formatDateTime(u.updatedAt) : 'Padrão do Sistema'}
                      </span>
                      {u.updatedBy && (
                        <span className="lac-audit-text" style={{ color: '#475569' }}>
                          por {u.updatedBy}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {u.isMaster ? (
                        <span style={{ color: '#fbbf24', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Lock size={14} /> Aprovador Master Automático
                        </span>
                      ) : (
                        <div className="lac-action-group">
                          <button
                            type="button"
                            disabled={isSaving}
                            className={`lac-btn-option ${isApprover ? 'active-approver' : ''}`}
                            onClick={() => handleRoleChange(u, 'APROVADOR_JURIDICO')}
                            title="Tornar este usuário um Aprovador Jurídico"
                          >
                            <ShieldCheck size={14} />
                            APROVADOR JURÍDICO
                          </button>

                          <button
                            type="button"
                            disabled={isSaving}
                            className={`lac-btn-option ${!isApprover ? 'active-non-approver' : ''}`}
                            onClick={() => handleRoleChange(u, 'NAO_APROVADOR')}
                            title="Remover alçada de aprovação jurídica deste usuário"
                          >
                            <UserX size={14} />
                            NÃO APROVADOR
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LegalApproversConfig;
