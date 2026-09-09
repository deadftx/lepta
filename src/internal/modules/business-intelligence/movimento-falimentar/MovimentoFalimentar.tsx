import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Scale,
  Search,
  RefreshCw,
  Download,
  ClipboardPaste,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  X,
  ShieldAlert,
  Flame,
  FileText
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './MovimentoFalimentar.css';

interface MovimentoItem {
  id?: string | number;
  processo: string;
  tribunal?: string;
  tribunalNome?: string;
  classe: string;
  empresa: string;
  cnpj: string;
  endereco?: string;
  administradorJudicial?: string;
  varaComarca?: string;
  dataAjuizamento?: string;
  dataCaptura?: string;
  fonte: string;
  raw?: {
    originalText?: string;
    articleUrl?: string;
    observacao?: string;
  };
}

interface ValorHojeResponse {
  title: string;
  url: string;
  date: string;
  items: MovimentoItem[];
  rawText?: string;
}

interface PortfolioMatch {
  event: MovimentoItem;
  client: {
    empresa?: string;
    nome?: string;
    cnpj?: string;
    origem?: string;
  };
}

export const MovimentoFalimentar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'valor' | 'datajud' | 'carteira'>('valor');
  const [daysPeriod, setDaysPeriod] = useState<number>(7);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Estados de dados
  const [valorData, setValorData] = useState<ValorHojeResponse | null>(null);
  const [datajudItems, setDatajudItems] = useState<MovimentoItem[]>([]);
  const [portfolioMatches, setPortfolioMatches] = useState<PortfolioMatch[]>([]);
  const [totalTrackedClients, setTotalTrackedClients] = useState<number>(0);

  // Estados de carregamento e feedback
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal Colar Matéria
  const [importModalOpen, setImportModalOpen] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [importDate, setImportDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [importing, setImporting] = useState<boolean>(false);

  // Carrega dados do Valor Econômico
  const fetchValorHoje = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/movimento-falimentar/valor-hoje`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Falha ao carregar dados do Valor Econômico');
      const data: ValorHojeResponse = await res.json();
      setValorData(data);
    } catch (err: any) {
      console.error('Erro ao buscar Valor Hoje:', err);
    }
  }, []);

  // Carrega dados do DataJud
  const fetchDatajud = useCallback(async (days: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/movimento-falimentar/report?days=${days}`, {
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error('Falha ao consultar DataJud');
      const data = await res.json();
      setDatajudItems(Array.isArray(data.items) ? data.items : []);
    } catch (err: any) {
      console.error('Erro ao consultar DataJud:', err);
    }
  }, []);

  // Carrega cruzamento de carteira
  const fetchMatches = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/movimento-falimentar/matches-lepta`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setPortfolioMatches(Array.isArray(data.matches) ? data.matches : []);
        setTotalTrackedClients(data.totalClientsTracked || 0);
      }
    } catch (err: any) {
      console.error('Erro ao cruzar carteira:', err);
    }
  }, []);

  // Carrega tudo
  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await Promise.all([
        fetchValorHoje(),
        fetchDatajud(daysPeriod),
        fetchMatches()
      ]);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar dados do monitor falimentar.');
    } finally {
      setLoading(false);
    }
  }, [fetchValorHoje, fetchDatajud, fetchMatches, daysPeriod]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Manipula envio da colagem de matéria
  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;
    setImporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/movimento-falimentar/import-valor`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: importText,
          date: importDate
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Erro ao processar texto da matéria.');
      }

      setImportModalOpen(false);
      setImportText('');
      await loadAll();
    } catch (err: any) {
      alert(`Falha na importação: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Itens da aba ativa
  const currentItems = useMemo(() => {
    if (activeTab === 'valor') {
      return valorData?.items || [];
    }
    if (activeTab === 'datajud') {
      return datajudItems;
    }
    return portfolioMatches.map(m => m.event);
  }, [activeTab, valorData, datajudItems, portfolioMatches]);

  // Itens filtrados pelo input de busca
  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return currentItems;
    const term = searchTerm.toLowerCase().trim();
    return currentItems.filter(item => {
      return (
        item.empresa?.toLowerCase().includes(term) ||
        item.cnpj?.toLowerCase().includes(term) ||
        item.classe?.toLowerCase().includes(term) ||
        item.processo?.toLowerCase().includes(term) ||
        item.administradorJudicial?.toLowerCase().includes(term) ||
        item.varaComarca?.toLowerCase().includes(term) ||
        item.tribunalNome?.toLowerCase().includes(term)
      );
    });
  }, [currentItems, searchTerm]);

  // Contagens dos KPIs
  const stats = useMemo(() => {
    const s = {
      total: filteredItems.length,
      falenciasDecretadas: 0,
      pedidosFalencia: 0,
      rjDeferida: 0,
      rjConcedida: 0,
      pedidosRj: 0,
      outros: 0
    };

    filteredItems.forEach(i => {
      const cl = String(i.classe || '').toUpperCase();
      if (cl.includes('FALÊNCIA DECRETADA') || cl.includes('FALENCIAS DECRETADAS')) {
        s.falenciasDecretadas++;
      } else if (cl.includes('PEDIDO DE FALÊNCIA') || cl.includes('PEDIDOS DE FALENCIA') || cl.includes('FALÊNCIA REQUERIDA')) {
        s.pedidosFalencia++;
      } else if (cl.includes('RECUPERAÇÃO JUDICIAL DEFERIDA') || cl.includes('PROCESSAMENTO DEFERIDO')) {
        s.rjDeferida++;
      } else if (cl.includes('RECUPERAÇÃO JUDICIAL CONCEDIDA') || cl.includes('HOMOLOGADA')) {
        s.rjConcedida++;
      } else if (cl.includes('PEDIDOS DE RECUPERAÇÃO') || cl.includes('PEDIDO DE RECUPERAÇÃO')) {
        s.pedidosRj++;
      } else {
        s.outros++;
      }
    });

    return s;
  }, [filteredItems]);

  // Agrupa os itens filtrados por classe para exibição elegante em blocos
  const groupedByCategory = useMemo(() => {
    const groups: { [key: string]: MovimentoItem[] } = {};
    filteredItems.forEach(item => {
      const c = item.classe || 'FALÊNCIAS DECRETADAS';
      if (!groups[c]) groups[c] = [];
      groups[c].push(item);
    });
    return groups;
  }, [filteredItems]);

  // Helpers de classes CSS para cada categoria
  const getCategoryTheme = (classe: string) => {
    const c = String(classe || '').toUpperCase();
    if (c.includes('FALÊNCIA DECRETADA') || c.includes('FALENCIAS DECRETADAS') || c.includes('CONVOLADA')) {
      return { cardClass: 'mf-cat-card falencia', badgeClass: 'mf-badge-falencia', iconColor: '#f43f5e' };
    }
    if (c.includes('PEDIDO DE FALÊNCIA') || c.includes('PEDIDOS DE FALENCIA')) {
      return { cardClass: 'mf-cat-card pedido-falencia', badgeClass: 'mf-badge-pedido-falencia', iconColor: '#fb923c' };
    }
    if (c.includes('DEFERIDA')) {
      return { cardClass: 'mf-cat-card rj-deferida', badgeClass: 'mf-badge-rj-deferida', iconColor: '#f59e0b' };
    }
    if (c.includes('CONCEDIDA')) {
      return { cardClass: 'mf-cat-card rj-concedida', badgeClass: 'mf-badge-rj-concedida', iconColor: '#10b981' };
    }
    if (c.includes('PEDIDOS DE RECUPERAÇÃO')) {
      return { cardClass: 'mf-cat-card pedido-rj', badgeClass: 'mf-badge-pedido-rj', iconColor: '#a855f7' };
    }
    return { cardClass: 'mf-cat-card default', badgeClass: 'mf-badge-default', iconColor: '#38bdf8' };
  };

  return (
    <div className="mf-container">
      {/* ── CABEÇALHO DO MÓDULO ── */}
      <header className="mf-header">
        <div className="mf-header-inner">
          <div className="mf-brand-group">
            <div className="mf-brand-icon">
              <Scale size={28} />
            </div>
            <div>
              <h1 className="mf-title">Movimento Falimentar</h1>
              <p className="mf-subtitle">
                Monitor de Falências e Recuperações Judiciais • Valor Econômico & DataJud (CNJ)
              </p>
            </div>
          </div>

          <div className="mf-header-actions">
            <div className="mf-date-badge">
              <Calendar size={15} />
              <span>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span>
            </div>
            <button
              type="button"
              className="mf-btn mf-btn-refresh"
              onClick={loadAll}
              disabled={loading}
              title="Atualizar dados"
            >
              <RefreshCw size={15} className={loading ? 'mf-spin' : ''} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mf-main">
        {errorMsg && (
          <div className="mf-error-banner" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', color: '#fca5a5', marginBottom: '16px' }}>
            <AlertTriangle size={18} />
            <span style={{ flex: 1, fontSize: '0.9rem' }}>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg(null)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── NAVEGAÇÃO ENTRE ABAS ── */}
        <div className="mf-tab-nav">
          <button
            type="button"
            className={`mf-tab-btn ${activeTab === 'valor' ? 'active' : ''}`}
            onClick={() => setActiveTab('valor')}
          >
            <Flame size={16} />
            <span>Movimentos de Hoje (Valor)</span>
            <span className="mf-tab-badge">
              {valorData?.items?.length || 0}
            </span>
          </button>

          <button
            type="button"
            className={`mf-tab-btn ${activeTab === 'datajud' ? 'active' : ''}`}
            onClick={() => setActiveTab('datajud')}
          >
            <Scale size={16} />
            <span>DataJud (Tribunais CNJ)</span>
            <span className="mf-tab-badge">
              {datajudItems.length}
            </span>
          </button>

          <button
            type="button"
            className={`mf-tab-btn ${activeTab === 'carteira' ? 'active' : ''}`}
            onClick={() => setActiveTab('carteira')}
          >
            <Building2 size={16} />
            <span>Cruzamento com Carteira</span>
            <span className={`mf-tab-badge ${portfolioMatches.length > 0 ? 'alert' : ''}`}>
              {portfolioMatches.length}
            </span>
          </button>
        </div>

        {/* ── TOOLBAR DE AÇÕES E FILTROS ── */}
        <div className="mf-toolbar-card glass">
          <div className="mf-toolbar-row">
            <button
              type="button"
              className="mf-btn mf-btn-import"
              onClick={() => setImportModalOpen(true)}
            >
              <ClipboardPaste size={15} />
              <span>Colar Matéria</span>
            </button>

            <a
              className="mf-btn mf-btn-extract"
              href={`${API_BASE_URL}/api/movimento-falimentar/report/csv?days=${daysPeriod}`}
              download={`Movimento_Falimentar_${daysPeriod}_dias.csv`}
              title="Baixar arquivo CSV completo"
            >
              <Download size={15} />
              <span>Extrair CSV</span>
            </a>

            {activeTab === 'datajud' && (
              <div className="mf-select-wrap">
                <select
                  value={daysPeriod}
                  onChange={e => {
                    const d = Number(e.target.value);
                    setDaysPeriod(d);
                    fetchDatajud(d);
                  }}
                  className="mf-select"
                >
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                </select>
              </div>
            )}

            <div className="mf-search-wrap">
              <Search size={16} className="mf-search-icon" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Filtrar por empresa, CNPJ, tribunal, administrador judicial ou comarca..."
                className="mf-search-input"
              />
              {searchTerm && (
                <button type="button" className="mf-search-clear" onClick={() => setSearchTerm('')}>
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── BANNER INFORMATIVO DO VALOR ECONÔMICO (SE NA ABA VALOR) ── */}
        {activeTab === 'valor' && valorData && (
          <div className="mf-banner-valor glass">
            <div className="mf-banner-left">
              <span className="mf-banner-tag">FONTE OFICIAL</span>
              <h3 className="mf-banner-title">{valorData.title}</h3>
              <span className="mf-banner-date">
                Publicação: {new Date(valorData.date).toLocaleDateString('pt-BR')} • {valorData.items.length} empresas catalogadas
              </span>
            </div>
            {valorData.url && (
              <a
                href={valorData.url}
                target="_blank"
                rel="noreferrer"
                className="mf-btn mf-btn-link"
              >
                <span>Acessar no Valor Econômico</span>
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}

        {/* ── CARD DE ALERTA DE CARTEIRA (SE HOUVER MATCHES) ── */}
        {portfolioMatches.length > 0 && activeTab !== 'carteira' && (
          <div className="mf-alert-portfolio glass" onClick={() => setActiveTab('carteira')}>
            <div className="mf-alert-icon">
              <ShieldAlert size={22} />
            </div>
            <div className="mf-alert-text">
              <strong>Atenção: {portfolioMatches.length} empresa(s) em Recuperação Judicial ou Falência coincidem com a carteira de clientes!</strong>
              <p>Clique aqui para visualizar os apontamentos da carteira.</p>
            </div>
          </div>
        )}

        {/* ── CARDS DE KPIS NUMÉRICOS ── */}
        <div className="mf-kpis-grid">
          <div className="mf-kpi-card glass">
            <span className="mf-kpi-label">TOTAL LISTADO</span>
            <strong className="mf-kpi-val text-blue">{stats.total}</strong>
          </div>
          <div className="mf-kpi-card glass">
            <span className="mf-kpi-label">FALÊNCIAS DECRETADAS</span>
            <strong className="mf-kpi-val text-rose">{stats.falenciasDecretadas}</strong>
          </div>
          <div className="mf-kpi-card glass">
            <span className="mf-kpi-label">PEDIDOS DE FALÊNCIA</span>
            <strong className="mf-kpi-val text-amber">{stats.pedidosFalencia}</strong>
          </div>
          <div className="mf-kpi-card glass">
            <span className="mf-kpi-label">RJ DEFERIDA</span>
            <strong className="mf-kpi-val text-yellow">{stats.rjDeferida}</strong>
          </div>
          <div className="mf-kpi-card glass">
            <span className="mf-kpi-label">RJ CONCEDIDA</span>
            <strong className="mf-kpi-val text-emerald">{stats.rjConcedida}</strong>
          </div>
          <div className="mf-kpi-card glass">
            <span className="mf-kpi-label">PEDIDOS DE RJ</span>
            <strong className="mf-kpi-val text-purple">{stats.pedidosRj}</strong>
          </div>
        </div>

        {/* ── CONTEÚDO DA ABA CARTEIRA ── */}
        {activeTab === 'carteira' && (
          <div className="mf-carteira-section">
            <div className="mf-carteira-header glass">
              <div>
                <h3>Cruzamento com a Carteira de Clientes ({totalTrackedClients} empresas monitoradas)</h3>
                <p>Verificação automática contra os cedentes e sacados cadastrados no LeptaSys.</p>
              </div>
              <span className="mf-carteira-count-tag">
                {portfolioMatches.length} Ocorrência(s) Encontrada(s)
              </span>
            </div>

            {portfolioMatches.length === 0 ? (
              <div className="mf-empty-carteira glass">
                <CheckCircle2 size={40} className="text-emerald" />
                <h4>Nenhuma empresa da carteira foi encontrada em Falência ou Recuperação Judicial</h4>
                <p>Todas as empresas da sua carteira monitorada permanecem regulares.</p>
              </div>
            ) : (
              <div className="mf-table-responsive glass">
                <table className="mf-table">
                  <thead>
                    <tr>
                      <th>EMPRESA</th>
                      <th>CNPJ</th>
                      <th>STATUS / CLASSE</th>
                      <th>PROCESSO</th>
                      <th>VARA / COMARCA</th>
                      <th>ADMINISTRADOR JUDICIAL</th>
                      <th>FONTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioMatches.map((m, idx) => (
                      <tr key={`match-${idx}`} className="mf-row match">
                        <td className="mf-company-cell">
                          <strong>{m.client.empresa || m.event.empresa}</strong>
                          <span className="mf-match-badge">Cliente da Carteira</span>
                        </td>
                        <td>
                          <code>{m.client.cnpj || m.event.cnpj}</code>
                        </td>
                        <td>
                          <span className="mf-badge-falencia">{m.event.classe}</span>
                        </td>
                        <td>
                          <span className="mf-process-num">{m.event.processo}</span>
                        </td>
                        <td>{m.event.varaComarca || '-'}</td>
                        <td>{m.event.administradorJudicial || '-'}</td>
                        <td>{m.event.fonte}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── CONTEÚDO DAS ABAS VALOR E DATAJUD ── */}
        {activeTab !== 'carteira' && (
          <div className="mf-categories-container">
            {loading ? (
              <div className="mf-loading-state glass">
                <RefreshCw size={36} className="mf-spin text-blue" />
                <p>Carregando eventos do Movimento Falimentar...</p>
              </div>
            ) : Object.keys(groupedByCategory).length === 0 ? (
              <div className="mf-empty-state glass">
                <FileText size={40} className="text-muted" />
                <h4>Nenhum registro encontrado</h4>
                <p>Não foram localizados processos para os critérios informados.</p>
              </div>
            ) : (
              Object.entries(groupedByCategory).map(([classe, items]) => {
                const theme = getCategoryTheme(classe);
                return (
                  <div key={classe} className={`${theme.cardClass} glass`}>
                    <div className="mf-category-header">
                      <div className="mf-cat-title-wrap">
                        <h3 className="mf-category-title">{classe}</h3>
                        <span className={`mf-cat-badge ${theme.badgeClass}`}>
                          {items.length} {items.length === 1 ? 'empresa' : 'empresas'}
                        </span>
                      </div>
                    </div>

                    <div className="mf-table-responsive">
                      <table className="mf-table">
                        <thead>
                          <tr>
                            <th>EMPRESA</th>
                            <th>CNPJ</th>
                            <th>PROCESSO</th>
                            <th>VARA / COMARCA</th>
                            <th>ADMINISTRADOR JUDICIAL</th>
                            <th>ENDEREÇO</th>
                            <th>DATA / FONTE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => {
                            const isMatch = portfolioMatches.some(
                              pm => (pm.event.cnpj && pm.event.cnpj === item.cnpj) ||
                                (pm.event.empresa && pm.event.empresa.toLowerCase() === item.empresa.toLowerCase())
                            );

                            return (
                              <tr key={`item-${idx}`} className={`mf-row ${isMatch ? 'match' : ''}`}>
                                <td className="mf-company-cell">
                                  <strong>{item.empresa}</strong>
                                  {isMatch && <span className="mf-match-badge">Carteira Lepta</span>}
                                  {item.raw?.observacao && (
                                    <span className="mf-observacao" title={item.raw.observacao}>
                                      Obs: {item.raw.observacao}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {item.cnpj ? (
                                    <div className="mf-copyable">
                                      <code>{item.cnpj}</code>
                                      <button
                                        type="button"
                                        className="mf-copy-btn"
                                        onClick={() => copyToClipboard(item.cnpj, `cnpj-${idx}`)}
                                        title="Copiar CNPJ"
                                      >
                                        {copiedKey === `cnpj-${idx}` ? <Check size={12} /> : <Copy size={12} />}
                                      </button>
                                    </div>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td>
                                  <div className="mf-copyable">
                                    <span className="mf-process-num">{item.processo}</span>
                                    <button
                                      type="button"
                                      className="mf-copy-btn"
                                      onClick={() => copyToClipboard(item.processo, `proc-${idx}`)}
                                      title="Copiar Número do Processo"
                                    >
                                      {copiedKey === `proc-${idx}` ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                  </div>
                                </td>
                                <td>{item.varaComarca || '-'}</td>
                                <td>{item.administradorJudicial || '-'}</td>
                                <td className="mf-endereco-cell" title={item.endereco}>
                                  {item.endereco || '-'}
                                </td>
                                <td>
                                  <span className="mf-date-txt">
                                    {item.dataAjuizamento ? item.dataAjuizamento.slice(0, 10).split('-').reverse().join('/') : '-'}
                                  </span>
                                  <span className="mf-source-txt">{item.fonte}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* ── MODAL COLAR MATÉRIA DO VALOR ECONÔMICO ── */}
      {importModalOpen && (
        <div className="mf-modal-overlay" onClick={() => setImportModalOpen(false)}>
          <div className="mf-modal-content glass" onClick={e => e.stopPropagation()}>
            <div className="mf-modal-header">
              <div className="mf-modal-title-wrap">
                <span className="mf-modal-badge">ENTRADA MANUAL / PARSER</span>
                <h2>Colar Matéria do Valor Econômico</h2>
              </div>
              <button
                type="button"
                className="mf-modal-close"
                onClick={() => setImportModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="mf-modal-body">
              <p className="mf-modal-instruction">
                Copie o texto bruto da coluna de <strong>Movimento Falimentar</strong> do Valor Econômico e cole abaixo. O sistema identificará automaticamente os blocos de Falências Decretadas, Pedidos de Falência, Recuperações Judiciais, CNPJs, administradores e varas.
              </p>

              <div className="mf-form-group">
                <label>Data de Publicação da Matéria:</label>
                <input
                  type="date"
                  value={importDate}
                  onChange={e => setImportDate(e.target.value)}
                  className="mf-input-date"
                  required
                />
              </div>

              <div className="mf-form-group">
                <label>Texto da Matéria:</label>
                <textarea
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  placeholder="Cole aqui o texto da matéria do jornal Valor Econômico..."
                  className="mf-textarea"
                  rows={14}
                  required
                />
              </div>

              <div className="mf-modal-footer">
                <button
                  type="button"
                  className="mf-btn secondary"
                  onClick={() => setImportModalOpen(false)}
                  disabled={importing}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="mf-btn primary"
                  disabled={importing || !importText.trim()}
                >
                  {importing ? <RefreshCw size={15} className="mf-spin" /> : <ClipboardPaste size={15} />}
                  <span>{importing ? 'Processando e Catalogando...' : 'Processar Matéria'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovimentoFalimentar;
