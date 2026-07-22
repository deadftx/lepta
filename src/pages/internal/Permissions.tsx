import React, { useEffect, useState } from 'react';
import type { User } from '../../contexts/AuthContext';
import { ShieldAlert, Edit, Save, X, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Permissions.css';

interface Area {
  id: string;
  name: string;
}

const Permissions = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, areasRes] = await Promise.all([
        fetch('http://localhost:3004/users'),
        fetch('http://localhost:3004/areas')
      ]);
      const usersData = await usersRes.json();
      const areasData = await areasRes.json();
      setUsers(usersData);
      setAreas(areasData);
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
    setSelectedPermissions(user.permissions || []);
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
      await fetch(`http://localhost:3004/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      });
      
      setUsers(users.map(u => u.id === editingUser.id ? updatedUser : u));
      setEditingUser(null);
    } catch (error) {
      console.error("Erro ao salvar", error);
    }
  };

  return (
    <div className="permissions-page">
      <div className="internal-card glass">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Gestão de Permissões</h3>
          <Link to="/permissions/groups" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <Users size={18} /> Configurar Grupos
          </Link>
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
              <div className="permissions-list">
                {areas.map(area => (
                  <label key={area.id} className="permission-item">
                    <input 
                      type="checkbox" 
                      checked={selectedPermissions.includes(area.id)}
                      onChange={() => handleTogglePermission(area.id)}
                    />
                    <span>{area.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
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
