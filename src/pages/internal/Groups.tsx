import React, { useEffect, useState } from 'react';
import { ShieldAlert, Edit, Save, Plus, X, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import './Permissions.css';

interface Area {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
  permissions: string[];
}

const Groups = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [groupsRes, areasRes] = await Promise.all([
        fetch('http://localhost:3004/groups'),
        fetch('http://localhost:3004/areas')
      ]);
      const groupsData = await groupsRes.json();
      const areasData = await areasRes.json();
      setGroups(groupsData);
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

  const openNewGroupModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setSelectedPermissions([]);
    setIsModalOpen(true);
  };

  const openEditModal = (group: Group) => {
    setEditingGroup(group);
    setGroupName(group.name);
    setSelectedPermissions(group.permissions || []);
    setIsModalOpen(true);
  };

  const handleTogglePermission = (areaId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(areaId) 
        ? prev.filter(id => id !== areaId)
        : [...prev, areaId]
    );
  };

  const handleSaveGroup = async () => {
    try {
      if (editingGroup) {
        // Edit existing
        const updatedGroup = { ...editingGroup, name: groupName, permissions: selectedPermissions };
        await fetch(`http://localhost:3004/groups/${editingGroup.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedGroup)
        });
        setGroups(groups.map(g => g.id === editingGroup.id ? updatedGroup : g));
      } else {
        // Create new
        const newGroup = {
          id: Date.now().toString(),
          name: groupName,
          permissions: selectedPermissions
        };
        await fetch(`http://localhost:3004/groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newGroup)
        });
        setGroups([...groups, newGroup]);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Erro ao salvar", error);
    }
  };

  return (
    <div className="permissions-page">
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/permissions" className="btn-link" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <ArrowLeft size={18} /> Voltar para Usuários
        </Link>
      </div>

      <div className="internal-card glass">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Gestão de Grupos (Setores)</h3>
          <button className="btn-primary" onClick={openNewGroupModal} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Novo Grupo
          </button>
        </div>

        {loading ? (
          <p>Carregando grupos...</p>
        ) : (
          <div className="table-responsive">
            <table className="permissions-table">
              <thead>
                <tr>
                  <th>Nome do Grupo</th>
                  <th>Permissões Vinculadas</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {groups.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center' }}>Nenhum grupo cadastrado.</td></tr>
                ) : (
                  groups.map(group => (
                    <tr key={group.id}>
                      <td>{group.name}</td>
                      <td>{group.permissions.length} áreas</td>
                      <td>
                        <button className="btn-icon" onClick={() => openEditModal(group)}>
                          <Edit size={18} /> Editar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <h3>{editingGroup ? 'Editar Grupo' : 'Novo Grupo'}</h3>
              <button className="icon-btn" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Nome do Setor/Grupo</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Ex: Financeiro" 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>

              <p>Áreas com acesso padrão para este grupo:</p>
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
              <button className="btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveGroup} disabled={!groupName.trim()}>
                <Save size={18} /> Salvar Grupo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Groups;
