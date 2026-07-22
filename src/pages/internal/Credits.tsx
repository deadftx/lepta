import React, { useEffect, useState } from 'react';
import { DollarSign, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import './Operations.css';

interface Credit {
  id: string;
  companyName: string;
  cnpj: string;
  requestedValue: number;
  approvedValue: number;
  status: string;
  requestDate: string;
  type: string;
  interestRate: number;
  termMonths: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const getStatusBadge = (status: string) => {
  if (status === 'Aprovado') return <span className="badge success"><CheckCircle size={12} /> Aprovado</span>;
  if (status === 'Recusado') return <span className="badge danger"><XCircle size={12} /> Recusado</span>;
  return <span className="badge warning"><Clock size={12} /> Em Análise</span>;
};

const Credits = () => {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3004/credits')
      .then(res => res.json())
      .then(data => {
        setCredits(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="operations-page">
      <div className="page-header">
        <div>
          <h2>Operações de Crédito</h2>
          <p>Acompanhamento e solicitação de limites de crédito.</p>
        </div>
        <button className="btn-primary">
          <Plus size={18} /> Nova Solicitação
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card glass">
          <div className="icon-wrapper bg-blue"><DollarSign size={24} /></div>
          <div className="summary-info">
            <span className="label">Volume Solicitado</span>
            <h4>{formatCurrency(credits.reduce((acc, curr) => acc + curr.requestedValue, 0))}</h4>
          </div>
        </div>
        <div className="summary-card glass">
          <div className="icon-wrapper bg-green"><CheckCircle size={24} /></div>
          <div className="summary-info">
            <span className="label">Volume Aprovado</span>
            <h4>{formatCurrency(credits.reduce((acc, curr) => acc + curr.approvedValue, 0))}</h4>
          </div>
        </div>
        <div className="summary-card glass">
          <div className="icon-wrapper bg-orange"><Clock size={24} /></div>
          <div className="summary-info">
            <span className="label">Em Análise</span>
            <h4>{credits.filter(c => c.status === 'Em Análise').length} Operações</h4>
          </div>
        </div>
      </div>

      <div className="internal-card glass full-width">
        <div className="card-header">
          <h3>Lista de Solicitações</h3>
        </div>
        
        {loading ? (
          <p>Carregando operações...</p>
        ) : (
          <div className="table-responsive">
            <table className="operations-table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>CNPJ</th>
                  <th>Linha de Crédito</th>
                  <th>Valor Solicitado</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {credits.map(credit => (
                  <tr key={credit.id}>
                    <td><strong>{credit.companyName}</strong></td>
                    <td>{credit.cnpj}</td>
                    <td>{credit.type}</td>
                    <td>{formatCurrency(credit.requestedValue)}</td>
                    <td>{getStatusBadge(credit.status)}</td>
                    <td>{new Date(credit.requestDate).toLocaleDateString('pt-BR')}</td>
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

export default Credits;
