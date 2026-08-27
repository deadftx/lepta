import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../core/AuthContext';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import {
  Activity,
  Server,
  Users,
  Database,
  AlertTriangle,
  GitBranch,
  Search,
  Filter,
  RefreshCw,
  Cpu,
  Radio,
  Zap,
  CheckCircle,
  XCircle,
  Layers,
  TrendingUp,
  Globe,
  Monitor,
  Smartphone,
  Tablet
} from 'lucide-react';
import './MonitorDashboard.css';

interface VpsMetrics {
  hostname: string;
  platform: string;
  arch: string;
  uptimeSeconds: number;
  cpu: { cores: number; model: string; usagePercent: number };
  memory: { totalBytes: number; freeBytes: number; usedBytes: number; usagePercent: number };
  loadAverage: number[];
}

interface Pm2Process {
  name: string;
  environment: string;
  port: number;
  status: string;
  uptimeSeconds: number;
  restarts: number;
  memoryBytes: number;
  cpuPercent: number;
  pmId: number | null;
}

interface GitCommitInfo {
  branch: string;
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface GitComparison {
  dev: GitCommitInfo;
  homolog: GitCommitInfo;
  isSynced: boolean;
  diffStatus: string;
}

interface ActiveUser {
  id: string;
  username: string;
  email: string;
  role: string;
  status: 'online' | 'idle' | 'offline';
  lastSeenAt: string;
  loginAt: string | null;
  currentModule: string;
  currentPath: string;
  totalSessionSeconds: number;
  moduleTimeSeconds: Record<string, number>;
}

interface DbEvent {
  id: string;
  action: string;
  table: string;
  durationMs: number;
  error?: string | null;
  timestamp: string;
}

interface SystemError {
  id: string;
  level: string;
  source: string;
  message: string;
  stack?: string;
  userId?: string;
  path?: string;
  created_at: string;
}

interface SiteAnalyticsData {
  period: string;
  onlineNow: number;
  totalSessions: number;
  totalPageviews: number;
  topPages: { path: string; views: number }[];
  devices: { device_type: string; count: number }[];
  browsers: { browser: string; count: number }[];
}

export const MonitorDashboard: React.FC = () => {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'vps' | 'users' | 'analytics' | 'modules' | 'db' | 'errors'>('vps');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastSync, setLastSync] = useState<string>(new Date().toLocaleTimeString('pt-BR'));

  // Dados do monitor
  const [vps, setVps] = useState<VpsMetrics | null>(null);
  const [pm2, setPm2] = useState<Pm2Process[]>([]);
  const [git, setGit] = useState<GitComparison | null>(null);
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [dbEvents, setDbEvents] = useState<DbEvent[]>([]);
  const [systemErrors, setSystemErrors] = useState<SystemError[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);

  // Analytics do site
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'today' | '7d' | '30d' | 'month'>('today');
  const [siteAnalytics, setSiteAnalytics] = useState<SiteAnalyticsData | null>(null);

