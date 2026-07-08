import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    
    const targetY = element.getBoundingClientRect().top + window.scrollY - 80;
    const startY = window.scrollY;
    const distance = targetY - startY;
    const duration = 800; // ms
    let startTime: number | null = null;

    const animation = (currentTime: number) => {
      if (startTime === null) startTime = currentTime;
      const timeElapsed = currentTime - startTime;
      const progress = Math.min(timeElapsed / duration, 1);
      
      // Easing function: easeInOutCubic
      const ease = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      window.scrollTo(0, startY + distance * ease);

      if (timeElapsed < duration) {
        requestAnimationFrame(animation);
      }
    };

    requestAnimationFrame(animation);
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        scrollToSection(id);
      }, 300);
    } else {
      scrollToSection(id);
      // Removido o pushState do hash para garantir que o navegador não pule sozinho.
    }
  };

  return (
    <nav className="navbar glass">
      <div className="navbar-container">
        <Link 
          to="/" 
          className="navbar-logo" 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <img src="/logo2.png" alt="Lepta Capital" style={{ height: '65px' }} />
        </Link>
        <ul className="navbar-menu">
          <li><a href="#" onClick={(e) => handleNavClick(e, 'proposito')}>Nosso Propósito</a></li>
          <li><a href="#" onClick={(e) => handleNavClick(e, 'servicos')}>O que Fazemos</a></li>
          <li><a href="#" onClick={(e) => handleNavClick(e, 'valores')}>Valores</a></li>
          <li><a href="#" onClick={(e) => handleNavClick(e, 'contato')}>Contato</a></li>
        </ul>
        <div className="navbar-actions">
          <Link to="/login" className="btn-primary login-btn">
            <LogIn size={18} />
            ÁREA INTERNA
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
