import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowRight, AlertCircle, LogOut, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../internal/core/AuthContext';
import { API_BASE_URL } from '../config/api';
import { authenticateWithMicrosoft } from '../config/msalConfig';
import { checkServerVersion } from '../internal/core/version/versionService';
import { UpdateRequiredModal } from '../internal/core/version/UpdateRequiredModal';
import './Login.css';

const MicrosoftIcon = () => (
  <svg width="22" height="22" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill="#F25022" d="M1 1h9v9H1z"/>
    <path fill="#00A4EF" d="M1 11h9v9H1z"/>
    <path fill="#7FBA00" d="M11 1h9v9h-9z"/>
    <path fill="#FFB900" d="M11 11h9v9h-9z"/>
  </svg>
);

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { loginWithMicrosoft, user, isAuthenticated, logout } = useAuth();

  const [error, setError] = useState('');
  const [corporateLoading, setCorporateLoading] = useState(false);

  // Exibe erro de autenticação SSO capturado na inicialização
  useEffect(() => {
    try {
      const storedError = sessionStorage.getItem('lepta_auth_error');
      if (storedError) {
        setError(storedError);
        sessionStorage.removeItem('lepta_auth_error');
      }
    } catch {}
  }, []);

  const [continueChecking, setContinueChecking] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateModalServerCommit, setUpdateModalServerCommit] = useState('');
  const [updateModalReason, setUpdateModalReason] = useState('commit_mismatch');

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

  const handleContinue = async () => {
    setContinueChecking(true);
    try {
      // 1. Checa se o commit do servidor é diferente do bundle do cliente
      const versionResult = await checkServerVersion();
      if (versionResult.updateAvailable) {
        setUpdateModalServerCommit(versionResult.serverCommit);
        setUpdateModalReason('commit_mismatch');
        setShowUpdateModal(true);
        setContinueChecking(false);
        return;
      }

      // 2. Checa se a sessão do usuário ainda é válida no backend
      const token = localStorage.getItem('lepta_auth_token');
      if (!token) {
        logout();
        setContinueChecking(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        setUpdateModalServerCommit(versionResult.serverCommit || 'nova versão');
        setUpdateModalReason('session_expired_deploy');
        setShowUpdateModal(true);
        setContinueChecking(false);
        return;
      }

      // Sessão e versão íntegras: navega normalmente ao destino
      navigateToDestination();
    } catch {
      navigateToDestination();
    } finally {
      setContinueChecking(false);
    }
  };

  // Autenticação oficial Microsoft (Entra ID)
  const handleCorporateLogin = async () => {
    setError('');
    setCorporateLoading(true);

    try {
      const msAuth = await authenticateWithMicrosoft();

      if (!msAuth) {
        setCorporateLoading(false);
        return;
      }

      const result = await loginWithMicrosoft({
        idToken: msAuth.idToken,
        email: msAuth.email
      });

      setCorporateLoading(false);
      if (result.success) {
        navigateToDestination();
      } else {
        setError(result.error || 'Acesso não autorizado para esta conta.');
      }
    } catch (err: any) {
      console.error('Erro na autenticação corporativa:', err);
      setCorporateLoading(false);
      
      const errorMessage = err?.message || '';
      if (errorMessage.includes('user_cancelled')) {
        return;
      }
      setError(err?.errorMessage || err?.message || 'Não foi possível conectar com a conta Microsoft.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-container glass">
        {isAuthenticated && user ? (
          <div className="login-active-session">
            <div className="login-brand-header">
              <img src="/logo2.png" alt="Lepta Capital" className="login-logo-img" />
            </div>

            <div className="login-header">
              <h2>Sessão <span className="text-gradient">Ativa</span></h2>
              <p>Você já está autenticado no sistema.</p>
            </div>

            <div className="active-user-badge">
              <div className="user-avatar-circle">
                {(user.username || user.email || 'U')[0].toUpperCase()}
              </div>
              <div className="user-details">
                <strong>{user.username}</strong>
                <span>{user.email || 'Conta Corporativa Lepta'}</span>
              </div>
            </div>

            <div className="active-session-actions">
              <button
                type="button"
                className="btn-primary login-submit"
                onClick={handleContinue}
                disabled={continueChecking}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {continueChecking ? (
                  <>
                    <RefreshCw className="spin" size={18} />
                    VERIFICANDO...
                  </>
                ) : (
                  <>
                    <ArrowRight size={18} />
                    CONTINUAR NO SISTEMA
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn-outline"
                onClick={() => logout()}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '4px' }}
              >
                <LogOut size={16} />
                Sair / Trocar de Conta
              </button>
            </div>
          </div>
        ) : (
          <div className="login-corporate-card">
            <div className="login-brand-header">
              <img src="/logo2.png" alt="Lepta Capital" className="login-logo-img" />
            </div>

            <div className="login-header">
              <h2>Portal <span className="text-gradient">Corporativo</span></h2>
              <p>Ambiente exclusivo para colaboradores e parceiros Lepta Capital.</p>
            </div>

            {error && (
              <div className="login-error">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="sso-primary-section">
              <button
                type="button"
                className="btn-microsoft-hero"
                onClick={handleCorporateLogin}
                disabled={corporateLoading}
                aria-label="Entrar com conta Microsoft Lepta Capital"
              >
                <div className="microsoft-icon-box">
                  <MicrosoftIcon />
                </div>
                <div className="microsoft-btn-text">
                  <strong>
                    {corporateLoading ? 'Conectando à Microsoft...' : 'Entrar com Conta Microsoft'}
                  </strong>
                  <span>@lepta.com.br</span>
                </div>
                {corporateLoading ? (
                  <RefreshCw className="spin ms-action-icon" size={20} />
                ) : (
                  <ArrowRight className="ms-action-icon" size={20} />
                )}
              </button>
            </div>

            <div className="security-trust-badge">
              <ShieldCheck size={20} className="shield-icon" />
              <div className="trust-text">
                <strong>Autenticação Segura</strong>
                <span>Protegido por Microsoft Entra ID com verificação em duas etapas (2FA).</span>
              </div>
            </div>

            <div className="login-footer-info">
              <p>Dúvidas ou dificuldades de acesso? Contate o suporte interno de TI.</p>
            </div>
          </div>
        )}
      </div>

      <UpdateRequiredModal
        isOpen={showUpdateModal}
        serverCommit={updateModalServerCommit}
        reason={updateModalReason}
        onConfirm={() => {
          logout();
          setShowUpdateModal(false);
        }}
      />
    </div>
  );
};

export default Login;
