import { useEffect, useState } from 'react';
import type { User } from '../../../core/AuthContext';
import { Edit, Save, X, Users, UserPlus, Unlock, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../../../config/api';
import '../../../core/styles/Permissions.css';
import PermissionSelector from '../../../core/PermissionSelector';
import { normalizePermissions } from '../../../core/permissions';

const Permissions = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const authHeaders = { Authorization: `Bearer ${localStorage.getItem('lepta_auth_token')}` };
      const usersRes = await fetch(`${API_BASE_URL}/users`, { headers: authHeaders });
      const usersData = await usersRes.json();
      setUsers(usersData);
    } catch (error) {
      console.error("Erro ao buscar dados", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setSelectedPermissions(normalizePermissions(user.permissions));
  };

  const handleTogglePermission = (areaId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(areaId) 
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const handleSavePermissions = async () => {
    if (!editingUser) return;
    
    try {
      const updatedUser = { ...editingUser, permissions: selectedPermissions };
      await fetch(`${API_BASE_URL}/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('lepta_auth_token')}` },
        body: JSON.stringify(updatedUser)
      });
      
      setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
      setEditingUser(null);
    } catch (error) {
      console.error("Erro ao salvar", error);
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
  };

  return (
    <div className="permissions-page">
      <div className="internal-card glass">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3>Gestão de Permissões</h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link to="/permissions/create-user" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
              <UserPlus size={18} /> Criar Usuário
            </Link>
            <Link to="/permissions/groups" className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
              <Users size={18} /> Configurar Grupos
            </Link>
          </div>
        </div>

        {loading ? (
          <p>Carregando usuários...</p>
        ) : (
          <div className="table-responsive">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>{user.email || '-'}</td>
                    <td><span className={`badge ${user.role === 'MASTER' ? 'master' : 'user'}`}>{user.role}</span></td>
                    <td>
                      {(user.accessLocked || user.fullyLocked) && (
                        <button className="btn-icon" onClick={() => handleUnlock(user)} title="Desbloquear usuário">
                          <Unlock size={18} /> Desbloquear
                        </button>
                      )}
                      {user.role !== 'MASTER' && (
                        <button className="btn-icon" onClick={() => handleEditClick(user)}>
                          <Edit size={18} /> Configurar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editingUser && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <h3>Configurar Acessos: {editingUser.username}</h3>
              <button className="icon-btn" onClick={() => setEditingUser(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <p>Selecione as áreas que este usuário pode acessar:</p>
              <PermissionSelector selected={selectedPermissions} onToggle={handleTogglePermission} />
            </div>
            <div className="modal-footer">
              <button className="btn-danger" onClick={handleDeleteUser}>
                <Trash2 size={18} /> Excluir usuário
              </button>
              <span className="modal-footer-spacer" />
              <button className="btn-outline" onClick={() => setEditingUser(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSavePermissions}>
                <Save size={18} /> Salvar Permissões
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Permissions;
