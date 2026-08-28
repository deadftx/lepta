import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Filter, 
  RotateCcw, 
  Download, 
  Database, 
  FileText, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Eye,
  X,
  Building2
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './SmartFactorQuery.css';

interface CedenteOption {
  nome: string;
  cnpj: string;
  totalTitulos: number;
  totalVolume: number;
}

interface SmartFactorTitle {
  ID: string;
  OPERACAO: string;
  PAGTO: string;
  CLIENTE: string;
  DOCUMENTO: string;
  SACADO: string;
  DOCUMENTO_SACADO: string;
  UA: string;
  PRODUTO: string;
  SIGLA: string;
  NUMERO: string;
  CADASTRO: string;
  EMISSAO: string;
  VENCIMENTO: string;
  VENCIMENTO_EFETIVO: string;
  VENCIDO: string;
  SITUACAO: string;
  DATA_SITUACAO: string;
  VALOR_NOMINAL: number;
  DESCONTO_ABATIMENTO: number;
  VALOR_LIQUIDO: number;
  VALOR_PAGO: number;
  SALDO_DEVEDOR: number;
  TAXA: number;
  DESAGIO: number;
  TARIFAS_OPERACAO: number;
  PRAZO_REAL: number;
  PRAZO_COBRADO: number;
  BANCO_COBRADOR: string;
  SETOR_CEDENTE: string;
  GRUPO_ECONOMICO: string;
  CIDADE_SACADO: string;
  UF_SACADO: string;
}

interface QueryKpis {
  totalTitulos: number;
  totalValorNominal: number;
  totalValorLiquido: number;
  totalValorPago: number;
  totalDesagio: number;
  totalTarifas: number;
  totalValorVencido: number;
  totalQtdVencido: number;
  totalValorLiquidado: number;
  totalQtdLiquidado: number;
  totalValorAberto: number;
  totalQtdAberto: number;
}

