import { LogOut, User, FileText, Settings, Users, MessageSquare, Bell, Calendar, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { logout, userEmail } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="internal-dashboard-page">
      <aside className="internal-sidebar glass">
        <div className="sidebar-brand">
          <img src="/logo2.png" alt="Lepta Capital" className="sidebar-logo" />
        </div>
        
        <div className="user-profile">
          <div className="user-avatar">
            <User size={24} />
          </div>
          <div className="user-info">
            <h4>Diretoria</h4>
            <p>{userEmail}</p>
          </div>
        </div>
        
        <nav className="internal-nav">
          <p className="nav-group-title">INTRANET</p>
          <a href="#" className="nav-item active">
            <MessageSquare size={20} /> Comunicados
          </a>
          <a href="#" className="nav-item">
            <FileText size={20} /> Relatórios Financeiros
          </a>
          <a href="#" className="nav-item">
            <Users size={20} /> Recursos Humanos
          </a>
          
          <p className="nav-group-title">FERRAMENTAS</p>
          <a href="#" className="nav-item">
            <Calendar size={20} /> Calendário
          </a>
          <a href="#" className="nav-item">
            <Settings size={20} /> Configurações
          </a>
          <a href="#" className="nav-item">
            <HelpCircle size={20} /> Suporte TI
          </a>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-outline logout-btn">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <main className="internal-content">
        <header className="internal-header">
          <div className="header-search">
            <input type="text" placeholder="Pesquisar na intranet..." className="input-field search-input" />
          </div>
          <div className="header-actions">
            <button className="icon-btn">
              <Bell size={20} />
            </button>
          </div>
        </header>

        <div className="internal-body">
          <div className="welcome-banner glass">
            <h2>Bem-vindo à Intranet <span className="text-gradient">Lepta</span></h2>
            <p>Seu portal central para comunicações internas, relatórios corporativos e ferramentas administrativas.</p>
          </div>

          <div className="dashboard-grid">
            <div className="internal-card glass">
              <div className="card-header">
                <h3>Comunicados Importantes</h3>
                <span className="badge new">Novo</span>
              </div>
              <ul className="notice-list">
                <li>
                  <div className="notice-date">10 Jul 2026</div>
                  <div className="notice-title">Atualização nas políticas de segurança da informação</div>
                </li>
                <li>
                  <div className="notice-date">05 Jul 2026</div>
                  <div className="notice-title">Resultados do Q2 disponíveis para diretoria</div>
                </li>
                <li>
                  <div className="notice-date">28 Jun 2026</div>
                  <div className="notice-title">Manutenção programada no ERP neste fim de semana</div>
                </li>
              </ul>
              <button className="btn-link">Ver todos os comunicados</button>
            </div>

            <div className="internal-card glass">
              <h3>Acessos Rápidos</h3>
              <div className="quick-links-grid">
                <a href="#" className="quick-link">
                  <FileText size={24} />
                  <span>Holerite</span>
                </a>
                <a href="#" className="quick-link">
                  <Users size={24} />
                  <span>Portal RH</span>
                </a>
                <a href="#" className="quick-link">
                  <Settings size={24} />
                  <span>Sistema ERP</span>
                </a>
                <a href="#" className="quick-link">
                  <HelpCircle size={24} />
                  <span>Chamados TI</span>
                </a>
              </div>
            </div>
            
            <div className="internal-card glass full-width">
              <h3>Próximos Eventos & Feriados</h3>
              <div className="events-list">
                <div className="event-item">
                  <div className="event-date">
                    <span className="day">15</span>
                    <span className="month">Jul</span>
                  </div>
                  <div className="event-details">
                    <h4>Reunião de Fechamento de Metas</h4>
                    <p>Sala de Reuniões Principal - 14:00h</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
