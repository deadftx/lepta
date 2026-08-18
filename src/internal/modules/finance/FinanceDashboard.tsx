import { FileSpreadsheet, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import '../../core/styles/Dashboard.css';

const FinanceDashboard = () => {
  return (
    <div className="internal-dashboard-page fade-in">
      <div className="dashboard-header">
        <h1>Financeiro</h1>
        <p>Bem-vindo ao módulo de gestão financeira</p>
      </div>

      <div className="dashboard-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(255, 138, 0, 0.1)', color: 'var(--accent-orange)' }}>
            <FileSpreadsheet size={24} />
          </div>
          <div className="stat-info">
            <h3>Processar Extrato</h3>
            <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Padronização de extratos bancários com inteligência.</p>
            <Link to="/financeiro/extratos" className="btn-outline" style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Acessar Ferramenta <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