  // Filtros
  const [userSearch, setUserSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'online' | 'offline'>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [dbSearch, setDbSearch] = useState('');

  const sseRef = useRef<EventSource | null>(null);

  const fetchOverview = async () => {
    try {
      setErrorMsg(null);
      const res = await fetch(`${API_BASE_URL}/api/monitor/overview`, { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 403) throw new Error('Acesso restrito ao Lepta Master.');
        throw new Error('Falha ao obter telemetria do servidor.');
      }
      const data = await res.json();
      setVps(data.vps || null);
      setPm2(data.pm2 || []);
      setGit(data.git || null);
      setUsers(data.users || []);
      setSystemErrors(data.errors || []);
      if (data.siteAnalytics) setSiteAnalytics(data.siteAnalytics);
      setLastSync(new Date().toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalyticsByPeriod = async (period: 'today' | '7d' | '30d' | 'month') => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/monitor/analytics?period=${period}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setSiteAnalytics(data);
      }
    } catch {}
  };

  const sendHeartbeat = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/monitor/heartbeat`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: window.location.pathname, moduleName: 'Monitor de Operações' })
      });
    } catch {}
  };

  useEffect(() => {
    fetchOverview();
    sendHeartbeat();

    let interval: ReturnType<typeof setInterval> | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchOverview();
        sendHeartbeat();
      }, 10000);
    }

    try {
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || '';
      const sseUrl = `${API_BASE_URL}/api/monitor/stream?token=${encodeURIComponent(token)}`;
      const es = new EventSource(sseUrl);

      es.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === 'db_event') {
            setDbEvents(prev => [payload.data, ...prev.slice(0, 49)]);
          } else if (payload.type === 'system_error') {
            setSystemErrors(prev => [payload.data, ...prev.slice(0, 19)]);
            setAlerts(prev => [`🚨 Erro capturado em tempo real: ${payload.data.message}`, ...prev]);
          } else if (payload.type === 'presence_update' || payload.type === 'site_hit') {
            setLastSync(new Date().toLocaleTimeString('pt-BR'));
          }
        } catch {}
      };

      sseRef.current = es;
    } catch (err) {
      console.warn('SSE stream não suportado ou offline:', err);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (sseRef.current) sseRef.current.close();
    };
  }, [autoRefresh]);

  const handlePeriodChange = (p: 'today' | '7d' | '30d' | 'month') => {
    setAnalyticsPeriod(p);
    fetchAnalyticsByPeriod(p);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds <= 0) return '0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
                          u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    const matchesModule = moduleFilter === 'ALL' || u.currentModule === moduleFilter;
    return matchesSearch && matchesStatus && matchesModule;
  });

  const onlineCount = users.filter(u => u.status === 'online').length;
  const offlineCount = users.filter(u => u.status === 'offline').length;
  const totalUsersCount = users.length;

  const filteredDbEvents = dbEvents.filter(ev => {
    if (!dbSearch) return true;
    const term = dbSearch.toLowerCase();
    return ev.table.toLowerCase().includes(term) ||
           ev.action.toLowerCase().includes(term) ||
           (ev.error && ev.error.toLowerCase().includes(term));
  });

  const uniqueModules = Array.from(new Set(users.map(u => u.currentModule).filter(Boolean)));

  return (
    <div className="monitor-container glass-theme">
      {alerts.length > 0 && (
        <div className="monitor-alert-banner">
          <div className="alert-content">
            <AlertTriangle className="alert-icon" size={20} />
            <span>{alerts[0]}</span>
          </div>
          <button className="btn-dismiss" onClick={() => setAlerts(prev => prev.slice(1))}>
            Fechar
          </button>
        </div>
      )}

      <header className="monitor-header">
        <div className="header-title">
          <div className="brand-badge">
            <Activity className="pulse-icon" size={24} />
            <h1>LEPTA MONITOR <span>REALTIME</span></h1>
          </div>
          <p>Central de controle, telemetria da VPS, status dos serviços PM2, analytics do site e presença em tempo real ({user?.username || 'Master'}).</p>
        </div>

        <div className="header-actions">
          <div className="sync-status">
            <Radio className="online-indicator" size={16} />
            <span>Sincronizado às <strong>{lastSync}</strong></span>
          </div>

          <button
            className={`refresh-btn ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Alternar atualização automática"
          >
            <RefreshCw className={autoRefresh ? 'spin' : ''} size={18} />
            {autoRefresh ? 'Auto 10s' : 'Pausado'}
          </button>

          <button className="primary-refresh-btn" onClick={fetchOverview} disabled={loading}>
            <Zap size={18} /> Atualizar Agora
          </button>
        </div>
      </header>

      {errorMsg && (
        <div className="monitor-error-card">
          <XCircle size={24} />
          <div>
            <h4>Erro de Conectividade com a Telemetria</h4>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Cards de Métricas Principais (KPIs) */}
      <div className="monitor-kpi-grid">
        <div className="kpi-card vps-card">
          <div className="kpi-header">
            <Server size={18} />
            <span>CPU VPS</span>
          </div>
          <div className="kpi-value">
            {vps?.cpu.usagePercent ?? 0}%
          </div>
          <div className="kpi-progress">
            <div className="progress-bar" style={{ width: `${Math.min(100, Math.max(0, vps?.cpu.usagePercent || 0))}%` }}></div>
          </div>
          <small className="kpi-subtext">{vps?.cpu.cores || 1} Cores | Load: {vps?.loadAverage?.join(', ') || '0.0'}</small>
        </div>

        <div className="kpi-card ram-card">
          <div className="kpi-header">
            <Cpu size={18} />
            <span>Memória RAM VPS</span>
          </div>
          <div className="kpi-value">
            {vps?.memory.usagePercent ?? 0}%
          </div>
          <div className="kpi-progress">
            <div className="progress-bar ram" style={{ width: `${Math.min(100, Math.max(0, vps?.memory.usagePercent || 0))}%` }}></div>
          </div>
          <small className="kpi-subtext">{formatBytes(vps?.memory.usedBytes || 0)} / {formatBytes(vps?.memory.totalBytes || 0)}</small>
        </div>

        <div className="kpi-card users-card">
          <div className="kpi-header">
            <Users size={18} />
            <span>Usuários Logados</span>
          </div>
          <div className="kpi-value text-green">
            {onlineCount} <span className="sub-value">/ {totalUsersCount}</span>
          </div>
          <div className="kpi-status-badge">
            <span className="dot green"></span> {onlineCount} Online
            <span className="dot gray"></span> {offlineCount} Offline
          </div>
        </div>

        <div className="kpi-card site-card">
          <div className="kpi-header">
            <Globe size={18} />
            <span>Site lepta.com.br</span>
          </div>
          <div className="kpi-value text-blue">
            {siteAnalytics?.onlineNow || 0} <span className="sub-value">Online no site</span>
          </div>
          <small className="kpi-subtext">
            {siteAnalytics?.totalSessions || 0} sessões hoje | {siteAnalytics?.totalPageviews || 0} pageviews
          </small>
        </div>

        <div className="kpi-card git-card">
          <div className="kpi-header">
            <GitBranch size={18} />
            <span>Status Git DEV x HOMOLOG</span>
          </div>
          <div className={`git-status-tag ${git?.isSynced ? 'synced' : 'ahead'}`}>
            {git?.isSynced ? 'Sincronizado' : 'DEV à Frente'}
          </div>
          <small className="git-hash-summary">
            DEV: <code>{git?.dev.hash}</code> | HOMOLOG: <code>{git?.homolog.hash}</code>
          </small>
        </div>
      </div>

      {/* Navegação por Abas */}
      <nav className="monitor-tabs">
        <button
          className={`tab-btn ${activeTab === 'vps' ? 'active' : ''}`}
          onClick={() => setActiveTab('vps')}
        >
          <Server size={18} /> VPS & Serviços PM2
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <TrendingUp size={18} /> Analytics Site (lepta.com.br)
        </button>
        <button
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={18} /> Usuários & Presença ({onlineCount})
        </button>
        <button
          className={`tab-btn ${activeTab === 'modules' ? 'active' : ''}`}
          onClick={() => setActiveTab('modules')}
        >
          <Layers size={18} /> Tempo por Módulo
        </button>
        <button
          className={`tab-btn ${activeTab === 'db' ? 'active' : ''}`}
          onClick={() => setActiveTab('db')}
        >
          <Database size={18} /> Feed do Banco (Audit)
        </button>
        <button
          className={`tab-btn ${activeTab === 'errors' ? 'active' : ''}`}
          onClick={() => setActiveTab('errors')}
        >
          <AlertTriangle size={18} /> Erros & Alertas ({systemErrors.length})
        </button>
      </nav>

      <main className="tab-content">
        {/* ABA 1: VPS & PM2 & GIT */}
        {activeTab === 'vps' && (
          <div className="tab-pane fade-in">
            <div className="vps-services-grid">
              <section className="monitor-section-card">
                <div className="section-title">
                  <Activity size={20} />
                  <h3>Status dos Serviços PM2 (DEV & HOMOLOG)</h3>
                </div>

                <div className="pm2-process-table-container">
                  <table className="monitor-table">
                    <thead>
                      <tr>
                        <th>Aplicação</th>
                        <th>Ambiente</th>
                        <th>Porta</th>
                        <th>Status</th>
                        <th>Uptime</th>
                        <th>Restarts</th>
                        <th>Memória</th>
                        <th>CPU</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pm2.map(proc => (
                        <tr key={proc.name}>
                          <td className="font-bold">
                            <span className="proc-icon">⚡</span> {proc.name}
                          </td>
                          <td>
                            <span className={`env-badge ${proc.environment.toLowerCase()}`}>
                              {proc.environment}
                            </span>
                          </td>
                          <td><code>:{proc.port}</code></td>
                          <td>
                            <span className={`status-badge ${proc.status}`}>
                              {proc.status === 'online' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                              {proc.status.toUpperCase()}
                            </span>
                          </td>
                          <td>{formatDuration(proc.uptimeSeconds)}</td>
                          <td>{proc.restarts}x</td>
                          <td>{formatBytes(proc.memoryBytes)}</td>
                          <td>{proc.cpuPercent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="monitor-section-card">
                <div className="section-title">
                  <GitBranch size={20} />
                  <h3>Comparador Git GitHub (DEV x HOMOLOG)</h3>
                </div>

                <div className="git-comparison-container">
                  <div className="git-branch-card dev">
                    <div className="branch-header">
                      <span className="branch-tag dev">BRANCH DEV</span>
                      <code>{git?.dev.hash}</code>
                    </div>
                    <h4 className="commit-msg">"{git?.dev.message}"</h4>
                    <div className="commit-meta">
                      <span>Autor: {git?.dev.author}</span>
                      <span>Data: {git?.dev.date ? new Date(git.dev.date).toLocaleString('pt-BR') : '-'}</span>
                    </div>
                  </div>

                  <div className="git-sync-divider">
                    <div className={`sync-pill ${git?.isSynced ? 'synced' : 'ahead'}`}>
                      {git?.isSynced ? '✓ 100% Sincronizado' : '⬆️ DEV à Frente'}
                    </div>
                  </div>

                  <div className="git-branch-card homolog">
                    <div className="branch-header">
                      <span className="branch-tag homolog">BRANCH HOMOLOG</span>
                      <code>{git?.homolog.hash}</code>
                    </div>
                    <h4 className="commit-msg">"{git?.homolog.message}"</h4>
                    <div className="commit-meta">
                      <span>Autor: {git?.homolog.author}</span>
                      <span>Data: {git?.homolog.date ? new Date(git.homolog.date).toLocaleString('pt-BR') : '-'}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ABA ANALYTICS DO SITE INSTITUCIONAL */}
        {activeTab === 'analytics' && (
          <div className="tab-pane fade-in">
            <div className="filter-bar">
              <div className="analytics-period-selector">
                <span className="filter-label">Filtro de Período:</span>
                <button className={`period-btn ${analyticsPeriod === 'today' ? 'active' : ''}`} onClick={() => handlePeriodChange('today')}>Hoje</button>
                <button className={`period-btn ${analyticsPeriod === '7d' ? 'active' : ''}`} onClick={() => handlePeriodChange('7d')}>Últimos 7 Dias</button>
                <button className={`period-btn ${analyticsPeriod === '30d' ? 'active' : ''}`} onClick={() => handlePeriodChange('30d')}>Últimos 30 Dias</button>
                <button className={`period-btn ${analyticsPeriod === 'month' ? 'active' : ''}`} onClick={() => handlePeriodChange('month')}>Mês Atual</button>
              </div>
            </div>

            <div className="analytics-kpi-summary">
              <div className="analytics-card">
                <div className="an-card-header"><Radio className="online-indicator" size={16} /> Visitantes no Site Agora</div>
                <div className="an-card-value text-green">{siteAnalytics?.onlineNow || 0}</div>
                <small>Últimos 5 minutos no lepta.com.br</small>
              </div>

              <div className="analytics-card">
                <div className="an-card-header"><Globe size={16} /> Sessões Abertas</div>
                <div className="an-card-value text-blue">{siteAnalytics?.totalSessions || 0}</div>
                <small>Sessões únicas no período selecionado</small>
              </div>

              <div className="analytics-card">
                <div className="an-card-header"><TrendingUp size={16} /> Total de Pageviews</div>
                <div className="an-card-value text-purple">{siteAnalytics?.totalPageviews || 0}</div>
                <small>Visualizações de páginas acumuladas</small>
              </div>
            </div>

            <div className="analytics-details-grid">
              {/* Páginas mais acessadas */}
              <section className="monitor-section-card">
                <div className="section-title">
                  <Globe size={20} />
                  <h3>Páginas Mais Acessadas</h3>
                </div>

                <div className="top-pages-list">
                  {(!siteAnalytics?.topPages || siteAnalytics.topPages.length === 0) ? (
                    <p className="no-activity">Nenhum acesso registrado no período.</p>
                  ) : (
                    siteAnalytics.topPages.map(p => {
                      const pct = siteAnalytics.totalPageviews > 0 ? Math.round((p.views / siteAnalytics.totalPageviews) * 100) : 0;
                      return (
                        <div key={p.path} className="page-hit-item">
                          <div className="page-hit-info">
                            <code>{p.path}</code>
                            <span>{p.views} views ({pct}%)</span>
                          </div>
                          <div className="page-hit-bar">
                            <div className="page-hit-fill" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              {/* Distribuição de Dispositivos e Navegadores */}
              <section className="monitor-section-card">
                <div className="section-title">
                  <Monitor size={20} />
                  <h3>Tecnologia dos Visitantes</h3>
                </div>

                <div className="device-distribution-group">
                  <h4>Dispositivos</h4>
                  <div className="devices-badges">
                    {(!siteAnalytics?.devices || siteAnalytics.devices.length === 0) ? (
                      <p className="no-activity">Sem dados suficientes.</p>
                    ) : (
                      siteAnalytics.devices.map(d => (
                        <div key={d.device_type} className="device-pill">
                          {d.device_type === 'Mobile' ? <Smartphone size={16} /> : d.device_type === 'Tablet' ? <Tablet size={16} /> : <Monitor size={16} />}
                          <span>{d.device_type}: <strong>{d.count}</strong></span>
                        </div>
                      ))
                    )}
                  </div>

                  <h4 className="mt-4">Navegadores</h4>
                  <div className="browsers-list">
                    {(!siteAnalytics?.browsers || siteAnalytics.browsers.length === 0) ? (
                      <p className="no-activity">Sem dados suficientes.</p>
                    ) : (
                      siteAnalytics.browsers.map(b => (
                        <span key={b.browser} className="browser-tag">
                          {b.browser}: <strong>{b.count}</strong>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ABA 2: USUÁRIOS ONLINE & PRESENÇA */}
        {activeTab === 'users' && (
          <div className="tab-pane fade-in">
            <div className="filter-bar">
              <div className="search-input-wrapper">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Buscar usuário por nome ou e-mail..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <Filter size={16} />
                <select value={statusFilter} onChange={(e: any) => setStatusFilter(e.target.value)}>
                  <option value="ALL">Todos os Status</option>
                  <option value="online">Apenas Online</option>
                  <option value="offline">Apenas Offline</option>
                </select>

                <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
                  <option value="ALL">Todos os Módulos</option>
                  {uniqueModules.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="users-table-wrapper glass-panel">
              <table className="monitor-table">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>E-mail</th>
                    <th>Papel</th>
                    <th>Status Presença</th>
                    <th>Módulo Atual</th>
                    <th>Sessão Ativa</th>
                    <th>Última Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-4">Nenhum usuário encontrado com os filtros aplicados.</td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id}>
                        <td className="font-bold flex-user">
                          <div className="user-avatar-mini">
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          {u.username}
                        </td>
                        <td>{u.email || '-'}</td>
                        <td>
                          <span className={`role-badge ${u.role.toLowerCase()}`}>{u.role}</span>
                        </td>
                        <td>
                          <span className={`presence-pill ${u.status}`}>
                            <span className="dot"></span>
                            {u.status === 'online' ? 'Online Now' : u.status === 'idle' ? 'Ausente' : 'Offline'}
                          </span>
                        </td>
                        <td>
                          <span className="module-tag">{u.currentModule}</span>
                        </td>
                        <td>{formatDuration(u.totalSessionSeconds)}</td>
                        <td>{u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleTimeString('pt-BR') : '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA 3: TEMPO POR MÓDULO */}
        {activeTab === 'modules' && (
          <div className="tab-pane fade-in">
            <div className="modules-time-grid">
              {users.map(u => (
                <div key={u.id} className="user-module-card glass-panel">
                  <div className="card-header">
                    <h4>{u.username}</h4>
                    <span className="total-time">Total: {formatDuration(u.totalSessionSeconds)}</span>
                  </div>

                  <div className="module-bars">
                    {Object.keys(u.moduleTimeSeconds).length === 0 ? (
                      <p className="no-activity">Nenhuma atividade registrada ainda nesta sessão.</p>
                    ) : (
                      Object.entries(u.moduleTimeSeconds).map(([mod, secs]) => {
                        const pct = u.totalSessionSeconds > 0 ? Math.round((secs / u.totalSessionSeconds) * 100) : 0;
                        return (
                          <div key={mod} className="module-progress-item">
                            <div className="mod-label">
                              <span>{mod}</span>
                              <span>{formatDuration(secs)} ({pct}%)</span>
                            </div>
                            <div className="mod-bar">
                              <div className="mod-fill" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABA 4: FEED DO BANCO DE DADOS */}
        {activeTab === 'db' && (
          <div className="tab-pane fade-in">
            <div className="filter-bar">
              <div className="search-input-wrapper">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="Filtrar por tabela ou ação (ex: compras_requisicoes, INSERT)..."
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                />
              </div>
              <span className="live-counter">📡 Total de eventos escutados: {dbEvents.length}</span>
            </div>

            <div className="db-events-list glass-panel">
              {filteredDbEvents.length === 0 ? (
                <div className="empty-state">
                  <Database size={32} />
                  <p>Aguardando operações no banco SQLite... (Ações de INSERT, UPDATE e DELETE aparecerão aqui ao vivo).</p>
                </div>
              ) : (
                filteredDbEvents.map(ev => (
                  <div key={ev.id} className={`db-event-item ${ev.error ? 'error' : ''}`}>
                    <div className="action-tag">
                      <span className={`act-badge ${ev.action.toLowerCase()}`}>{ev.action}</span>
                      <strong className="table-name">"{ev.table}"</strong>
                    </div>

                    <div className="event-meta">
                      <span className="duration">⏱️ {ev.durationMs}ms</span>
                      <span className="time">{new Date(ev.timestamp).toLocaleTimeString('pt-BR')}</span>
                    </div>

                    {ev.error && (
                      <div className="error-detail">
                        ❌ Erro: {ev.error}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ABA 5: ERROS & ALERTAS */}
        {activeTab === 'errors' && (
          <div className="tab-pane fade-in">
            <div className="errors-list glass-panel">
              {systemErrors.length === 0 ? (
                <div className="empty-state green">
                  <CheckCircle size={36} />
                  <h3>Nenhum erro de sistema registrado!</h3>
                  <p>A aplicação está operando de forma saudável sem exceções 5xx.</p>
                </div>
              ) : (
                systemErrors.map(err => (
                  <div key={err.id} className="system-error-card">
                    <div className="err-header">
                      <span className={`err-level ${err.level.toLowerCase()}`}>{err.level}</span>
                      <span className="err-source">Origem: {err.source}</span>
                      <span className="err-time">{new Date(err.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <h4 className="err-message">{err.message}</h4>
                    {err.stack && <pre className="err-stack">{err.stack}</pre>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MonitorDashboard;