export const SmartFactorQuery: React.FC = () => {
  const [cedentesList, setCedentesList] = useState<CedenteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros
  const [cedente, setCedente] = useState('');
  const [showCedenteSuggestions, setShowCedenteSuggestions] = useState(false);
  const [sacado, setSacado] = useState('');
  const [numero, setNumero] = useState('');
  const [operacao, setOperacao] = useState('');
  const [situacao, setSituacao] = useState('');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [dataOpDe, setDataOpDe] = useState('');
  const [dataOpAte, setDataOpAte] = useState('');
  const [vencDe, setVencDe] = useState('');
  const [vencAte, setVencAte] = useState('');
  const [liqDe, setLiqDe] = useState('');
  const [liqAte, setLiqAte] = useState('');

  // Resultados
  const [titles, setTitles] = useState<SmartFactorTitle[]>([]);
  const [kpis, setKpis] = useState<QueryKpis>({
    totalTitulos: 0,
    totalValorNominal: 0,
    totalValorLiquido: 0,
    totalValorPago: 0,
    totalDesagio: 0,
    totalTarifas: 0,
    totalValorVencido: 0,
    totalQtdVencido: 0,
    totalValorLiquidado: 0,
    totalQtdLiquidado: 0,
    totalValorAberto: 0,
    totalQtdAberto: 0
  });

  const [selectedTitle, setSelectedTitle] = useState<SmartFactorTitle | null>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Carregar lista de cedentes para o autocomplete
  useEffect(() => {
    async function loadCedentes() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/smartfactor/cedentes`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          setCedentesList(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Erro ao carregar cedentes do SmartFactor:', err);
      }
    }
    loadCedentes();
  }, []);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (autocompleteRef.current && !autocompleteRef.current.contains(e.target as Node)) {
        setShowCedenteSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Normalizador de texto para busca sem acentos
  const normalize = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Filtrar sugestões de cedentes digitadas em tempo real
  const queryNorm = normalize(cedente);
  const queryDigits = cedente.replace(/\D/g, '');

  const filteredCedentes = queryNorm.length >= 1
    ? cedentesList.filter(c => {
        const nomeNorm = normalize(c.nome);
        const cnpjClean = (c.cnpj || '').replace(/\D/g, '');
        const matchName = nomeNorm.includes(queryNorm);
        const matchCnpj = queryDigits.length >= 2 && cnpjClean.includes(queryDigits);
        return matchName || matchCnpj;
      }).slice(0, 15)
    : cedentesList.slice(0, 15);

  const handleSearch = async () => {
    try {
      setLoading(true);
      setShowCedenteSuggestions(false);
      const params = new URLSearchParams();
      if (cedente) params.append('cedente', cedente);
      if (sacado) params.append('sacado', sacado);
      if (numero) params.append('numero', numero);
      if (operacao) params.append('operacao', operacao);
      if (situacao) params.append('situacao', situacao);
      if (valorMin) params.append('valorMin', valorMin);
      if (valorMax) params.append('valorMax', valorMax);
      if (dataOpDe) params.append('dataOpDe', dataOpDe);
      if (dataOpAte) params.append('dataOpAte', dataOpAte);
      if (vencDe) params.append('vencDe', vencDe);
      if (vencAte) params.append('vencAte', vencAte);
      if (liqDe) params.append('liqDe', liqDe);
      if (liqAte) params.append('liqAte', liqAte);
      params.append('limit', '500');

      const res = await fetch(`${API_BASE_URL}/api/smartfactor/query?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setTitles(data.titles || []);
        setKpis(data.kpis || {});
        setHasSearched(true);
      }
    } catch (err) {
      console.error('Erro ao consultar títulos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setCedente('');
    setSacado('');
    setNumero('');
    setOperacao('');
    setSituacao('');
    setValorMin('');
    setValorMax('');
    setDataOpDe('');
    setDataOpAte('');
    setVencDe('');
    setVencAte('');
    setLiqDe('');
    setLiqAte('');
    setTitles([]);
    setHasSearched(false);
  };

  const exportToExcel = async () => {
    if (titles.length === 0) return;
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('SmartFactor_Titulos');

      worksheet.columns = [
        { header: 'ID', key: 'ID', width: 10 },
        { header: 'Operação', key: 'OPERACAO', width: 12 },
        { header: 'Cedente', key: 'CLIENTE', width: 35 },
        { header: 'CNPJ Cedente', key: 'DOCUMENTO', width: 20 },
        { header: 'Sacado', key: 'SACADO', width: 35 },
        { header: 'CNPJ Sacado', key: 'DOCUMENTO_SACADO', width: 20 },
        { header: 'Nº Documento', key: 'NUMERO', width: 15 },
        { header: 'Emissão (Op)', key: 'EMISSAO', width: 14 },
        { header: 'Vencimento', key: 'VENCIMENTO', width: 14 },
        { header: 'Data Liquidação', key: 'DATA_SITUACAO', width: 16 },
        { header: 'Status', key: 'SITUACAO', width: 15 },
        { header: 'Valor Nominal', key: 'VALOR_NOMINAL', width: 16 },
        { header: 'Valor Líquido', key: 'VALOR_LIQUIDO', width: 16 },
        { header: 'Valor Pago', key: 'VALOR_PAGO', width: 16 },
        { header: 'Taxa (%)', key: 'TAXA', width: 10 },
        { header: 'Deságio', key: 'DESAGIO', width: 14 },
        { header: 'Tarifas', key: 'TARIFAS_OPERACAO', width: 14 },
        { header: 'Cidade Sacado', key: 'CIDADE_SACADO', width: 20 },
        { header: 'UF Sacado', key: 'UF_SACADO', width: 8 }
      ];

      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };

      titles.forEach(t => worksheet.addRow(t));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SmartFactor_Consulta_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
    } catch (err) {
      console.error('Erro ao exportar excel:', err);
    }
  };

  const formatBRL = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="smartfactor-page">
      {/* Header */}
      <div className="smartfactor-header">
        <div className="smartfactor-header-left">
          <div className="smartfactor-header-icon">
            <Database size={28} />
          </div>
          <div className="smartfactor-header-title">
            <h2>Consulta SmartFactor</h2>
            <p>Histórico Legado Consolidado de Títulos, Sacados e Operações (2021–2025)</p>
            <div className="smartfactor-badge">
              <Database size={12} /> Tabela Ativa: <code>BASE_SMARTFACTOR</code>
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Filtros */}
      <div className="smartfactor-filters-panel">
        <div className="filters-grid">
          {/* Cedente com Dropdown Interativo de Previsões */}
          <div className="filter-group" ref={autocompleteRef}>
            <label>Cedente (Busca com Previsão)</label>
            <div className="filter-autocomplete-wrapper">
              <input
                type="text"
                className="filter-input"
                placeholder="Digite nome ou CNPJ do cedente..."
                value={cedente}
                onChange={e => {
                  setCedente(e.target.value);
                  setShowCedenteSuggestions(true);
                }}
                onFocus={() => setShowCedenteSuggestions(true)}
                autoComplete="off"
              />
              {showCedenteSuggestions && (
                <div className="sf-suggestions-dropdown" role="listbox">
                  {filteredCedentes.length > 0 ? (
                    filteredCedentes.map(c => (
                      <button
                        key={c.cnpj || c.nome}
                        type="button"
                        className="sf-suggestion-item"
                        onClick={() => {
                          setCedente(c.nome);
                          setShowCedenteSuggestions(false);
                        }}
                      >
                        <div className="sf-suggestion-icon">
                          <Building2 size={16} />
                        </div>
                        <div className="sf-suggestion-content">
                          <strong>{c.nome}</strong>
                          <small>{c.cnpj} • {c.totalTitulos} títulos ({formatBRL(c.totalVolume)})</small>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontSize: '0.78rem', textAlign: 'center' }}>
                      Nenhum cedente correspondente encontrado.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Sacado */}
          <div className="filter-group">
            <label>Sacado</label>
            <input
              type="text"
              className="filter-input"
              placeholder="Nome ou CNPJ do Sacado..."
              value={sacado}
              onChange={e => setSacado(e.target.value)}
            />
          </div>

          {/* Nº Documento / Título */}
          <div className="filter-group">
            <label>Nº Documento / Título</label>
            <input
              type="text"
              className="filter-input"
              placeholder="Ex: 12110/001 ou Nosso Número"
              value={numero}
              onChange={e => setNumero(e.target.value)}
            />
          </div>

          {/* Nº Operação */}
          <div className="filter-group">
            <label>Nº Operação</label>
            <input
              type="text"
              className="filter-input"
              placeholder="Ex: 13732"
              value={operacao}
              onChange={e => setOperacao(e.target.value)}
            />
          </div>

          {/* Situação */}
          <div className="filter-group">
            <label>Situação / Status</label>
            <select
              className="filter-input"
              value={situacao}
              onChange={e => setSituacao(e.target.value)}
            >
              <option value="">Todas as Situações</option>
              <option value="quitado">Quitado / Liquidado</option>
              <option value="aberto">Em Aberto</option>
              <option value="baixado">Baixado</option>
              <option value="recomprado">Recomprado</option>
            </select>
          </div>

          {/* Faixa de Valor */}
          <div className="filter-group">
            <label>Valor Nominal (Face)</label>
            <div className="filter-input-row">
              <input
                type="number"
                className="filter-input"
                placeholder="Mín R$"
                value={valorMin}
                onChange={e => setValorMin(e.target.value)}
              />
              <span>até</span>
              <input
                type="number"
                className="filter-input"
                placeholder="Máx R$"
                value={valorMax}
                onChange={e => setValorMax(e.target.value)}
              />
            </div>
          </div>

          {/* Data de Operação (Emissão) */}
          <div className="filter-group">
            <label>Data Operação (De ~ Até)</label>
            <div className="filter-input-row">
              <input
                type="date"
                className="filter-input"
                value={dataOpDe}
                onChange={e => setDataOpDe(e.target.value)}
              />
              <span>até</span>
              <input
                type="date"
                className="filter-input"
                value={dataOpAte}
                onChange={e => setDataOpAte(e.target.value)}
              />
            </div>
          </div>

          {/* Data de Vencimento */}
          <div className="filter-group">
            <label>Data Vencimento (De ~ Até)</label>
            <div className="filter-input-row">
              <input
                type="date"
                className="filter-input"
                value={vencDe}
                onChange={e => setVencDe(e.target.value)}
              />
              <span>até</span>
              <input
                type="date"
                className="filter-input"
                value={vencAte}
                onChange={e => setVencAte(e.target.value)}
              />
            </div>
          </div>

          {/* Data de Liquidação */}
          <div className="filter-group">
            <label>Data Liquidação (De ~ Até)</label>
            <div className="filter-input-row">
              <input
                type="date"
                className="filter-input"
                value={liqDe}
                onChange={e => setLiqDe(e.target.value)}
              />
              <span>até</span>
              <input
                type="date"
                className="filter-input"
                value={liqAte}
                onChange={e => setLiqAte(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="filters-actions-bar">
          <button className="sf-btn-secondary" onClick={handleClearFilters}>
            <RotateCcw size={15} /> Limpar Filtros
          </button>
          {titles.length > 0 && (
            <button className="sf-btn-secondary" onClick={exportToExcel}>
              <Download size={15} /> Exportar Excel
            </button>
          )}
          <button className="sf-btn-primary" onClick={handleSearch} disabled={loading}>
            <Search size={15} /> {loading ? 'Pesquisando...' : 'Pesquisar Títulos'}
          </button>
        </div>
      </div>

      {/* Cards de Resumo / KPIs */}
      {hasSearched && (
        <div className="smartfactor-kpi-grid">
          <div className="smartfactor-kpi-card">
            <div className="smartfactor-kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
              <FileText size={22} />
            </div>
            <div className="smartfactor-kpi-info">
              <span>Títulos Encontrados</span>
              <strong>{kpis.totalTitulos.toLocaleString('pt-BR')}</strong>
              <small>Registros na pesquisa</small>
            </div>
          </div>

          <div className="smartfactor-kpi-card">
            <div className="smartfactor-kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
              <DollarSign size={22} />
            </div>
            <div className="smartfactor-kpi-info">
              <span>Volume Nominal (Face)</span>
              <strong>{formatBRL(kpis.totalValorNominal)}</strong>
              <small>Líquido: {formatBRL(kpis.totalValorLiquido)}</small>
            </div>
          </div>

          <div className="smartfactor-kpi-card">
            <div className="smartfactor-kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <CheckCircle2 size={22} />
            </div>
            <div className="smartfactor-kpi-info">
              <span>Liquidado / Quitado</span>
              <strong>{formatBRL(kpis.totalValorLiquidado)}</strong>
              <small>{kpis.totalQtdLiquidado.toLocaleString('pt-BR')} títulos pagos</small>
            </div>
          </div>

          <div className="smartfactor-kpi-card">
            <div className="smartfactor-kpi-icon" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8' }}>
              <Clock size={22} />
            </div>
            <div className="smartfactor-kpi-info">
              <span>Em Aberto (Adimplente)</span>
              <strong>{formatBRL(Math.max(0, kpis.totalValorAberto - kpis.totalValorVencido))}</strong>
              <small>{Math.max(0, kpis.totalQtdAberto - kpis.totalQtdVencido).toLocaleString('pt-BR')} títulos no prazo</small>
            </div>
          </div>

          <div className="smartfactor-kpi-card" style={{ borderColor: kpis.totalValorVencido > 0 ? 'rgba(239, 68, 68, 0.3)' : undefined }}>
            <div className="smartfactor-kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
              <AlertTriangle size={22} />
            </div>
            <div className="smartfactor-kpi-info">
              <span>Vencido Real (Aberto + Atrasado)</span>
              <strong style={{ color: kpis.totalValorVencido > 0 ? '#ef4444' : '#ffffff' }}>
                {formatBRL(kpis.totalValorVencido)}
              </strong>
              <small>{kpis.totalQtdVencido.toLocaleString('pt-BR')} títulos pendentes</small>
            </div>
          </div>
        </div>
      )}

      {/* Tabela de Títulos */}
      <div className="smartfactor-table-container">
        {!hasSearched ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
            <Filter size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
            <h3 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>Pronto para Consultar</h3>
            <p style={{ maxWidth: 500, margin: '0 auto', fontSize: '0.9rem' }}>
              Utilize os filtros acima para pesquisar por Cedente, Sacado, Datas ou Valores, e clique em <strong>"Pesquisar Títulos"</strong>.
            </p>
          </div>
        ) : titles.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#94a3b8' }}>
            <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
            <h3 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>Nenhum título encontrado</h3>
            <p>Tente ajustar os critérios de pesquisa para encontrar os registros.</p>
          </div>
        ) : (
          <table className="smartfactor-table">
            <thead>
              <tr>
                <th>Ações</th>
                <th>Cedente</th>
                <th>Sacado</th>
                <th>Nº Documento</th>
                <th>Op.</th>
                <th>Emissão</th>
                <th>Vencimento</th>
                <th>Liquidação</th>
                <th>Valor Face</th>
                <th>Valor Pago</th>
                <th>Status</th>
                <th>Taxa</th>
              </tr>
            </thead>
            <tbody>
              {titles.map(t => {
                const isQuit = t.SITUACAO.toLowerCase().includes('quit') || t.SITUACAO.toLowerCase().includes('liq');
                const badgeClass = isQuit ? 'quitado' : (t.VENCIDO === 'Sim' ? 'vencido' : 'aberto');

                return (
                  <tr key={t.ID}>
                    <td>
                      <button
                        className="sf-btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => setSelectedTitle(t)}
                        title="Ver Detalhes Completos"
                      >
                        <Eye size={14} /> Detalhes
                      </button>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#ffffff' }}>{t.CLIENTE}</div>
                      <small style={{ color: '#64748b' }}>{t.DOCUMENTO}</small>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: '#e2e8f0' }}>{t.SACADO}</div>
                      <small style={{ color: '#64748b' }}>{t.DOCUMENTO_SACADO} {t.UF_SACADO ? `(${t.UF_SACADO})` : ''}</small>
                    </td>
                    <td style={{ fontFamily: 'monospace' }}>{t.NUMERO}</td>
                    <td style={{ fontFamily: 'monospace' }}>{t.OPERACAO}</td>
                    <td>{t.EMISSAO}</td>
                    <td style={{ fontWeight: 600, color: t.VENCIDO === 'Sim' && !isQuit ? '#ef4444' : 'inherit' }}>
                      {t.VENCIMENTO}
                    </td>
                    <td>{t.DATA_SITUACAO || '—'}</td>
                    <td style={{ fontWeight: 600, color: '#ffffff' }}>{formatBRL(t.VALOR_NOMINAL)}</td>
                    <td style={{ color: isQuit ? '#10b981' : '#94a3b8' }}>{formatBRL(t.VALOR_PAGO)}</td>
                    <td>
                      <span className={`sf-status-badge ${badgeClass}`}>
                        {t.SITUACAO}
                      </span>
                    </td>
                    <td>{t.TAXA > 0 ? `${t.TAXA.toFixed(2)}%` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de Detalhes do Título */}
      {selectedTitle && (
        <div className="title-modal-overlay" onClick={() => setSelectedTitle(null)}>
          <div className="title-modal" onClick={e => e.stopPropagation()}>
            <div className="title-modal-header">
              <div>
                <h3 style={{ margin: 0, color: '#ffffff' }}>Detalhes do Título #{selectedTitle.ID}</h3>
                <small style={{ color: '#94a3b8' }}>Operação #{selectedTitle.OPERACAO} • {selectedTitle.UA}</small>
              </div>
              <button className="sf-btn-secondary" style={{ padding: '6px' }} onClick={() => setSelectedTitle(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="title-modal-body">
              <div className="detail-item">
                <span>Cedente</span>
                <strong>{selectedTitle.CLIENTE}</strong>
                <small style={{ display: 'block', color: '#64748b' }}>CNPJ: {selectedTitle.DOCUMENTO}</small>
              </div>

              <div className="detail-item">
                <span>Sacado</span>
                <strong>{selectedTitle.SACADO}</strong>
                <small style={{ display: 'block', color: '#64748b' }}>CNPJ: {selectedTitle.DOCUMENTO_SACADO} | {selectedTitle.CIDADE_SACADO} - {selectedTitle.UF_SACADO}</small>
              </div>

              <div className="detail-item">
                <span>Nº Documento / Banco</span>
                <strong>{selectedTitle.NUMERO}</strong>
                <small style={{ display: 'block', color: '#64748b' }}>Nosso Nº: {selectedTitle.BANCO_COBRADOR || '—'}</small>
              </div>

              <div className="detail-item">
                <span>Espécie / Produto</span>
                <strong>{selectedTitle.SIGLA} ({selectedTitle.PRODUTO})</strong>
              </div>

              <div className="detail-item">
                <span>Data da Operação (Emissão)</span>
                <strong>{selectedTitle.EMISSAO}</strong>
              </div>

              <div className="detail-item">
                <span>Vencimento / Efetivo</span>
                <strong>{selectedTitle.VENCIMENTO} (Efetivo: {selectedTitle.VENCIMENTO_EFETIVO})</strong>
              </div>

              <div className="detail-item">
                <span>Status / Data Liquidação</span>
                <strong style={{ color: selectedTitle.SITUACAO.toLowerCase().includes('quit') ? '#10b981' : '#f59e0b' }}>
                  {selectedTitle.SITUACAO}
                </strong>
                <small style={{ display: 'block', color: '#64748b' }}>Liquidado em: {selectedTitle.DATA_SITUACAO || 'Em Aberto'}</small>
              </div>

              <div className="detail-item">
                <span>Valor Nominal (Face)</span>
                <strong style={{ fontSize: '1.1rem', color: '#ffffff' }}>{formatBRL(selectedTitle.VALOR_NOMINAL)}</strong>
              </div>

              <div className="detail-item">
                <span>Valor Líquido Operado</span>
                <strong>{formatBRL(selectedTitle.VALOR_LIQUIDO)}</strong>
              </div>

              <div className="detail-item">
                <span>Valor Pago / Recebido</span>
                <strong style={{ color: '#10b981' }}>{formatBRL(selectedTitle.VALOR_PAGO)}</strong>
              </div>

              <div className="detail-item">
                <span>Taxa / Fator da Op</span>
                <strong>{selectedTitle.TAXA}%</strong>
              </div>

              <div className="detail-item">
                <span>Deságio / Tarifas</span>
                <strong>Deságio: {formatBRL(selectedTitle.DESAGIO)} | Tarifas: {formatBRL(selectedTitle.TARIFAS_OPERACAO)}</strong>
              </div>

              <div className="detail-item">
                <span>Prazos</span>
                <strong>Prazo Real: {selectedTitle.PRAZO_REAL} dias | Cobrado: {selectedTitle.PRAZO_COBRADO} dias</strong>
              </div>

              <div className="detail-item">
                <span>Setor / Grupo Econômico</span>
                <strong>{selectedTitle.SETOR_CEDENTE || '—'} {selectedTitle.GRUPO_ECONOMICO ? `(${selectedTitle.GRUPO_ECONOMICO})` : ''}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
