import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  Building2,
  Calendar,
  Search,
  RotateCw,
  Upload,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Car,
  FilterX
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './AssociadosDashboard.css';

interface Associado {
  id: string;
  associado: string;
  cpf?: string;
  cnpj?: string;
  razao_social?: string;
  rg?: string;
  email?: string;
  email_corporativo?: string;
  telefone?: string;
  status: string;
  area_setor: string;
  cargo_funcao: string;
  data_nascimento?: string;
  data_inicio?: string;
  tempo_casa?: string;
  endereco?: string;
  contato_emergencia?: string;
  veiculo?: string;
  tipo_veiculo?: string;
  dependentes?: string;
  dependentes_nomes?: string;
  dependentes_datas_nascimento?: string;
  url_veiculos?: string;
  created_at?: string;
  updated_at?: string;
}

interface KPIs {
  totalAssociados: number;
  totalAtivos: number;
  totalInativos: number;
  taxaAtivos: number;
  mediaIdade: number;
  totalAreas: number;
  totalCargos: number;
  distribuicaoArea: { label: string; count: number; percentage: number }[];
  distribuicaoCargo: { label: string; count: number; percentage: number }[];
  distribuicaoNivelCargo: { label: string; count: number; percentage: number }[];
  distribuicaoStatus: { label: string; count: number; percentage: number }[];
}

interface FilterOptions {
  areas: string[];
  cargos: string[];
  status: string[];
}

const COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#34d399', '#fbbf24', '#f87171', '#38bdf8', '#a78bfa'];

