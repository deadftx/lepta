import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { API_BASE_URL } from '../config/api';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'MASTER' | 'USER';
  groupId?: string;
  permissions: string[];
  requiresSecuritySetup?: boolean;
  accessLocked?: boolean;
  fullyLocked?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (loginId: string, pass: string) => Promise<boolean>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SecuritySetup = ({ onComplete, onLogout }: { onComplete: (user: User) => void; onLogout: () => void }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^\p{L}+$/u.test(answer.trim())) {
      setError('A palavra secreta deve ser uma única palavra, sem números ou espaços.');
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem('lepta_auth_token');
      const response = await fetch(`${API_BASE_URL}/api/auth/security-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, answer })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível salvar.');
      onComplete(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container glass">
        <div className="login-header">
          <h2>Proteja seu acesso</h2>
          <p>Cadastre uma pergunta e uma palavra secreta para recuperar sua conta.</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form onSubmit={submit} className="login-form">
          <input value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ex.: Qual era o nome do meu primeiro animal?" minLength={5} required />
          <input value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Palavra secreta" autoComplete="off" required />
          <small>A resposta deve conter somente uma palavra. Ela não poderá ser visualizada depois.</small>
          <button type="submit" className="btn-primary login-submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar e continuar'}</button>
          <button type="button" className="btn-secondary" onClick={onLogout}>Sair</button>
        </form>
      </div>
    </div>
  );
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('lepta_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const login = async (loginId: string, pass: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId, password: pass })
      });

      if (res.ok) {
        const { user: authenticatedUser, token } = await res.json();
        setIsAuthenticated(true);
        setUser(authenticatedUser);
        localStorage.setItem('lepta_user', JSON.stringify(authenticatedUser));
        localStorage.setItem('lepta_auth_token', token);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Erro ao conectar no banco de dados:", error);
      return false;
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('lepta_user');
    localStorage.removeItem('lepta_auth_token');
  };

  const completeSecuritySetup = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('lepta_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading }}>
      {!isLoading && user?.requiresSecuritySetup
        ? <SecuritySetup onComplete={completeSecuritySetup} onLogout={logout} />
        : !isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
