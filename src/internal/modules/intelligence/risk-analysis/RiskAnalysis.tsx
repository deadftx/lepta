import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, BarChart3, Building2, CalendarClock,
  CheckCircle2, ChevronRight, CircleDollarSign, FileCheck2, Landmark,
  RefreshCw, Search, ShieldCheck, TrendingDown, UserRoundSearch, UsersRound
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './RiskAnalysis.css';

type EntityType = 'cliente' | 'sacado';

interface RiskSuggestion {
  nome: string;
  documento: string;
  grupoEconomico: string;
  qtdTitulos: number;
  valorGeral: number;
  valorAberto: number;
  valorVencido: number;
  percentualVencido: number;
}

interface RiskDetails {
  aviso?: string;
  tipo: EntityType;
  entidade: {
    nome: string;
    documento: string;
    email: string;
    telefone: string;
    grupoEconomico: string;
  };
  indicador: {
    score: number;
    nivel: 'Baixo' | 'Moderado' | 'Alto' | 'Crítico';
    fatores: Array<{ nome: string; peso: number; impacto: number; valor: number }>;
  };
  metricas: {
    qtdTitulos: number;
    valorGeral: number;
    valorAberto: number;
    valorVencido: number;
    valorCobrancaSimples?: number;
    qtdCobrancaSimples?: number;
    valorLiquidado: number;
    percentualVencido: number;
    atrasoMedio: number;
    atrasoMaximo: number;
    percentualNoPrazo: number;
    ocorrenciasNegativas: number;
    valorOcorrenciasNegativas: number;
    limite: number;
    utilizacaoLimite: number | null;
    qualidadeDocumental: number;
    quantidadeContrapartes: number;
  };
  serasa?: {
    status: string;
    score: number;
    apontamentos: number;
    protestos: number;
    pefinRefin: number;
    origem: string;
  };
  aging: Array<{ chave: string; rotulo: string; valor: number; quantidade: number }>;
  agendaVencimentos: Array<{ rotulo: string; valor: number }>;
  concentracao: Array<{ nome: string; documento: string; valorAberto: number; valorVencido: number; qtdTitulos: number }>;
  situacoes: Array<{ situacao: string; valor: number }>;
  historico: Array<{ mes: string; valorGeral: number; valorAberto: number; valorVencido: number }>;
  titulos: Array<{
    id: number | string;
    numero: string;
    contraparte: string;
    documentoContraparte: string;
    vencimento: string | null;
    situacao: string;
    valorNominal: number;
    valorLiquido: number;
    manifesto: string;
    codigoDoLastro: string;
    registradoNoCobrador: boolean;
  }>;
}

const currency = (value = 0) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', maximumFractionDigits: 2
}).format(value);

const compactCurrency = (value = 0) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1
}).format(value);

const percent = (value = 0) => new Intl.NumberFormat('pt-BR', {
  style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1
}).format(value);

const formatDocument = (value = '') => {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 14) return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (digits.length === 11) return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return value || 'Documento não informado';
};

const formatDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(value))
  : '—';

const riskColor: Record<RiskDetails['indicador']['nivel'], string> = {
  Baixo: '#10b981', Moderado: '#f59e0b', Alto: '#f97316', Crítico: '#ef4444'
};

