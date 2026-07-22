import React, { useEffect, useState } from 'react';
import { Scale, Users, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react';
import './Operations.css';

interface CommitteeDecision {
  id: string;
  companyName: string;
  cnpj: string;
  requestedValue: number;
  proponentSector: string;
  analysisDate: string;
  status: string;
  votes: { approved: number; rejected: number };
  notes: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getStatusBadge = (status: string) => {
  if (status === 'Aprovado') return <span className="badge success">{status}</span>;
  if (status === 'Reprovado') return <span className="badge danger">{status}</span>;
  return <span className="badge info">{status}</span>;
};

const Committee = () => {
  const [decisions, setDecisions] = useState<CommitteeDecision[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3004/committees')
      .then(res => res.json())
      .then(data => {
        setDecisions(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="operations-page">
      <div className="page-header">
        <div>
          <h2>Comitê de Crédito</h2>
          <p>Deliberações manuais e acompanhamento de aprovações excepcionais.</p>
        </div>
        <button className="btn-primary">
          Agendar Comitê
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card glass">
          <div className="icon-wrapper bg-blue"><Scale size={24} /></div>
          <div className="summary-info">
            <span className="label">Em Pauta</span>
            <h4>{decisions.filter(d => d.status === 'Agendado').length} Casos</h4>
          </div>
        </div>
        <div className="summary-card glass">
          <div className="icon-wrapper bg-green"><ThumbsUp size={24} /></div>
          <div className="summary-info">
            <span className="label">Aprovações no Mês</span>
            <h4>{decisions.filter(d => d.status === 'Aprovado').length}</h4>
          </div>
        </div>
        <div className="summary-card glass">
          <div className="icon-wrapper bg-red"><ThumbsDown size={24} /></div>
          <div className="summary-info">
            <span className="label">Reprovações no Mês</span>
            <h4>{decisions.filter(d => d.status === 'Reprovado').length}</h4>
          </div>
        </div>
      </div>

      <div className="internal-card glass full-width">
        <div className="card-header">
          <h3>Pauta e Histórico de Deliberações</h3>
        </div>
        
        {loading ? (
          <p>Carregando pauta...</p>
        ) : (
          <div className="table-responsive">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>Cliente (CNPJ)</th>
                  <th>Valor Pleiteado</th>
                  <th>Setor Proponente</th>
                  <th>Data do Comitê</th>
                  <th>Votação</th>
                  <th>Decisão Final</th>
                  <th>Parecer</th>
                </tr>
              </thead>
              <tbody>
                {decisions.map(d => (
                  <tr key={d.id}>
                    <td>
                      <div><strong>{d.companyName}</strong></div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{d.cnpj}</div>
                    </td>
                    <td>{formatCurrency(d.requestedValue)}</td>
                    <td>{d.proponentSector}</td>
                    <td>{new Date(d.analysisDate).toLocaleDateString('pt-BR')}</td>
                    <td>
                      {d.status === 'Agendado' ? (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span style={{ color: '#00cc66', display: 'flex', alignItems: 'center', gap: '2px' }}><ThumbsUp size={14}/> {d.votes.approved}</span>
                          <span style={{ color: '#ff3366', display: 'flex', alignItems: 'center', gap: '2px' }}><ThumbsDown size={14}/> {d.votes.rejected}</span>
                        </div>
                      )}
                    </td>
                    <td>{getStatusBadge(d.status)}</td>
                    <td>
                      <button className="btn-icon" title={d.notes}>
                        <MessageSquare size={16} /> Ler Parecer
                      </button>
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

export default Committee;
