import { useState, useEffect } from 'react';
import { Users, Search, BrainCircuit, Database, TrendingUp, AlertTriangle, ArrowLeft, Building2, User, CheckCircle, Clock } from 'lucide-react';
import './CustomerAnalysis.css';
import './Operations.css';

interface ClientAnalysis {
  cedente: string;
  sacado?: string; // used for drill-down view
  ua?: string; // used for UA drill-down view
  qtdTitulos: number;
  qtdVencido?: number;
  qtdLiquidado?: number;
  qtdAberto?: number;
  valorGeral: number;
  valorVencido: number;
  valorLiquidado: number;
  valorAberto: number;
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
  const [drillDownMode, setDrillDownMode] = useState<'sacados' | 'ua' | null>(null);
  const [activeKpiFilter, setActiveKpiFilter] = useState<'all' | 'liquidado' | 'aberto' | 'vencido'>('all');
  const [subData, setSubData] = useState<ClientAnalysis[]>([]);
  const [loadingSubData, setLoadingSubData] = useState(false);
  const [subDataError, setSubDataError] = useState('');
  
  // Popover state
  const [popover, setPopover] = useState<{ visible: boolean; x: number; y: number; cedente: string } | null>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setPopover(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

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

  const handleCedenteClick = (e: React.MouseEvent, cedente: string) => {
    e.stopPropagation();
    
    // Estimativas do tamanho do modal
    const modalWidth = 320;
    const modalHeight = 150;
    
    let popX = e.clientX + 15;
    let popY = e.clientY + 15;

    // Inteligência de tela: não deixar estourar a tela
    if (popX + modalWidth > window.innerWidth) {
      popX = e.clientX - modalWidth - 15; // Joga pra esquerda do cursor
    }
    if (popY + modalHeight > window.innerHeight) {
      popY = e.clientY - modalHeight - 15; // Joga pra cima do cursor
    }

    setPopover({
      visible: true,
      x: popX,
      y: popY,
      cedente
    });
  };

  const handleSelectDrillDown = async (mode: 'sacados' | 'ua') => {
    if (!popover) return;
    const cedente = popover.cedente;
    setPopover(null);
    setSearchTerm('');
    setSelectedCedente(cedente);
    setDrillDownMode(mode);
    setLoadingSubData(true);
    setSubDataError('');
    try {
      const endpoint = mode === 'sacados' ? `/api/analise-sacados/` : `/api/analise-ua/`;
      const response = await fetch(`${endpoint}${encodeURIComponent(cedente)}`);
      if (!response.ok) throw new Error('Erro ao buscar dados da API');
      const data = await response.json();
      
      const enriched = data.map((item: any) => {
        const percVencido = item.valorGeral > 0 ? (item.valorVencido / item.valorGeral) : 0;
        let riskLevel: 'Baixo' | 'MǸdio' | 'Alto' = 'Baixo';
        let score = 900;
        if (percVencido > 0.1) {
          riskLevel = 'Alto';
          score = Math.floor(400 + Math.random() * 200);
        } else if (percVencido > 0.02) {
          riskLevel = 'MǸdio';
          score = Math.floor(600 + Math.random() * 150);
        } else {
          riskLevel = 'Baixo';
          score = Math.floor(750 + Math.random() * 250);
        }
        return { ...item, riskLevel, score };
      });
      setSubData(enriched);
    } catch (err) {
      console.error('Erro ao buscar sub-dados:', err);
      setSubDataError('Erro ao carregar dados detalhados.');
    } finally {
      setLoadingSubData(false);
    }
  };

  const handleBack = () => {
    setSelectedCedente(null);
    setDrillDownMode(null);
    setSubData([]);
  };

  // KPIs
  let displayClients = [];
  let kpiClients = clients; // Usado apenas para os totais no topo
  
  if (selectedCedente) {
    const currentSubData = searchTerm.trim() === '' 
      ? subData 
      : subData.filter(item => {
          const field = drillDownMode === 'sacados' ? item.sacado : item.ua;
          return (field || '').toLowerCase().includes(searchTerm.toLowerCase());
        });
    
    displayClients = currentSubData;
    kpiClients = currentSubData; 
  } else {
    displayClients = filteredClients; 
    kpiClients = clients; 
  }

  // Aplica filtro e ordenação baseado no KPI selecionado
  if (activeKpiFilter !== 'all' && displayClients.length > 0) {
    displayClients = displayClients.filter(c => {
      if (activeKpiFilter === 'liquidado') return (c.valorLiquidado || 0) > 0;
      if (activeKpiFilter === 'aberto') return (c.valorAberto || 0) > 0;
      if (activeKpiFilter === 'vencido') return (c.valorVencido || 0) > 0;
      return true;
    });

    displayClients.sort((a, b) => {
      if (activeKpiFilter === 'liquidado') return (b.valorLiquidado || 0) - (a.valorLiquidado || 0);
      if (activeKpiFilter === 'aberto') return (b.valorAberto || 0) - (a.valorAberto || 0);
      if (activeKpiFilter === 'vencido') return (b.valorVencido || 0) - (a.valorVencido || 0);
      return (b.valorGeral || 0) - (a.valorGeral || 0);
    });
  } else {
    // Ordenação padrão
    displayClients.sort((a, b) => (b.valorGeral || 0) - (a.valorGeral || 0));
  }
  
  const totalClients = kpiClients.length;
  const totalVolume = kpiClients.reduce((acc, curr) => acc + (curr.valorGeral || 0), 0);
  const totalVencido = kpiClients.reduce((acc, curr) => acc + (curr.valorVencido || 0), 0);
  const totalLiquidado = kpiClients.reduce((acc, curr) => acc + (curr.valorLiquidado || 0), 0);
  const totalAberto = kpiClients.reduce((acc, curr) => acc + (curr.valorAberto || 0), 0);
  
  const percVencidoGeral = totalVolume > 0 ? (totalVencido / totalVolume) * 100 : 0;
// const avgScore = totalClients > 0 ? Math.floor(kpiClients.reduce((acc, c) => acc + (c.score || 0), 0) / totalClients) : 0;

  return (
    <div className="customer-analysis-page">
      {/* Title block removed to save space */ }

      {/* KPI Summary Grid */}
      <div className="kpi-grid">
        <div className={`kpi-card ${activeKpiFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveKpiFilter('all')}>
          <div className="kpi-icon">
            <Users size={24} />
          </div>
          <div className="kpi-info">
            <h4>{selectedCedente ? (drillDownMode === 'sacados' ? 'Sacados' : 'Unid. Administrativas') : 'Cedentes / Clientes'}</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : totalClients}</div>
            <div className="kpi-sub">{selectedCedente ? 'Do cedente selecionado' : 'Cadastrados na Base'}</div>
          </div>
        </div>

        <div className={`kpi-card ${activeKpiFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveKpiFilter('all')}>
          <div className="kpi-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.12)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <h4>Volume Geral</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : formatCurrency(totalVolume)}</div>
            <div className="kpi-sub">Total {selectedCedente ? 'do detalhamento' : 'da Base'}</div>
          </div>
        </div>

        <div className={`kpi-card ${activeKpiFilter === 'liquidado' ? 'active' : ''}`} onClick={() => setActiveKpiFilter('liquidado')}>
          <div className="kpi-icon" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }}>
            <CheckCircle size={24} />
          </div>
          <div className="kpi-info">
            <h4>Total Liquidado</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : formatCurrency(totalLiquidado)}</div>
            <div className="kpi-sub" style={{ color: '#10b981' }}>Titulos Liquidados</div>
          </div>
        </div>

