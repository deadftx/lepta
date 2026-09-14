import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Layers,
  DollarSign,
  TrendingUp,
  Percent,
  CheckCircle2,
  ShieldCheck,
  Maximize2,
  Minimize2,
  RotateCw,
  Search,
  Activity,
  PieChart as PieIcon,
  BarChart3,
  Clock,
  Volume2,
  VolumeX,
  Play,
  Pause
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './MesaOperacaoDashboard.css';

interface DashboardStats {
  periodo: string;
  totalOperacoes: number;
  totalTitulos: number;
  volumeBruto: number;
  volumeLiquido: number;
  desagioTotal: number;
  taxaDesagioMedia: number;
  ticketMedioOperacao: number;
  ticketMedioTitulo: number;
  efetivadasQtd: number;
  efetivadasVolumeBruto: number;
  efetivadasVolumeLiquido: number;
  pendentesQtd: number;
  pendentesVolumeBruto: number;
  pendentesVolumeLiquido: number;
  comCoobrigacaoQtd: number;
  semCoobrigacaoQtd: number;
  taxaEfetivacaoQtd: number;
  taxaEfetivacaoVolume: number;
  percentualCoobrigacao: number;
  porUnidade: Record<string, { qtd: number; bruto: number; liquido: number }>;
  porProduto: Record<string, { qtd: number; bruto: number; liquido: number }>;
  topCedentes: { nome: string; documento: string; qtd: number; bruto: number; liquido: number }[];
  timeline: { dataOuHora: string; label: string; qtd: number; bruto: number; liquido: number }[];
}

interface OperacaoItem {
  id: number;
  dataDeCadastro: string;
  efetivada: boolean;
  coobrigacao: boolean;
  quantidadeDeTitulos: number;
  totalBruto: number;
  totalLiquido: number;
  contaOperacional?: {
    unidadeAdministrativa?: { alias?: string; nome?: string };
    produto?: { descricao?: string };
    cliente?: { entidade?: { nome?: string; documento?: string } };
  };
}

const PIE_COLORS = ['#06b6d4', '#10b981', '#a855f7', '#f59e0b', '#3b82f6', '#ec4899'];

const formatBRL = (val: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(val || 0);
};

