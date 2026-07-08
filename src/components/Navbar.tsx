import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar glass">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          {/* Logo placeholder - replace src with /Logo1.png when available */}
          <span className="logo-text">
            <span className="logo-lepta">LEPTA</span> <span className="logo-capital">CAPITAL</span>
          </span>
        </Link>
        <ul className="navbar-menu">
          <li><a href="#proposito">Nosso Propósito</a></li>
          <li><a href="#servicos">O que Fazemos</a></li>
          <li><a href="#valores">Valores</a></li>
          <li><a href="#contato">Contato</a></li>
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