        <div className={`kpi-card ${activeKpiFilter === 'aberto' ? 'active' : ''}`} onClick={() => setActiveKpiFilter('aberto')}>
          <div className="kpi-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)' }}>
            <Clock size={24} />
          </div>
          <div className="kpi-info">
            <h4>Total em Aberto</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : formatCurrency(totalAberto)}</div>
            <div className="kpi-sub" style={{ color: '#f59e0b' }}>A vencer (Títulos Abertos)</div>
          </div>
        </div>

        <div className={`kpi-card ${activeKpiFilter === 'vencido' ? 'active' : ''}`} onClick={() => setActiveKpiFilter('vencido')}>
          <div className="kpi-icon" style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.12)' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-info">
            <h4>Total Vencido</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : formatCurrency(totalVencido)}</div>
            <div className="kpi-sub" style={{ color: '#ef4444' }}>{percVencidoGeral.toFixed(2)}% da carteira</div>
          </div>
        </div>
      </div>

      {/* Main Content Table */}
      <div className="internal-card glass" style={{ marginTop: '1rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <h3>
            {selectedCedente 
              ? (drillDownMode === 'sacados' 
                  ? `Visão Geral dos Sacados do Cedente "${selectedCedente}"` 
                  : `Visão Geral das UAs do Cedente "${selectedCedente}"`)
              : "Visão Geral dos Clientes"}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="intelligence-badge" style={{ margin: 0 }}>
              <BrainCircuit size={16} /> Lepta Intelligence
            </div>
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
        </div>

        {/* Unified Search Bar */}
        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem' }}>
          <div className="search-input-wrapper" style={{ width: '100%' }}>
            <Search size={18} />
            <input
              type="text"
              className="input-field"
              placeholder={selectedCedente ? `Buscar ${drillDownMode === 'sacados' ? 'sacado' : 'UA'}...` : "Buscar instantânea por nome do cliente ou cedente..."}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        {loading || loadingSubData ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
            <Database size={48} className="animate-pulse" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>Consultando e agregando registros no SQLite...</p>
          </div>
        ) : error || subDataError ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
            <p>{error || subDataError}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{selectedCedente ? (drillDownMode === 'sacados' ? 'Sacado' : 'Unidade Administrativa (UA)') : 'Cliente (Cedente)'}</th>
                  <th>Títulos (Qtd)</th>
                  {activeKpiFilter === 'all' && <th>Valor Geral (R$)</th>}
                  {activeKpiFilter === 'liquidado' && <th>Total Liquidado (R$)</th>}
                  {activeKpiFilter === 'aberto' && <th>Total em Aberto (R$)</th>}
                  {(activeKpiFilter === 'vencido' || activeKpiFilter === 'all') && <th>Valor Vencido (R$)</th>}
                </tr>
              </thead>
              <tbody>
                {displayClients.map((client, idx) => (
                  <tr key={idx}>
                    <td 
                      style={{ fontWeight: 600, cursor: selectedCedente ? 'default' : 'pointer', color: selectedCedente ? 'inherit' : '#3b82f6' }}
                      onClick={(e) => !selectedCedente && handleCedenteClick(e, client.cedente)}
                    >
                      {selectedCedente ? (drillDownMode === 'sacados' ? client.sacado : client.ua) : client.cedente}
                    </td>
                    <td style={{ color: 'var(--text-muted, #94a3b8)' }}>
                      {activeKpiFilter === 'all' && client.qtdTitulos}
                      {activeKpiFilter === 'liquidado' && client.qtdLiquidado}
                      {activeKpiFilter === 'aberto' && client.qtdAberto}
                      {activeKpiFilter === 'vencido' && client.qtdVencido}
                    </td>
                    {activeKpiFilter === 'all' && <td style={{ fontWeight: 600 }}>{formatCurrency(client.valorGeral)}</td>}
                    {activeKpiFilter === 'liquidado' && <td style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(client.valorLiquidado)}</td>}
                    {activeKpiFilter === 'aberto' && <td style={{ fontWeight: 600, color: '#f59e0b' }}>{formatCurrency(client.valorAberto)}</td>}
                    {(activeKpiFilter === 'vencido' || activeKpiFilter === 'all') && (
                      <td style={{ color: client.valorVencido > 0 ? '#ef4444' : 'inherit' }}>
                        {formatCurrency(client.valorVencido)}
                      </td>
                    )}
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

      {popover && popover.visible && (
        <div 
          className="popover-modal glass"
          style={{
            position: 'fixed',
            top: popover.y,
            left: popover.x,
            zIndex: 1000,
            padding: '1.25rem',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            minWidth: '280px',
            boxShadow: '0 20px 40px -5px rgba(0, 0, 0, 0.6), 0 10px 15px -6px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255,255,255,0.05)',
            animation: 'fadeIn 0.2s ease-out'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600 }}>Detalhar <span style={{ color: '#fff' }}>{popover.cedente}</span> por:</div>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', padding: '0.75rem 1rem' }}
            onClick={() => handleSelectDrillDown('sacados')}
          >
            <User size={18} /> Sacados
          </button>
          <button 
            className="btn-primary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', padding: '0.75rem 1rem', background: 'var(--accent-color, #10b981)' }}
            onClick={() => handleSelectDrillDown('ua')}
          >
            <Building2 size={18} /> Unidades Administrativas (UA)
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerAnalysis;
