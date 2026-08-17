import { useState, useEffect } from 'react';
import { Users, Search, BrainCircuit, Database, TrendingUp, AlertTriangle, ArrowLeft, Building2, User, CheckCircle, Clock, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import './CustomerAnalysis.css';
import './Operations.css';

interface ClientAnalysis {
  cedente: string;
  sacado?: string; // used for drill-down view
  ua?: string; // used for UA/UN drill-down view
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
  hasNova?: boolean;
  valorNpl?: number;
  isUN?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const CustomerAnalysis = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clients, setClients] = useState<ClientAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState<'api' | 'db'>('api');

  const [selectedCedente, setSelectedCedente] = useState<string | null>(null);
  const [drillDownMode, setDrillDownMode] = useState<'sacados' | 'ua' | 'un' | null>(null);
  const [kpiFilters, setKpiFilters] = useState<string[]>(['volume_geral']);
  const [subData, setSubData] = useState<ClientAnalysis[]>([]);
  const [loadingSubData, setLoadingSubData] = useState(false);
  const [subDataError, setSubDataError] = useState('');
  
  // Sort state
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else {
        setSortConfig(null);
        return;
      }
    }
    setSortConfig({ key, direction });
  };
  
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
        
        const queryParams = new URLSearchParams();
        queryParams.append('t', Date.now().toString());
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);

        const response = await fetch(`/api/analise-clientes?${queryParams.toString()}`, { 
          cache: 'no-store',
          headers: {
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
          }
        });
        if (!response.ok) throw new Error('Erro ao buscar dados da API');
        
        const source = response.headers.get('x-data-source') === 'db' ? 'db' : 'api';
        setDataSource(source);
        
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
  }, [startDate, endDate]);

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

  const fetchSubData = async (cedente: string, mode: 'sacados' | 'ua' | 'un') => {
    setLoadingSubData(true);
    setSubDataError('');
    try {
      let endpoint = '';
      if (mode === 'sacados') endpoint = '/api/analise-sacados/';
      else if (mode === 'ua') endpoint = '/api/analise-ua/';
      else if (mode === 'un') endpoint = '/api/analise-un/';
      
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('startDate', startDate);
      if (endDate) queryParams.append('endDate', endDate);
      
      const url = `${endpoint}${encodeURIComponent(cedente)}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao buscar dados da API');
      
      const source = response.headers.get('x-data-source') === 'db' ? 'db' : 'api';
      setDataSource(source);
      
      const data = await response.json();
      
      const enriched = data.map((item: any) => {
        const percVencido = item.valorGeral > 0 ? (item.valorVencido / item.valorGeral) : 0;
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

  useEffect(() => {
    if (selectedCedente && drillDownMode) {
      fetchSubData(selectedCedente, drillDownMode);
    }
  }, [startDate, endDate]);

  const handleSelectDrillDown = async (mode: 'sacados' | 'ua' | 'un') => {
    if (!popover) return;
    const cedente = popover.cedente;
    setPopover(null);
    setSearchTerm('');
    setSelectedCedente(cedente);
    setDrillDownMode(mode);
    fetchSubData(cedente, mode);
  };

  const handleBack = () => {
    setSelectedCedente(null);
    setDrillDownMode(null);
    setSubData([]);
  };

  // Logic for combinable filters
  const toggleKpiFilter = (filter: string) => {
    setKpiFilters(prev => {
      if (filter === 'volume_geral') return ['volume_geral'];
      let newFilters = [...prev].filter(f => f !== 'volume_geral');
      if (newFilters.includes(filter)) {
        newFilters = newFilters.filter(f => f !== filter);
        if (newFilters.length === 0) return ['volume_geral'];
      } else {
        newFilters.push(filter);
      }
      return newFilters;
    });
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
    // Filtragem combinada para a visão geral
    const showListWithoutSearch = kpiFilters.includes('cedentes');
    
    let baseFiltered = clients;
    if (searchTerm.trim() !== '') {
      baseFiltered = clients.filter(c => c.cedente.toLowerCase().includes(searchTerm.toLowerCase()));
    } else if (!showListWithoutSearch) {
      baseFiltered = []; // Padrão: esconde se não tiver busca e só volume_geral ativo
    }

    // Filtro estrito do NPL
    if (kpiFilters.includes('volume_npl')) {
      baseFiltered = baseFiltered.filter(c => (c.valorNpl || 0) > 0);
    }

    displayClients = baseFiltered; 
    kpiClients = clients; 
  }

  // Ordenação padrão
  displayClients.sort((a, b) => {
    if (sortConfig) {
      const { key, direction } = sortConfig;
      const modifier = direction === 'asc' ? 1 : -1;
      
      if (key === 'cliente') {
        const nameA = a.cedente || a.sacado || a.ua || '';
        const nameB = b.cedente || b.sacado || b.ua || '';
        return nameA.localeCompare(nameB) * modifier;
      }
      
      let valA = 0; let valB = 0;
      if (key === 'qtdTitulos') { valA = a.qtdTitulos || 0; valB = b.qtdTitulos || 0; }
      else if (key === 'valorGeral') { valA = (a.valorGeral || 0) + (a.valorNpl || 0); valB = (b.valorGeral || 0) + (b.valorNpl || 0); }
      else if (key === 'valorLiquidado') { valA = a.valorLiquidado || 0; valB = b.valorLiquidado || 0; }
      else if (key === 'valorAberto') { valA = a.valorAberto || 0; valB = b.valorAberto || 0; }
      else if (key === 'valorVencido') { valA = a.valorVencido || 0; valB = b.valorVencido || 0; }
      
      return (valA - valB) * modifier;
    }

    const bTotal = (b.valorGeral || 0) + (b.valorNpl || 0);
    const aTotal = (a.valorGeral || 0) + (a.valorNpl || 0);
    return bTotal - aTotal;
  });
  
  const totalClients = kpiClients.length;
  // Volume Geral only uses BASE_NOVA
  const totalVolume = kpiClients.reduce((acc, curr) => acc + (curr.valorGeral || 0), 0);
  // Separate Volume for NPL
  const totalVolumeNpl = kpiClients.reduce((acc, curr) => acc + (curr.valorNpl || 0), 0);
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
        <div className={`kpi-card ${kpiFilters.includes('cedentes') ? 'active' : ''}`} onClick={() => toggleKpiFilter('cedentes')}>
          <div className="kpi-icon">
            <Users size={24} />
          </div>
          <div className="kpi-info">
            <h4>{selectedCedente ? (drillDownMode === 'sacados' ? 'Sacados' : 'Unid. Administrativas') : 'Cedentes / Clientes'}</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : totalClients}</div>
            <div className="kpi-sub">{selectedCedente ? 'Do cedente selecionado' : 'Cadastrados na Base'}</div>
          </div>
        </div>

        <div className={`kpi-card ${kpiFilters.includes('volume_geral') ? 'active' : ''}`} onClick={() => toggleKpiFilter('volume_geral')}>
          <div className="kpi-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.12)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <h4>Volume Geral</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : formatCurrency(totalVolume)}</div>
            <div className="kpi-sub">Total {selectedCedente ? 'do detalhamento' : 'da Base'}</div>
          </div>
        </div>

        <div className={`kpi-card ${kpiFilters.includes('volume_npl') ? 'active' : ''}`} onClick={() => toggleKpiFilter('volume_npl')}>
          <div className="kpi-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)' }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <h4>Volume NPL</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : formatCurrency(totalVolumeNpl)}</div>
            <div className="kpi-sub">Total {selectedCedente ? 'do detalhamento' : 'da Base NPL'}</div>
          </div>
        </div>

        <div className={`kpi-card ${kpiFilters.includes('total_liquidado') ? 'active' : ''}`} onClick={() => toggleKpiFilter('total_liquidado')}>
          <div className="kpi-icon" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.12)' }}>
            <CheckCircle size={24} />
          </div>
          <div className="kpi-info">
            <h4>Total Liquidado</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : formatCurrency(totalLiquidado)}</div>
            <div className="kpi-sub" style={{ color: '#10b981' }}>Titulos Liquidados</div>
          </div>
        </div>

        <div className={`kpi-card ${kpiFilters.includes('total_aberto') ? 'active' : ''}`} onClick={() => toggleKpiFilter('total_aberto')}>
          <div className="kpi-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.12)' }}>
            <Clock size={24} />
          </div>
          <div className="kpi-info">
            <h4>Total em Aberto</h4>
            <div className="kpi-value">{loading || loadingSubData ? '...' : formatCurrency(totalAberto)}</div>
            <div className="kpi-sub" style={{ color: '#f59e0b' }}>A vencer (Títulos Abertos)</div>
          </div>
        </div>

        <div className={`kpi-card ${kpiFilters.includes('total_vencido') ? 'active' : ''}`} onClick={() => toggleKpiFilter('total_vencido')}>
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
            {dataSource === 'api' ? (
              <div className="data-source-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(16, 185, 129, 0.2)', animation: 'pulse-green 2s infinite' }}>
                <Database size={14} /> VIA API
              </div>
            ) : (
              <div className="data-source-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.35rem 0.75rem', borderRadius: '16px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600, border: '1px solid rgba(245, 158, 11, 0.2)', animation: 'pulse-yellow 2s infinite' }}>
                <Database size={14} /> VIA DB
              </div>
            )}
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
        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="search-input-wrapper" style={{ flex: '1 1 40%' }}>
            <Search size={18} />
            <input
              type="text"
              className="input-field"
              placeholder={selectedCedente ? `Buscar ${drillDownMode === 'sacados' ? 'sacado' : drillDownMode === 'un' ? 'UN' : 'UA'}...` : "Buscar instantânea por nome do cliente ou cedente..."}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 auto', alignItems: 'center' }}>
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <span style={{ position: 'absolute', left: '1rem', color: '#94a3b8', fontSize: '0.85rem' }}>De:</span>
              <input 
                type="date"
                className="input-field"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ width: '100%', paddingLeft: '3rem' }}
              />
            </div>
            <div className="search-input-wrapper" style={{ flex: 1 }}>
              <span style={{ position: 'absolute', left: '1rem', color: '#94a3b8', fontSize: '0.85rem' }}>Até:</span>
              <input 
                type="date"
                className="input-field"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{ width: '100%', paddingLeft: '3rem' }}
              />
            </div>
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
                  <th onClick={() => requestSort('cliente')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {selectedCedente ? (drillDownMode === 'sacados' ? 'Sacado' : drillDownMode === 'un' ? 'Unidade de Negócio (UN)' : 'Unidade Administrativa (UA)') : 'Cliente (Cedente)'}
                      {sortConfig?.key === 'cliente' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  <th onClick={() => requestSort('qtdTitulos')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      Títulos (Qtd)
                      {sortConfig?.key === 'qtdTitulos' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                    </div>
                  </th>
                  {(!kpiFilters.includes('total_liquidado') && !kpiFilters.includes('total_aberto') && !kpiFilters.includes('total_vencido')) && (
                    <th onClick={() => requestSort('valorGeral')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Valor Geral (R$)
                        {sortConfig?.key === 'valorGeral' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
                  {kpiFilters.includes('total_liquidado') && (
                    <th onClick={() => requestSort('valorLiquidado')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Total Liquidado (R$)
                        {sortConfig?.key === 'valorLiquidado' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
                  {kpiFilters.includes('total_aberto') && (
                    <th onClick={() => requestSort('valorAberto')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Total em Aberto (R$)
                        {sortConfig?.key === 'valorAberto' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
                  {kpiFilters.includes('total_vencido') && (
                    <th onClick={() => requestSort('valorVencido')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Valor Vencido (R$)
                        {sortConfig?.key === 'valorVencido' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
                  {(!kpiFilters.includes('total_liquidado') && !kpiFilters.includes('total_aberto') && !kpiFilters.includes('total_vencido')) && (
                    <th onClick={() => requestSort('valorVencido')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        Valor Vencido (R$)
                        {sortConfig?.key === 'valorVencido' ? (sortConfig.direction === 'asc' ? <ArrowUp size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} /> : <ArrowDown size={14} style={{ marginLeft: '0.25rem', color: '#3b82f6' }} />) : <ArrowUpDown size={14} style={{ marginLeft: '0.25rem', opacity: 0.3 }} />}
                      </div>
                    </th>
                  )}
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
                      {client.hasNova === false ? '-' : client.qtdTitulos}
                    </td>
                    
                    {/* Default View */}
                    {(!kpiFilters.includes('total_liquidado') && !kpiFilters.includes('total_aberto') && !kpiFilters.includes('total_vencido')) && (
                      <td style={{ fontWeight: 600 }}>{formatCurrency((client.valorGeral || 0) + (client.valorNpl || 0))}</td>
                    )}
                    
                    {/* Liquidado View */}
                    {kpiFilters.includes('total_liquidado') && (
                      <td style={{ fontWeight: 600, color: '#10b981' }}>{formatCurrency(client.valorLiquidado || 0)}</td>
                    )}
                    
                    {/* Aberto View */}
                    {kpiFilters.includes('total_aberto') && (
                      <td style={{ fontWeight: 600, color: '#f59e0b' }}>{formatCurrency(client.valorAberto || 0)}</td>
                    )}

                    {/* Vencido View (Isolated) */}
                    {kpiFilters.includes('total_vencido') && (
                      <td style={{ color: (client.valorVencido || 0) > 0 ? '#ef4444' : 'inherit' }}>
                        {client.hasNova === false ? '-' : formatCurrency(client.valorVencido || 0)}
                      </td>
                    )}
                    
                    {/* Default Vencido Column */}
                    {(!kpiFilters.includes('total_liquidado') && !kpiFilters.includes('total_aberto') && !kpiFilters.includes('total_vencido')) && (
                      <td style={{ color: (client.valorVencido || 0) > 0 ? '#ef4444' : 'inherit' }}>
                        {client.hasNova === false ? '-' : formatCurrency(client.valorVencido || 0)}
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

      {popover && popover.visible && (() => {
        const currentClient = clients.find(c => c.cedente === popover.cedente);
        const hasNova = currentClient?.hasNova !== false;
        const hasNpl = (currentClient?.valorNpl || 0) > 0;
        
        return (
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
            
            {hasNova && (
              <>
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
              </>
            )}

            {hasNpl && (
              <button 
                className="btn-primary" 
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'flex-start', padding: '0.75rem 1rem', background: '#f59e0b', color: '#fff' }}
                onClick={() => handleSelectDrillDown('un')}
              >
                <TrendingUp size={18} /> Unidade de Negócio (UN)
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
};

export default CustomerAnalysis;
