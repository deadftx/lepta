import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Search,
  Plus,
  Edit3,
  Trash2,
  X,
  Building2,
  ContactRound,
  FileText,
  DollarSign,
  Scale,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Save,
  Filter,
  RefreshCw,
  Briefcase,
  AlertCircle
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './NplManagement.css';

export interface NplRecord {
  id?: number;
  cedente: string;
  cedenteCnpj?: string;
  credoresDeInteresse?: string;
  creditoRj?: number;
  classe?: string;
  creditoExecucao?: number;
  extraconcursalNaoAjuizado?: number;
  vpl?: number;
  porcentagemDeQuorum?: number;
  valorConsiderado?: number;
  observacoes?: string;
  entrada?: string;
  processo?: string;
  estado?: string;
  indicacao?: string;
  contatoBancoFornecedor?: string;
  advDaEmpresa?: string;
  telefoneDoAdvogado?: string;
  telefoneDoDevedor?: string;
  advDoCredor?: string;
  administradorJudicial?: string;
  faseDoProcesso?: string;
  contatoDevedor?: string;
  propostaReal?: number;
  propostaParceiro?: number;
  valorDeSaidaCliente?: number;
  resultadoBruto?: number;
  imposto?: number;
  valorParceiro?: number;
  resultadoLiquido?: number;
  statusDaNegociacao?: string;
  dataRetorno?: string;
  gestor?: string;
  observacoes1?: string;
  hiperlink?: string;
  ramoDeAtividade?: string;
  socios?: string;
  garantia?: string;
  fluxoDePagamento?: string;
  valorFinalDaOperacao?: number;
  valorRetidoFidc?: number;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface NplClientSummary {
  cedente: string;
  cedenteCnpj: string;
  totalCasos: number;
  totalValorConsiderado: number;
  totalCreditoRj: number;
  totalCreditoExecucao: number;
  totalPropostaReal: number;
  totalPropostaParceiro: number;
  totalValorSaidaCliente: number;
  totalResultadoBruto: number;
  totalResultadoLiquido: number;
  totalValorFinalOperacao: number;
  totalValorRetidoFidc: number;
  gestores: string[];
  statusList: string[];
  estados: string[];
  credores: string[];
  observacoes: string;
  ultimaAtualizacao: string;
}

export interface NplKpiSummary {
  totalRegistros: number;
  totalCedentes: number;
  totalValorConsiderado: number;
  totalCreditoRj: number;
  totalCreditoExecucao: number;
  totalPropostaReal: number;
  totalResultadoLiquido: number;
  totalValorFinal: number;
  statusDistribuicao?: { status_da_negociacao: string; qtd: number }[];
}

const emptyRecord = (cedente: string = ''): NplRecord => ({
  cedente,
  cedenteCnpj: '',
  credoresDeInteresse: '',
  creditoRj: 0,
  classe: '',
  creditoExecucao: 0,
  extraconcursalNaoAjuizado: 0,
  vpl: 0,
  porcentagemDeQuorum: 0,
  valorConsiderado: 0,
  observacoes: '',
  entrada: '',
  processo: '',
  estado: '',
  indicacao: '',
  contatoBancoFornecedor: '',
  advDaEmpresa: '',
  telefoneDoAdvogado: '',
  telefoneDoDevedor: '',
  advDoCredor: '',
  administradorJudicial: '',
  faseDoProcesso: '',
  contatoDevedor: '',
  propostaReal: 0,
  propostaParceiro: 0,
  valorDeSaidaCliente: 0,
  resultadoBruto: 0,
  imposto: 0,
  valorParceiro: 0,
  resultadoLiquido: 0,
  statusDaNegociacao: 'Em Análise',
  dataRetorno: '',
  gestor: '',
  observacoes1: '',
  hiperlink: '',
  ramoDeAtividade: '',
  socios: '',
  garantia: '',
  fluxoDePagamento: '',
  valorFinalDaOperacao: 0,
  valorRetidoFidc: 0
});

const formatCurrency = (value?: number | null) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const NplManagement: React.FC = () => {
  const navigate = useNavigate();

  // Estados da lista principal
  const [clients, setClients] = useState<NplClientSummary[]>([]);
  const [kpis, setKpis] = useState<NplKpiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedGestor, setSelectedGestor] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('');

  // Popover adaptativo (ao clicar no cedente)
  const [popover, setPopover] = useState<{ visible: boolean; x: number; y: number; cedente: string } | null>(null);

