import { useState, useEffect } from 'react';
import { Users, Search, BrainCircuit, Database, ShieldCheck, TrendingUp, AlertTriangle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import './CustomerAnalysis.css';
import './Operations.css';

interface ClientAnalysis {
  cedente: string;
  sacado?: string; // used for drill-down view
  qtdTitulos: number;
  valorGeral: number;
  valorVencido: number;
  riskLevel?: 'Baixo' | 'Médio' | 'Alto';
  score?: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const CustomerAnalysis = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<ClientAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Drill-down states
  const [selectedCedente, setSelectedCedente] = useState<string | null>(null);
  const [sacados, setSacados] = useState<ClientAnalysis[]>([]);
  const [loadingSacados, setLoadingSacados] = useState(false);
  const [sacadosError, setSacadosError] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/analise-clientes?t=${Date.now()}`, { 
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });
        if (!response.ok) throw new Error('Erro ao buscar dados da API');
        const data = await response.json();
        
        // Enriquecer dados com inteligência simulada baseada em regras de negócio
        const enriched = data.map((client: ClientAnalysis) => {
          const percVencido = client.valorGeral > 0 ? (client.valorVencido / client.valorGeral) : 0;
          let riskLevel: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
          let score = 900;

          if (percVencido > 0.1) {
            riskLevel = 'Alto';
            score = Math.floor(400 + Math.random() * 200); // 400-600
          } else if (percVencido > 0.02) {
            riskLevel = 'Médio';
            score = Math.floor(600 + Math.random() * 150); // 600-750
          } else {
            riskLevel = 'Baixo';
            score = Math.floor(750 + Math.random() * 250); // 750-1000
          }

          return { ...client, riskLevel, score };
        });
        setClients(enriched);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao buscar dados:', err);
        setError('Erro ao carregar dados do banco.');
        setLoading(false);
      }
    };
    fetchClients();
  }, []);

  const filteredClients = searchTerm.trim() === ''
    ? []
    : clients.filter(client => {
        return client.cedente.toLowerCase().includes(searchTerm.toLowerCase());
      });

  const handleCedenteClick = async (cedente: string) => {
    setSearchTerm(''); // Limpa a busca ao entrar
    setSelectedCedente(cedente);
    setLoadingSacados(true);
    setSacadosError('');
    try {
      const response = await fetch(`/api/analise-sacados/${encodeURIComponent(cedente)}`);
      if (!response.ok) throw new Error('Erro ao buscar sacados da API');
      const data = await response.json();
      
      const enriched = data.map((sac: any) => {
        const percVencido = sac.valorGeral > 0 ? (sac.valorVencido / sac.valorGeral) : 0;
        let riskLevel: 'Baixo' | 'Médio' | 'Alto' = 'Baixo';
        let score = 900;
        if (percVencido > 0.1) {
          riskLevel = 'Alto';
          score = Math.floor(400 + Math.random() * 200);
        } else if (percVencido > 0.02) {
          riskLevel = 'Médio';
          score = Math.floor(600 + Math.random() * 150);
        } else {
          riskLevel = 'Baixo';
          score = Math.floor(750 + Math.random() * 250);
        }
        return { ...sac, riskLevel, score };
      });
      setSacados(enriched);
    } catch (err) {
      console.error('Erro ao buscar sacados:', err);
      setSacadosError('Erro ao carregar dados dos sacados.');
    } finally {
      setLoadingSacados(false);
    }
  };

  const handleBack = () => {
    setSelectedCedente(null);
    setSacados([]);
  };

  // KPIs
  let displayClients = [];
  
  if (selectedCedente) {
    displayClients = searchTerm.trim() === '' 
      ? sacados 
      : sacados.filter(sac => (sac.sacado || '').toLowerCase().includes(searchTerm.toLowerCase()));
  } else {
    displayClients = filteredClients;
  }
  
  const totalClients = displayClients.length;
  const totalVolume = displayClients.reduce((acc, curr) => acc + curr.valorGeral, 0);
  const totalVencido = displayClients.reduce((acc, curr) => acc + curr.valorVencido, 0);
  
  const percVencidoGeral = totalVolume > 0 ? (totalVencido / totalVolume) * 100 : 0;
  const avgScore = totalClients > 0 ? Math.floor(displayClients.reduce((acc, c) => acc + (c.score || 0), 0) / totalClients) : 0;

  return (
    <div className="customer-analysis-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div className="intelligence-badge">
            <BrainCircuit size={16} /> Lepta Intelligence (Ao Vivo)
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginTop: '0.5rem', color: '#fff' }}>
            Análise de Clientes
          </h2>
          <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.95rem' }}>
            Dados sincronizados em tempo real diretamente da base do banco de dados.
          </p>
        </div>

        <Link to="/banco-de-dados" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
          <Database size={18} /> Gerenciar Base de Dados
        </Link>
      </div>

      {/* KPI Summary Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon">
            <Users size={24} />
          </div>
          <div className="kpi-info">
            <h4>{selectedCedente ? 'Sacados' : 'Cedentes / Clientes'}</h4>
            <div className="kpi-value">{loading || loadingSacados ? '...' : totalClients}</div>
            <div className="kpi-sub">{selectedCedente ? 'Do cedente selecionado' : 'Cadastrados na Base'}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.12)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <h4>Volume Geral</h4>
            <div className="kpi-value">{loading || loadingSacados ? '...' : formatCurrency(totalVolume)}</div>
            <div className="kpi-sub">Total {selectedCedente ? 'dos Sacados' : 'da Base'}</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-info">
            <h4>Total Vencido</h4>
            <div className="kpi-value">{loading || loadingSacados ? '...' : formatCurrency(totalVencido)}</div>
            <div className="kpi-sub" style={{ color: '#ef4444' }}>{percVencidoGeral.toFixed(2)}% da carteira</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="kpi-info">
            <h4>Score Médio</h4>
            <div className="kpi-value">{loading || loadingSacados ? '...' : `${avgScore} / 1000`}</div>
            <div className="kpi-sub" style={{ color: '#10b981' }}>Score calculado</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-bar glass">
        <div className="filter-group" style={{ width: '100%' }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search size={18} />
            <input
              type="text"
              className="input-field"
              placeholder={selectedCedente ? "Buscar sacado..." : "Buscar instantânea por nome do cliente ou cedente..."}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Main Content Table */}
      <div className="internal-card glass">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>
            {selectedCedente 
              ? `Visão Geral dos Sacados do Cedente "${selectedCedente}"`
              : "Visão Geral dos Clientes"}
          </h3>
          {selectedCedente && (
            <button 
              onClick={handleBack}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: 'rgba(255, 255, 255, 0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <ArrowLeft size={16} /> Voltar para Cedentes
            </button>
          )}
        </div>

        {loading || loadingSacados ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Database size={48} className="animate-pulse" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Consultando e agregando registros no SQLite...</p>
          </div>
        ) : error || sacadosError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
            <p>{error || sacadosError}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{selectedCedente ? 'Sacado' : 'Cliente (Cedente)'}</th>
                  <th>Títulos (Qtd)</th>
                  <th>Valor Geral (R$)</th>
                  <th>Valor Vencido (R$)</th>
                  <th>Score Calculado</th>
                  <th>Risco</th>
                </tr>
              </thead>
              <tbody>
                {displayClients.map((client, idx) => (
                  <tr key={idx}>
                    <td 
                      style={{ fontWeight: 600, cursor: selectedCedente ? 'default' : 'pointer', color: selectedCedente ? 'inherit' : '#3b82f6' }}
                      onClick={() => !selectedCedente && handleCedenteClick(client.cedente)}
                    >
                      {selectedCedente ? client.sacado : client.cedente}
                    </td>
                    <td style={{ color: 'var(--text-muted, #94a3b8)' }}>{client.qtdTitulos}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(client.valorGeral)}</td>
                    <td style={{ color: client.valorVencido > 0 ? '#ef4444' : 'inherit' }}>
                      {formatCurrency(client.valorVencido)}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, color: (client.score || 0) > 750 ? '#10b981' : (client.score || 0) > 600 ? '#f59e0b' : '#ef4444' }}>
                        {client.score}
                      </span>
                    </td>
                    <td>
                      <span className={`client-status-pill ${
                        client.riskLevel === 'Baixo' ? 'status-low' : client.riskLevel === 'Médio' ? 'status-medium' : 'status-high'
                      }`}>
                        {client.riskLevel}
                      </span>
                    </td>
                  </tr>
                ))}
                {displayClients.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                      {searchTerm.trim() === '' ? (
                        <>
                          <Search size={48} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                          <p style={{ fontSize: '1.1rem' }}>Digite o nome de um cliente ou cedente para visualizar os dados</p>
                        </>
                      ) : (
                        <p>Nenhum registro encontrado com a busca "{searchTerm}"</p>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerAnalysis;
