import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Building2,
  Phone,
  Mail,
  X,
  UserCheck,
  FileSpreadsheet,
  FileCode,
  AlertCircle,
  Copy,
  Check,
  Download,
  FileText
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import './OperationsAnalysis.css';

interface CedenteInfo {
  nome: string;
  documento: string;
  telefones?: string[];
  emails?: string[];
}

interface OperacaoSummary {
  id: string;
  numero: string;
  dataCadastro: string;
  cedente: CedenteInfo;
  unidadeAdministrativa: string;
  gerente: string;
  valorTotal: number;
  titulosCount: number;
  status: string;
}

interface SacadoInconsistente {
  key: string;
  documento: string;
  nome: string;
  qtdTitulos: number;
  valorTotal: number;
  cep: string;
  rawCep: string;
  isValido: boolean;
  errorReason: string;
  sugestaoCep?: string | null;
  endereco: string;
  telefones: string[];
  emails: string[];
}

interface TituloItem {
  id: string | number;
  numero: string;
  sacadoNome: string;
  sacadoDoc: string;
  valorNominal: number;
  vencimento: string;
  situacao: string;
}

interface OperacaoDetail {
  operacaoId: string;
  dataCadastro: string;
  status: string;
  unidadeAdministrativa: string;
  gerente: string;
  valorTotalOperacao: number;
  totalTitulos: number;
  cedente: CedenteInfo;
  alertaBitfin: {
    titulo: string;
    severidade: string;
    descricao: string;
    valorAfetado: number;
    percentualAfetado: number;
    totalSacadosAfetados: number;
    possuiInconsistencias: boolean;
  };
  sacadosInconsistentes: SacadoInconsistente[];
  todosSacados: SacadoInconsistente[];
  titulosResumo: TituloItem[];
}

