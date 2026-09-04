import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Download,
  Building2,
  Phone,
  Mail,
  X,
  UserCheck,
  FileSpreadsheet,
  FileCode,
  Upload,
  AlertCircle,
  Copy,
  Check
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
  const [downloadingTitulosXlsx, setDownloadingTitulosXlsx] = useState<boolean>(false);
  const [downloadingCnab, setDownloadingCnab] = useState<boolean>(false);
  const [downloadingSeparatedCnab, setDownloadingSeparatedCnab] = useState<'validos' | 'erros' | null>(null);
  const [uploadingCnab, setUploadingCnab] = useState<boolean>(false);
  const [uploadResultModal, setUploadResultModal] = useState<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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

  // Download da planilha Excel de TÍTULOS e SACADOS com erro (para refazer a operação)
  const handleDownloadTitulosXlsx = async (opId: string) => {
    setDownloadingTitulosXlsx(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/operacoes/${opId}/exportar-titulos-xlsx?data=${dataFiltro}`, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao gerar planilha de títulos.');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Titulos_e_Sacados_Com_Erro_Op_${opId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Erro ao exportar títulos XLSX:', err);
      alert(`Erro no download da planilha de títulos: ${err.message}`);
    } finally {
      setDownloadingTitulosXlsx(false);
    }
  };

  // Download do arquivo CNAB 400 Remessa Corrigido com todos os títulos da operação
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

  // Upload e correção do CNAB original enviado pelo cedente (.txt ou .rem)
  const handleUploadCnab = async (e: React.ChangeEvent<HTMLInputElement>, opId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCnab(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (operationDetail?.sacadosInconsistentes?.length) {
        const errCnpjs = operationDetail.sacadosInconsistentes
          .map((s: any) => String(s.documento || '').replace(/\D/g, ''))
          .filter(Boolean);
        formData.append('inconsistentCnpjs', JSON.stringify(errCnpjs));
      }

      const res = await fetch(`${API_BASE_URL}/api/mesa-operacoes/operacoes/${opId}/corrigir-cnab-upload?format=json`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao processar o arquivo CNAB enviado.');
      }

      const data = await res.json();

      // Download automático do arquivo CNAB corrigido
      if (data.cnabBase64) {
        const byteCharacters = atob(data.cnabBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'text/plain;charset=iso-8859-1' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.filename || `REM_OP_${opId}_CORRIGIDA.REM`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      setUploadResultModal(data);
    } catch (err: any) {
      console.error('Erro ao processar upload do CNAB:', err);
      alert(`Erro no upload da remessa: ${err.message}`);
    } finally {
      setUploadingCnab(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
              R$ {volumeTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          <div className="oa-table-responsive">
            <table className="oa-table">
              <thead>
                <tr>
                  <th>Nº OPERAÇÃO</th>
                  <th>DATA CADASTRO</th>
                  <th>CEDENTE (CLIENTE)</th>
                  <th>GERENTE</th>
                  <th>UNIDADE (FUNDO)</th>
                  <th style={{ textAlign: 'center' }}>TÍTULOS</th>
                  <th style={{ textAlign: 'right' }}>VALOR TOTAL (R$)</th>
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
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>
                      R$ {op.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`oa-status-badge ${getStatusBadgeClass(op.status)}`}>
                        {op.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="oa-action-btn primary"
                        onClick={() => handleOpenOperation(op.id)}
                        title="Auditar sacados e inconsistências de endereço"
                      >
                        <Search size={14} /> Analisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                            R$ {operationDetail.alertaBitfin.valorAfetado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            className="oa-btn-export-xlsx"
                            onClick={() => handleDownloadXlsx(operationDetail.operacaoId)}
                            disabled={downloadingXlsx}
                            title="Exportar resumo de sacados com CEP incorreto"
                          >
                            <FileSpreadsheet size={16} />
                            {downloadingXlsx ? 'Gerando...' : 'Exportar Sacados (.xlsx)'}
                          </button>
                          <button
                            type="button"
                            className="oa-btn-export-xlsx titulos"
                            onClick={() => handleDownloadTitulosXlsx(operationDetail.operacaoId)}
                            disabled={downloadingTitulosXlsx}
                            title="Exportar cada título dos sacados com erro para refazer a operação no Bitfin"
                          >
                            <Download size={16} />
                            {downloadingTitulosXlsx ? 'Gerando...' : 'Exportar Sacado + Título (.xlsx)'}
                          </button>
                        </div>

                        {/* Botões de CNAB Corrigido: Importar Arquivo Original do Cedente ou Gerar Direto */}
                        <div className="oa-cnab-export-section">
                          <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".txt,.rem"
                            onChange={e => handleUploadCnab(e, operationDetail.operacaoId)}
                          />
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
                              className="oa-btn-upload-cnab"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={uploadingCnab}
                              title="Subir o arquivo CNAB exato enviado pelo cliente (.txt/.rem) e ajustar pontualmente apenas os CEPs incorretos"
                            >
                              <Upload size={16} />
                              {uploadingCnab ? 'Processando e Corrigindo CEPs...' : 'Importar Remessa Cedente e Corrigir CEPs'}
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
                          <span className="oa-cnab-desc-hint">
                            <strong>Importar CNAB Cedente:</strong> Você importa exatamente o mesmo arquivo que o cliente enviou (.txt/.rem). O sistema lê linha a linha, preserva 100% dos dados originais (endereços, cessão Tipo 2, instruções Tipo 3, NF-e Tipo 4) e substitui <strong>estritamente as 8 posições dos CEPs inconsistentes</strong> pelo CEP oficial consultado na Receita Federal via CNPJ.
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="oa-bitfin-success-card">
                      <CheckCircle2 size={24} color="#10b981" />
                      <div>
                        <h4>Endereços de Todos os Sacados Verificados</h4>
                        <p>Nenhum erro de CEP ou endereço pendente foi detectado nos sacados desta operação.</p>
                      </div>
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
                        <div className="oa-table-responsive">
                          <table className="oa-table modal-table">
                            <thead>
                              <tr>
                                <th>SACADO (DEVEDOR)</th>
                                <th>CNPJ / CPF</th>
                                <th style={{ textAlign: 'center' }}>CEP ATUAL</th>
                                <th>DIAGNÓSTICO DO ERRO</th>
                                <th>ENDEREÇO</th>
                                <th style={{ textAlign: 'center' }}>TÍTULOS</th>
                                <th style={{ textAlign: 'right' }}>VALOR RETIDO</th>
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
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#f43f5e' }}>
                                    R$ {s.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA 2: TODOS OS SACADOS */}
                  {detailTab === 'todos_sacados' && (
                    <div className="oa-tab-content">
                      <div className="oa-table-responsive">
                        <table className="oa-table modal-table">
                          <thead>
                            <tr>
                              <th>SACADO</th>
                              <th>CNPJ / CPF</th>
                              <th style={{ textAlign: 'center' }}>STATUS CEP</th>
                              <th>CEP CADASTRADO</th>
                              <th>ENDEREÇO</th>
                              <th style={{ textAlign: 'center' }}>TÍTULOS</th>
                              <th style={{ textAlign: 'right' }}>VALOR TOTAL</th>
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
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  R$ {s.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* ABA 3: TÍTULOS DA OPERAÇÃO */}
                  {detailTab === 'titulos' && (
                    <div className="oa-tab-content">
                      <div className="oa-table-responsive">
                        <table className="oa-table modal-table">
                          <thead>
                            <tr>
                              <th>ID / NÚMERO</th>
                              <th>SACADO</th>
                              <th>CNPJ/CPF SACADO</th>
                              <th>VENCIMENTO</th>
                              <th style={{ textAlign: 'right' }}>VALOR NOMINAL (R$)</th>
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
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                  R$ {t.valorNominal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="oa-status-badge badge-default">{t.situacao}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="oa-modal-footer">
              {operationDetail && operationDetail.sacadosInconsistentes.length > 0 && (
                <>
                  <button
                    type="button"
                    className="oa-btn secondary"
                    onClick={() => handleDownloadXlsx(operationDetail.operacaoId)}
                    disabled={downloadingXlsx}
                  >
                    <FileSpreadsheet size={16} />
                    {downloadingXlsx ? 'Exportando...' : 'Exportar Sacados (.xlsx)'}
                  </button>
                  <button
                    type="button"
                    className="oa-btn primary"
                    onClick={() => handleDownloadTitulosXlsx(operationDetail.operacaoId)}
                    disabled={downloadingTitulosXlsx}
                  >
                    <Download size={16} />
                    {downloadingTitulosXlsx ? 'Exportando...' : 'Exportar Sacado + Título (.xlsx)'}
                  </button>
                  <button
                    type="button"
                    className="oa-btn cnab"
                    onClick={() => handleDownloadCnab(operationDetail.operacaoId)}
                    disabled={downloadingCnab}
                    title="Baixar Remessa CNAB 400 Corrigida"
                  >
                    <FileCode size={16} />
                    {downloadingCnab ? 'Gerando Remessa...' : 'Gerar Remessa CNAB (.rem)'}
                  </button>
                  <button
                    type="button"
                    className="oa-btn upload"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingCnab}
                    title="Importar arquivo CNAB do cedente e corrigir pontualmente os CEPs com erro"
                  >
                    <Upload size={16} />
                    {uploadingCnab ? 'Processando CNAB...' : 'Importar CNAB e Corrigir (.txt / .rem)'}
                  </button>
                </>
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

      {/* ── MODAL DE RESULTADO DO UPLOAD DO CNAB ── */}
      {uploadResultModal && (
        <div className="oa-modal-overlay" style={{ zIndex: 1200 }} onClick={() => setUploadResultModal(null)}>
          <div className="oa-modal-content glass" style={{ maxWidth: '900px', maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
            <div className="oa-modal-header">
              <div className="oa-modal-title-group">
                <span className="oa-modal-badge" style={{ background: '#0284c7', color: '#fff' }}>CNAB PROCESSADO E AJUSTADO</span>
                <h2>Remessa CNAB Corrigida a Partir do Arquivo Cedente</h2>
              </div>
              <button className="oa-modal-close-btn" onClick={() => setUploadResultModal(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="oa-modal-body" style={{ padding: '20px' }}>
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', fontWeight: 700, marginBottom: '6px' }}>
                  <CheckCircle2 size={20} />
                  <span>Download Concluído: {uploadResultModal.filename}</span>
                </div>
                <p style={{ color: '#cbd5e1', fontSize: '13px', margin: 0 }}>
                  O arquivo foi lido linha a linha preservando 100% dos dados originais do cedente (endereços, cessão, instruções e NF-e). 
                  Foram verificados <strong>{uploadResultModal.totalTitulos} títulos</strong> ({uploadResultModal.totalLinhas} linhas).
                  Total de títulos com CEP substituído pelo oficial da Receita Federal: <strong>{uploadResultModal.totalCorrigidos}</strong>.
                </p>
              </div>

              {uploadResultModal.detalhesCorrecoes?.length > 0 && (
                <div>
                  <h4 style={{ color: '#f8fafc', fontSize: '14px', marginBottom: '10px' }}>
                    Relação de Sacados e CEPs Substituídos pelo Oficial do CNPJ ({uploadResultModal.detalhesCorrecoes.length} sacados):
                  </h4>
                  <div style={{ maxHeight: '380px', overflowY: 'auto', border: '1px solid #1e293b', borderRadius: '8px' }}>
                    <table className="oa-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>CNPJ</th>
                          <th>Razão Social</th>
                          <th>Endereço Original (Intacto)</th>
                          <th style={{ textAlign: 'center' }}>CEP Anterior</th>
                          <th style={{ textAlign: 'center' }}>Novo CEP Oficial</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResultModal.detalhesCorrecoes.map((item: any, idx: number) => (
                          <tr key={idx} className="oa-row">
                            <td><code>{item.doc}</code></td>
                            <td>{item.nome}</td>
                            <td>{item.endereco}</td>
                            <td style={{ textAlign: 'center', color: '#f87171' }}>{item.oldCep}</td>
                            <td style={{ textAlign: 'center', color: '#4ade80', fontWeight: 700 }}>{item.newCep}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="oa-modal-footer">
              <button
                type="button"
                className="oa-btn primary"
                onClick={() => setUploadResultModal(null)}
              >
                Concluir e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsAnalysis;