  // Modal de Detalhes NPL do Cedente
  const [activeCedente, setActiveCedente] = useState<string | null>(null);
  const [cedenteRecords, setCedenteRecords] = useState<NplRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  // Modal de Edição / Criação de Registro NPL
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<NplRecord | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'valores' | 'processo' | 'negociacao' | 'garantias'>('valores');
  const [savingRecord, setSavingRecord] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Carrega dados principais
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams();
      if (searchTerm) queryParams.append('search', searchTerm);
      if (selectedStatus) queryParams.append('status', selectedStatus);
      if (selectedGestor) queryParams.append('gestor', selectedGestor);
      if (selectedEstado) queryParams.append('estado', selectedEstado);

      const [clientsRes, kpisRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/npl/clients?${queryParams.toString()}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/npl/kpis`, { headers: getAuthHeaders() })
      ]);

      if (!clientsRes.ok) throw new Error('Falha ao carregar clientes NPL');
      if (!kpisRes.ok) throw new Error('Falha ao carregar KPIs NPL');

      const clientsData = await clientsRes.json();
      const kpisData = await kpisRes.json();

      setClients(clientsData);
      setKpis(kpisData);
    } catch (err: any) {
      console.error('Erro ao buscar dados NPL:', err);
      setError(err.message || 'Erro ao carregar módulo NPL');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [searchTerm, selectedStatus, selectedGestor, selectedEstado]);

  // Carrega registros de um cedente específico
  const fetchCedenteRecords = async (cedente: string) => {
    setLoadingRecords(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/npl/client/${encodeURIComponent(cedente)}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Erro ao buscar operações do cedente.');
      const data = await res.json();
      setCedenteRecords(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingRecords(false);
    }
  };

  // Fecha popover ao clicar fora
  useEffect(() => {
    const handleOutsideClick = () => {
      if (popover && popover.visible) {
        setPopover(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [popover]);

  // Handler do clique na linha do Cedente para abrir o Popover Adaptativo
  const handleCedenteClick = (e: React.MouseEvent, cedente: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const popWidth = 300;
    const popHeight = 180;
    
    let popX = rect.left;
    let popY = rect.bottom + 8;

    if (popX + popWidth > window.innerWidth - 16) {
      popX = window.innerWidth - popWidth - 16;
    }
    if (popY + popHeight > window.innerHeight - 16) {
      popY = rect.top - popHeight - 8;
    }

    setPopover({
      visible: true,
      x: Math.max(16, popX),
      y: Math.max(16, popY),
      cedente
    });
  };

  // Abre a tela detalhada de NPL do Cedente
  const handleOpenNplDetails = (cedente: string) => {
    setPopover(null);
    setActiveCedente(cedente);
    fetchCedenteRecords(cedente);
  };

  // Abre formulário para novo registro
  const handleAddNewRecord = () => {
    setCurrentRecord(emptyRecord(activeCedente || ''));
    setActiveFormTab('valores');
    setFormFeedback(null);
    setIsEditingModalOpen(true);
  };

  // Abre formulário para editar registro existente
  const handleEditRecord = (rec: NplRecord) => {
    setCurrentRecord({ ...rec });
    setActiveFormTab('valores');
    setFormFeedback(null);
    setIsEditingModalOpen(true);
  };

  // Salva registro NPL
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRecord || !currentRecord.cedente.trim()) {
      setFormFeedback({ type: 'error', message: 'O nome do cedente é obrigatório.' });
      return;
    }

    setSavingRecord(true);
    setFormFeedback(null);

    try {
      const isNew = !currentRecord.id;
      const url = isNew
        ? `${API_BASE_URL}/api/npl/record`
        : `${API_BASE_URL}/api/npl/record/${currentRecord.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method,
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(currentRecord)
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Erro ao salvar operação NPL.');
      }

      setFormFeedback({ type: 'success', message: 'Operação NPL salva com sucesso!' });
      
      // Atualiza lista do cedente e lista geral
      if (activeCedente) {
        await fetchCedenteRecords(activeCedente);
      }
      await fetchData();

      setTimeout(() => {
        setIsEditingModalOpen(false);
        setFormFeedback(null);
      }, 1000);
    } catch (err: any) {
      setFormFeedback({ type: 'error', message: err.message || 'Não foi possível salvar.' });
    } finally {
      setSavingRecord(false);
    }
  };

  // Remove registro NPL
  const handleDeleteRecord = async (id: number) => {
    if (!window.confirm('Tem certeza que deseja excluir esta operação de NPL?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/npl/record/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Erro ao excluir registro.');
      if (activeCedente) {
        fetchCedenteRecords(activeCedente);
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir');
    }
  };

  // Helper para atualizar campos do formulário
  const updateCurrentField = (field: keyof NplRecord, value: any) => {
    setCurrentRecord(prev => (prev ? { ...prev, [field]: value } : null));
  };

  // Lista de gestores e status únicos para filtros
  const availableGestores = useMemo(() => {
    const set = new Set<string>();
    clients.forEach(c => c.gestores.forEach(g => set.add(g)));
    return Array.from(set).sort();
  }, [clients]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    clients.forEach(c => c.statusList.forEach(s => set.add(s)));
    return Array.from(set).sort();
  }, [clients]);

  const availableEstados = useMemo(() => {
    const set = new Set<string>();
    clients.forEach(c => c.estados.forEach(e => set.add(e)));
    return Array.from(set).sort();
  }, [clients]);

  // Totais calculados para o cedente ativo
  const activeCedenteTotals = useMemo(() => {
    return cedenteRecords.reduce(
      (acc, r) => ({
        totalConsiderado: acc.totalConsiderado + (r.valorConsiderado || 0),
        totalCreditoRj: acc.totalCreditoRj + (r.creditoRj || 0),
        totalPropostaReal: acc.totalPropostaReal + (r.propostaReal || 0),
        totalResultadoLiquido: acc.totalResultadoLiquido + (r.resultadoLiquido || 0)
      }),
      { totalConsiderado: 0, totalCreditoRj: 0, totalPropostaReal: 0, totalResultadoLiquido: 0 }
    );
  }, [cedenteRecords]);

  return (
    <div className="npl-management-page">
      {/* Header com Ações Rápidas */}
      <header className="npl-header internal-card glass">
        <div className="npl-header-title">
          <div className="npl-header-icon">
            <TrendingUp size={28} />
          </div>
          <div>
            <h2>Gestão de NPL</h2>
            <p>Acompanhamento de carteira NPL, créditos de recuperação judicial, execuções e propostas.</p>
          </div>
        </div>
        <div className="npl-header-actions">
          <button className="npl-btn-secondary" onClick={fetchData} title="Atualizar dados">
            <RefreshCw size={17} className={loading ? 'spin' : ''} /> Atualizar
          </button>
          <button
            className="npl-btn-primary"
            onClick={() => {
              setActiveCedente('');
              handleAddNewRecord();
            }}
          >
            <Plus size={18} /> Nova Operação NPL
          </button>
        </div>
      </header>

      {/* Grid de KPIs Globais */}
      <section className="npl-kpi-grid">
        <div className="npl-kpi-card glass">
          <div className="kpi-icon blue">
            <Building2 size={22} />
          </div>
          <div className="kpi-body">
            <span>Cedentes em NPL</span>
            <strong>{loading ? '...' : kpis?.totalCedentes || clients.length}</strong>
            <small>{kpis?.totalRegistros || 0} operações registradas</small>
          </div>
        </div>

        <div className="npl-kpi-card glass">
          <div className="kpi-icon emerald">
            <DollarSign size={22} />
          </div>
          <div className="kpi-body">
            <span>Valor Considerado (Face)</span>
            <strong style={{ color: '#10b981' }}>{loading ? '...' : formatCurrency(kpis?.totalValorConsiderado)}</strong>
            <small>Total em carteira NPL</small>
          </div>
        </div>

        <div className="npl-kpi-card glass">
          <div className="kpi-icon purple">
            <Scale size={22} />
          </div>
          <div className="kpi-body">
            <span>Crédito RJ Total</span>
            <strong style={{ color: '#a855f7' }}>{loading ? '...' : formatCurrency(kpis?.totalCreditoRj)}</strong>
            <small>Créditos em recuperação judicial</small>
          </div>
        </div>

        <div className="npl-kpi-card glass">
          <div className="kpi-icon amber">
            <CheckCircle2 size={22} />
          </div>
          <div className="kpi-body">
            <span>Resultado Líquido</span>
            <strong style={{ color: '#f59e0b' }}>{loading ? '...' : formatCurrency(kpis?.totalResultadoLiquido)}</strong>
            <small>Projeção acumulada</small>
          </div>
        </div>
      </section>

      {/* Barra de Filtros */}
      <section className="npl-filters-bar internal-card glass">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Buscar por cedente, credor, processo, advogado ou gestor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button type="button" className="clear-search" onClick={() => setSearchTerm('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filters-group">
          <div className="filter-select-wrapper">
            <Filter size={15} />
            <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)}>
              <option value="">Todos os Status</option>
              {availableStatuses.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="filter-select-wrapper">
            <Briefcase size={15} />
            <select value={selectedGestor} onChange={e => setSelectedGestor(e.target.value)}>
              <option value="">Todos os Gestores</option>
              {availableGestores.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          {availableEstados.length > 0 && (
            <div className="filter-select-wrapper">
              <select value={selectedEstado} onChange={e => setSelectedEstado(e.target.value)}>
                <option value="">Todos os Estados</option>
                {availableEstados.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Tabela de Clientes NPL */}
      <section className="npl-table-container internal-card glass">
        {loading ? (
          <div className="npl-state-message">
            <RefreshCw size={36} className="spin" />
            <p>Carregando carteira de NPL...</p>
          </div>
        ) : error ? (
          <div className="npl-state-message error">
            <AlertCircle size={36} />
            <p>{error}</p>
          </div>
        ) : clients.length === 0 ? (
          <div className="npl-state-message">
            <FileText size={40} style={{ opacity: 0.3 }} />
            <p>Nenhum cedente de NPL encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <table className="npl-table">
            <thead>
              <tr>
                <th>Cedente / Cliente</th>
                <th>Casos</th>
                <th>Valor Considerado</th>
                <th>Crédito RJ</th>
                <th>Resultado Líquido</th>
                <th>Gestor Responsável</th>
                <th>Status da Negociação</th>
                <th>Observações</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.cedente}>
                  <td
                    className="cedente-cell clickable"
                    onClick={e => handleCedenteClick(e, client.cedente)}
                    title="Clique para ver opções do cedente"
                  >
                    <strong>{client.cedente}</strong>
                    {client.cedenteCnpj && <small>{client.cedenteCnpj}</small>}
                  </td>
                  <td>
                    <span className="badge-cases">{client.totalCasos}</span>
                  </td>
                  <td className="value-cell" style={{ fontWeight: 600, color: '#10b981' }}>
                    {formatCurrency(client.totalValorConsiderado)}
                  </td>
                  <td className="value-cell" style={{ color: '#a855f7' }}>
                    {formatCurrency(client.totalCreditoRj)}
                  </td>
                  <td className="value-cell" style={{ color: '#f59e0b' }}>
                    {formatCurrency(client.totalResultadoLiquido)}
                  </td>
                  <td>
                    {client.gestores.length > 0 ? (
                      <span className="gestor-tag">{client.gestores.join(', ')}</span>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                  <td>
                    {client.statusList.length > 0 ? (
                      <span className="status-pill">{client.statusList[0]}</span>
                    ) : (
                      <span className="status-pill">Em Análise</span>
                    )}
                  </td>
                  <td className="obs-cell" title={client.observacoes}>
                    {client.observacoes || <span className="muted">-</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="npl-action-btn"
                      onClick={() => handleOpenNplDetails(client.cedente)}
                      title="Ver Operações NPL"
                    >
                      <TrendingUp size={16} /> Operações
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Popover Adaptativo ao Clicar no Cedente */}
      {popover && popover.visible && createPortal(
        <div
          className="npl-popover glass"
          role="dialog"
          style={{
            position: 'fixed',
            top: popover.y,
            left: popover.x,
            zIndex: 1000,
            animation: 'fadeIn 0.15s ease-out'
          }}
          onClick={e => e.stopPropagation()}
        >
          <button className="popover-close-btn" onClick={() => setPopover(null)}>
            <X size={16} />
          </button>
          <div className="popover-header-title">
            Cedente: <strong>{popover.cedente}</strong>
          </div>
          <div className="popover-actions">
            <button
              className="popover-btn client-info-btn"
              onClick={() => {
                const ced = popover.cedente;
                setPopover(null);
                navigate(`/intelligence/cadastro-clientes?search=${encodeURIComponent(ced)}`);
              }}
            >
              <ContactRound size={17} /> Informações do Cedente
            </button>
            <button
              className="popover-btn npl-info-btn"
              onClick={() => handleOpenNplDetails(popover.cedente)}
            >
              <TrendingUp size={17} /> Informações NPL
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Completo de Gestão de NPL do Cedente */}
      {activeCedente && (
        <div className="npl-modal-backdrop" onClick={() => setActiveCedente(null)}>
          <div className="npl-modal-container glass" onClick={e => e.stopPropagation()}>
            <header className="npl-modal-header">
              <div>
                <span className="modal-tag">Painel NPL</span>
                <h2>{activeCedente}</h2>
              </div>
              <div className="modal-header-right">
                <button
                  className="npl-btn-primary"
                  onClick={() => handleAddNewRecord()}
                >
                  <Plus size={17} /> Adicionar Operação NPL
                </button>
                <button
                  className="modal-close-icon-btn"
                  onClick={() => setActiveCedente(null)}
                  aria-label="Fechar modal"
                >
                  <X size={22} />
                </button>
              </div>
            </header>

            {/* Resumo Acumulado do Cedente */}
            <div className="cedente-totals-bar">
              <div className="total-item">
                <span>Total Considerado:</span>
                <strong>{formatCurrency(activeCedenteTotals.totalConsiderado)}</strong>
              </div>
              <div className="total-item">
                <span>Total Crédito RJ:</span>
                <strong style={{ color: '#a855f7' }}>{formatCurrency(activeCedenteTotals.totalCreditoRj)}</strong>
              </div>
              <div className="total-item">
                <span>Proposta (Real):</span>
                <strong style={{ color: '#3b82f6' }}>{formatCurrency(activeCedenteTotals.totalPropostaReal)}</strong>
              </div>
              <div className="total-item">
                <span>Resultado Líquido:</span>
                <strong style={{ color: '#f59e0b' }}>{formatCurrency(activeCedenteTotals.totalResultadoLiquido)}</strong>
              </div>
            </div>

            {/* Listagem de Operações do Cedente */}
            <div className="cedente-records-list">
              {loadingRecords ? (
                <div className="records-loading">
                  <RefreshCw size={28} className="spin" /> Carregando operações...
                </div>
              ) : cedenteRecords.length === 0 ? (
                <div className="records-empty">
                  <p>Nenhuma operação NPL cadastrada para este cedente.</p>
                  <button className="npl-btn-primary" onClick={handleAddNewRecord}>
                    <Plus size={16} /> Cadastrar Primeira Operação
                  </button>
                </div>
              ) : (
                <div className="records-grid">
                  {cedenteRecords.map((rec, index) => (
                    <article key={rec.id || index} className="npl-record-card glass">
                      <div className="record-card-header">
                        <div>
                          <span className="record-index">#{index + 1}</span>
                          <h4>{rec.credoresDeInteresse || 'Credor não informado'}</h4>
                        </div>
                        <span className="status-pill">{rec.statusDaNegociacao || 'Em Análise'}</span>
                      </div>

                      <div className="record-card-body">
                        <div className="record-field">
                          <span>Processo:</span>
                          <strong>{rec.processo || '-'} ({rec.estado || 'BR'})</strong>
                        </div>
                        <div className="record-field">
                          <span>Classe:</span>
                          <strong>{rec.classe || '-'}</strong>
                        </div>
                        <div className="record-field">
                          <span>Valor Considerado:</span>
                          <strong className="text-emerald">{formatCurrency(rec.valorConsiderado)}</strong>
                        </div>
                        <div className="record-field">
                          <span>Crédito RJ:</span>
                          <strong>{formatCurrency(rec.creditoRj)}</strong>
                        </div>
                        <div className="record-field">
                          <span>Proposta Real:</span>
                          <strong>{formatCurrency(rec.propostaReal)}</strong>
                        </div>
                        <div className="record-field">
                          <span>Resultado Líquido:</span>
                          <strong className="text-amber">{formatCurrency(rec.resultadoLiquido)}</strong>
                        </div>
                        {rec.gestor && (
                          <div className="record-field">
                            <span>Gestor:</span>
                            <strong>{rec.gestor}</strong>
                          </div>
                        )}
                        {rec.advDaEmpresa && (
                          <div className="record-field">
                            <span>Adv. Empresa:</span>
                            <strong>{rec.advDaEmpresa}</strong>
                          </div>
                        )}
                        {rec.observacoes && (
                          <div className="record-field wide">
                            <span>Observações:</span>
                            <p>{rec.observacoes}</p>
                          </div>
                        )}
                      </div>

                      <div className="record-card-actions">
                        {rec.hiperlink && (
                          <a
                            href={rec.hiperlink.startsWith('http') ? rec.hiperlink : `https://${rec.hiperlink}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="record-link-btn"
                          >
                            <ExternalLink size={15} /> Documento / Link
                          </a>
                        )}
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="record-action-btn edit"
                            onClick={() => handleEditRecord(rec)}
                            title="Editar operação"
                          >
                            <Edit3 size={15} /> Editar
                          </button>
                          <button
                            className="record-action-btn delete"
                            onClick={() => rec.id && handleDeleteRecord(rec.id)}
                            title="Excluir operação"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Formulário Completo (39 Campos em 4 Abas) */}
      {isEditingModalOpen && currentRecord && (
        <div className="npl-modal-backdrop" onClick={() => setIsEditingModalOpen(false)}>
          <div className="npl-form-modal glass" onClick={e => e.stopPropagation()}>
            <header className="form-modal-header">
              <div>
                <span className="modal-tag">{currentRecord.id ? 'Edição' : 'Novo Cadastro'}</span>
                <h3>{currentRecord.id ? `Editar Operação #${currentRecord.id}` : 'Nova Operação NPL'}</h3>
              </div>
              <button
                className="modal-close-icon-btn"
                onClick={() => setIsEditingModalOpen(false)}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </header>

            {/* Abas do Formulário */}
            <nav className="form-tabs-nav">
              <button
                type="button"
                className={`form-tab-btn ${activeFormTab === 'valores' ? 'active' : ''}`}
                onClick={() => setActiveFormTab('valores')}
              >
                <DollarSign size={16} /> 1. Créditos & Valores
              </button>
              <button
                type="button"
                className={`form-tab-btn ${activeFormTab === 'processo' ? 'active' : ''}`}
                onClick={() => setActiveFormTab('processo')}
              >
                <Scale size={16} /> 2. Processo & Contatos
              </button>
              <button
                type="button"
                className={`form-tab-btn ${activeFormTab === 'negociacao' ? 'active' : ''}`}
                onClick={() => setActiveFormTab('negociacao')}
              >
                <TrendingUp size={16} /> 3. Proposta & Resultados
              </button>
              <button
                type="button"
                className={`form-tab-btn ${activeFormTab === 'garantias' ? 'active' : ''}`}
                onClick={() => setActiveFormTab('garantias')}
              >
                <ShieldAlert size={16} /> 4. Garantias & Estruturação
              </button>
            </nav>

            <form onSubmit={handleSaveRecord} className="npl-record-form">
              {/* ABA 1: CRÉDITOS E VALORES */}
              {activeFormTab === 'valores' && (
                <div className="form-tab-content">
                  <div className="form-grid">
                    <div className="form-field wide">
                      <label>Cedente / Cliente *</label>
                      <input
                        type="text"
                        value={currentRecord.cedente}
                        onChange={e => updateCurrentField('cedente', e.target.value)}
                        placeholder="Nome completo do cedente ou empresa"
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label>CNPJ do Cedente</label>
                      <input
                        type="text"
                        value={currentRecord.cedenteCnpj || ''}
                        onChange={e => updateCurrentField('cedenteCnpj', e.target.value)}
                        placeholder="00.000.000/0001-00"
                      />
                    </div>
                    <div className="form-field wide">
                      <label>Credores de Interesse</label>
                      <input
                        type="text"
                        value={currentRecord.credoresDeInteresse || ''}
                        onChange={e => updateCurrentField('credoresDeInteresse', e.target.value)}
                        placeholder="Ex: Banco Itaú, Bradesco, Santander..."
                      />
                    </div>
                    <div className="form-field">
                      <label>Crédito RJ (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.creditoRj ?? ''}
                        onChange={e => updateCurrentField('creditoRj', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>Classe</label>
                      <input
                        type="text"
                        value={currentRecord.classe || ''}
                        onChange={e => updateCurrentField('classe', e.target.value)}
                        placeholder="Ex: I - Trabalhista, II - Garantia Real, III - Quirografário"
                      />
                    </div>
                    <div className="form-field">
                      <label>Crédito Execução (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.creditoExecucao ?? ''}
                        onChange={e => updateCurrentField('creditoExecucao', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>Extraconcursal Não Ajuizado (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.extraconcursalNaoAjuizado ?? ''}
                        onChange={e => updateCurrentField('extraconcursalNaoAjuizado', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>VPL (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.vpl ?? ''}
                        onChange={e => updateCurrentField('vpl', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>% de Quórum</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.porcentagemDeQuorum ?? ''}
                        onChange={e => updateCurrentField('porcentagemDeQuorum', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="form-field highlight">
                      <label>Valor Considerado (R$) *</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.valorConsiderado ?? ''}
                        onChange={e => updateCurrentField('valorConsiderado', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 2: PROCESSO E CONTATOS */}
              {activeFormTab === 'processo' && (
                <div className="form-tab-content">
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Número do Processo</label>
                      <input
                        type="text"
                        value={currentRecord.processo || ''}
                        onChange={e => updateCurrentField('processo', e.target.value)}
                        placeholder="0000000-00.0000.8.00.0000"
                      />
                    </div>
                    <div className="form-field">
                      <label>Estado (UF)</label>
                      <input
                        type="text"
                        maxLength={2}
                        value={currentRecord.estado || ''}
                        onChange={e => updateCurrentField('estado', e.target.value.toUpperCase())}
                        placeholder="SP, RJ, MG..."
                      />
                    </div>
                    <div className="form-field">
                      <label>Fase do Processo</label>
                      <input
                        type="text"
                        value={currentRecord.faseDoProcesso || ''}
                        onChange={e => updateCurrentField('faseDoProcesso', e.target.value)}
                        placeholder="Ex: Habilitação, Assembleia, Cumprimento..."
                      />
                    </div>
                    <div className="form-field">
                      <label>Data de Entrada</label>
                      <input
                        type="text"
                        value={currentRecord.entrada || ''}
                        onChange={e => updateCurrentField('entrada', e.target.value)}
                        placeholder="DD/MM/AAAA ou YYYY-MM-DD"
                      />
                    </div>
                    <div className="form-field">
                      <label>Indicação</label>
                      <input
                        type="text"
                        value={currentRecord.indicacao || ''}
                        onChange={e => updateCurrentField('indicacao', e.target.value)}
                        placeholder="Quem indicou a operação"
                      />
                    </div>
                    <div className="form-field">
                      <label>Administrador Judicial (AJ)</label>
                      <input
                        type="text"
                        value={currentRecord.administradorJudicial || ''}
                        onChange={e => updateCurrentField('administradorJudicial', e.target.value)}
                        placeholder="Nome do Administrador Judicial"
                      />
                    </div>
                    <div className="form-field">
                      <label>Advogado da Empresa</label>
                      <input
                        type="text"
                        value={currentRecord.advDaEmpresa || ''}
                        onChange={e => updateCurrentField('advDaEmpresa', e.target.value)}
                        placeholder="Nome do advogado da empresa"
                      />
                    </div>
                    <div className="form-field">
                      <label>Telefone do Advogado</label>
                      <input
                        type="text"
                        value={currentRecord.telefoneDoAdvogado || ''}
                        onChange={e => updateCurrentField('telefoneDoAdvogado', e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="form-field">
                      <label>Advogado do Credor</label>
                      <input
                        type="text"
                        value={currentRecord.advDoCredor || ''}
                        onChange={e => updateCurrentField('advDoCredor', e.target.value)}
                        placeholder="Nome do advogado do credor"
                      />
                    </div>
                    <div className="form-field">
                      <label>Telefone do Devedor</label>
                      <input
                        type="text"
                        value={currentRecord.telefoneDoDevedor || ''}
                        onChange={e => updateCurrentField('telefoneDoDevedor', e.target.value)}
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div className="form-field">
                      <label>Contato Devedor</label>
                      <input
                        type="text"
                        value={currentRecord.contatoDevedor || ''}
                        onChange={e => updateCurrentField('contatoDevedor', e.target.value)}
                        placeholder="Nome / cargo do contato no devedor"
                      />
                    </div>
                    <div className="form-field">
                      <label>Contato Banco / Fornecedor</label>
                      <input
                        type="text"
                        value={currentRecord.contatoBancoFornecedor || ''}
                        onChange={e => updateCurrentField('contatoBancoFornecedor', e.target.value)}
                        placeholder="Contato no banco ou fornecedor"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 3: PROPOSTA E RESULTADOS */}
              {activeFormTab === 'negociacao' && (
                <div className="form-tab-content">
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Status da Negociação</label>
                      <select
                        value={currentRecord.statusDaNegociacao || 'Em Análise'}
                        onChange={e => updateCurrentField('statusDaNegociacao', e.target.value)}
                      >
                        <option value="Em Análise">Em Análise</option>
                        <option value="Proposta Enviada">Proposta Enviada</option>
                        <option value="Em Negociação">Em Negociação</option>
                        <option value="ACP Curto Prazo">ACP Curto Prazo</option>
                        <option value="ACP Longo Prazo">ACP Longo Prazo</option>
                        <option value="Proposta Firme">Proposta Firme</option>
                        <option value="Casos Fechados">Casos Fechados</option>
                        <option value="Casos Declinados">Casos Declinados</option>
                        <option value="Entrar em Contato">Entrar em Contato</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Gestor Responsável</label>
                      <input
                        type="text"
                        value={currentRecord.gestor || ''}
                        onChange={e => updateCurrentField('gestor', e.target.value)}
                        placeholder="Nome do gestor da conta"
                      />
                    </div>
                    <div className="form-field">
                      <label>Data de Retorno</label>
                      <input
                        type="text"
                        value={currentRecord.dataRetorno || ''}
                        onChange={e => updateCurrentField('dataRetorno', e.target.value)}
                        placeholder="DD/MM/AAAA"
                      />
                    </div>
                    <div className="form-field">
                      <label>Proposta Real (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.propostaReal ?? ''}
                        onChange={e => updateCurrentField('propostaReal', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>Proposta Parceiro (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.propostaParceiro ?? ''}
                        onChange={e => updateCurrentField('propostaParceiro', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>Valor de Saída (Cliente) (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.valorDeSaidaCliente ?? ''}
                        onChange={e => updateCurrentField('valorDeSaidaCliente', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>Resultado Bruto (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.resultadoBruto ?? ''}
                        onChange={e => updateCurrentField('resultadoBruto', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>Imposto (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.imposto ?? ''}
                        onChange={e => updateCurrentField('imposto', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>Valor Parceiro (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.valorParceiro ?? ''}
                        onChange={e => updateCurrentField('valorParceiro', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field highlight">
                      <label>Resultado Líquido (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.resultadoLiquido ?? ''}
                        onChange={e => updateCurrentField('resultadoLiquido', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 4: GARANTIAS E ESTRUTURAÇÃO */}
              {activeFormTab === 'garantias' && (
                <div className="form-tab-content">
                  <div className="form-grid">
                    <div className="form-field">
                      <label>Ramo de Atividade</label>
                      <input
                        type="text"
                        value={currentRecord.ramoDeAtividade || ''}
                        onChange={e => updateCurrentField('ramoDeAtividade', e.target.value)}
                        placeholder="Ex: Agronegócio, Metalurgia, Construção..."
                      />
                    </div>
                    <div className="form-field">
                      <label>Sócios</label>
                      <input
                        type="text"
                        value={currentRecord.socios || ''}
                        onChange={e => updateCurrentField('socios', e.target.value)}
                        placeholder="Nome dos sócios / avalistas"
                      />
                    </div>
                    <div className="form-field wide">
                      <label>Garantia</label>
                      <input
                        type="text"
                        value={currentRecord.garantia || ''}
                        onChange={e => updateCurrentField('garantia', e.target.value)}
                        placeholder="Imóveis, recebíveis, cessão fiduciária..."
                      />
                    </div>
                    <div className="form-field wide">
                      <label>Fluxo de Pagamento</label>
                      <input
                        type="text"
                        value={currentRecord.fluxoDePagamento || ''}
                        onChange={e => updateCurrentField('fluxoDePagamento', e.target.value)}
                        placeholder="Condições e fluxo acordado"
                      />
                    </div>
                    <div className="form-field">
                      <label>Valor Final da Operação (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.valorFinalDaOperacao ?? ''}
                        onChange={e => updateCurrentField('valorFinalDaOperacao', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field">
                      <label>Valor Retido FIDC (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentRecord.valorRetidoFidc ?? ''}
                        onChange={e => updateCurrentField('valorRetidoFidc', parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="form-field wide">
                      <label>Hiperlink (Documento / Pasta na Nuvem)</label>
                      <input
                        type="url"
                        value={currentRecord.hiperlink || ''}
                        onChange={e => updateCurrentField('hiperlink', e.target.value)}
                        placeholder="https://drive.google.com/..."
                      />
                    </div>
                    <div className="form-field wide">
                      <label>Observações Principais</label>
                      <textarea
                        rows={3}
                        value={currentRecord.observacoes || ''}
                        onChange={e => updateCurrentField('observacoes', e.target.value)}
                        placeholder="Comentários e anotações sobre a operação..."
                      />
                    </div>
                    <div className="form-field wide">
                      <label>Observações Adicionais (Observações.1)</label>
                      <textarea
                        rows={2}
                        value={currentRecord.observacoes1 || ''}
                        onChange={e => updateCurrentField('observacoes1', e.target.value)}
                        placeholder="Outras anotações e histórico complementar..."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback de erro/sucesso */}
              {formFeedback && (
                <div className={`form-feedback ${formFeedback.type}`}>
                  {formFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{formFeedback.message}</span>
                </div>
              )}

              {/* Ações do Rodapé do Formulário */}
              <footer className="form-modal-footer">
                <button
                  type="button"
                  className="npl-btn-secondary"
                  onClick={() => setIsEditingModalOpen(false)}
                  disabled={savingRecord}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="npl-btn-primary"
                  disabled={savingRecord}
                >
                  <Save size={18} /> {savingRecord ? 'Salvando...' : 'Salvar Operação'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NplManagement;
