import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Calendar, Download, RefreshCw, Layers, DollarSign,
  FileSpreadsheet, Share2, Copy, Check, ExternalLink,
  Building2, ArrowUpDown
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import './ConfirmationAnalise.css';

interface TituloRow {
  id: string | number;
  operacao: string | number;
  pagto: string | number;
  cliente: string;
  documentoCliente: string;
  sacado: string;
  documentoSacado: string;
  ua: string;
  fundoTipo: 'MULTISETORIAL' | 'SPECIAL';
  produto: string;
  sigla: string;
  numero: string;
  cadastro: string;
  emissao: string;
  vencimento: string;
  vencimentoEfetivo: string;
  vencido: string;
  situacao: string;
  dataSituacao: string;
  manifesto: string;
  dataManifesto: string;
  valorNominal: number;
  descontoAbatimento: number;
  valorLiquido: number;
  valorPago: number;
  saldoDevedor: number;
  oscilacao: number;
  taxa: number;
  desagio: number;
  custo: number;
  receita: number;
  tarifasOperacao: number;
  prazoReal: number;
  prazoCobrado: number;
  gerente: string;
  superintendente: string;
  bancoCobrador: string;
}

export const ConfirmationAnalise: React.FC = () => {
  const todayStr = new Date().toISOString().substring(0, 10);
  const [dataCadastro, setDataCadastro] = useState<string>(todayStr);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dados carregados da API UNLTD
  const [titulos, setTitulos] = useState<TituloRow[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  // Filtros locais de navegação
  const [filtroFundo, setFiltroFundo] = useState<'AMBOS' | 'MULTISETORIAL' | 'SPECIAL'>('AMBOS');
  const [filtroSituacao, setFiltroSituacao] = useState<string>('TODAS');
  const [filtroGerente, setFiltroGerente] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Paginação
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  // Ordenação
  const [sortField, setSortField] = useState<keyof TituloRow>('valorNominal');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modal de Compartilhamento de Link
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareData, setShareData] = useState<{ fullUrl: string; shareUrl: string } | null>(null);
  const [generatingLink, setGeneratingLink] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [shareFundo, setShareFundo] = useState<'AMBOS' | 'MULTISETORIAL' | 'SPECIAL'>('AMBOS');

  // Consulta à API UNLTD
  const handleConsultar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/analise/consultar?data=${dataCadastro}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${res.status}`);
      }

      const json = await res.json();
      setTitulos(json.titulos || []);
      setMetrics({
        totalTitulos: json.totalTitulos,
        totalNominal: json.totalNominal,
        totalLiquido: json.totalLiquido,
        totalReceita: json.totalReceita,
        qtdMs: json.qtdMs,
        valorMs: json.valorMs,
        qtdSpecial: json.qtdSpecial,
        valorSpecial: json.valorSpecial
      });
      setCurrentPage(1);
    } catch (err: any) {
      console.error('Erro ao consultar títulos na API:', err);
      setError(err.message || 'Falha ao buscar dados na API UNLTD');
      setTitulos([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [dataCadastro]);

  useEffect(() => {
    handleConsultar();
  }, [handleConsultar]);

  // Lista única de gerentes e situações para os selects
  const gerentesList = useMemo(() => {
    const s = new Set<string>();
    titulos.forEach(t => { if (t.gerente) s.add(t.gerente); });
    return Array.from(s).sort();
  }, [titulos]);

  const situacoesList = useMemo(() => {
    const s = new Set<string>();
    titulos.forEach(t => { if (t.situacao) s.add(t.situacao); });
    return Array.from(s).sort();
  }, [titulos]);

  // Aplicação dos filtros
  const filteredTitulos = useMemo(() => {
    return titulos.filter(t => {
      if (filtroFundo !== 'AMBOS' && t.fundoTipo !== filtroFundo) return false;
      if (filtroSituacao !== 'TODAS' && t.situacao !== filtroSituacao) return false;
      if (filtroGerente !== 'TODOS' && t.gerente !== filtroGerente) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchCliente = t.cliente?.toLowerCase().includes(s);
        const matchSacado = t.sacado?.toLowerCase().includes(s);
        const matchNumero = t.numero?.toLowerCase().includes(s);
        const matchDocCliente = t.documentoCliente?.includes(s);
        const matchDocSacado = t.documentoSacado?.includes(s);
        if (!matchCliente && !matchSacado && !matchNumero && !matchDocCliente && !matchDocSacado) {
          return false;
        }
      }
      return true;
    });
  }, [titulos, filtroFundo, filtroSituacao, filtroGerente, searchTerm]);

  // Ordenação
  const sortedTitulos = useMemo(() => {
    return [...filteredTitulos].sort((a, b) => {
      const vA = a[sortField];
      const vB = b[sortField];
      if (vA === vB) return 0;
      if (vA === undefined || vA === null) return 1;
      if (vB === undefined || vB === null) return -1;
      if (typeof vA === 'number' && typeof vB === 'number') {
        return sortDir === 'asc' ? vA - vB : vB - vA;
      }
      return sortDir === 'asc'
        ? String(vA).localeCompare(String(vB))
        : String(vB).localeCompare(String(vA));
    });
  }, [filteredTitulos, sortField, sortDir]);

  const totalPages = Math.ceil(sortedTitulos.length / pageSize) || 1;
  const paginatedTitulos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedTitulos.slice(start, start + pageSize);
  }, [sortedTitulos, currentPage]);

  const handleSort = (field: keyof TituloRow) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const formatBrl = (v: number) => {
    return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Exportar CSV
  const handleExportCsv = async (targetFundo: 'AMBOS' | 'MULTISETORIAL' | 'SPECIAL') => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/analise/exportar/csv`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataCadastro,
          fundo: targetFundo,
          titulos
        })
      });

      if (!res.ok) throw new Error('Falha ao exportar CSV');
      const blob = await res.blob();
      const prefix = targetFundo === 'SPECIAL' ? 'Lepta Special FIDC - Titulos' : targetFundo === 'MULTISETORIAL' ? 'Lepta MS FIDC - Titulos' : 'Lepta Geral FIDC - Titulos';
      const filename = `${prefix} - ${dataCadastro} - ${dataCadastro}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (err: any) {
      alert('Erro ao exportar CSV: ' + err.message);
    }
  };

  // Exportar Excel
  const handleExportXlsx = async (targetFundo: 'AMBOS' | 'MULTISETORIAL' | 'SPECIAL') => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/analise/exportar/xlsx`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataCadastro,
          fundo: targetFundo,
          titulos
        })
      });

      if (!res.ok) throw new Error('Falha ao exportar Excel');
      const blob = await res.blob();
      const prefix = targetFundo === 'SPECIAL' ? 'Lepta_Special_FIDC_Titulos' : targetFundo === 'MULTISETORIAL' ? 'Lepta_MS_FIDC_Titulos' : 'Lepta_Geral_FIDC_Titulos';
      const filename = `${prefix}_${dataCadastro}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 1000);
    } catch (err: any) {
      alert('Erro ao exportar XLSX: ' + err.message);
    }
  };

  // Gerar Link de Compartilhamento
  const handleGenerateShareLink = async (targetFundo: 'AMBOS' | 'MULTISETORIAL' | 'SPECIAL') => {
    setGeneratingLink(true);
    setShareFundo(targetFundo);
    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/analise/share-link`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataCadastro,
          fundo: targetFundo,
          titulos
        })
      });

      if (!res.ok) throw new Error('Falha ao gerar link');
      const json = await res.json();
      setShareData(json);
      setIsShareModalOpen(true);
      setCopied(false);
    } catch (err: any) {
      alert('Erro ao gerar link de compartilhamento: ' + err.message);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareData?.fullUrl) return;
    navigator.clipboard.writeText(shareData.fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="ca-container">
      {/* ── HEADER ── */}
      <div className="ca-header">
        <div className="ca-title-group">
          <div>
            <h1 className="ca-title">
              <Search size={26} color="#38bdf8" /> Análise de Confirmação
            </h1>
            <p className="ca-subtitle">
              Consulta direta à API Unlimited (Bitfin) por data de cadastro e exportação canônica para os fundos.
            </p>
          </div>
        </div>

        <div className="ca-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="#94a3b8" />
            <input
              type="date"
              className="ca-date-input"
              value={dataCadastro}
              onChange={e => setDataCadastro(e.target.value)}
              title="Data de Cadastro dos Títulos"
            />
          </div>

          <button
            className="ca-btn-primary"
            onClick={handleConsultar}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'pwc-spinner' : ''} />
            {loading ? 'Consultando API...' : 'Buscar Títulos na API'}
          </button>
        </div>
      </div>

      {/* ── CRITÉRIOS DE NEGÓCIO ATIVOS ── */}
      <div style={{
        background: '#090d16',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        padding: '0.65rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.78rem',
        color: '#94a3b8',
        flexWrap: 'wrap'
      }}>
        <span style={{ color: '#38bdf8', fontWeight: 700 }}>📌 Critérios Estritos Bitfin:</span>
        <span>Sigla: <strong style={{ color: '#f8fafc' }}>DM / DS</strong></span>
        <span>• Produto: <strong style={{ color: '#f8fafc' }}>FAT</strong></span>
        <span>• Situação: <strong style={{ color: '#4ade80' }}>Em Aberto</strong></span>
        <span>• Manifestos Permitidos: <strong style={{ color: '#fbbf24' }}>Sem Atuação, Inacessível, Sacado não Confirma, Promessa Pgto, Ciência, Em Andamento, Concluída</strong></span>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', color: '#fca5a5', padding: '1rem', borderRadius: '10px', fontSize: '0.85rem' }}>
          <strong>⚠️ Atenção:</strong> {error}
        </div>
      )}

      {/* ── KPI CARDS ── */}
      <div className="ca-kpi-grid">
        <div className="ca-kpi-card">
          <div className="ca-kpi-header">
            <span className="ca-kpi-label">Total de Títulos</span>
            <Layers size={16} color="#38bdf8" />
          </div>
          <div className="ca-kpi-val">{metrics?.totalTitulos?.toLocaleString('pt-BR') || 0}</div>
          <div className="ca-kpi-sub">
            MS: <strong>{metrics?.qtdMs || 0}</strong> | Special: <strong>{metrics?.qtdSpecial || 0}</strong>
          </div>
        </div>

        <div className="ca-kpi-card">
          <div className="ca-kpi-header">
            <span className="ca-kpi-label">Valor Nominal Total</span>
            <DollarSign size={16} color="#4ade80" />
          </div>
          <div className="ca-kpi-val" style={{ color: '#f8fafc' }}>
            {formatBrl(metrics?.totalNominal || 0)}
          </div>
          <div className="ca-kpi-sub">
            Valor bruto original
          </div>
        </div>

        <div className="ca-kpi-card">
          <div className="ca-kpi-header">
            <span className="ca-kpi-label">Valor Líquido Total</span>
            <DollarSign size={16} color="#38bdf8" />
          </div>
          <div className="ca-kpi-val" style={{ color: '#38bdf8' }}>
            {formatBrl(metrics?.totalLiquido || 0)}
          </div>
          <div className="ca-kpi-sub">
            Valor de aquisição
          </div>
        </div>

        <div className="ca-kpi-card">
          <div className="ca-kpi-header">
            <span className="ca-kpi-label">Receita Apurada</span>
            <DollarSign size={16} color="#fbbf24" />
          </div>
          <div className="ca-kpi-val" style={{ color: '#fbbf24' }}>
            {formatBrl(metrics?.totalReceita || 0)}
          </div>
          <div className="ca-kpi-sub">
            Deságio líquido apurado
          </div>
        </div>

        <div className="ca-kpi-card">
          <div className="ca-kpi-header">
            <span className="ca-kpi-label">Lepta Multisorial</span>
            <Building2 size={16} color="#38bdf8" />
          </div>
          <div className="ca-kpi-val" style={{ color: '#38bdf8' }}>
            {formatBrl(metrics?.valorMs || 0)}
          </div>
          <div className="ca-kpi-sub">{metrics?.qtdMs || 0} títulos cadastrados</div>
        </div>

        <div className="ca-kpi-card">
          <div className="ca-kpi-header">
            <span className="ca-kpi-label">Lepta Special</span>
            <Building2 size={16} color="#f59e0b" />
          </div>
          <div className="ca-kpi-val" style={{ color: '#fbbf24' }}>
            {formatBrl(metrics?.valorSpecial || 0)}
          </div>
          <div className="ca-kpi-sub">{metrics?.qtdSpecial || 0} títulos cadastrados</div>
        </div>
      </div>

      {/* ── TOOLBAR DE FILTROS E EXPORTAÇÕES ── */}
      <div className="ca-toolbar">
        <div className="ca-filter-group">
          {/* Seletor de Fundo */}
          <select
            className="ca-select"
            value={filtroFundo}
            onChange={e => setFiltroFundo(e.target.value as any)}
          >
            <option value="AMBOS">Todos os Fundos (Ambos)</option>
            <option value="MULTISETORIAL">🔵 Lepta MS FIDC</option>
            <option value="SPECIAL">🟡 Lepta Special FIDC</option>
          </select>

          {/* Busca textual */}
          <input
            type="text"
            className="ca-search-input"
            placeholder="Buscar por Cedente, Sacado, Documento ou Número..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />

          {/* Filtro de Gerente */}
          <select
            className="ca-select"
            value={filtroGerente}
            onChange={e => setFiltroGerente(e.target.value)}
          >
            <option value="TODOS">Todos os Gerentes</option>
            {gerentesList.map((g, idx) => (
              <option key={idx} value={g}>{g}</option>
            ))}
          </select>

          {/* Filtro de Situação */}
          <select
            className="ca-select"
            value={filtroSituacao}
            onChange={e => setFiltroSituacao(e.target.value)}
          >
            <option value="TODAS">Todas as Situações</option>
            {situacoesList.map((s, idx) => (
              <option key={idx} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Botões de Ações e Exportações */}
        <div className="ca-export-group">
          <button
            className="ca-btn-secondary"
            onClick={() => handleExportCsv(filtroFundo)}
            title="Baixar CSV com as 36 colunas oficiais idênticas"
          >
            <Download size={14} /> CSV ({filtroFundo === 'AMBOS' ? 'Geral' : filtroFundo === 'SPECIAL' ? 'Special' : 'MS'})
          </button>

          <button
            className="ca-btn-secondary"
            onClick={() => handleExportXlsx(filtroFundo)}
            title="Baixar Planilha Excel (.xlsx)"
          >
            <FileSpreadsheet size={14} color="#4ade80" /> Excel (.xlsx)
          </button>

          <button
            className="ca-btn-primary"
            onClick={() => handleGenerateShareLink(filtroFundo)}
            disabled={generatingLink || titulos.length === 0}
            title="Gerar link público legível e compartilhável para outros sistemas"
          >
            <Share2 size={14} /> Exportar via Link
          </button>
        </div>
      </div>

      {/* ── TABELA DE TÍTULOS ── */}
      <div className="ca-table-card">
        <div className="ca-table-wrapper">
          <table className="ca-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                <th onClick={() => handleSort('numero')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Número <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort('cliente')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Cedente (Cliente) <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>CNPJ Cedente</th>
                <th onClick={() => handleSort('sacado')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Sacado <ArrowUpDown size={12} />
                  </div>
                </th>
                <th>Fundo (UA)</th>
                <th>Emissão</th>
                <th onClick={() => handleSort('vencimento')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Vencimento <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort('valorNominal')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Valor Nominal <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort('valorLiquido')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Valor Líquido <ArrowUpDown size={12} />
                  </div>
                </th>
                <th onClick={() => handleSort('receita')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    Receita <ArrowUpDown size={12} />
                  </div>
                </th>
                <th style={{ textAlign: 'right' }}>Taxa %</th>
                <th style={{ textAlign: 'center' }}>Situação</th>
                <th>Gerente</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTitulos.map((t, idx) => {
                const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr key={idx}>
                    <td style={{ textAlign: 'center', color: '#64748b' }}>{globalIdx}</td>
                    <td style={{ fontWeight: 700, color: '#38bdf8' }}>{t.numero || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{t.cliente || '-'}</td>
                    <td style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{t.documentoCliente || '-'}</td>
                    <td>{t.sacado || '-'}</td>
                    <td>
                      <span className={`ca-badge ${t.fundoTipo === 'SPECIAL' ? 'ca-badge-special' : 'ca-badge-multi'}`}>
                        {t.ua}
                      </span>
                    </td>
                    <td>{t.emissao || '-'}</td>
                    <td>{t.vencimento || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatBrl(t.valorNominal)}</td>
                    <td style={{ textAlign: 'right', color: '#38bdf8' }}>{formatBrl(t.valorLiquido)}</td>
                    <td style={{ textAlign: 'right', color: '#4ade80', fontWeight: 700 }}>{formatBrl(t.receita)}</td>
                    <td style={{ textAlign: 'right' }}>{t.taxa ? `${t.taxa.toFixed(4)}%` : '-'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        background: t.situacao === 'Liquidado' ? 'rgba(74, 222, 128, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                        color: t.situacao === 'Liquidado' ? '#4ade80' : '#fbbf24',
                        border: `1px solid ${t.situacao === 'Liquidado' ? '#4ade80' : '#fbbf24'}`
                      }}>
                        {t.situacao}
                      </span>
                    </td>
                    <td>{t.gerente || '-'}</td>
                  </tr>
                );
              })}

              {paginatedTitulos.length === 0 && (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
                    {loading ? 'Buscando títulos na API UNLTD...' : 'Nenhum título encontrado para os filtros e data selecionados.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINAÇÃO ── */}
        <div className="ca-pagination">
          <div>
            Mostrando <strong>{paginatedTitulos.length}</strong> de <strong>{sortedTitulos.length}</strong> títulos filtrados (Total API: {titulos.length})
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              className="ca-btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              Anterior
            </button>
            <span>Página <strong>{currentPage}</strong> de <strong>{totalPages}</strong></span>
            <button
              className="ca-btn-secondary"
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL EXPORTAR VIA LINK ── */}
      {isShareModalOpen && shareData && (
        <div className="ca-modal-overlay">
          <div className="ca-modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Share2 size={20} color="#38bdf8" /> Link de Compartilhamento Gerado
              </h3>
              <button
                onClick={() => setIsShareModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.4, margin: 0 }}>
              Este link disponibiliza a visualização HTML interativa dos títulos de cadastro <strong>{dataCadastro}</strong> ({shareFundo === 'AMBOS' ? 'Todos os Fundos' : shareFundo}) e permite o download em Excel / CSV por outros sistemas ou parceiros.
            </p>

            <div className="ca-link-box">
              <span className="ca-link-text">{shareData.fullUrl}</span>
              <button
                className="ca-btn-primary"
                onClick={handleCopyLink}
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <a
                href={shareData.shareUrl}
                target="_blank"
                rel="noreferrer"
                className="ca-btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink size={14} /> Abrir Página no Navegador
              </a>
              <button
                className="ca-btn-primary"
                onClick={() => setIsShareModalOpen(false)}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmationAnalise;
