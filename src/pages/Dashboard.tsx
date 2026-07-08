import { LogOut, User, Activity, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate('/');
  };

  return (
    <div className="dashboard-page">
      <aside className="dashboard-sidebar glass">
        <div className="sidebar-header">
          <div className="user-avatar">
            <User size={24} />
          </div>
          <div className="user-info">
            <h4>Administrador</h4>
            <p>admin@lepta.com.br</p>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <a href="#" className="nav-item active">
            <Activity size={20} /> Visão Geral
          </a>
          <a href="#" className="nav-item">
            <FileText size={20} /> Relatórios
          </a>
          <a href="#" className="nav-item">
            <User size={20} /> Clientes
          </a>
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-outline logout-btn">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <main className="dashboard-content">
        <header className="dashboard-header">
          <h2>Painel de <span className="text-gradient">Controle</span></h2>
          <p>Bem-vindo à Área Interna da Lepta Capital.</p>
        </header>

        <div className="dashboard-grid">
          <div className="stat-card glass">
            <h3>Operações Ativas</h3>
            <div className="stat-value">124</div>
            <div className="stat-trend positive">+12% este mês</div>
          </div>
          
          <div className="stat-card glass">
            <h3>Volume NPL</h3>
            <div className="stat-value">R$ 45M</div>
            <div className="stat-trend positive">+5% este mês</div>
          </div>
          
          <div className="stat-card glass">
            <h3>Novos Clientes</h3>
            <div className="stat-value">8</div>
            <div className="stat-trend negative">-2 em relação ao mês passado</div>
          </div>
        </div>

        <div className="recent-activity glass">
          <h3>Atividade Recente</h3>
          <ul className="activity-list">
            <li><strong>João Silva</strong> aprovou o contrato de reestruturação. <span>Há 2 horas</span></li>
            <li><strong>Maria Oliveira</strong> solicitou análise de crédito. <span>Há 4 horas</span></li>
            <li>Sistema gerou relatório mensal automaticamente. <span>Há 1 dia</span></li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
