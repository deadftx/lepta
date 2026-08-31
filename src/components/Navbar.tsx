import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LogIn, Menu, X } from 'lucide-react';
import { useAuth } from '../internal/core/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Fecha o menu quando a rota muda
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const toggleMenu = () => setIsOpen(!isOpen);

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
    setIsOpen(false); // Fecha o menu mobile ao clicar
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        scrollToSection(id);
      }, 300);
    } else {
      scrollToSection(id);
    }
  };

  return (
    <nav className="navbar glass">
      <div className="navbar-container">
        <Link 
          to="/" 
          className="navbar-logo" 
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            setIsOpen(false);
          }}
        >
          <img src="/logo2.png" alt="Lepta Capital" className="navbar-logo-img" />
        </Link>
        
        {/* Desktop Menu */}
        <ul className="navbar-menu desktop-only">
          <li><a href="#" onClick={(e) => handleNavClick(e, 'proposito')}>Nosso Propósito</a></li>
          <li><a href="#" onClick={(e) => handleNavClick(e, 'servicos')}>O que Fazemos</a></li>
          <li><a href="#" onClick={(e) => handleNavClick(e, 'valores')}>Valores</a></li>
          <li><a href="#" onClick={(e) => handleNavClick(e, 'contato')}>Contato</a></li>
        </ul>

        <div className="navbar-actions">
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn-primary login-btn desktop-only" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
              <ArrowRight size={18} />
              CONTINUAR
            </Link>
          ) : (
            <Link to="/login" className="btn-primary login-btn desktop-only">
              <LogIn size={18} />
              ÁREA INTERNA
            </Link>
          )}
          
          {/* Hamburger Menu Toggle (Mobile) */}
          <button className="mobile-toggle" onClick={toggleMenu} aria-label="Toggle menu">
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      {/* Mobile Premium Dropdown Menu */}
      <div className={`mobile-menu glass ${isOpen ? 'open' : ''}`}>
        <ul className="mobile-menu-list">
          <li><a href="#" onClick={(e) => handleNavClick(e, 'proposito')}>Nosso Propósito</a></li>
          <li><a href="#" onClick={(e) => handleNavClick(e, 'servicos')}>O que Fazemos</a></li>
          <li><a href="#" onClick={(e) => handleNavClick(e, 'valores')}>Valores</a></li>
          <li><a href="#" onClick={(e) => handleNavClick(e, 'contato')}>Contato</a></li>
          <li className="mobile-menu-action">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary login-btn-mobile" onClick={() => setIsOpen(false)} style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
                <ArrowRight size={18} />
                CONTINUAR
              </Link>
            ) : (
              <Link to="/login" className="btn-primary login-btn-mobile" onClick={() => setIsOpen(false)}>
                <LogIn size={18} />
                ÁREA INTERNA
              </Link>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
