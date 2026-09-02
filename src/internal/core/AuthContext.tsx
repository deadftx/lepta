import { createContext, useContext, useState, type ReactNode, useEffect } from 'react';
import { API_BASE_URL } from '../../config/api';
import { KeyRound, LogOut, ShieldQuestion } from 'lucide-react';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'MASTER' | 'USER';
  groupId?: string;
  group_id?: string;
  groupName?: string;
  directPermissions?: string[];
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

async function enrichUserWithGroupPermissions(rawUser: User, authToken?: string): Promise<User> {
  if (!rawUser || rawUser.role === 'MASTER') return rawUser;

  try {
    const token = authToken || localStorage.getItem('lepta_auth_token');
    let groups: any[] = [];

    // Tenta carregar do cache para enriquecimento instantâneo
    try {
      const cached = localStorage.getItem('lepta_groups_cache');
      if (cached) groups = JSON.parse(cached);
    } catch {}

    // Busca grupos atualizados na API
    if (token) {
      try {
        let res = await fetch(`${API_BASE_URL}/api/groups`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const apiGroups = await res.json();
          if (Array.isArray(apiGroups) && apiGroups.length > 0) {
            groups = apiGroups;
            localStorage.setItem('lepta_groups_cache', JSON.stringify(apiGroups));
          }
        } else {
          let res2 = await fetch(`${API_BASE_URL}/groups`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res2.ok && res2.headers.get('content-type')?.includes('application/json')) {
            const apiGroups2 = await res2.json();
            if (Array.isArray(apiGroups2) && apiGroups2.length > 0) {
              groups = apiGroups2;
              localStorage.setItem('lepta_groups_cache', JSON.stringify(apiGroups2));
            }
          }
        }
      } catch {}
    }

    if (!Array.isArray(groups) || groups.length === 0) return rawUser;

    const uId = String(rawUser.id);
    const uEmail = (rawUser.email || '').toLowerCase().trim();
    const uGrpId = String(rawUser.groupId || rawUser.group_id || '');

    const matchingGroups = groups.filter(g => {
      if (!g) return false;
      const matchById = uGrpId && String(g.id) === uGrpId;
      const matchByList = Array.isArray(g.userIds) && g.userIds.some((x: any) => {
        const str = String(x).toLowerCase().trim();
        return str === uId.toLowerCase() || (uEmail && str === uEmail);
      });
      return matchById || matchByList;
    });

    if (matchingGroups.length === 0) return rawUser;

    const groupPerms = matchingGroups.flatMap(g => Array.isArray(g.permissions) ? g.permissions : []);
    const directPerms = Array.isArray(rawUser.directPermissions) && rawUser.directPermissions.length > 0
      ? rawUser.directPermissions
      : (rawUser.permissions || []);

    const effective = Array.from(new Set([...directPerms, ...groupPerms]));

    return {
      ...rawUser,
      groupId: rawUser.groupId || rawUser.group_id || matchingGroups[0]?.id,
      group_id: rawUser.group_id || rawUser.groupId || matchingGroups[0]?.id,
      groupName: rawUser.groupName || matchingGroups[0]?.name,
      directPermissions: directPerms,
      permissions: effective
    };
  } catch (err) {
    console.warn('Erro ao enriquecer permissões do grupo:', err);
    return rawUser;
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUserPermissions = async () => {
    const token = localStorage.getItem('lepta_auth_token');
    const stored = localStorage.getItem('lepta_user');
    if (!token || !stored) return;
    try {
      const parsed = JSON.parse(stored);
      const enriched = await enrichUserWithGroupPermissions(parsed, token);
      setUser(enriched);
      localStorage.setItem('lepta_user', JSON.stringify(enriched));
    } catch {}
  };

  useEffect(() => {
    const handlePermissionsUpdated = () => {
      refreshUserPermissions();
    };
    window.addEventListener('lepta_permissions_updated', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('lepta_permissions_updated', handlePermissionsUpdated);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const initAuth = async () => {
      // 1. Processa retorno de redirecionamento da Microsoft se presente
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
            const enriched = await enrichUserWithGroupPermissions(data.user, data.token);
            setIsAuthenticated(true);
            setUser(enriched);
            localStorage.setItem('lepta_user', JSON.stringify(enriched));
            localStorage.setItem('lepta_auth_token', data.token);
            try { sessionStorage.removeItem('lepta_auth_error'); } catch {}
            window.history.replaceState(null, '', '/dashboard');
            window.location.href = '/dashboard';
            return;
          } else if (data.error && !isCancelled) {
            try { sessionStorage.setItem('lepta_auth_error', data.error); } catch {}
          }
        }
      } catch (err: any) {
        console.error('Erro na autenticação Microsoft no carregamento:', err);
        try { sessionStorage.setItem('lepta_auth_error', err?.message || 'Erro ao comunicar com a Microsoft.'); } catch {}
      }

      // 2. Valida sessão salva em localStorage
      const storedUser = localStorage.getItem('lepta_user');
      const token = localStorage.getItem('lepta_auth_token');
      if (!storedUser || !token) {
        if (!isCancelled) setIsLoading(false);
        return;
      }

      // Restaura imediatamente do localStorage com dados em cache para não piscar a tela
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed && !isCancelled) {
          setUser(parsed);
          setIsAuthenticated(true);
        }
      } catch {}

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Sessão inválida');
        const result = await response.json();
        if (!isCancelled) {
          const enriched = await enrichUserWithGroupPermissions(result.user, token);
          setUser(enriched);
          setIsAuthenticated(true);
          localStorage.setItem('lepta_user', JSON.stringify(enriched));
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
        const enriched = await enrichUserWithGroupPermissions(authenticatedUser, token);
        setIsAuthenticated(true);
        setUser(enriched);
        localStorage.setItem('lepta_user', JSON.stringify(enriched));
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
        const enriched = await enrichUserWithGroupPermissions(data.user, data.token);
        setIsAuthenticated(true);
        setUser(enriched);
        localStorage.setItem('lepta_user', JSON.stringify(enriched));
        localStorage.setItem('lepta_auth_token', data.token);
        return { success: true };
      }
      return { success: false, error: data.error || 'Erro ao autenticar com a Microsoft.' };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Erro de conexão com o servidor.' };
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