const RiskAnalysis = () => {
  const [type, setType] = useState<EntityType>('cliente');
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<RiskSuggestion[]>([]);
  const [details, setDetails] = useState<RiskDetails | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (details) return;
    const query = search.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        setError('');
        const params = new URLSearchParams({ tipo: type, modo: 'lista', busca: query });
        const response = await fetch(`${API_BASE_URL}/api/analise-riscos?${params}`, {
          headers: getAuthHeaders(), signal: controller.signal
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.message || payload.error || 'Não foi possível consultar a API UNLTD.');
        }
        const results = await response.json();
        setSuggestions((Array.isArray(results) ? results : []).slice(0, 8));
      } catch (requestError) {
        if ((requestError as Error).name !== 'AbortError') setError((requestError as Error).message);
      } finally {
        if (!controller.signal.aborted) setLoadingSuggestions(false);
      }
    }, 400);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [type, search, details]);

  const selectEntity = async (entity: RiskSuggestion) => {
    try {
      setLoadingDetails(true);
      setError('');
      const params = new URLSearchParams({ tipo: type, modo: 'detalhe', nome: entity.nome });
      if (entity.documento) params.set('documento', entity.documento);
      const response = await fetch(`${API_BASE_URL}/api/analise-riscos?${params}`, { headers: getAuthHeaders() });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || payload.error || 'Não foi possível compor a análise.');
      }
      const payload = await response.json() as RiskDetails;
      if (!payload?.entidade || !payload?.indicador || !payload?.metricas) {
        throw new Error('A API retornou uma análise incompleta. Tente novamente.');
      }
      setDetails({
        ...payload,
        indicador: {
          ...payload.indicador,
          fatores: Array.isArray(payload.indicador.fatores) ? payload.indicador.fatores : []
        },
        aging: Array.isArray(payload.aging) ? payload.aging : [],
        agendaVencimentos: Array.isArray(payload.agendaVencimentos) ? payload.agendaVencimentos : [],
        concentracao: Array.isArray(payload.concentracao) ? payload.concentracao : [],
        situacoes: Array.isArray(payload.situacoes) ? payload.situacoes : [],
        historico: Array.isArray(payload.historico) ? payload.historico : [],
        titulos: Array.isArray(payload.titulos) ? payload.titulos : []
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setLoadingDetails(false);
    }
  };

  const maxAging = useMemo(() => Math.max(...(details?.aging.map(item => item.valor) || [0]), 1), [details]);

  const resetAnalysis = () => {
    setDetails(null);
    setSearch('');
    setError('');
  };

  if (loadingDetails) {
    return (
      <div className="risk-analysis-page">
        <div className="risk-loading glass">
          <div className="risk-loader"><ShieldCheck size={38} /><span /></div>
          <h3>Compondo análise de risco</h3>
          <p>Consultando títulos e liquidações na API UNLTD...</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="risk-analysis-page">
        <header className="risk-page-header">
          <div>
            <span className="risk-eyebrow"><ShieldCheck size={15} /> Lepta Intelligence</span>
            <h1>Análise de Riscos</h1>
            <p>Risco comportamental calculado a partir da carteira registrada na API UNLTD.</p>
          </div>
          <span className="risk-api-badge"><span /> VIA API UNLTD</span>
        </header>

        <section className="risk-search-card glass">
          <div className="risk-type-switch" role="group" aria-label="Tipo de análise">
            <button className={type === 'cliente' ? 'active' : ''} onClick={() => setType('cliente')}>
              <Building2 size={18} /> Cedente / Cliente
            </button>
            <button className={type === 'sacado' ? 'active' : ''} onClick={() => setType('sacado')}>
              <UserRoundSearch size={18} /> Sacado
            </button>
          </div>
          <label className="risk-search-input">
            <Search size={21} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder={`Busque ${type === 'cliente' ? 'um cedente' : 'um sacado'} por nome ou CNPJ...`}
              autoComplete="off"
            />
            {loadingSuggestions && <RefreshCw className="spin" size={18} />}
          </label>
        </section>

        {error && <div className="risk-error"><AlertTriangle size={19} /> {error}</div>}

        <section className="risk-results glass">
          <div className="risk-section-title">
            <div><h2>{search.trim().length >= 2 ? 'Recomendações encontradas' : 'Consulte um cedente ou sacado'}</h2><p>{search.trim().length >= 2 ? 'Selecione uma entidade para gerar a análise completa.' : 'Digite pelo menos 2 caracteres do nome, CPF ou CNPJ.'}</p></div>
            <span>{suggestions.length} resultados</span>
          </div>
          <div className="risk-suggestion-list">
            {loadingSuggestions && (
              <div className="risk-search-loading"><RefreshCw className="spin" size={25} /><strong>Consultando dados na API UNLTD</strong><span>Carregando o histórico completo para localizar as recomendações...</span></div>
            )}
            {suggestions.map(entity => (
              <button className="risk-suggestion" key={`${entity.documento}-${entity.nome}`} onClick={() => selectEntity(entity)}>
                <div className="risk-entity-icon">{type === 'cliente' ? <Building2 size={22} /> : <UsersRound size={22} />}</div>
                <div className="risk-entity-main">
                  <strong title={entity.nome}>{entity.nome}</strong>
                  <span>{formatDocument(entity.documento)}{entity.grupoEconomico ? ` • ${entity.grupoEconomico}` : ''}</span>
                </div>
                <div className="risk-suggestion-number"><span>Em aberto</span><strong>{currency(entity.valorAberto)}</strong></div>
                <div className="risk-suggestion-number overdue"><span>Vencido</span><strong>{currency(entity.valorVencido)}</strong><small>{percent(entity.percentualVencido)}</small></div>
                <ChevronRight size={20} />
              </button>
            ))}
            {!loadingSuggestions && !suggestions.length && !error && (
              <div className="risk-empty"><Search size={34} /><strong>{search.trim().length >= 2 ? 'Nenhuma entidade encontrada' : 'Comece digitando para pesquisar'}</strong><span>{search.trim().length >= 2 ? 'Confira o nome ou documento informado.' : 'As recomendações aparecerão automaticamente.'}</span></div>
            )}
          </div>
        </section>
      </div>
    );
  }

  const color = riskColor[details.indicador.nivel];

  return (
    <div className="risk-analysis-page">
      <header className="risk-detail-header glass">
        <button className="risk-back" onClick={resetAnalysis}><ArrowLeft size={18} /> Voltar para consulta</button>
        <div className="risk-detail-identity">
          <div className="risk-entity-icon large"><Building2 size={28} /></div>
          <div>
            <span>{details.tipo === 'cliente' ? 'CEDENTE / CLIENTE' : 'SACADO'}</span>
            <h1>{details.entidade.nome}</h1>
            <p>{formatDocument(details.entidade.documento)}{details.entidade.grupoEconomico ? ` • Grupo ${details.entidade.grupoEconomico}` : ''}</p>
          </div>
        </div>
        <div className="risk-score" style={{ '--risk-color': color } as React.CSSProperties}>
          <div className="risk-score-circle"><strong>{details.indicador.score}</strong><span>/ 100</span></div>
          <div><span>Indicador Interno Lepta</span><strong>Risco {details.indicador.nivel}</strong></div>
        </div>
      </header>

      {error && <div className="risk-error"><AlertTriangle size={19} /> {error}</div>}
      {details.aviso && <div className="risk-warning"><AlertTriangle size={19} /> {details.aviso}</div>}

      <section className="risk-kpi-grid">
        <article className="risk-kpi"><CircleDollarSign /><span>Exposição em aberto</span><strong>{currency(details.metricas.valorAberto)}</strong><small>{details.metricas.qtdTitulos} títulos analisados</small></article>
        <article className="risk-kpi danger"><TrendingDown /><span>Total vencido</span><strong>{currency(details.metricas.valorVencido)}</strong><small>{percent(details.metricas.percentualVencido)} da exposição</small></article>
        <article className="risk-kpi cs-kpi"><Landmark /><span>Cobrança Simples</span><strong>{currency(details.metricas.valorCobrancaSimples || 0)}</strong><small>{details.metricas.qtdCobrancaSimples || 0} títulos em CS</small></article>
        <article className="risk-kpi"><CalendarClock /><span>Atraso médio</span><strong>{Math.round(details.metricas.atrasoMedio)} dias</strong><small>Máximo de {Math.round(details.metricas.atrasoMaximo)} dias</small></article>
        <article className="risk-kpi success"><CheckCircle2 /><span>Liquidações no prazo</span><strong>{percent(details.metricas.percentualNoPrazo)}</strong><small>{currency(details.metricas.valorLiquidado)} liquidado</small></article>
        <article className="risk-kpi"><UsersRound /><span>Contrapartes</span><strong>{details.metricas.quantidadeContrapartes}</strong><small>{details.tipo === 'cliente' ? 'sacados na carteira' : 'cedentes relacionados'}</small></article>
        <article className="risk-kpi warning"><AlertTriangle /><span>Ocorrências negativas</span><strong>{details.metricas.ocorrenciasNegativas}</strong><small>{currency(details.metricas.valorOcorrenciasNegativas)}</small></article>
        <article className="risk-kpi serasa-kpi"><ShieldCheck /><span>SERASA (Cadastro)</span><strong>{details.serasa?.status || 'Regular'}</strong><small>{details.serasa?.score ? `Score Interno: ${details.serasa.score} pts` : 'Sem restrições cadastradas'}</small></article>
        <article className="risk-kpi"><FileCheck2 /><span>Qualidade documental</span><strong>{percent(details.metricas.qualidadeDocumental)}</strong><small>Lastro, manifesto e registro</small></article>
      </section>

      <section className="risk-dashboard-grid">
        <article className="risk-panel glass">
          <div className="risk-panel-title"><div><h2>Aging da carteira vencida</h2><p>Exposição em aberto por faixa de atraso.</p></div><BarChart3 size={21} /></div>
          <div className="risk-aging-list">
            {details.aging.map(item => (
              <div className="risk-aging-row" key={item.chave}>
                <div><span>{item.rotulo}</span><small>{item.quantidade} títulos</small></div>
                <div className="risk-aging-track"><span style={{ width: `${(item.valor / maxAging) * 100}%` }} /></div>
                <strong>{currency(item.valor)}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="risk-panel glass">
          <div className="risk-panel-title"><div><h2>Composição do indicador</h2><p>Impactos que reduziram a nota de segurança.</p></div><ShieldCheck size={21} /></div>
          <div className="risk-factor-list">
            {details.indicador.fatores.map(factor => (
              <div className="risk-factor" key={factor.nome}>
                <div><span>{factor.nome}</span><strong>-{factor.impacto.toFixed(1)} pts</strong></div>
                <div><span style={{ width: `${Math.min(100, (factor.impacto / factor.peso) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
          <p className="risk-method-note"><BadgeCheck size={16} /> Indicador comportamental interno. Não substitui consulta a bureau de crédito.</p>
        </article>

        <article className="risk-panel glass risk-chart-panel">
          <div className="risk-panel-title"><div><h2>Agenda de vencimentos</h2><p>Valores em aberto que ainda vencerão.</p></div><CalendarClock size={21} /></div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={details.agendaVencimentos} margin={{ top: 12, right: 6, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.12)" vertical={false} />
              <XAxis dataKey="rotulo" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compactCurrency} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
              <Tooltip formatter={value => currency(Number(Array.isArray(value) ? value[0] : value) || 0)} contentStyle={{ background: '#11141c', border: '1px solid #293042', borderRadius: 10 }} />
              <Bar dataKey="valor" radius={[7, 7, 0, 0]} fill="#3b82f6" name="Valor em aberto" />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="risk-panel glass risk-chart-panel">
          <div className="risk-panel-title"><div><h2>Concentração</h2><p>Principais {details.tipo === 'cliente' ? 'sacados' : 'cedentes'} por exposição.</p></div><UsersRound size={21} /></div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={details.concentracao.slice(0, 6)} layout="vertical" margin={{ top: 6, right: 10, left: 12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.12)" horizontal={false} />
              <XAxis type="number" tickFormatter={compactCurrency} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="nome" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={115} tickFormatter={value => value.length > 18 ? `${value.slice(0, 18)}…` : value} axisLine={false} tickLine={false} />
              <Tooltip formatter={value => currency(Number(Array.isArray(value) ? value[0] : value) || 0)} contentStyle={{ background: '#11141c', border: '1px solid #293042', borderRadius: 10 }} />
              <Bar dataKey="valorAberto" radius={[0, 7, 7, 0]} name="Exposição em aberto">
                {details.concentracao.slice(0, 6).map((_, index) => <Cell key={index} fill={index === 0 ? '#f97316' : '#8b5cf6'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className="risk-panel glass risk-chart-panel risk-wide-panel">
          <div className="risk-panel-title"><div><h2>Evolução da carteira</h2><p>Últimos 18 meses, considerando o vencimento dos títulos.</p></div><BarChart3 size={21} /></div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={details.historico} margin={{ top: 14, right: 16, left: 0, bottom: 4 }}>
              <defs>
                <linearGradient id="riskOpenGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.38}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                <linearGradient id="riskOverdueGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.35}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,.12)" vertical={false} />
              <XAxis dataKey="mes" tickFormatter={value => value.split('-').reverse().join('/')} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={compactCurrency} tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} width={72} />
              <Tooltip formatter={value => currency(Number(Array.isArray(value) ? value[0] : value) || 0)} labelFormatter={value => `Mês ${String(value).split('-').reverse().join('/')}`} contentStyle={{ background: '#11141c', border: '1px solid #293042', borderRadius: 10 }} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              <Area type="monotone" dataKey="valorAberto" name="Em aberto" stroke="#3b82f6" fill="url(#riskOpenGradient)" strokeWidth={2} />
              <Area type="monotone" dataKey="valorVencido" name="Vencido" stroke="#ef4444" fill="url(#riskOverdueGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="risk-situation-summary">
            {details.situacoes.map(item => <span key={item.situacao}><strong>{item.situacao}</strong>{currency(item.valor)}</span>)}
          </div>
        </article>
      </section>

      <section className="risk-panel glass risk-title-panel">
        <div className="risk-panel-title"><div><h2>Títulos que compõem a análise</h2><p>Até 500 registros mais recentes retornados pela API.</p></div><span>{details.titulos.length} exibidos</span></div>
        <div className="risk-table-wrap">
          <table className="risk-table">
            <thead><tr><th>Título</th><th>{details.tipo === 'cliente' ? 'Sacado' : 'Cedente'}</th><th>Vencimento</th><th>Situação</th><th>Valor nominal</th><th>Documentação</th></tr></thead>
            <tbody>
              {details.titulos.map((title, index) => (
                <tr key={`${title.id}-${index}`}>
                  <td>{title.numero || title.id || '—'}</td>
                  <td><strong title={title.contraparte}>{title.contraparte}</strong><small>{formatDocument(title.documentoContraparte)}</small></td>
                  <td>{formatDate(title.vencimento)}</td>
                  <td><span className={`risk-status ${title.situacao.toLowerCase().includes('aberto') ? 'open' : title.situacao.toLowerCase().includes('liquidado') ? 'settled' : 'attention'}`}>{title.situacao}</span></td>
                  <td>{currency(title.valorNominal)}</td>
                  <td><span className={title.codigoDoLastro && title.manifesto && title.registradoNoCobrador ? 'document-ok' : 'document-missing'}>{title.codigoDoLastro && title.manifesto && title.registradoNoCobrador ? 'Completa' : 'Pendente'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default RiskAnalysis;
