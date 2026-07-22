import React, { useEffect, useState } from 'react';
import { Shield, AlertTriangle, TrendingDown, CheckCircle, Search } from 'lucide-react';
import './Operations.css';

interface Risk {
  id: string;
  creditId: string;
  companyName: string;
  score: number;
  rating: string;
  defaultProbability: number;
  mainRisks: string[];
  observations: string;
}

const getRatingBadge = (rating: string) => {
  if (rating.startsWith('A')) return <span className="badge success">{rating}</span>;
  if (rating.startsWith('B')) return <span className="badge warning">{rating}</span>;
  return <span className="badge danger">{rating}</span>;
};

const Risks = () => {
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3004/risks')
      .then(res => res.json())
      .then(data => {
        setRisks(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="operations-page">
      <div className="page-header">
        <div>
          <h2>Análise de Riscos</h2>
          <p>Métricas e avaliação de probabilidade de inadimplência.</p>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card glass">
          <div className="icon-wrapper bg-blue"><Shield size={24} /></div>
          <div className="summary-info">
            <span className="label">Score Médio</span>
            <h4>{risks.length > 0 ? Math.round(risks.reduce((a, c) => a + c.score, 0) / risks.length) : 0}</h4>
          </div>
        </div>
        <div className="summary-card glass">
          <div className="icon-wrapper bg-green"><CheckCircle size={24} /></div>
          <div className="summary-info">
            <span className="label">Baixo Risco (A/AA/AAA)</span>
            <h4>{risks.filter(r => r.rating.startsWith('A')).length} Empresas</h4>
          </div>
        </div>
        <div className="summary-card glass">
          <div className="icon-wrapper bg-red"><AlertTriangle size={24} /></div>
          <div className="summary-info">
            <span className="label">Alto Risco (C/D)</span>
            <h4>{risks.filter(r => !r.rating.startsWith('A') && !r.rating.startsWith('B')).length} Empresas</h4>
          </div>
        </div>
      </div>

      <div className="internal-card glass full-width">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Carteira Monitorada</h3>
          <div className="header-search" style={{ width: '300px' }}>
            <Search size={16} style={{ position: 'absolute', marginLeft: '10px', color: '#999' }} />
            <input type="text" placeholder="Buscar empresa..." className="input-field" style={{ paddingLeft: '35px', width: '100%' }} />
          </div>
        </div>
        
        {loading ? (
          <p>Carregando carteira...</p>
        ) : (
          <div className="table-responsive">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Score (0-1000)</th>
                  <th>Rating</th>
                  <th>PD (%)</th>
                  <th>Principais Riscos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {risks.map(risk => (
                  <tr key={risk.id}>
                    <td><strong>{risk.companyName}</strong></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {risk.score}
                        <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${(risk.score / 1000) * 100}%`, height: '100%', background: risk.score > 700 ? '#00cc66' : risk.score > 400 ? '#ff9900' : '#ff3366' }}></div>
                        </div>
                      </div>
                    </td>
                    <td>{getRatingBadge(risk.rating)}</td>
                    <td>{risk.defaultProbability.toFixed(1)}%</td>
                    <td><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{risk.mainRisks.join(', ')}</span></td>
                    <td>
                      <button className="btn-link">Ver Parecer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Risks;
