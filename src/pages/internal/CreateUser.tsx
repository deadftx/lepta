import { useState, useEffect } from 'react';
import { UserPlus, Save, ArrowLeft, CheckCircle2, AlertCircle, Mail, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/api';
import './Permissions.css';

interface Area {
  id: string;
  name: string;
}

const CreateUser = () => {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'USER' | 'MASTER'>('USER');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchAreas = async () => {
      try {
        setLoadingAreas(true);
        const res = await fetch(`${API_BASE_URL}/areas`);
        const data = await res.json();
        setAreas(data);
      } catch (err) {
        console.error('Erro ao buscar áreas:', err);
      } finally {
        setLoadingAreas(false);
      }
    };
    fetchAreas();
  }, []);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (!username || username === email.split('@')[0]) {
      const prefix = val.split('@')[0];
      if (prefix) {
        setUsername(prefix);
      }
    }
  };

  const handleTogglePermission = (areaId: string) => {
    setSelectedPermissions(prev =>
      prev.includes(areaId) ? prev.filter(id => id !== areaId) : [...prev, areaId]
    );
  };

  const handleSelectAll = () => {
    if (selectedPermissions.length === areas.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(areas.map(a => a.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedUsername = username.trim();

    if (!trimmedEmail) {
      setMessage({ type: 'error', text: 'Por favor, informe o e-mail do usuário.' });
      return;
    }

    if (!trimmedUsername) {
      setMessage({ type: 'error', text: 'Por favor, informe o nome de usuário.' });
      return;
    }

    try {
      setSubmitting(true);

      // Check existing users in database
      const usersRes = await fetch(`${API_BASE_URL}/users`);
      const existingUsers = await usersRes.json();

      const emailExists = existingUsers.some(
        (u: any) => u.email?.toLowerCase() === trimmedEmail
      );
      if (emailExists) {
        setMessage({ type: 'error', text: 'Já existe um usuário cadastrado com este e-mail.' });
        setSubmitting(false);
        return;
      }

      const newUser = {
        id: `user_${Date.now()}`,
        username: trimmedUsername,
        email: trimmedEmail,
        password: '', // Usuário criará no "Primeiro Acesso"
        role,
        permissions: role === 'MASTER' ? areas.map(a => a.id) : selectedPermissions
      };

      const saveRes = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      if (saveRes.ok) {
        setMessage({
          type: 'success',
          text: `Usuário "${trimmedUsername}" cadastrado com sucesso no banco de dados!`
        });
        setEmail('');
        setUsername('');
        setSelectedPermissions([]);
        setRole('USER');
      } else {
        setMessage({ type: 'error', text: 'Falha ao salvar usuário no banco de dados.' });
      }
    } catch (err) {
      console.error('Erro ao cadastrar usuário:', err);
      setMessage({ type: 'error', text: 'Erro de conexão com o servidor.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="permissions-page">
      <div style={{ marginBottom: '1rem' }}>
        <Link
          to="/permissions"
          className="btn-link"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}
        >
          <ArrowLeft size={18} /> Voltar para Gestão de Permissões
        </Link>
      </div>

      <div className="internal-card glass">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={22} style={{ color: 'var(--accent-orange)' }} /> Cadastro de Novo Usuário
          </h3>
        </div>

        {message && (
          <div
            style={{
              padding: '1rem',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: message.type === 'success' ? 'rgba(46, 213, 115, 0.15)' : 'rgba(255, 71, 87, 0.15)',
              border: `1px solid ${message.type === 'success' ? 'rgba(46, 213, 115, 0.4)' : 'rgba(255, 71, 87, 0.4)'}`,
              color: message.type === 'success' ? '#2ed573' : '#ff4757'
            }}
          >
            {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                E-mail do Usuário *
              </label>
              <div className="input-group" style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="email"
                  className="input-field"
                  style={{ paddingLeft: '2.5rem', width: '100%' }}
                  placeholder="usuario@lepta.com.br"
                  value={email}
                  onChange={e => handleEmailChange(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Nome de Usuário *
              </label>
              <div className="input-group" style={{ position: 'relative' }}>
                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="input-field"
                  style={{ paddingLeft: '2.5rem', width: '100%' }}
                  placeholder="Ex: joaosilva"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Perfil de Acesso
              </label>
              <select
                className="input-field"
                style={{ width: '100%', height: '42px' }}
                value={role}
                onChange={e => setRole(e.target.value as 'USER' | 'MASTER')}
              >
                <option value="USER">USER (Acessos personalizados)</option>
                <option value="MASTER">MASTER (Acesso total)</option>
              </select>
            </div>
          </div>

          {role === 'USER' && (
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.95rem', fontWeight: 600 }}>
                  Acessos e Áreas Permitidas:
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="btn-link"
                  style={{ fontSize: '0.85rem' }}
                >
                  {selectedPermissions.length === areas.length ? 'Desmarcar todas' : 'Marcar todas'}
                </button>
              </div>

              {loadingAreas ? (
                <p style={{ color: 'var(--text-muted)' }}>Carregando áreas existentes...</p>
              ) : (
                <div className="permissions-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  {areas.map(area => (
                    <label key={area.id} className="permission-item">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(area.id)}
                        onChange={() => handleTogglePermission(area.id)}
                      />
                      <span style={{ fontWeight: 500 }}>{area.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <button
              type="button"
              className="btn-outline"
              onClick={() => navigate('/permissions')}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Save size={18} /> {submitting ? 'Salvando...' : 'Cadastrar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUser;
