import { FileSpreadsheet, ArrowRight, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../core/AuthContext';
import { hasPermission } from '../../core/permissions';
import '../../core/styles/Dashboard.css';

const FinanceDashboard = () => {
  const { user } = useAuth();
  const canAccessExtratos = hasPermission(user, '7.1');
  const canAccessGrafeno = hasPermission(user, '7.2');

  return (
    <div className="internal-dashboard-page fade-in">
      <div className="dashboard-header">
        <h1>Financeiro</h1>
        <p>Bem-vindo ao módulo de gestão financeira</p>
      </div>

      <div className="dashboard-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        {canAccessExtratos && (
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
        )}

        {canAccessGrafeno && (
          <div className="stat-card">
            <div className="stat-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
              <Landmark size={24} />
            </div>
            <div className="stat-info">
              <h3>LEPTA x GRAFENO</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Receptor de Webhooks, homologação e integração da API Grafeno.</p>
              <Link to="/financeiro/grafeno" className="btn-outline" style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                Acessar Integração <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceDashboard;
