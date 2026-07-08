import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight } from 'lucide-react';
import './Login.css';

const Login = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulate login
    navigate('/dashboard');
  };

  return (
    <div className="login-page">
      <div className="login-container glass">
        <div className="login-header">
          <h2>Área <span className="text-gradient">Interna</span></h2>
          <p>Acesse sua conta para continuar.</p>
        </div>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <Mail className="input-icon" size={18} />
            <input 
              type="email" 
              placeholder="E-mail Corporativo" 
              className="input-field with-icon" 
              required 
            />
          </div>
          
          <div className="input-group">
            <Lock className="input-icon" size={18} />
            <input 
              type="password" 
              placeholder="Senha" 
              className="input-field with-icon" 
              required 
            />
          </div>
          
          <div className="login-options">
            <label className="remember-me">
              <input type="checkbox" /> Lembrar-me
            </label>
            <a href="#" className="forgot-password">Esqueci minha senha</a>
          </div>
          
          <button type="submit" className="btn-primary login-submit">
            Entrar <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