export const OperationsAnalysis: React.FC = () => {
  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);

  const [dataFiltro, setDataFiltro] = useState<string>(todayStr);
  const [statusFiltro, setStatusFiltro] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [operacoes, setOperacoes] = useState<OperacaoSummary[]>([]);

  // Modal de Detalhe da Operação
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [operationDetail, setOperationDetail] = useState<OperacaoDetail | null>(null);
  const [detailTab, setDetailTab] = useState<'inconsistencias' | 'todos_sacados' | 'titulos'>('inconsistencias');
  const [downloadingXlsx, setDownloadingXlsx] = useState<boolean>(false);
  const [downloadingFullXlsx, setDownloadingFullXlsx] = useState<boolean>(false);
  const [downloadingCnab, setDownloadingCnab] = useState<boolean>(false);
  const [downloadingSeparatedCnab, setDownloadingSeparatedCnab] = useState<'validos' | 'erros' | null>(null);

  // Modal Consolidado de Exportação CNAB (Válidos / Erros / Completo x Vortex / Bitfin)
  const [cnabModalOpen, setCnabModalOpen] = useState<boolean>(false);
  const [cnabEscopo, setCnabEscopo] = useState<'validos' | 'erros' | 'completo'>('completo');
  const [cnabModelo, setCnabModelo] = useState<'vortex' | 'bitfin'>('vortex');
  const [downloadingUnifiedCnab, setDownloadingUnifiedCnab] = useState<boolean>(false);

  // Modal de Diagnóstico Bruto da API BitFin
  const [diagnoseModalOpen, setDiagnoseModalOpen] = useState<boolean>(false);
  const [diagnoseLoading, setDiagnoseLoading] = useState<boolean>(false);
  const [diagnoseData, setDiagnoseData] = useState<any>(null);
  const [diagnoseCopied, setDiagnoseCopied] = useState<boolean>(false);

  const handleDiagnose = async (opId: string) => {
    setDiagnoseLoading(true);
    setDiagnoseModalOpen(true);
    setDiagnoseData(null);
    setDiagnoseCopied(false);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/operacoes/${opId}/investigar`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      setDiagnoseData(data);
    } catch (err: any) {
      setDiagnoseData({ error: err.message });
    } finally {
      setDiagnoseLoading(false);
    }
  };

  // Busca listagem de operações
  const fetchOperations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        data: dataFiltro,
        ...(statusFiltro !== 'TODOS' ? { status: statusFiltro } : {})
      });

      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/operacoes?${queryParams.toString()}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${res.status}`);
      }

      const data = await res.json();
      setOperacoes(data.operacoes || []);
    } catch (err: any) {
      console.error('Erro ao buscar operações:', err);
      setError(err.message || 'Não foi possível carregar as operações do BitFin.');
    } finally {
      setLoading(false);
    }
  }, [dataFiltro, statusFiltro]);

  useEffect(() => {
    fetchOperations();
  }, [fetchOperations]);

  // Busca detalhes de uma operação específica
  const handleOpenOperation = async (opId: string) => {
    setSelectedOpId(opId);
    setDetailLoading(true);
    setOperationDetail(null);
    setDetailTab('inconsistencias');

    try {
      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/operacoes/${opId}?data=${dataFiltro}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${res.status}`);
      }

      const data: OperacaoDetail = await res.json();
      setOperationDetail(data);
    } catch (err: any) {
      console.error('Erro ao buscar detalhe da operação:', err);
      alert(`Erro ao abrir operação #${opId}: ${err.message}`);
      setSelectedOpId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Download da planilha Excel de sacados com erro
  const handleDownloadXlsx = async (opId: string) => {
    setDownloadingXlsx(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/operacoes/${opId}/exportar-xlsx?data=${dataFiltro}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao gerar planilha.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sacados_Sem_Endereco_Verificado_Op_${opId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Erro ao exportar XLSX:', err);
      alert(`Erro no download da planilha: ${err.message}`);
    } finally {
      setDownloadingXlsx(false);
    }
  };

  // Download da planilha Excel completa da operação (todos os dados, sacados, títulos, CEPs e endereços)
  const handleDownloadFullOperationXlsx = async (opId: string) => {
    setDownloadingFullXlsx(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/operacoes/${opId}/exportar-completo-xlsx?data=${dataFiltro}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao gerar planilha completa da operação.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Operacao_${opId}_Completa.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Erro ao exportar XLSX completo:', err);
      alert(`Erro no download da planilha completa: ${err.message}`);
    } finally {
      setDownloadingFullXlsx(false);
    }
  };

  // Download consolidado de Remessa CNAB (Escopo: Válido, Com Erro ou Completo | Modelos: Vortex ou Bitfin)
  const handleDownloadUnifiedCnab = async () => {
    if (!operationDetail) return;
    setDownloadingUnifiedCnab(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/mesa-operacoes/operacoes/${operationDetail.operacaoId}/gerar-cnab?escopo=${cnabEscopo}&modelo=${cnabModelo}&data=${dataFiltro}`,
        {
          headers: getAuthHeaders()
        }
      );

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao gerar remessa CNAB.');
      }

      const disposition = res.headers.get('Content-Disposition');
      let filename = `REM_${cnabModelo.toUpperCase()}_OP_${operationDetail.operacaoId}_${cnabEscopo.toUpperCase()}.REM`;
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename=["']?([^"';]+)["']?/i);
        if (match && match[1]) filename = match[1];
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setCnabModalOpen(false);
    } catch (err: any) {
      console.error('Erro ao gerar remessa CNAB:', err);
      alert(`Erro no download da remessa CNAB: ${err.message}`);
    } finally {
      setDownloadingUnifiedCnab(false);
    }
  };
  const handleDownloadCnab = async (opId: string) => {
    setDownloadingCnab(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/operacoes/${opId}/exportar-cnab?data=${dataFiltro}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao gerar remessa CNAB 400.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `REM_OP_${opId}_CORRIGIDA.REM`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Erro ao exportar CNAB 400:', err);
      alert(`Erro no download da remessa CNAB: ${err.message}`);
    } finally {
      setDownloadingCnab(false);
    }
  };

  // Download particionado do arquivo CNAB (apenas válidos ou apenas com erro) sem alterar dados
  const handleDownloadSeparatedCnab = async (opId: string, tipo: 'validos' | 'erros') => {
    setDownloadingSeparatedCnab(tipo);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/operacoes/${opId}/exportar-cnab-separado?tipo=${tipo}&data=${dataFiltro}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro ao gerar remessa CNAB de ${tipo}.`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const suffix = tipo === 'erros' ? 'COM_ERRO_CEP' : 'VALIDOS';
      a.download = `REM_OP_${opId}_${suffix}.REM`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error(`Erro ao exportar CNAB separado (${tipo}):`, err);
      alert(`Erro no download da remessa CNAB (${tipo}): ${err.message}`);
    } finally {
      setDownloadingSeparatedCnab(null);
    }
  };

  // Filtro de busca textual
  const filteredOperacoes = useMemo(() => {
    if (!searchTerm.trim()) return operacoes;
    const term = searchTerm.toLowerCase().trim();
    return operacoes.filter(op =>
      op.id.toLowerCase().includes(term) ||
      op.numero.toLowerCase().includes(term) ||
      op.cedente.nome.toLowerCase().includes(term) ||
      op.cedente.documento.includes(term) ||
      op.gerente.toLowerCase().includes(term) ||
      op.unidadeAdministrativa.toLowerCase().includes(term)
    );
  }, [operacoes, searchTerm]);

  // Totais rápidos
  const totalOperacoes = filteredOperacoes.length;
  const volumeTotal = filteredOperacoes.reduce((acc, o) => acc + o.valorTotal, 0);

  const formatCurrency = (val: number | null | undefined): string => {
    if (val == null || isNaN(val)) return 'R$\u00A00,00';
    return `R$\u00A0${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getCurrencySizeClass = (val: number | null | undefined): string => {
    if (val == null) return 'val-normal';
    if (val >= 10_000_000) return 'val-xlarge';
    if (val >= 1_000_000) return 'val-large';
    return 'val-normal';
  };

  const getStatusBadgeClass = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('analise') || s.includes('análise')) return 'badge-warning';
    if (s.includes('pagamento')) return 'badge-info';
    if (s.includes('formaliz') || s.includes('formalização')) return 'badge-purple';
    if (s.includes('aberto') || s.includes('cadastrada')) return 'badge-cyan';
    if (s.includes('liquid') || s.includes('paga') || s.includes('aprovad')) return 'badge-success';
    if (s.includes('cancelad') || s.includes('rejeit')) return 'badge-danger';
    return 'badge-default';
  };

  return (
    <div className="oa-container">
      {/* ── HEADER PRINCIPAL ── */}
      <div className="oa-header">
        <div className="oa-header-left">
          <div className="oa-title-badge">
            <Layers size={22} color="#38bdf8" />
            <span>MESA DE OPERAÇÃO</span>
          </div>
          <h1 className="oa-title">Análise de Operações (BitFin)</h1>
          <p className="oa-subtitle">
            Acompanhamento em tempo real de operações ativas, esteira de crédito e diagnóstico de sacados sem endereço verificado.
          </p>
        </div>

        <div className="oa-header-actions">
          <button
            type="button"
            className="oa-btn secondary"
            onClick={() => {
              setDataFiltro(todayStr);
            }}
            title="Voltar para a data de hoje"
          >
            <Calendar size={16} /> Hoje
          </button>
          <button
            type="button"
            className="oa-btn primary"
            onClick={fetchOperations}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'oa-spin' : ''} />
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      {/* ── BARRA DE FILTROS ── */}
      <div className="oa-filter-bar glass">
        <div className="oa-filter-group">
          <label htmlFor="data-filtro" className="oa-label">Data de Cadastro:</label>
          <input
            id="data-filtro"
            type="date"
            className="oa-input date"
            value={dataFiltro}
            onChange={e => setDataFiltro(e.target.value)}
          />
        </div>

        <div className="oa-filter-group">
          <label htmlFor="status-filtro" className="oa-label">Status da Operação:</label>
          <select
            id="status-filtro"
            className="oa-select"
            value={statusFiltro}
            onChange={e => setStatusFiltro(e.target.value)}
          >
            <option value="TODOS">Todos os Status Ativos</option>
            <option value="Em Análise">Em Análise</option>
            <option value="Em Pagamento">Em Pagamento</option>
            <option value="Em Formalização">Em Formalização</option>
            <option value="Em Aberto">Em Aberto</option>
            <option value="Cadastrada">Cadastrada</option>
          </select>
        </div>

        <div className="oa-filter-group search">
          <label htmlFor="search-termo" className="oa-label">Busca Rápida:</label>
          <div className="oa-search-wrap">
            <Search size={16} className="oa-search-icon" />
            <input
              id="search-termo"
              type="text"
              className="oa-input search"
              placeholder="Buscar por Nº Op, Cedente, CNPJ..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="oa-clear-search" onClick={() => setSearchTerm('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── CARDS DE RESUMO (KPIs) ── */}
      <div className="oa-kpis-grid">
        <div className="oa-kpi-card">
          <div className="oa-kpi-icon blue">
            <Layers size={22} />
          </div>
          <div>
            <span className="oa-kpi-label">Operações no Período</span>
            <h3 className="oa-kpi-value">{totalOperacoes}</h3>
          </div>
        </div>

        <div className="oa-kpi-card">
          <div className="oa-kpi-icon green">
            <Building2 size={22} />
          </div>
          <div>
            <span className="oa-kpi-label">Volume Total (Nominal)</span>
            <h3 className="oa-kpi-value">
              {formatCurrency(volumeTotal)}
            </h3>
          </div>
        </div>

        <div className="oa-kpi-card highlight">
          <div className="oa-kpi-icon yellow">
            <AlertTriangle size={22} />
          </div>
          <div>
            <span className="oa-kpi-label">Diagnóstico de CEP</span>
            <p className="oa-kpi-desc">
              Clique em qualquer operação para auditar os sacados com erro cadastral.
            </p>
          </div>
        </div>
      </div>

      {/* ── MENSAGENS DE ERRO ── */}
      {error && (
        <div className="oa-error-box">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="oa-btn-retry" onClick={fetchOperations}>Tentar Novamente</button>
        </div>
      )}

      {/* ── TABELA DE OPERAÇÕES ── */}
      <div className="oa-table-card glass">
        <div className="oa-table-header">
          <h2>Operações da Mesa ({totalOperacoes})</h2>
          <span className="oa-table-subtitle">
            Mostrando operações registradas em {dataFiltro.split('-').reverse().join('/')}
          </span>
        </div>

        {loading ? (
          <div className="oa-loading-state">
            <RefreshCw size={32} className="oa-spin text-blue" />
            <p>Carregando operações diretamente da API do BitFin...</p>
          </div>
        ) : filteredOperacoes.length === 0 ? (
          <div className="oa-empty-state">
            <CheckCircle2 size={40} color="#10b981" />
            <h3>Nenhuma operação encontrada</h3>
            <p>Não foram localizadas operações ativas para a data selecionada com os filtros aplicados.</p>
          </div>
        ) : (
          <>
            {/* ── TABELA PARA DESKTOP ── */}
            <div className="oa-table-responsive oa-desktop-only">
              <table className="oa-table">
                <thead>
                  <tr>
                    <th>Nº OPERAÇÃO</th>
                    <th>DATA CADASTRO</th>
                    <th>CEDENTE (CLIENTE)</th>
                    <th>GERENTE</th>
                    <th>UNIDADE (FUNDO)</th>
                    <th style={{ textAlign: 'center' }}>TÍTULOS</th>
                    <th className="oa-th-valor">VALOR TOTAL (R$)</th>
                    <th style={{ textAlign: 'center' }}>STATUS</th>
                    <th style={{ textAlign: 'center' }}>AÇÃO</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOperacoes.map(op => (
                    <tr key={op.id} className="oa-row">
                      <td>
                        <button
                          className="oa-op-id-btn"
                          onClick={() => handleOpenOperation(op.id)}
                          title="Clique para analisar sacados e inconsistências"
                        >
                          #{op.id}
                        </button>
                      </td>
                      <td>{op.dataCadastro ? op.dataCadastro.substring(0, 10).split('-').reverse().join('/') : '-'}</td>
                      <td>
                        <div className="oa-cedente-cell">
                          <span className="oa-cedente-name">{op.cedente.nome}</span>
                          {op.cedente.documento && (
                            <span className="oa-cedente-doc">CNPJ: {op.cedente.documento}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="oa-gerente-tag">
                          <UserCheck size={13} /> {op.gerente || '-'}
                        </span>
                      </td>
                      <td>
                        <span className="oa-ua-badge">{op.unidadeAdministrativa}</span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{op.titulosCount}</td>
                      <td className="oa-valor-cell">
                        <span className={`oa-currency-val ${getCurrencySizeClass(op.valorTotal)}`}>
                          {formatCurrency(op.valorTotal)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`oa-status-badge ${getStatusBadgeClass(op.status)}`}>
                          {op.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="oa-action-group">
                          <button
                            className="oa-action-btn primary"
                            onClick={() => handleOpenOperation(op.id)}
                            title="Auditar sacados e inconsistências de endereço"
                          >
                            <Search size={14} /> Analisar
                          </button>
                          <button
                            type="button"
                            className="oa-action-btn-icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadFullOperationXlsx(op.id);
                            }}
                            disabled={downloadingFullXlsx}
                            title="Exportar operação completa em planilha Excel (.xlsx)"
                          >
                            <FileSpreadsheet size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── VISUALIZAÇÃO EM CARDS INTUITIVOS PARA MOBILE (SEM ROLAGEM HORIZONTAL) ── */}
            <div className="oa-mobile-cards-list oa-mobile-only">
              {filteredOperacoes.map(op => (
                <div
                  key={`m-${op.id}`}
                  className="oa-m-op-card glass"
                  onClick={() => handleOpenOperation(op.id)}
                >
                  <div className="oa-m-card-header">
                    <div className="oa-m-id-status">
                      <span className="oa-m-op-id">#{op.id}</span>
                      <span className={`oa-status-badge ${getStatusBadgeClass(op.status)}`}>
                        {op.status}
                      </span>
                    </div>
                    <div className="oa-m-total-val">
                      <span className={`oa-currency-val ${getCurrencySizeClass(op.valorTotal)}`}>
                        {formatCurrency(op.valorTotal)}
                      </span>
                    </div>
                  </div>

                  <div className="oa-m-cedente-box">
                    <span className="oa-m-cedente-name">{op.cedente.nome}</span>
                    {op.cedente.documento && (
                      <span className="oa-m-cedente-doc">CNPJ: {op.cedente.documento}</span>
                    )}
                  </div>

                  <div className="oa-m-tags-grid">
                    <div className="oa-m-tag-item">
                      <span className="oa-m-tag-label">Data Cadastro</span>
                      <span className="oa-m-tag-val">{op.dataCadastro ? op.dataCadastro.substring(0, 10).split('-').reverse().join('/') : '-'}</span>
                    </div>
                    <div className="oa-m-tag-item">
                      <span className="oa-m-tag-label">Qtd Títulos</span>
                      <span className="oa-m-tag-val">{op.titulosCount} docs</span>
                    </div>
                    <div className="oa-m-tag-item">
                      <span className="oa-m-tag-label">Gerente</span>
                      <span className="oa-m-tag-val">{op.gerente || '-'}</span>
                    </div>
                    <div className="oa-m-tag-item">
                      <span className="oa-m-tag-label">Fundo / Unidade</span>
                      <span className="oa-m-tag-val">{op.unidadeAdministrativa}</span>
                    </div>
                  </div>

                  <div className="oa-m-actions-row" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      className="oa-btn primary oa-m-btn-analisar"
                      onClick={() => handleOpenOperation(op.id)}
                    >
                      <Search size={15} /> Analisar Operação
                    </button>
                    <button
                      type="button"
                      className="oa-m-btn-export"
                      onClick={() => handleDownloadFullOperationXlsx(op.id)}
                      disabled={downloadingFullXlsx}
                      title="Exportar XLSX da Operação"
                    >
                      <FileSpreadsheet size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── MODAL DE DETALHE DA OPERAÇÃO (AUDITORIA DE CEP) ── */}
      {selectedOpId && (
        <div className="oa-modal-overlay" onClick={() => setSelectedOpId(null)}>
          <div className="oa-modal-content glass" onClick={e => e.stopPropagation()}>
            {/* Header do Modal */}
            <div className="oa-modal-header">
              <div className="oa-modal-title-group">
                <span className="oa-modal-badge">OPERAÇÃO #{selectedOpId}</span>
                <h2>Auditoria Cadastral de Sacados</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleDiagnose(selectedOpId)}
                  title="Investigar chamadas brutas na API BitFin para esta operação"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    color: '#60a5fa',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <Search size={14} /> Investigar API
                </button>
                <button
                  className="oa-modal-close-btn"
                  onClick={() => setSelectedOpId(null)}
                  title="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Conteúdo do Modal */}
            <div className="oa-modal-body">
              {detailLoading ? (
                <div className="oa-loading-state" style={{ minHeight: '300px' }}>
                  <RefreshCw size={36} className="oa-spin text-blue" />
                  <p>Consultando títulos e validando endereços dos sacados na API BitFin...</p>
                </div>
              ) : !operationDetail ? (
                <div className="oa-empty-state">
                  <AlertCircle size={40} color="#f43f5e" />
                  <h3>Não foi possível carregar a operação</h3>
                </div>
              ) : (
                <>
                  {/* CARD DE ALERTA IDÊNTICO AO BITFIN (SEVERIDADE ALTA) */}
                  {operationDetail.alertaBitfin.possuiInconsistencias ? (
                    <div className="oa-bitfin-alert-card">
                      <div className="oa-bitfin-alert-header">
                        <div className="oa-bitfin-alert-title-wrap">
                          <div className="oa-bitfin-alert-icon">
                            <X size={18} strokeWidth={3} />
                          </div>
                          <div>
                            <h3 className="oa-bitfin-alert-title">
                              {operationDetail.alertaBitfin.titulo}
                            </h3>
                            <span className="oa-bitfin-alert-severity">
                              {operationDetail.alertaBitfin.severidade}
                            </span>
                          </div>
                        </div>

                        {/* Valor e Percentual Retido */}
                        <div className="oa-bitfin-alert-impact">
                          <span className="oa-bitfin-alert-amount">
                            {formatCurrency(operationDetail.alertaBitfin.valorAfetado)}
                          </span>
                          <span className="oa-bitfin-alert-percent">
                            {operationDetail.alertaBitfin.percentualAfetado.toFixed(2).replace('.', ',')}%
                          </span>
                        </div>
                      </div>

                      <p className="oa-bitfin-alert-text">
                        {operationDetail.alertaBitfin.descricao}
                      </p>

                      {/* Barra de Ação para Exportar */}
                      <div className="oa-bitfin-alert-actions">
                        <span className="oa-bitfin-alert-count-label">
                          <AlertTriangle size={16} />
                          <strong>{operationDetail.alertaBitfin.totalSacadosAfetados} sacado(s)</strong> com inconsistência de CEP nesta operação.
                        </span>
                        <div className="oa-btn-group-export">
                          <button
                            type="button"
                            className="oa-btn-export-xlsx full"
                            onClick={() => handleDownloadFullOperationXlsx(operationDetail.operacaoId)}
                            disabled={downloadingFullXlsx}
                            title="Exportar todos os sacados, títulos, CEPs e endereços da operação inteira em Excel"
                          >
                            {downloadingFullXlsx ? <RefreshCw size={16} className="oa-spin" /> : <FileSpreadsheet size={16} />}
                            {downloadingFullXlsx ? 'Gerando...' : 'Exportar Operação Completa (.xlsx)'}
                          </button>
                          <button
                            type="button"
                            className="oa-btn-export-xlsx"
                            onClick={() => handleDownloadXlsx(operationDetail.operacaoId)}
                            disabled={downloadingXlsx}
                            title="Exportar resumo de sacados com CEP incorreto"
                          >
                            <FileSpreadsheet size={16} />
                            {downloadingXlsx ? 'Gerando...' : 'Exportar Sacados (.xlsx)'}
                          </button>
                        </div>

                        {/* Botões de CNAB Corrigido */}
                        <div className="oa-cnab-export-section">
                          <div className="oa-actions-dual-cnab">
                            <button
                              type="button"
                              className="oa-btn-split-cnab validos"
                              onClick={() => handleDownloadSeparatedCnab(operationDetail.operacaoId, 'validos')}
                              disabled={downloadingSeparatedCnab !== null}
                              title="Exportar arquivo CNAB contendo apenas os títulos com CEP válido, sem alterar nada nos dados"
                            >
                              {downloadingSeparatedCnab === 'validos' ? (
                                <RefreshCw size={16} className="oa-spin" />
                              ) : (
                                <CheckCircle2 size={16} />
                              )}
                              <span>Exportar CNAB Válidos ({operationDetail.totalTitulos - (operationDetail.sacadosInconsistentes.reduce((acc: number, s: any) => acc + (s.qtdTitulos || 0), 0))})</span>
                            </button>

                            <button
                              type="button"
                              className="oa-btn-split-cnab erros"
                              onClick={() => handleDownloadSeparatedCnab(operationDetail.operacaoId, 'erros')}
                              disabled={downloadingSeparatedCnab !== null}
                              title="Exportar arquivo CNAB contendo apenas os títulos com erro de CEP, sem alterar nada nos dados"
                            >
                              {downloadingSeparatedCnab === 'erros' ? (
                                <RefreshCw size={16} className="oa-spin" />
                              ) : (
                                <AlertTriangle size={16} />
                              )}
                              <span>Exportar CNAB c/ Erro CEP ({operationDetail.sacadosInconsistentes.reduce((acc: number, s: any) => acc + (s.qtdTitulos || 0), 0)})</span>
                            </button>

                            <button
                              type="button"
                              className="oa-btn-export-cnab"
                              onClick={() => handleDownloadCnab(operationDetail.operacaoId)}
                              disabled={downloadingCnab}
                              title="Gerar e baixar arquivo CNAB 400 Remessa completo com todos os títulos e CEPs corrigidos"
                            >
                              <FileCode size={16} />
                              {downloadingCnab ? 'Gerando Remessa...' : 'Gerar Remessa Completa Corrigida'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="oa-bitfin-success-card">
                      <div className="oa-bitfin-success-info">
                        <CheckCircle2 size={24} color="#10b981" />
                        <div>
                          <h4>Endereços de Todos os Sacados Verificados</h4>
                          <p>Nenhum erro de CEP ou endereço pendente foi detectado nos sacados desta operação.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="oa-btn-export-full-success"
                        onClick={() => handleDownloadFullOperationXlsx(operationDetail.operacaoId)}
                        disabled={downloadingFullXlsx}
                        title="Exportar todos os sacados e títulos com endereços e CEPs completos em planilha Excel"
                      >
                        {downloadingFullXlsx ? (
                          <RefreshCw size={15} className="oa-spin" />
                        ) : (
                          <FileSpreadsheet size={15} />
                        )}
                        <span>{downloadingFullXlsx ? 'Gerando Planilha...' : `Exportar Operação Completa (${operationDetail.todosSacados.length} Sacados / ${operationDetail.totalTitulos} Títulos)`}</span>
                      </button>
                    </div>
                  )}

                  {/* Resumo do Cedente e Contato Direto */}
                  <div className="oa-cedente-card">
                    <div className="oa-cedente-card-left">
                      <Building2 size={20} color="#38bdf8" />
                      <div>
                        <span className="oa-card-label">Cedente da Operação</span>
                        <h4>{operationDetail.cedente.nome}</h4>
                        <span className="oa-doc-pill">CNPJ: {operationDetail.cedente.documento}</span>
                      </div>
                    </div>

                    <div className="oa-cedente-contacts">
                      <span className="oa-card-label">Contato Direto da Operação:</span>
                      <div className="oa-contact-pills">
                        {operationDetail.cedente.telefones && operationDetail.cedente.telefones.length > 0 ? (
                          operationDetail.cedente.telefones.map((tel, idx) => (
                            <span key={idx} className="oa-contact-pill">
                              <Phone size={12} /> {tel}
                            </span>
                          ))
                        ) : (
                          <span className="oa-contact-pill muted">Sem telefone cadastrado</span>
                        )}

                        {operationDetail.cedente.emails && operationDetail.cedente.emails.length > 0 ? (
                          operationDetail.cedente.emails.map((mail, idx) => (
                            <span key={idx} className="oa-contact-pill">
                              <Mail size={12} /> {mail}
                            </span>
                          ))
                        ) : (
                          <span className="oa-contact-pill muted">Sem e-mail cadastrado</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Abas Internas */}
                  <div className="oa-modal-tabs">
                    <button
                      className={`oa-modal-tab ${detailTab === 'inconsistencias' ? 'active alert' : ''}`}
                      onClick={() => setDetailTab('inconsistencias')}
                    >
                      Sacados com Erro de CEP ({operationDetail.sacadosInconsistentes.length})
                    </button>
                    <button
                      className={`oa-modal-tab ${detailTab === 'todos_sacados' ? 'active' : ''}`}
                      onClick={() => setDetailTab('todos_sacados')}
                    >
                      Todos os Sacados ({operationDetail.todosSacados.length})
                    </button>
                    <button
                      className={`oa-modal-tab ${detailTab === 'titulos' ? 'active' : ''}`}
                      onClick={() => setDetailTab('titulos')}
                    >
                      Títulos da Operação ({operationDetail.totalTitulos})
                    </button>
                  </div>

                  {/* ABA 1: SACADOS COM ERRO DE CEP */}
                  {detailTab === 'inconsistencias' && (
                    <div className="oa-tab-content">
                      {operationDetail.sacadosInconsistentes.length === 0 ? (
                        <div className="oa-empty-sub">
                          <CheckCircle2 size={32} color="#10b981" />
                          <p>Nenhum sacado com erro de endereço para listar.</p>
                        </div>
                      ) : (
                        <>
                          <div className="oa-table-responsive oa-desktop-only">
                            <table className="oa-table modal-table">
                              <thead>
                                <tr>
                                  <th>SACADO (DEVEDOR)</th>
                                  <th>CNPJ / CPF</th>
                                  <th style={{ textAlign: 'center' }}>CEP ATUAL</th>
                                  <th>DIAGNÓSTICO DO ERRO</th>
                                  <th>ENDEREÇO</th>
                                  <th style={{ textAlign: 'center' }}>TÍTULOS</th>
                                  <th className="oa-th-valor">VALOR RETIDO</th>
                                </tr>
                              </thead>
                              <tbody>
                                {operationDetail.sacadosInconsistentes.map(s => (
                                  <tr key={s.key} className="oa-row error-row">
                                    <td>
                                      <div className="oa-sacado-cell">
                                        <span className="oa-sacado-nome">{s.nome}</span>
                                        {s.telefones.length > 0 && (
                                          <span className="oa-sacado-phone">
                                            <Phone size={11} /> {s.telefones[0]}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td><code>{s.documento || '-'}</code></td>
                                    <td style={{ textAlign: 'center' }}>
                                      <span className="oa-cep-badge invalid">
                                        {s.cep}
                                      </span>
                                      {s.sugestaoCep && (
                                        <span className="oa-cep-sugestao" title="Sugestão de correção">
                                          Sugestão: {s.sugestaoCep}
                                        </span>
                                      )}
                                    </td>
                                    <td>
                                      <span className="oa-error-reason-badge">
                                        <AlertTriangle size={12} /> {s.errorReason}
                                      </span>
                                    </td>
                                    <td className="oa-endereco-cell" title={s.endereco}>
                                      {s.endereco}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{s.qtdTitulos}</td>
                                    <td className="oa-valor-cell" style={{ color: '#f43f5e' }}>
                                      <span className={`oa-currency-val ${getCurrencySizeClass(s.valorTotal)}`}>
                                        {formatCurrency(s.valorTotal)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          {/* ── CARDS MOBILE PARA SACADOS COM ERRO ── */}
                          <div className="oa-mobile-sacados-list oa-mobile-only">
                            {operationDetail.sacadosInconsistentes.map(s => (
                              <div key={`m-inc-${s.key}`} className="oa-m-sacado-card glass error">
                                <div className="oa-m-sacado-head">
                                  <div className="oa-m-sacado-title-group">
                                    <h4 className="oa-m-sacado-name">{s.nome}</h4>
                                    <span className="oa-m-sacado-doc">CNPJ/CPF: {s.documento || '-'}</span>
                                  </div>
                                  <span className={`oa-m-sacado-val error oa-currency-val ${getCurrencySizeClass(s.valorTotal)}`}>
                                    {formatCurrency(s.valorTotal)}
                                  </span>
                                </div>

                                <div className="oa-m-cep-section error">
                                  <div className="oa-m-cep-line">
                                    <span className="oa-m-cep-lbl">CEP Cadastrado:</span>
                                    <span className="oa-cep-badge invalid">{s.cep || 'Inexistente'}</span>
                                  </div>
                                  {s.sugestaoCep && (
                                    <div className="oa-m-sugestao-line">
                                      <span>Sugestão Correios:</span>
                                      <strong>{s.sugestaoCep}</strong>
                                    </div>
                                  )}
                                  <div className="oa-m-error-tag">
                                    <AlertTriangle size={12} /> {s.errorReason}
                                  </div>
                                </div>

                                <div className="oa-m-field-box">
                                  <span className="oa-m-field-lbl">Endereço:</span>
                                  <span className="oa-m-field-txt">{s.endereco || 'Não informado'}</span>
                                </div>

                                <div className="oa-m-card-footer-info">
                                  <span className="oa-m-count-tag">{s.qtdTitulos} título(s)</span>
                                  <div className="oa-m-contact-btns">
                                    {s.telefones.length > 0 && (
                                      <a href={`tel:${s.telefones[0].replace(/\D/g, '')}`} className="oa-m-contact-action tel" title="Ligar">
                                        <Phone size={12} /> {s.telefones[0]}
                                      </a>
                                    )}
                                    {s.emails.length > 0 && (
                                      <a href={`mailto:${s.emails[0]}`} className="oa-m-contact-action mail" title="Enviar E-mail">
                                        <Mail size={12} /> E-mail
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ABA 2: TODOS OS SACADOS */}
                  {detailTab === 'todos_sacados' && (
                    <div className="oa-tab-content">
                      <div className="oa-table-responsive oa-desktop-only">
                        <table className="oa-table modal-table">
                          <thead>
                            <tr>
                              <th>SACADO</th>
                              <th>CNPJ / CPF</th>
                              <th style={{ textAlign: 'center' }}>STATUS CEP</th>
                              <th>CEP CADASTRADO</th>
                              <th>ENDEREÇO</th>
                              <th style={{ textAlign: 'center' }}>TÍTULOS</th>
                              <th className="oa-th-valor">VALOR TOTAL</th>
                            </tr>
                          </thead>
                          <tbody>
                            {operationDetail.todosSacados.map(s => (
                              <tr key={s.key} className="oa-row">
                                <td style={{ fontWeight: 600 }}>{s.nome}</td>
                                <td><code>{s.documento || '-'}</code></td>
                                <td style={{ textAlign: 'center' }}>
                                  {s.isValido ? (
                                    <span className="oa-cep-status-tag valid">
                                      <CheckCircle2 size={12} /> Válido
                                    </span>
                                  ) : (
                                    <span className="oa-cep-status-tag invalid">
                                      <AlertTriangle size={12} /> Inconsistente
                                    </span>
                                  )}
                                </td>
                                <td>{s.cep}</td>
                                <td className="oa-endereco-cell" title={s.endereco}>{s.endereco}</td>
                                <td style={{ textAlign: 'center' }}>{s.qtdTitulos}</td>
                                <td className="oa-valor-cell">
                                  <span className={`oa-currency-val ${getCurrencySizeClass(s.valorTotal)}`}>
                                    {formatCurrency(s.valorTotal)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* ── CARDS MOBILE PARA TODOS OS SACADOS ── */}
                      <div className="oa-mobile-sacados-list oa-mobile-only">
                        {operationDetail.todosSacados.map(s => (
                          <div key={`m-all-${s.key}`} className={`oa-m-sacado-card glass ${s.isValido ? 'valid' : 'error'}`}>
                            <div className="oa-m-sacado-head">
                              <div className="oa-m-sacado-title-group">
                                <h4 className="oa-m-sacado-name">{s.nome}</h4>
                                <span className="oa-m-sacado-doc">CNPJ/CPF: {s.documento || '-'}</span>
                              </div>
                              <span className={`oa-cep-status-tag ${s.isValido ? 'valid' : 'invalid'}`}>
                                {s.isValido ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                                {s.isValido ? 'Válido' : 'Inconsistente'}
                              </span>
                            </div>

                            <div className="oa-m-info-cols">
                              <div>
                                <span className="oa-m-field-lbl">CEP:</span>
                                <span className="oa-m-field-txt font-mono">{s.cep || '-'}</span>
                              </div>
                              <div>
                                <span className="oa-m-field-lbl">Títulos:</span>
                                <span className="oa-m-field-txt">{s.qtdTitulos}</span>
                              </div>
                              <div>
                                <span className="oa-m-field-lbl">Valor Total:</span>
                                <span className={`oa-m-sacado-val oa-currency-val ${getCurrencySizeClass(s.valorTotal)}`}>
                                  {formatCurrency(s.valorTotal)}
                                </span>
                              </div>
                            </div>

                            <div className="oa-m-field-box">
                              <span className="oa-m-field-lbl">Endereço:</span>
                              <span className="oa-m-field-txt">{s.endereco || 'Não informado'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ABA 3: TÍTULOS DA OPERAÇÃO */}
                  {detailTab === 'titulos' && (
                    <div className="oa-tab-content">
                      <div className="oa-table-responsive oa-desktop-only">
                        <table className="oa-table modal-table">
                          <thead>
                            <tr>
                              <th>ID / NÚMERO</th>
                              <th>SACADO</th>
                              <th>CNPJ/CPF SACADO</th>
                              <th>VENCIMENTO</th>
                              <th className="oa-th-valor">VALOR NOMINAL (R$)</th>
                              <th style={{ textAlign: 'center' }}>SITUAÇÃO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {operationDetail.titulosResumo.map(t => (
                              <tr key={t.id} className="oa-row">
                                <td style={{ fontWeight: 600 }}>{t.numero}</td>
                                <td>{t.sacadoNome}</td>
                                <td><code>{t.sacadoDoc}</code></td>
                                <td>{t.vencimento ? t.vencimento.substring(0, 10).split('-').reverse().join('/') : '-'}</td>
                                <td className="oa-valor-cell">
                                  <span className={`oa-currency-val ${getCurrencySizeClass(t.valorNominal)}`}>
                                    {formatCurrency(t.valorNominal)}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="oa-status-badge badge-default">{t.situacao}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* ── CARDS MOBILE PARA TÍTULOS ── */}
                      <div className="oa-mobile-titulos-list oa-mobile-only">
                        {operationDetail.titulosResumo.map(t => (
                          <div key={`m-tit-${t.id}`} className="oa-m-titulo-card glass">
                            <div className="oa-m-titulo-head">
                              <span className="oa-m-titulo-num">Título #{t.numero}</span>
                              <span className="oa-status-badge badge-default">{t.situacao}</span>
                            </div>
                            <div className="oa-m-titulo-sacado">
                              <span className="oa-m-sacado-name">{t.sacadoNome}</span>
                              <span className="oa-m-sacado-doc"><code>{t.sacadoDoc}</code></span>
                            </div>
                            <div className="oa-m-titulo-bottom">
                              <div className="oa-m-venc-box">
                                <span className="oa-m-field-lbl">Vencimento:</span>
                                <span className="oa-m-field-txt">{t.vencimento ? t.vencimento.substring(0, 10).split('-').reverse().join('/') : '-'}</span>
                              </div>
                              <div className="oa-m-valor-box">
                                <span className="oa-m-field-lbl">Valor Nominal:</span>
                                <span className={`oa-m-titulo-valor oa-currency-val ${getCurrencySizeClass(t.valorNominal)}`}>
                                  {formatCurrency(t.valorNominal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="oa-modal-footer">
              {operationDetail && (
                <button
                  type="button"
                  className="oa-btn success"
                  onClick={() => handleDownloadFullOperationXlsx(operationDetail.operacaoId)}
                  disabled={downloadingFullXlsx}
                  title="Exportar operação inteira com todos os sacados, títulos, CEPs e endereços em planilha Excel (.xlsx)"
                >
                  {downloadingFullXlsx ? <RefreshCw size={16} className="oa-spin" /> : <FileSpreadsheet size={16} />}
                  <span>{downloadingFullXlsx ? 'Gerando Planilha...' : 'Exportar Operação Completa (.xlsx)'}</span>
                </button>
              )}
              {operationDetail && operationDetail.sacadosInconsistentes.length > 0 && (
                <button
                  type="button"
                  className="oa-btn secondary"
                  onClick={() => handleDownloadXlsx(operationDetail.operacaoId)}
                  disabled={downloadingXlsx}
                  title="Exportar sacados com inconsistência cadastral em planilha Excel"
                >
                  <FileSpreadsheet size={16} />
                  {downloadingXlsx ? 'Exportando...' : 'Exportar Sacados (.xlsx)'}
                </button>
              )}
              {operationDetail && (
                <button
                  type="button"
                  className="oa-btn cnab"
                  onClick={() => setCnabModalOpen(true)}
                  title="Consolidar e Gerar Remessa CNAB (Válidos, Com Erro ou Completo / Modelos Vortex e Bitfin)"
                >
                  <FileCode size={16} />
                  <span>Gerar Remessa CNAB</span>
                </button>
              )}
              <button
                type="button"
                className="oa-btn secondary"
                onClick={() => setSelectedOpId(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE INVESTIGAÇÃO DA API BITFIN ── */}
      {diagnoseModalOpen && (
        <div className="oa-modal-overlay" style={{ zIndex: 1100 }} onClick={() => setDiagnoseModalOpen(false)}>
          <div className="oa-modal-content glass" style={{ maxWidth: '900px', maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="oa-modal-header">
              <div className="oa-modal-title-group">
                <span className="oa-modal-badge">DIAGNÓSTICO TÉCNICO</span>
                <h2>Varredura de Endpoints na API BitFin</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (diagnoseData) {
                      navigator.clipboard.writeText(JSON.stringify(diagnoseData, null, 2));
                      setDiagnoseCopied(true);
                      setTimeout(() => setDiagnoseCopied(false), 2000);
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#34d399',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {diagnoseCopied ? <Check size={14} /> : <Copy size={14} />}
                  {diagnoseCopied ? 'Copiado!' : 'Copiar Diagnóstico'}
                </button>
                <button
                  className="oa-modal-close-btn"
                  onClick={() => setDiagnoseModalOpen(false)}
                  title="Fechar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="oa-modal-body" style={{ padding: '20px' }}>
              {diagnoseLoading ? (
                <div className="oa-loading-state" style={{ minHeight: '300px' }}>
                  <RefreshCw size={36} className="oa-spin text-blue" />
                  <p>Executando testes em múltiplos endpoints da API BitFin para a Operação #{selectedOpId}...</p>
                </div>
              ) : (
                <div>
                  <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
                    Esta auditoria consulta em tempo real todos os nós e sub-recursos potenciais da API BitFin para a Operação #{selectedOpId}, verificando onde os títulos e sacados estão localizados.
                  </p>
                  <pre style={{
                    background: '#090d16',
                    border: '1px solid #1e293b',
                    borderRadius: '8px',
                    padding: '16px',
                    color: '#38bdf8',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    overflowX: 'auto',
                    maxHeight: '450px'
                  }}>
                    {JSON.stringify(diagnoseData, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="oa-modal-footer">
              <button
                type="button"
                className="oa-btn secondary"
                onClick={() => setDiagnoseModalOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONSOLIDADO DE GERAÇÃO CNAB ── */}
      {cnabModalOpen && operationDetail && (
        <div className="oa-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setCnabModalOpen(false)}>
          <div className="oa-modal-content glass oa-cnab-modal" onClick={e => e.stopPropagation()}>
            <div className="oa-modal-header">
              <div className="oa-modal-title-group">
                <span className="oa-modal-badge cnab">EXPORTAÇÃO DE REMESSA CNAB 400</span>
                <h2>Gerar Remessa CNAB</h2>
                <p className="oa-cnab-modal-sub">
                  Operação #{operationDetail.operacaoId} • {operationDetail.cedente.nome}
                </p>
              </div>
              <button
                className="oa-modal-close-btn"
                onClick={() => setCnabModalOpen(false)}
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="oa-modal-body oa-cnab-modal-body">
              {/* SEÇÃO 1: ESCOLHA DO ESCOPO */}
              <div className="oa-cnab-section">
                <label className="oa-cnab-section-label">
                  <span className="oa-cnab-step-num">1</span>
                  Selecione o Escopo da Remessa
                </label>
                <div className="oa-cnab-options-grid">
                  {/* Opção VÁLIDO */}
                  <div
                    className={`oa-cnab-card ${cnabEscopo === 'validos' ? 'active' : ''}`}
                    onClick={() => setCnabEscopo('validos')}
                  >
                    <div className="oa-cnab-card-radio">
                      <input
                        type="radio"
                        name="cnabEscopo"
                        checked={cnabEscopo === 'validos'}
                        onChange={() => setCnabEscopo('validos')}
                      />
                    </div>
                    <div className="oa-cnab-card-info">
                      <div className="oa-cnab-card-header">
                        <CheckCircle2 size={16} className="text-emerald" />
                        <strong>CNAB VÁLIDO</strong>
                      </div>
                      <p>Apenas títulos cujos sacados têm CEP verificado e regular nos Correios.</p>
                      <div className="oa-cnab-card-count">
                        <span className="oa-count-pill valid">
                          {Math.max(0, operationDetail.totalTitulos - (operationDetail.sacadosInconsistentes || []).reduce((acc, s) => acc + (s.qtdTitulos || 0), 0))} títulos
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Opção COM ERRO */}
                  <div
                    className={`oa-cnab-card ${cnabEscopo === 'erros' ? 'active' : ''}`}
                    onClick={() => setCnabEscopo('erros')}
                  >
                    <div className="oa-cnab-card-radio">
                      <input
                        type="radio"
                        name="cnabEscopo"
                        checked={cnabEscopo === 'erros'}
                        onChange={() => setCnabEscopo('erros')}
                      />
                    </div>
                    <div className="oa-cnab-card-info">
                      <div className="oa-cnab-card-header">
                        <AlertTriangle size={16} className="text-amber" />
                        <strong>CNAB C/ ERRO</strong>
                      </div>
                      <p>Apenas títulos de sacados com CEP extinto, divergente ou inexistente.</p>
                      <div className="oa-cnab-card-count">
                        <span className="oa-count-pill error">
                          {(operationDetail.sacadosInconsistentes || []).reduce((acc, s) => acc + (s.qtdTitulos || 0), 0)} títulos
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Opção COMPLETO */}
                  <div
                    className={`oa-cnab-card ${cnabEscopo === 'completo' ? 'active' : ''}`}
                    onClick={() => setCnabEscopo('completo')}
                  >
                    <div className="oa-cnab-card-radio">
                      <input
                        type="radio"
                        name="cnabEscopo"
                        checked={cnabEscopo === 'completo'}
                        onChange={() => setCnabEscopo('completo')}
                      />
                    </div>
                    <div className="oa-cnab-card-info">
                      <div className="oa-cnab-card-header">
                        <Layers size={16} className="text-blue" />
                        <strong>CNAB COMPLETO</strong>
                      </div>
                      <p>Operação inteira consolidada com todos os CEPs corrigidos e validados.</p>
                      <div className="oa-cnab-card-count">
                        <span className="oa-count-pill info">
                          {operationDetail.totalTitulos} títulos
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEÇÃO 2: ESCOLHA DO MODELO / LAYOUT */}
              <div className="oa-cnab-section">
                <label className="oa-cnab-section-label">
                  <span className="oa-cnab-step-num">2</span>
                  Selecione o Modelo de Layout
                </label>
                <div className="oa-cnab-models-grid">
                  {/* Modelo VORTEX */}
                  <div
                    className={`oa-cnab-model-card ${cnabModelo === 'vortex' ? 'active' : ''}`}
                    onClick={() => setCnabModelo('vortex')}
                  >
                    <div className="oa-cnab-model-header">
                      <input
                        type="radio"
                        name="cnabModelo"
                        checked={cnabModelo === 'vortex'}
                        onChange={() => setCnabModelo('vortex')}
                      />
                      <span className="oa-model-title">Modelo VORTEX</span>
                      <span className="oa-model-tag vortex">Padrão Vortx DTVM</span>
                    </div>
                    <div className="oa-cnab-model-details">
                      <div className="oa-model-detail-row">
                        <span>Instituição:</span>
                        <strong>VORTX DTVM</strong>
                      </div>
                      <div className="oa-model-detail-row">
                        <span>Código Banco:</span>
                        <strong>999</strong>
                      </div>
                      <div className="oa-model-detail-row">
                        <span>Carteira:</span>
                        <strong>021 (Vinculada)</strong>
                      </div>
                    </div>
                  </div>

                  {/* Modelo BITFIN */}
                  <div
                    className={`oa-cnab-model-card ${cnabModelo === 'bitfin' ? 'active' : ''}`}
                    onClick={() => setCnabModelo('bitfin')}
                  >
                    <div className="oa-cnab-model-header">
                      <input
                        type="radio"
                        name="cnabModelo"
                        checked={cnabModelo === 'bitfin'}
                        onChange={() => setCnabModelo('bitfin')}
                      />
                      <span className="oa-model-title">Modelo BITFIN</span>
                      <span className="oa-model-tag bitfin">Layout V1.00</span>
                    </div>
                    <div className="oa-cnab-model-details">
                      <div className="oa-model-detail-row">
                        <span>Instituição:</span>
                        <strong>BITFIN</strong>
                      </div>
                      <div className="oa-model-detail-row">
                        <span>Código Banco:</span>
                        <strong>999</strong>
                      </div>
                      <div className="oa-model-detail-row">
                        <span>Carteira:</span>
                        <strong>001 (Simples)</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RESUMO DO ARQUIVO A SER GERADO */}
              <div className="oa-cnab-summary-box">
                <FileText size={16} />
                <span>
                  Arquivo gerado: <code>{`REM_${cnabModelo.toUpperCase()}_OP_${operationDetail.operacaoId}_${cnabEscopo === 'validos' ? 'VALIDOS' : cnabEscopo === 'erros' ? 'COM_ERRO' : 'COMPLETO'}.REM`}</code>
                </span>
              </div>
            </div>

            <div className="oa-modal-footer">
              <button
                type="button"
                className="oa-btn secondary"
                onClick={() => setCnabModalOpen(false)}
                disabled={downloadingUnifiedCnab}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="oa-btn cnab oa-btn-lg"
                onClick={handleDownloadUnifiedCnab}
                disabled={downloadingUnifiedCnab}
              >
                {downloadingUnifiedCnab ? <RefreshCw size={16} className="oa-spin" /> : <Download size={16} />}
                <span>{downloadingUnifiedCnab ? 'Gerando Remessa...' : 'Baixar Arquivo .REM'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsAnalysis;


