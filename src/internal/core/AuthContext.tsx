import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';
import { KeyRound, LogOut, ShieldQuestion } from 'lucide-react';

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
  loginWithMicrosoft: (params?: { email?: string; idToken?: string; microsoftId?: string; mode?: 'auto' | 'interactive' | 'windows_sso' | 'mock' }) => Promise<{ success: boolean; requireInteractive?: boolean; error?: string }>;
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
        <form onSubmit={submit} className="login-form security-setup-form">
          <div className="security-field">
            <label htmlFor="security-question">Pergunta secreta</label>
            <div className="input-group">
              <ShieldQuestion className="input-icon" size={18} />
              <input id="security-question" className="input-field with-icon" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ex.: Nome do meu primeiro animal?" minLength={5} required />
            </div>
          </div>
          <div className="security-field">
            <label htmlFor="security-answer">Palavra secreta</label>
            <div className="input-group">
              <KeyRound className="input-icon" size={18} />
              <input id="security-answer" className="input-field with-icon" value={answer} onChange={event => setAnswer(event.target.value)} placeholder="Digite uma única palavra" autoComplete="off" required />
            </div>
          </div>
          <small className="security-hint">A resposta deve conter somente uma palavra e não poderá ser visualizada depois.</small>
          <button type="submit" className="btn-primary login-submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar e continuar'}</button>
          <button type="button" className="btn-outline security-exit" onClick={onLogout}><LogOut size={17} /> Sair</button>
        </form>
      </div>
    </div>
  );
};

import { handleMicrosoftRedirect } from '../../config/msalConfig';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isCancelled = false;

    const initAuth = async () => {
      // 1. Verifica se o usuário acabou de retornar do redirecionamento Microsoft
      const hasAuthCode = typeof window !== 'undefined' && (
        window.location.hash.includes('code=') ||
        window.location.search.includes('code=') ||
        window.location.hash.includes('id_token=') ||
        window.location.search.includes('id_token=')
      );

      if (hasAuthCode) {
        try {
          const response = await handleMicrosoftRedirect();
          if (response && response.idToken && !isCancelled) {
            const email = (
              response.account?.username ||
              (response.idTokenClaims as any)?.preferred_username ||
              (response.idTokenClaims as any)?.email ||
              ''
            ).toLowerCase();

            const res = await fetch(`${API_BASE_URL}/api/auth/microsoft`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                idToken: response.idToken,
                email
              })
            });

            const data = await res.json();
            if (res.ok && data.user && data.token && !isCancelled) {
              setIsAuthenticated(true);
              setUser(data.user);
              localStorage.setItem('lepta_user', JSON.stringify(data.user));
              localStorage.setItem('lepta_auth_token', data.token);
              window.history.replaceState(null, '', '/dashboard');
              window.location.href = '/dashboard';
              return;
            }
          }
        } catch (err) {
          console.error('Erro na autenticação Microsoft no carregamento:', err);
        }
      }

      // 2. Valida sessão salva em localStorage
      const storedUser = localStorage.getItem('lepta_user');
      const token = localStorage.getItem('lepta_auth_token');
      if (!storedUser || !token) {
        if (!isCancelled) setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Sessão inválida');
        const result = await response.json();
        if (!isCancelled) {
          setUser(result.user);
          setIsAuthenticated(true);
          localStorage.setItem('lepta_user', JSON.stringify(result.user));
        }
      } catch {
        if (!isCancelled) {
          localStorage.removeItem('lepta_user');
          localStorage.removeItem('lepta_auth_token');
        }
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    initAuth();

    return () => {
      isCancelled = true;
    };
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

  const loginWithMicrosoft = async (params: { email?: string; idToken?: string; microsoftId?: string; mode?: 'auto' | 'interactive' | 'windows_sso' | 'mock' } = {}): Promise<{ success: boolean; requireInteractive?: boolean; error?: string }> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/microsoft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      const data = await res.json();
      if (res.ok) {
        if (data.requireInteractive) {
          return { success: false, requireInteractive: true };
        }
        setIsAuthenticated(true);
        setUser(data.user);
        localStorage.setItem('lepta_user', JSON.stringify(data.user));
        localStorage.setItem('lepta_auth_token', data.token);
        return { success: true };
      }
      return { success: false, error: data.error || 'Não foi possível autenticar com a conta Microsoft.' };
    } catch (error) {
      console.error("Erro na autenticação Microsoft:", error);
      return { success: false, error: 'Erro de conexão com o servidor.' };
    }
  };

  const logout = () => {
    const token = localStorage.getItem('lepta_auth_token');
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        keepalive: true
      }).catch(() => {});
    }
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('lepta_user');
    localStorage.removeItem('lepta_auth_token');
    try {
      sessionStorage.clear();
    } catch {}
  };

  const completeSecuritySetup = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('lepta_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, loginWithMicrosoft, logout, isLoading }}>
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
