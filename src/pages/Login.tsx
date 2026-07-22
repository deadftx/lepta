import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="login-page">
      <div className="login-container glass">
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
            <a href="#" className="forgot-password">Esqueci minha senha</a>
          </div>
          
          <button type="submit" className="btn-primary login-submit" disabled={loading}>
            {loading ? 'Entrando...' : <>Entrar <ArrowRight size={18} /></>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
