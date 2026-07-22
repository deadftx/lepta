import { FileText, Settings, Users, HelpCircle } from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  return (
    <>
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
    </>
  );
};

export default Dashboard;
