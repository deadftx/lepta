import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Lock, User, ArrowRight, AlertCircle, CheckCircle2, KeyRound, Mail, ArrowLeft, X, ShieldCheck, Laptop } from 'lucide-react';
import { useAuth } from '../internal/core/AuthContext';
import { API_BASE_URL } from '../config/api';
import { getSSOConfig, getCorporateAccounts, type CorporateAccount, type MicrosoftSSOConfig } from '../config/msalConfig';
import './Login.css';

const MicrosoftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#F25022" d="M1 1h9v9H1z"/>
    <path fill="#00A4EF" d="M1 11h9v9H1z"/>
    <path fill="#7FBA00" d="M11 1h9v9h-9z"/>
    <path fill="#FFB900" d="M11 11h9v9h-9z"/>
  </svg>
);

const WindowsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { login, loginWithMicrosoft } = useAuth();

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // SSO state
  const [ssoConfig, setSsoConfig] = useState<MicrosoftSSOConfig | null>(null);
  const [corporateAccounts, setCorporateAccounts] = useState<CorporateAccount[]>([]);
  const [ssoModalOpen, setSsoModalOpen] = useState(false);
  const [ssoMode, setSsoMode] = useState<'interactive' | 'windows_sso'>('windows_sso');
  const [ssoCustomEmail, setSsoCustomEmail] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);
  const [ssoError, setSsoError] = useState('');

  // Primeiro Acesso state
  const [isFirstAccessMode, setIsFirstAccessMode] = useState(false);
  const [firstAccessStep, setFirstAccessStep] = useState<1 | 2>(1);
  const [firstAccessEmail, setFirstAccessEmail] = useState('');
  const [firstAccessUser, setFirstAccessUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstAccessError, setFirstAccessError] = useState('');
  const [firstAccessSuccess, setFirstAccessSuccess] = useState('');
  const [firstAccessLoading, setFirstAccessLoading] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryQuestion, setRecoveryQuestion] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState('');

  useEffect(() => {
    getSSOConfig().then(setSsoConfig).catch(() => {});
    getCorporateAccounts().then(setCorporateAccounts).catch(() => {});
  }, []);

  const navigateToDestination = () => {
    const fromState = (location.state as any)?.from;
    let targetUrl = '/dashboard';
    if (fromState && fromState.pathname) {
      targetUrl = `${fromState.pathname}${fromState.search || ''}`;
    } else if (searchParams.get('redirect')) {
      targetUrl = searchParams.get('redirect')!;
    }
    navigate(targetUrl, { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(loginId, password);

    setLoading(false);
    if (success) {
      navigateToDestination();
    } else {
      setError('Credenciais incorretas.');
    }
  };

  const handleOpenSSOModal = (mode: 'interactive' | 'windows_sso') => {
    setSsoMode(mode);
    setSsoError('');
    setSsoCustomEmail('');
    setSsoModalOpen(true);
  };

  const handleExecuteSSO = async (emailToAuth: string) => {
    const trimmed = emailToAuth.trim().toLowerCase();
    if (!trimmed) {
      setSsoError('Por favor, informe um e-mail corporativo válido.');
      return;
    }

    setSsoLoading(true);
    setSsoError('');
    setError('');

    const result = await loginWithMicrosoft({
      email: trimmed,
      mode: ssoMode
    });

    setSsoLoading(false);
    if (result.success) {
      setSsoModalOpen(false);
      navigateToDestination();
    } else {
      setSsoError(result.error || 'Não foi possível autenticar com esta conta.');
    }
  };

  const loadRecoveryQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    const response = await fetch(`${API_BASE_URL}/api/auth/recovery/question`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loginId })
    });
    const result = await response.json();
    if (!response.ok) return setRecoveryError(result.error || 'Recuperação indisponível.');
    setRecoveryQuestion(result.question);
  };

  const resetForgottenPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    const response = await fetch(`${API_BASE_URL}/api/auth/recovery/reset`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId, answer: secretAnswer, password: recoveryPassword })
    });
    const result = await response.json();
    if (!response.ok) return setRecoveryError(result.error || 'Não foi possível redefinir a senha.');
    setPassword(recoveryPassword);
    setRecoveryPassword('');
    setSecretAnswer('');
    setRecoveryQuestion('');
    setIsRecoveryMode(false);
    setError('Senha redefinida. Entre com a nova senha.');
  };

  // Step 1: Check or register email in db.json
  const handleFirstAccessStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setFirstAccessError('');
    const emailToSearch = firstAccessEmail.trim().toLowerCase();

    if (!emailToSearch) {
      setFirstAccessError('Por favor, informe seu e-mail.');
      return;
    }

    try {
      setFirstAccessLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/auth/first-access/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: emailToSearch })
      });
      const result = await res.json();
      let target = result.user;
      if (!res.ok) {
        setFirstAccessError(result.error || 'Não foi possível validar o primeiro acesso.');
        return;
      }

      if (!target) {
        // Create new user in db.json if not existing
        const prefix = emailToSearch.split('@')[0] || `user_${Date.now()}`;
        const newUser = {
          id: `user_${Date.now()}`,
          username: prefix,
          email: emailToSearch,
          password: '',
          role: 'USER',
          permissions: ['1']
        };

        const createRes = await fetch(`${API_BASE_URL}/users`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newUser)
        });

        if (createRes.ok) {
          target = await createRes.json();
        } else {
          setFirstAccessError('Erro ao registrar novo usuário no banco.');
          setFirstAccessLoading(false);
          return;
        }
      }

      setFirstAccessUser(target);
      setFirstAccessStep(2);
    } catch (err) {
      console.error('Erro no primeiro acesso:', err);
      setFirstAccessError('Erro de conexão com o banco de dados.');
    } finally {
      setFirstAccessLoading(false);
    }
  };

  // Step 2: Create & confirm password, saving to db.json
  const handleFirstAccessStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setFirstAccessError('');

    if (newPassword.length < 10) {
      setFirstAccessError('A senha deve possuir pelo menos 10 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFirstAccessError('As senhas não coincidem. Digite a mesma senha nos dois campos.');
      return;
    }

    try {
      setFirstAccessLoading(true);

      const res = await fetch(`${API_BASE_URL}/api/auth/first-access/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: firstAccessUser.id, password: newPassword })
      });

      if (res.ok) {
        setFirstAccessSuccess('Senha criada com sucesso no banco de dados!');
        setLoginId(firstAccessUser.username || firstAccessUser.email);
        setPassword(newPassword);

        setTimeout(() => {
          setIsFirstAccessMode(false);
          setFirstAccessStep(1);
          setFirstAccessEmail('');
          setNewPassword('');
          setConfirmPassword('');
          setFirstAccessSuccess('');
        }, 1800);
      } else {
        setFirstAccessError('Erro ao atualizar a senha no banco de dados.');
      }
    } catch (err) {
      console.error('Erro ao salvar senha:', err);
      setFirstAccessError('Erro de conexão ao salvar no banco.');
    } finally {
      setFirstAccessLoading(false);
    }
  };

  const resetFirstAccessMode = () => {
    setIsFirstAccessMode(false);
    setFirstAccessStep(1);
    setFirstAccessEmail('');
    setFirstAccessError('');
    setFirstAccessSuccess('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="login-page">
      <div className="login-container glass">
        {isRecoveryMode ? (
          <>
            <div className="login-header">
              <h2>Recuperar <span className="text-gradient">Acesso</span></h2>
              <p>Após três erros na palavra secreta, somente o administrador poderá desbloquear sua conta.</p>
            </div>
            {recoveryError && <div className="login-error"><AlertCircle size={18} /><span>{recoveryError}</span></div>}
            {!recoveryQuestion ? (
              <form onSubmit={loadRecoveryQuestion} className="login-form">
                <div className="input-group"><User className="input-icon" size={18} /><input className="input-field with-icon" value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="E-mail ou usuário" required /></div>
                <button type="submit" className="btn-primary login-submit">Continuar</button>
                <button type="button" className="btn-outline" onClick={() => setIsRecoveryMode(false)}>Voltar</button>
              </form>
            ) : (
              <form onSubmit={resetForgottenPassword} className="login-form">
                <p><strong>{recoveryQuestion}</strong></p>
                <div className="input-group"><KeyRound className="input-icon" size={18} /><input className="input-field with-icon" value={secretAnswer} onChange={e => setSecretAnswer(e.target.value)} placeholder="Palavra secreta" autoComplete="off" required /></div>
                <div className="input-group"><Lock className="input-icon" size={18} /><input type="password" className="input-field with-icon" value={recoveryPassword} onChange={e => setRecoveryPassword(e.target.value)} placeholder="Nova senha (mínimo 10 caracteres)" minLength={10} required /></div>
                <button type="submit" className="btn-primary login-submit">Redefinir senha e desbloquear</button>
                <button type="button" className="btn-outline" onClick={() => setRecoveryQuestion('')}>Voltar</button>
              </form>
            )}
          </>
        ) : !isFirstAccessMode ? (
          <>
            <div className="login-header">
              <h2>Área <span className="text-gradient">Interna</span></h2>
              <p>Acesse sua conta corporativa para continuar.</p>
            </div>

            {error && (
              <div className="login-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            {/* Acesso Corporativo Microsoft & Windows */}
            <div className="sso-section">
              <button
                type="button"
                className="btn-sso btn-sso-windows"
                onClick={() => handleOpenSSOModal('windows_sso')}
                title="Autenticar diretamente com o usuário conectado no Windows"
              >
                <WindowsIcon /> Conectar com Usuário do Windows (Exchange)
              </button>

              <button
                type="button"
                className="btn-sso btn-sso-microsoft"
                onClick={() => handleOpenSSOModal('interactive')}
                title="Entrar com conta Microsoft corporativa da Lepta"
              >
                <MicrosoftIcon /> Entrar com Conta Microsoft (Lepta)
              </button>
            </div>

            <div className="sso-divider">
              <span>ou acesse com usuário e senha</span>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              <div className="input-group">
                <User className="input-icon" size={18} />
                <input
                  type="text"
                  placeholder="E-mail ou Usuário"
                  className="input-field with-icon"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <Lock className="input-icon" size={18} />
                <input
                  type="password"
                  placeholder="Senha"
                  className="input-field with-icon"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <div className="login-options">
                <label className="remember-me">
                  <input type="checkbox" /> Lembrar-me
                </label>
                <button type="button" className="forgot-password" onClick={() => setIsRecoveryMode(true)}>Esqueci minha senha</button>
              </div>

              <button type="submit" className="btn-primary login-submit" disabled={loading}>
                {loading ? 'Entrando...' : <>Entrar <ArrowRight size={18} /></>}
              </button>

              <div style={{ marginTop: '1.25rem', textAlign: 'center', paddingTop: '1rem', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <button
                  type="button"
                  onClick={() => setIsFirstAccessMode(true)}
                  className="btn-outline"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <KeyRound size={18} /> Primeiro Acesso?
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="login-header">
              <h2>Primeiro <span className="text-gradient">Acesso</span></h2>
              <p>{firstAccessStep === 1 ? 'Informe seu e-mail cadastrado para continuar.' : 'Crie e confirme sua nova senha.'}</p>
            </div>

            {firstAccessError && (
              <div className="login-error">
                <AlertCircle size={18} />
                <span>{firstAccessError}</span>
              </div>
            )}

            {firstAccessSuccess && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(46, 213, 115, 0.15)',
                  border: '1px solid #2ed573',
                  color: '#2ed573',
                  padding: '12px',
                  borderRadius: '8px',
                  marginBottom: '1.5rem',
                  fontSize: '0.9rem'
                }}
              >
                <CheckCircle2 size={18} />
                <span>{firstAccessSuccess}</span>
              </div>
            )}

            {firstAccessStep === 1 ? (
              <form onSubmit={handleFirstAccessStep1} className="login-form">
                <div className="input-group">
                  <Mail className="input-icon" size={18} />
                  <input
                    type="email"
                    placeholder="Seu E-mail"
                    className="input-field with-icon"
                    value={firstAccessEmail}
                    onChange={(e) => setFirstAccessEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <button type="submit" className="btn-primary login-submit" disabled={firstAccessLoading}>
                  {firstAccessLoading ? 'Verificando...' : <>Continuar <ArrowRight size={18} /></>}
                </button>

                <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={resetFirstAccessMode}
                    className="btn-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <ArrowLeft size={16} /> Voltar para o Login
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleFirstAccessStep2} className="login-form">
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
                  E-mail: <strong>{firstAccessEmail}</strong>
                </p>

                <div className="input-group">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="password"
                    placeholder="Criar Nova Senha"
                    className="input-field with-icon"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="input-group">
                  <Lock className="input-icon" size={18} />
                  <input
                    type="password"
                    placeholder="Confirmar Mesma Senha"
                    className="input-field with-icon"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="btn-primary login-submit" disabled={firstAccessLoading}>
                  {firstAccessLoading ? 'Salvando...' : <>Salvar Senha e Entrar <CheckCircle2 size={18} /></>}
                </button>

                <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setFirstAccessStep(1)}
                    className="btn-link"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <ArrowLeft size={16} /> Voltar passo
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>

      {/* Modal de Conexão Corporativa / Windows SSO */}
      {ssoModalOpen && (
        <div className="sso-modal-overlay" onClick={() => !ssoLoading && setSsoModalOpen(false)}>
          <div className="sso-modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                {ssoMode === 'windows_sso' ? <Laptop size={24} color="#60a5fa" /> : <MicrosoftIcon />}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#f8fafc' }}>
                      {ssoMode === 'windows_sso' ? 'Conexão Windows (Exchange)' : 'Autenticação Microsoft Lepta'}
                    </h3>
                    {ssoConfig?.configured && (
                      <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                        Ativo
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8' }}>
                    {ssoMode === 'windows_sso' ? 'Conta corporativa vinculada ao seu computador' : 'Selecione ou confirme sua conta corporativa'}
                  </p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSsoModalOpen(false)}
                disabled={ssoLoading}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {ssoError && (
              <div className="login-error" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={18} />
                <span>{ssoError}</span>
              </div>
            )}

            {corporateAccounts.length > 0 ? (
              <>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Contas corporativas detectadas no sistema:
                </p>
                <div className="sso-accounts-list">
                  {corporateAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      className="sso-account-item"
                      disabled={ssoLoading}
                      onClick={() => handleExecuteSSO(acc.email)}
                    >
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.9rem', color: '#f1f5f9' }}>{acc.username}</strong>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{acc.email}</span>
                      </div>
                      <span style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
                        {acc.role}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="sso-divider" style={{ margin: '0.85rem 0' }}>
                  <span>ou digite outro e-mail</span>
                </div>
              </>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleExecuteSSO(ssoCustomEmail);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              <div className="input-group" style={{ marginBottom: 0 }}>
                <Mail className="input-icon" size={18} />
                <input
                  type="email"
                  className="input-field with-icon"
                  placeholder="exemplo@lepta.com.br"
                  value={ssoCustomEmail}
                  onChange={(e) => setSsoCustomEmail(e.target.value)}
                  disabled={ssoLoading}
                />
              </div>

              <button
                type="submit"
                className="btn-primary login-submit"
                disabled={ssoLoading || !ssoCustomEmail.trim()}
                style={{ padding: '10px' }}
              >
                {ssoLoading ? 'Autenticando...' : <>Conectar Agora <ShieldCheck size={18} /></>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