export const MesaOperacaoDashboard: React.FC = () => {
  const [periodo, setPeriodo] = useState<string>('hoje');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [operacoes, setOperacoes] = useState<OperacaoItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Auto-refresh timer (20s)
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [countdown, setCountdown] = useState<number>(20);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Table filters
  const [tableSearch, setTableSearch] = useState<string>('');
  const [tableStatus, setTableStatus] = useState<string>('todas');

  // Live Clock
  const [clockTime, setClockTime] = useState<string>('--:--:--');
  const [clockDate, setClockDate] = useState<string>('--/--/----');

  const prevTotalOpsRef = useRef<number>(0);

  // Relógio oficial de Brasília
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setClockDate(now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  // Chime sonoro via Web Audio API para novas operações
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {}
  }, [soundEnabled]);

  // Carrega dados da Mesa
  const fetchData = useCallback(async (selectedPeriod: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const headers = getAuthHeaders();

      const [statsRes, opsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/mesa-operacoes/live-stats?periodo=${selectedPeriod}`, { headers }),
        fetch(`${API_BASE_URL}/api/mesa-operacoes/live-operacoes?periodo=${selectedPeriod}`, { headers })
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success && statsData.stats) {
          setStats(statsData.stats);
          if (prevTotalOpsRef.current > 0 && statsData.stats.totalOperacoes > prevTotalOpsRef.current) {
            playChime();
          }
          prevTotalOpsRef.current = statsData.stats.totalOperacoes;
        }
      }

      if (opsRes.ok) {
        const opsData = await opsRes.json();
        if (opsData.success && opsData.operacoes) {
          setOperacoes(opsData.operacoes);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar dados da mesa:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [playChime]);

  useEffect(() => {
    fetchData(periodo);
  }, [periodo, fetchData]);

  // Timer de rotação e auto-refresh de 20 segundos
  useEffect(() => {
    if (!autoRotate) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Atualiza dados e alterna entre hoje e mes se estiver em modo auto-rotate
          fetchData(periodo, true);
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRotate, periodo, fetchData]);

  // Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  // Preparação de dados para gráficos
  const fidcChartData = stats?.porUnidade
    ? Object.entries(stats.porUnidade).map(([name, data]) => ({
        name,
        value: data.bruto,
        qtd: data.qtd
      }))
    : [];

  const produtoChartData = stats?.porProduto
    ? Object.entries(stats.porProduto)
        .map(([name, data]) => ({
          name,
          bruto: data.bruto,
          liquido: data.liquido
        }))
        .sort((a, b) => b.bruto - a.bruto)
    : [];

  // Filtragem na tabela de operações
  const filteredOperacoes = operacoes.filter(op => {
    if (tableStatus === 'efetivadas' && !op.efetivada) return false;
    if (tableStatus === 'pendentes' && op.efetivada) return false;

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      const cedente = op.contaOperacional?.cliente?.entidade?.nome?.toLowerCase() || '';
      const doc = op.contaOperacional?.cliente?.entidade?.documento?.toLowerCase() || '';
      const fundo = op.contaOperacional?.unidadeAdministrativa?.alias?.toLowerCase() || '';
      const prod = op.contaOperacional?.produto?.descricao?.toLowerCase() || '';
      const idStr = String(op.id);
      if (!cedente.includes(q) && !doc.includes(q) && !fundo.includes(q) && !prod.includes(q) && !idStr.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="mesa-container">
      {/* ── BARRA DE PROGRESSO DO AUTO-REFRESH ── */}
      <div className="mesa-progress-bar">
        <div
          className="mesa-progress-fill"
          style={{ width: `${((20 - countdown) / 20) * 100}%` }}
        />
      </div>

      {/* ── WALLBOARD HEADER ── */}
      <header className="mesa-header">
        <div className="mesa-header-inner">
          <div className="mesa-brand">
            <div className="mesa-brand-icon">
              <Layers size={24} />
            </div>
            <div className="mesa-title-wrap">
              <h1>
                <span>MESA DE OPERAÇÕES</span>
              </h1>
              <p>Monitoramento e Inteligência Operacional em Tempo Real</p>
            </div>
          </div>

          {/* Period Switcher */}
          <div className="mesa-period-switcher">
            <button
              className={`mesa-period-btn ${periodo === 'hoje' ? 'active' : ''}`}
              onClick={() => { setPeriodo('hoje'); setCountdown(20); }}
            >
              HOJE (AO VIVO)
            </button>
            <button
              className={`mesa-period-btn ${periodo === 'mes' ? 'active' : ''}`}
              onClick={() => { setPeriodo('mes'); setCountdown(20); }}
            >
              VISÃO MENSAL
            </button>
            <button
              className={`mesa-period-btn ${periodo === '7d' ? 'active' : ''}`}
              onClick={() => { setPeriodo('7d'); setCountdown(20); }}
            >
              7 DIAS
            </button>
            <button
              className={`mesa-period-btn ${periodo === '30d' ? 'active' : ''}`}
              onClick={() => { setPeriodo('30d'); setCountdown(20); }}
            >
              30 DIAS
            </button>
          </div>

          {/* Header Controls */}
          <div className="mesa-header-right">
            <div className="mesa-live-pill">
              <span className="mesa-live-dot" />
              <span>EM TEMPO REAL ({countdown}s)</span>
            </div>

            <button
              className="mesa-tool-btn"
              onClick={() => setAutoRotate(!autoRotate)}
              title={autoRotate ? 'Pausar auto-refresh' : 'Retomar auto-refresh'}
            >
              {autoRotate ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <button
              className="mesa-tool-btn"
              onClick={() => { setCountdown(20); fetchData(periodo); }}
              title="Atualizar agora"
            >
              <RotateCw size={16} />
            </button>

            <button
              className="mesa-tool-btn"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Silenciar novos alertas' : 'Ativar alertas sonoros'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              className="mesa-tool-btn"
              onClick={toggleFullscreen}
              title="Alternar Tela Cheia"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <div className="mesa-clock-card">
              <Clock size={13} color="#94a3b8" />
              <span>{clockDate} · {clockTime}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="mesa-main">
        {/* ── ROW 1: 6 KPI CARDS ── */}
        <section className="mesa-kpi-grid">
          {/* Volume Bruto */}
          <div className="mesa-kpi-card cyan">
            <div className="mesa-kpi-top">
              <span className="mesa-kpi-label">Volume Bruto</span>
              <div className="mesa-kpi-icon-wrap cyan">
                <DollarSign size={18} />
              </div>
            </div>
            <div className="mesa-kpi-val">{stats ? formatBRL(stats.volumeBruto) : 'R$ 0,00'}</div>
            <div className="mesa-kpi-sub">
              <span>{stats?.totalOperacoes ?? 0} operações negociadas</span>
            </div>
          </div>

          {/* Volume Líquido */}
          <div className="mesa-kpi-card emerald">
            <div className="mesa-kpi-top">
              <span className="mesa-kpi-label">Volume Líquido</span>
              <div className="mesa-kpi-icon-wrap emerald">
                <TrendingUp size={18} />
              </div>
            </div>
            <div className="mesa-kpi-val">{stats ? formatBRL(stats.volumeLiquido) : 'R$ 0,00'}</div>
            <div className="mesa-kpi-sub">
              <span>Ticket Médio: {stats ? formatBRL(stats.ticketMedioOperacao) : 'R$ 0,00'}</span>
            </div>
          </div>

          {/* Deságio / Retenção */}
          <div className="mesa-kpi-card amber">
            <div className="mesa-kpi-top">
              <span className="mesa-kpi-label">Deságio / Retenção</span>
              <div className="mesa-kpi-icon-wrap amber">
                <Percent size={18} />
              </div>
            </div>
            <div className="mesa-kpi-val">{stats ? formatBRL(stats.desagioTotal) : 'R$ 0,00'}</div>
            <div className="mesa-kpi-sub">
              <span className="mesa-badge warning">{stats?.taxaDesagioMedia ?? 0}% de deságio médio</span>
            </div>
          </div>

          {/* Total de Títulos */}
          <div className="mesa-kpi-card purple">
            <div className="mesa-kpi-top">
              <span className="mesa-kpi-label">Total de Títulos</span>
              <div className="mesa-kpi-icon-wrap purple">
                <Layers size={18} />
              </div>
            </div>
            <div className="mesa-kpi-val">{stats?.totalTitulos ?? 0}</div>
            <div className="mesa-kpi-sub">
              <span>Ticket Título: {stats ? formatBRL(stats.ticketMedioTitulo) : 'R$ 0,00'}</span>
            </div>
          </div>

          {/* Taxa de Efetivação */}
          <div className="mesa-kpi-card green">
            <div className="mesa-kpi-top">
              <span className="mesa-kpi-label">Taxa de Efetivação</span>
              <div className="mesa-kpi-icon-wrap green">
                <CheckCircle2 size={18} />
              </div>
            </div>
            <div className="mesa-kpi-val">{stats?.taxaEfetivacaoQtd ?? 0}%</div>
            <div className="mesa-kpi-sub">
              <span style={{ color: '#34d399' }}>{stats?.efetivadasQtd ?? 0} efetivadas</span>
              <span>·</span>
              <span style={{ color: '#fbbf24' }}>{stats?.pendentesQtd ?? 0} em análise</span>
            </div>
          </div>

          {/* Coobrigação */}
          <div className="mesa-kpi-card blue">
            <div className="mesa-kpi-top">
              <span className="mesa-kpi-label">Coobrigação</span>
              <div className="mesa-kpi-icon-wrap blue">
                <ShieldCheck size={18} />
              </div>
            </div>
            <div className="mesa-kpi-val">{stats?.percentualCoobrigacao ?? 0}%</div>
            <div className="mesa-kpi-sub">
              <span>{stats?.comCoobrigacaoQtd ?? 0} com coob</span>
              <span>·</span>
              <span>{stats?.semCoobrigacaoQtd ?? 0} sem coob</span>
            </div>
          </div>
        </section>

        {/* ── ROW 2: ANALYTICS CHARTS SECTION ── */}
        <section className="mesa-charts-grid">
          {/* Chart 1: Evolução Temporal */}
          <div className="mesa-card">
            <div className="mesa-card-header">
              <h3 className="mesa-card-title">
                <Activity size={18} color="#06b6d4" />
                Evolução do Volume Operado · {stats?.periodo || 'Ao Vivo'}
              </h3>
              <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem' }}>
                <span style={{ color: '#06b6d4', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#06b6d4' }} /> Bruto
                </span>
                <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981' }} /> Líquido
                </span>
              </div>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              {stats?.timeline && stats.timeline.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="brutoGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="liqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" stroke="#64748b" fontSize={11} />
                    <YAxis
                      stroke="#64748b"
                      fontSize={11}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatBRL(val), 'Volume']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#06b6d4', borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="bruto" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#brutoGrad)" />
                    <Area type="monotone" dataKey="liquido" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#liqGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  Aguardando movimentações no período selecionado...
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Distribuição por Fundo (FIDC) */}
          <div className="mesa-card">
            <div className="mesa-card-header">
              <h3 className="mesa-card-title">
                <PieIcon size={18} color="#a855f7" />
                Distribuição por Fundo (FIDC)
              </h3>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              {fidcChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={fidcChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {fidcChartData.map((_, index) => (
                        <Cell key={`fidc-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [formatBRL(val), 'Volume Bruto']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#a855f7', borderRadius: 8 }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      formatter={(value) => <span style={{ color: '#cbd5e1', fontSize: 11 }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  Sem dados para este período
                </div>
              )}
            </div>
          </div>

          {/* Chart 3: Volume por Produto */}
          <div className="mesa-card">
            <div className="mesa-card-header">
              <h3 className="mesa-card-title">
                <BarChart3 size={18} color="#f59e0b" />
                Volume por Produto
              </h3>
            </div>
            <div style={{ width: '100%', height: 260 }}>
              {produtoChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={produtoChartData} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} angle={-20} textAnchor="end" />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatBRL(val), 'Volume']}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#f59e0b', borderRadius: 8 }}
                    />
                    <Bar dataKey="bruto" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                  Sem produtos no período
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── ROW 3: REAL-TIME OPERATIONS TABLE ── */}
        <section className="mesa-table-card">
          <div className="mesa-table-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 className="mesa-card-title" style={{ fontSize: '1rem' }}>
                Carteira de Operações ({filteredOperacoes.length})
              </h3>
              <span className="mesa-badge cyan">{stats?.periodo || 'Ao Vivo'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Buscar cedente, ID, fundo..."
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#ffffff',
                    padding: '6px 10px 6px 30px',
                    borderRadius: 8,
                    fontSize: '0.8rem',
                    outline: 'none'
                  }}
                />
              </div>

              <select
                value={tableStatus}
                onChange={(e) => setTableStatus(e.target.value)}
                style={{
                  backgroundColor: 'rgba(30, 41, 59, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: '0.8rem',
                  outline: 'none'
                }}
              >
                <option value="todas">Status: Todas</option>
                <option value="efetivadas">Efetivadas</option>
                <option value="pendentes">Em Análise / Pendentes</option>
              </select>
            </div>
          </div>

          <div className="mesa-table-wrapper">
            <table className="mesa-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Data / Hora</th>
                  <th>Cedente / Razão Social</th>
                  <th>Fundo (FIDC)</th>
                  <th>Produto</th>
                  <th style={{ textAlign: 'center' }}>Títulos</th>
                  <th style={{ textAlign: 'right' }}>Valor Bruto</th>
                  <th style={{ textAlign: 'right' }}>Valor Líquido</th>
                  <th style={{ textAlign: 'center' }}>Coobrigação</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                      Carregando operações ao vivo...
                    </td>
                  </tr>
                ) : filteredOperacoes.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                      Nenhuma operação encontrada para os critérios selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredOperacoes.slice(0, 50).map((op) => (
                    <tr key={op.id}>
                      <td>
                        <strong style={{ color: '#38bdf8' }}>#{op.id}</strong>
                      </td>
                      <td>
                        {op.dataDeCadastro
                          ? new Date(op.dataDeCadastro).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                          : '--:--'}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f1f5f9' }}>
                          {op.contaOperacional?.cliente?.entidade?.nome || 'Cliente não informado'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {op.contaOperacional?.cliente?.entidade?.documento || ''}
                        </div>
                      </td>
                      <td>
                        <span className="mesa-badge purple">
                          {op.contaOperacional?.unidadeAdministrativa?.alias || op.contaOperacional?.unidadeAdministrativa?.nome || 'FIDC'}
                        </span>
                      </td>
                      <td>{op.contaOperacional?.produto?.descricao || 'Comum'}</td>
                      <td style={{ textAlign: 'center' }}>{op.quantidadeDeTitulos || 0}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#ffffff' }}>
                        {formatBRL(op.totalBruto)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#34d399' }}>
                        {formatBRL(op.totalLiquido)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {op.coobrigacao ? (
                          <span className="mesa-badge success">Sim</span>
                        ) : (
                          <span className="mesa-badge neutral">Não</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {op.efetivada ? (
                          <span className="mesa-badge success">Efetivada</span>
                        ) : (
                          <span className="mesa-badge warning">Em Análise</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
};

export default MesaOperacaoDashboard;
