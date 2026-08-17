import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, AlertCircle, CheckCircle2, KeyRound, Mail, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Login form state
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const success = await login(loginId, password);

    setLoading(false);
    if (success) {
      navigate('/dashboard');
    } else {
      setError('Credenciais incorretas.');
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
              <p>Acesse sua conta para continuar.</p>
            </div>

            {error && (
              <div className="login-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

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
    </div>
  );
};

export default Login;