export const AssociadosDashboard: React.FC = () => {
  const [associados, setAssociados] = useState<Associado[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ areas: [], cargos: [], status: [] });

  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedCargo, setSelectedCargo] = useState<string>('all');

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Modais
  const [detailModalItem, setDetailModalItem] = useState<Associado | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchFilters = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/associados/filters`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setFilterOptions(data);
      }
    } catch (err) {
      console.error('Erro ao carregar filtros:', err);
    }
  }, []);

  const fetchKpis = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedArea !== 'all') params.set('area', selectedArea);
      if (selectedCargo !== 'all') params.set('cargo', selectedCargo);

      const res = await fetch(`${API_BASE_URL}/api/associados/kpis?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setKpis(data);
      }
    } catch (err) {
      console.error('Erro ao carregar KPIs:', err);
    }
  }, [searchTerm, selectedStatus, selectedArea, selectedCargo]);

  const fetchAssociados = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '20'
      });
      if (searchTerm) params.set('search', searchTerm);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);
      if (selectedArea !== 'all') params.set('area', selectedArea);
      if (selectedCargo !== 'all') params.set('cargo', selectedCargo);

      const res = await fetch(`${API_BASE_URL}/api/associados?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const result = await res.json();
        setAssociados(result.data || []);
        setCurrentPage(result.page || 1);
        setTotalPages(result.totalPages || 1);
        setTotalRecords(result.total || 0);
      }
    } catch (err) {
      console.error('Erro ao carregar associados:', err);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedStatus, selectedArea, selectedCargo]);

  useEffect(() => {
    fetchFilters();
  }, [fetchFilters]);

  useEffect(() => {
    fetchKpis();
    fetchAssociados(1);
  }, [fetchKpis, fetchAssociados]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedStatus('all');
    setSelectedArea('all');
    setSelectedCargo('all');
  };

  const handleSyncData = async () => {
    try {
      setLoading(true);
      await fetch(`${API_BASE_URL}/api/associados/reload`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      await Promise.all([fetchFilters(), fetchKpis(), fetchAssociados(1)]);
    } catch (err) {
      console.error('Erro ao sincronizar base:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadFeedback(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/associados/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setUploadFeedback({ type: 'success', message: data.message || 'Planilha importada com sucesso!' });
        fetchFilters();
        fetchKpis();
        fetchAssociados(1);
      } else {
        setUploadFeedback({ type: 'error', message: data.error || 'Falha ao importar planilha.' });
      }
    } catch (err: any) {
      setUploadFeedback({ type: 'error', message: err.message || 'Erro de conexão com o servidor.' });
    } finally {
      setUploading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('ativ')) return 'assoc-badge success';
    if (s.includes('deslig') || s.includes('inativ')) return 'assoc-badge danger';
    if (s.includes('afast') || s.includes('licen')) return 'assoc-badge warning';
    return 'assoc-badge neutral';
  };

  return (
    <div className="assoc-container">
      {/* ── HEADER ── */}
      <header className="assoc-header">
        <div className="assoc-header-inner">
          <div className="assoc-brand">
            <div className="assoc-brand-icon">
              <Users size={26} />
            </div>
            <div>
              <h1 className="assoc-title">ASSOCIADOS</h1>
              <p className="assoc-subtitle">Painel Analítico e Gestão Corporativa da Base de Associados 2026</p>
            </div>
          </div>

          <div className="assoc-header-actions">
            <div className="assoc-status-pill">
              <span className="assoc-pulse-dot" />
              <span>{totalRecords} Associados no Banco de Dados</span>
            </div>

            <button
              className="assoc-btn assoc-btn-secondary"
              onClick={handleSyncData}
              title="Sincronizar dados do banco SQLite"
            >
              <RotateCw size={16} className={loading ? 'rotating' : ''} /> Sincronizar Banco
            </button>

            <button
              className="assoc-btn assoc-btn-primary"
              onClick={() => { setUploadFeedback(null); setUploadModalOpen(true); }}
            >
              <Upload size={16} /> Upload Planilha
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="assoc-main">
        {/* ── ROW 1: KPI CARDS ── */}
        <section className="assoc-kpi-grid">
          <div className="assoc-kpi-card">
            <div className="assoc-kpi-icon blue">
              <Users size={24} />
            </div>
            <div className="assoc-kpi-content">
              <span className="assoc-kpi-label">Total de Associados</span>
              <div className="assoc-kpi-val-row">
                <span className="assoc-kpi-val">{kpis?.totalAssociados ?? '--'}</span>
                <span className="assoc-badge neutral">Base Oficial</span>
              </div>
            </div>
          </div>

          <div className="assoc-kpi-card">
            <div className="assoc-kpi-icon emerald">
              <UserCheck size={24} />
            </div>
            <div className="assoc-kpi-content">
              <span className="assoc-kpi-label">Associados Ativos</span>
              <div className="assoc-kpi-val-row">
                <span className="assoc-kpi-val">{kpis?.totalAtivos ?? '--'}</span>
                <span className="assoc-badge success">{kpis?.taxaAtivos ?? '--'}% Ativos</span>
              </div>
            </div>
          </div>

          <div className="assoc-kpi-card">
            <div className="assoc-kpi-icon amber">
              <Calendar size={24} />
            </div>
            <div className="assoc-kpi-content">
              <span className="assoc-kpi-label">Média de Idade</span>
              <div className="assoc-kpi-val-row">
                <span className="assoc-kpi-val">{kpis?.mediaIdade ? `${kpis.mediaIdade} anos` : '--'}</span>
                <span className="assoc-badge warning">Equipe</span>
              </div>
            </div>
          </div>

          <div className="assoc-kpi-card">
            <div className="assoc-kpi-icon purple">
              <Building2 size={24} />
            </div>
            <div className="assoc-kpi-content">
              <span className="assoc-kpi-label">Áreas & Departamentos</span>
              <div className="assoc-kpi-val-row">
                <span className="assoc-kpi-val">{kpis?.totalAreas ?? '--'}</span>
                <span className="assoc-badge purple">Setores</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── ROW 2: SPLIT LAYOUT (LEFT: CHARTS | RIGHT: DATA TABLE) ── */}
        <section className="assoc-split">
          {/* LEFT CHARTS PANEL */}
          <div className="assoc-charts-panel">
            {/* Chart 1: Por Departamento */}
            <div className="assoc-chart-box">
              <div className="assoc-chart-header">
                <h3 className="assoc-chart-title">Associados por Departamento</h3>
                <span className="assoc-badge blue">Distribuição</span>
              </div>
              <div style={{ width: '100%', height: 240 }}>
                {kpis?.distribuicaoArea && kpis.distribuicaoArea.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={kpis.distribuicaoArea.slice(0, 6)}
                      layout="vertical"
                      margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        dataKey="label"
                        type="category"
                        width={110}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(val: any) => [`${val} associados`, 'Quantidade']}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#38bdf8', borderRadius: 8 }}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {kpis.distribuicaoArea.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                    Sem dados suficientes
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Por Nível de Cargo / Senioridade */}
            <div className="assoc-chart-box">
              <div className="assoc-chart-header">
                <h3 className="assoc-chart-title">Distribuição por Nível / Cargo (%)</h3>
                <span className="assoc-badge purple">Senioridade</span>
              </div>
              <div style={{ width: '100%', height: 240 }}>
                {kpis?.distribuicaoNivelCargo && kpis.distribuicaoNivelCargo.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={kpis.distribuicaoNivelCargo}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 15, bottom: 5 }}
                    >
                      <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis
                        dataKey="label"
                        type="category"
                        width={120}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(val: any) => [`${val}%`, 'Participação']}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#c084fc', borderRadius: 8 }}
                      />
                      <Bar dataKey="percentage" fill="#c084fc" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                    Sem dados suficientes
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT DATA TABLE PANEL */}
          <div className="assoc-table-panel">
            {/* Toolbar */}
            <div className="assoc-toolbar">
              <div className="assoc-search-box">
                <Search size={16} className="assoc-search-icon" />
                <input
                  type="text"
                  className="assoc-search-input"
                  placeholder="Buscar associado, cargo, área..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="assoc-filters-group">
                <select
                  className="assoc-select"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="all">Status: Todos</option>
                  {filterOptions.status.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>

                <select
                  className="assoc-select"
                  value={selectedArea}
                  onChange={(e) => setSelectedArea(e.target.value)}
                >
                  <option value="all">Área: Todas</option>
                  {filterOptions.areas.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>

                <select
                  className="assoc-select"
                  value={selectedCargo}
                  onChange={(e) => setSelectedCargo(e.target.value)}
                >
                  <option value="all">Cargo: Todos</option>
                  {filterOptions.cargos.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <button
                  className="assoc-btn assoc-btn-secondary"
                  onClick={handleResetFilters}
                  title="Limpar filtros"
                >
                  <FilterX size={15} />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="assoc-table-wrapper">
              <table className="assoc-table">
                <thead>
                  <tr>
                    <th>Associado</th>
                    <th>Status</th>
                    <th>Cargo / Função</th>
                    <th>Área / Setor</th>
                    <th>Admissão</th>
                    <th>Tempo de Casa</th>
                    <th>Veículo</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        Carregando associados...
                      </td>
                    </tr>
                  ) : associados.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
                            {totalRecords === 0
                              ? 'Nenhum associado encontrado no banco de dados SQLite.'
                              : 'Nenhum associado encontrado com os filtros selecionados.'}
                          </span>
                          {totalRecords === 0 && (
                            <button
                              type="button"
                              className="assoc-btn assoc-btn-primary"
                              onClick={handleSyncData}
                              style={{ padding: '8px 18px', fontSize: '0.85rem' }}
                            >
                              <RotateCw size={15} /> Sincronizar Base Oficial 2026 no Banco
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    associados.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="assoc-user-cell">
                            <div className="assoc-user-avatar">
                              {item.associado ? item.associado.slice(0, 2).toUpperCase() : 'AS'}
                            </div>
                            <div>
                              <div className="assoc-user-name">{item.associado}</div>
                              <div className="assoc-user-sub">{item.email_corporativo || item.email || item.cpf}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={getStatusBadgeClass(item.status)}>{item.status}</span>
                        </td>
                        <td>{item.cargo_funcao || '--'}</td>
                        <td>{item.area_setor || '--'}</td>
                        <td>{item.data_inicio || '--'}</td>
                        <td>{item.tempo_casa || '--'}</td>
                        <td>
                          {item.url_veiculos ? (
                            <a
                              href={item.url_veiculos}
                              target="_blank"
                              rel="noreferrer"
                              className="assoc-badge blue"
                              style={{ textDecoration: 'none' }}
                            >
                              <Car size={13} style={{ marginRight: 4 }} /> Ver Foto
                            </a>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{item.tipo_veiculo || 'Nenhum'}</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="assoc-action-btn"
                            onClick={() => setDetailModalItem(item)}
                          >
                            <Eye size={13} /> Detalhes
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="assoc-pagination">
              <div>
                Exibindo {associados.length} de {totalRecords} associados
              </div>
              <div className="assoc-page-controls">
                <button
                  className="assoc-page-btn"
                  disabled={currentPage <= 1}
                  onClick={() => fetchAssociados(currentPage - 1)}
                >
                  Anterior
                </button>
                <span style={{ alignSelf: 'center', margin: '0 6px', color: '#cbd5e1' }}>
                  Página {currentPage} de {totalPages || 1}
                </span>
                <button
                  className="assoc-page-btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => fetchAssociados(currentPage + 1)}
                >
                  Próxima
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── MODAL: DETALHES COMPLETOS DO ASSOCIADO ── */}
      {detailModalItem && (
        <div className="assoc-modal-overlay" onClick={() => setDetailModalItem(null)}>
          <div className="assoc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="assoc-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Users size={22} color="#38bdf8" />
                <h3 className="assoc-modal-title">{detailModalItem.associado}</h3>
              </div>
              <button className="assoc-modal-close" onClick={() => setDetailModalItem(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="assoc-modal-body">
              <div className="assoc-detail-top-badges">
                <span className={getStatusBadgeClass(detailModalItem.status)}>
                  {detailModalItem.status}
                </span>
                <span className="assoc-badge purple">
                  {detailModalItem.cargo_funcao}
                </span>
                <span className="assoc-badge blue">
                  {detailModalItem.area_setor}
                </span>
                {detailModalItem.tempo_casa && (
                  <span className="assoc-badge neutral">
                    Tempo: {detailModalItem.tempo_casa}
                  </span>
                )}
              </div>

              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Informações Pessoais & Contato
                </h4>
                <div className="assoc-detail-grid">
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">CPF</div>
                    <div className="assoc-detail-value">{detailModalItem.cpf || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">RG</div>
                    <div className="assoc-detail-value">{detailModalItem.rg || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Data de Nascimento</div>
                    <div className="assoc-detail-value">{detailModalItem.data_nascimento || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Telefone</div>
                    <div className="assoc-detail-value">{detailModalItem.telefone || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">E-mail Pessoal</div>
                    <div className="assoc-detail-value">{detailModalItem.email || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">E-mail Corporativo</div>
                    <div className="assoc-detail-value">{detailModalItem.email_corporativo || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Contato de Emergência</div>
                    <div className="assoc-detail-value">{detailModalItem.contato_emergencia || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item" style={{ gridColumn: 'span 2' }}>
                    <div className="assoc-detail-label">Endereço Residencial</div>
                    <div className="assoc-detail-value">{detailModalItem.endereco || 'Não informado'}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#c084fc', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dados Corporativos & PJ
                </h4>
                <div className="assoc-detail-grid">
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">CNPJ</div>
                    <div className="assoc-detail-value">{detailModalItem.cnpj || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Razão Social</div>
                    <div className="assoc-detail-value">{detailModalItem.razao_social || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Data de Início / Entrada</div>
                    <div className="assoc-detail-value">{detailModalItem.data_inicio || 'Não informado'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Tempo de Casa</div>
                    <div className="assoc-detail-value">{detailModalItem.tempo_casa || 'Não informado'}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Dependentes & Família
                </h4>
                <div className="assoc-detail-grid">
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Possui Dependentes?</div>
                    <div className="assoc-detail-value">{detailModalItem.dependentes || 'Não'}</div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Nomes dos Dependentes</div>
                    <div className="assoc-detail-value" style={{ whiteSpace: 'pre-line' }}>
                      {detailModalItem.dependentes_nomes || 'Nenhum'}
                    </div>
                  </div>
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Datas de Nascimento</div>
                    <div className="assoc-detail-value" style={{ whiteSpace: 'pre-line' }}>
                      {detailModalItem.dependentes_datas_nascimento || 'Nenhuma'}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Veículo & Estacionamento
                </h4>
                <div className="assoc-detail-grid">
                  <div className="assoc-detail-item">
                    <div className="assoc-detail-label">Tipo de Veículo</div>
                    <div className="assoc-detail-value">{detailModalItem.tipo_veiculo || 'Nenhum'}</div>
                  </div>
                  <div className="assoc-detail-item" style={{ gridColumn: 'span 2' }}>
                    <div className="assoc-detail-label">Identificação / Placa / Marca</div>
                    <div className="assoc-detail-value">{detailModalItem.veiculo || 'Não informado'}</div>
                  </div>
                </div>
                {detailModalItem.url_veiculos && (
                  <div className="assoc-vehicle-preview">
                    <img
                      src={detailModalItem.url_veiculos}
                      alt="Veículo"
                      className="assoc-vehicle-img"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: UPLOAD DE PLANILHA ── */}
      {uploadModalOpen && (
        <div className="assoc-modal-overlay" onClick={() => setUploadModalOpen(false)}>
          <div className="assoc-modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
            <div className="assoc-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileSpreadsheet size={22} color="#38bdf8" />
                <h3 className="assoc-modal-title">Atualizar Planilha de Associados</h3>
              </div>
              <button className="assoc-modal-close" onClick={() => setUploadModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="assoc-modal-body">
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#94a3b8' }}>
                Selecione o arquivo <strong>Controle - Associados - 2026.xlsx</strong>. O sistema processará automaticamente todas as colunas e atualizará a base de dados do SQLite.
              </p>

              <label className="assoc-dropzone">
                <Upload size={36} color="#38bdf8" style={{ marginBottom: 10 }} />
                <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>
                  {uploading ? 'Processando planilha...' : 'Clique para selecionar a planilha'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Suporta arquivos .xlsx ou .xls
                </div>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  disabled={uploading}
                />
              </label>

              {uploadFeedback && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 16px',
                    borderRadius: 10,
                    backgroundColor: uploadFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${uploadFeedback.type === 'success' ? '#10b981' : '#ef4444'}`,
                    color: uploadFeedback.type === 'success' ? '#34d399' : '#f87171',
                    fontSize: '0.85rem',
                    fontWeight: 600
                  }}
                >
                  {uploadFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{uploadFeedback.message}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssociadosDashboard;
