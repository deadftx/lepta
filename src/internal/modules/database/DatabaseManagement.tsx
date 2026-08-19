import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ChevronUp,
  Clock3, Database, HardDrive, Layers3, Play, RefreshCw, Server,
  ShieldCheck, Table2, XCircle
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import { useAuth } from '../../core/AuthContext';
import './DatabaseManagement.css';

interface SyncResource {
  recurso: string;
  status: string;
  janelasConcluidas: number;
  janelasTotal: number;
  registrosRecebidos: number;
  registrosGravados: number;
  mensagem?: string;
}

interface SyncExecution {
  id: string;
  origem: string;
  solicitadoPor?: string;
  status: string;
  etapa?: string;
  progresso: number;
  registrosRecebidos: number;
  registrosGravados: number;
  iniciadoEm?: string;
  finalizadoEm?: string;
  mensagem?: string;
  erro?: string;
  criadoEm: string;
  resources?: SyncResource[];
}

interface SyncTable {
  nome: string;
  recurso: string;
  tipo: string;
  registros: number;
  colunas: number;
  ultimaSincronizacao?: string;
  columns: string[];
}

interface SyncDashboard {
  schedule: string;
  automaticEnabled: boolean;
  initialDate: string;
  databasePath: string;
  databaseSizeBytes: number;
  active: SyncExecution | null;
  lastSuccess: SyncExecution | null;
  executions: SyncExecution[];
  tables: SyncTable[];
  totalRecords: number;
}

type Notice = { type: 'success' | 'error'; text: string };

const formatDateTime = (value?: string) => value
  ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value))
  : 'Ainda não executado';

const formatNumber = (value?: number) => Number(value || 0).toLocaleString('pt-BR');

const formatBytes = (value?: number) => {
  const bytes = Number(value || 0);
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${units[index]}`;
};

const formatDuration = (execution: SyncExecution) => {
  if (!execution.iniciadoEm) return '—';
  const end = execution.finalizadoEm ? new Date(execution.finalizadoEm).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(execution.iniciadoEm).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}min ${remainingSeconds}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
};

const statusLabel = (status?: string) => ({
  PENDENTE: 'Aguardando', EXECUTANDO: 'Em execução', SUCESSO: 'Concluído', ERRO: 'Falhou'
}[String(status || '').toUpperCase()] || status || 'Não iniciado');

const DatabaseManagement = () => {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<SyncDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  const loadDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/database-sync/status`, {
        headers: getAuthHeaders({ 'Cache-Control': 'no-cache' })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível consultar o banco de dados.');
      setDashboard(payload);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Não foi possível consultar as sincronizações.' });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);
    const interval = window.setInterval(() => loadDashboard(false), 5000);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  const startManualSync = async () => {
    setStarting(true);
    setNotice(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/database-sync/run`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Não foi possível iniciar a sincronização.');
      setNotice({ type: 'success', text: payload.message });
      await loadDashboard(false);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Não foi possível iniciar a sincronização.' });
    } finally {
      setStarting(false);
    }
  };

  const active = dashboard?.active;
  const isRunning = Boolean(active && ['PENDENTE', 'EXECUTANDO'].includes(active.status));
  const canStart = user?.role === 'MASTER';
  const principalTables = useMemo(() => dashboard?.tables.filter(table => table.tipo === 'PRINCIPAL') || [], [dashboard?.tables]);

  if (loading && !dashboard) {
    return <div className="database-page database-loading"><RefreshCw className="spin" size={30} /><strong>Consultando o banco da VPS...</strong></div>;
  }

  return (
    <div className="database-page">
      <header className="database-header">
        <div>
          <span className="database-kicker"><Database size={16} /> Central de dados UNLTD</span>
          <h2>Banco de Dados</h2>
          <p>Backup e espelhamento das bases da API UNLTD no SQLite da LEPTA.</p>
        </div>
        <div className="database-header-actions">
          <button type="button" className="db-refresh-button" onClick={() => loadDashboard(true)} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spin' : ''} /> Atualizar status
          </button>
          <button type="button" className="db-run-button" onClick={startManualSync} disabled={!canStart || isRunning || starting} title={!canStart ? 'Somente usuários MASTER podem iniciar manualmente.' : undefined}>
            <Play size={18} />{starting ? 'Iniciando...' : isRunning ? 'Sincronização em andamento' : 'Sincronizar agora'}
          </button>
        </div>
      </header>

      {notice && (
        <div className={`db-notice ${notice.type}`}>
          {notice.type === 'success' ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
          <span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">×</button>
        </div>
      )}

      <section className="db-overview-grid">
        <article className={`db-overview-card ${isRunning ? 'running' : dashboard?.lastSuccess ? 'success' : ''}`}>
          <span className="db-overview-icon"><ShieldCheck size={23} /></span>
          <div><small>Estado do backup</small><strong>{isRunning ? 'Sincronizando' : dashboard?.lastSuccess ? 'Protegido' : 'Aguardando primeira carga'}</strong></div>
        </article>
        <article className="db-overview-card">
          <span className="db-overview-icon schedule"><CalendarClock size={23} /></span>
          <div><small>Agendamento</small><strong>Todos os dias, 07:30</strong><em>{dashboard?.automaticEnabled ? 'Ativo na VPS principal' : 'DEV: execução manual'}</em></div>
        </article>
        <article className="db-overview-card">
          <span className="db-overview-icon tables"><Layers3 size={23} /></span>
          <div><small>Tabelas da API</small><strong>{formatNumber(dashboard?.tables.length)}</strong><em>{formatNumber(dashboard?.totalRecords)} linhas armazenadas</em></div>
        </article>
        <article className="db-overview-card">
          <span className="db-overview-icon storage"><HardDrive size={23} /></span>
          <div><small>Arquivo SQLite</small><strong>{formatBytes(dashboard?.databaseSizeBytes)}</strong><em>{dashboard?.databasePath || 'database.sqlite'}</em></div>
        </article>
      </section>

      {active && (
        <section className="db-running-card">
          <div className="db-running-header">
            <div className="db-running-title"><RefreshCw className="spin" size={22} /><div><strong>{active.etapa || 'Sincronizando API UNLTD'}</strong><span>{active.mensagem}</span></div></div>
            <b>{Math.max(0, Math.min(100, Number(active.progresso || 0)))}%</b>
          </div>
          <div className="db-progress-track"><span style={{ width: `${active.progresso || 0}%` }} /></div>
          <div className="db-running-metrics">
            <span><small>Início</small>{formatDateTime(active.iniciadoEm || active.criadoEm)}</span>
            <span><small>Recebidos</small>{formatNumber(active.registrosRecebidos)}</span>
            <span><small>Gravados</small>{formatNumber(active.registrosGravados)}</span>
            <span><small>Duração</small>{formatDuration(active)}</span>
          </div>
          {!!active.resources?.length && (
            <div className="db-resource-list">
              {active.resources.map(resource => (
                <div key={resource.recurso} className="db-resource-row">
                  <span className={`db-status-dot ${resource.status.toLowerCase()}`} /><strong>{resource.recurso}</strong>
                  <span>{resource.janelasConcluidas}/{resource.janelasTotal} períodos</span><span>{formatNumber(resource.registrosRecebidos)} registros</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="db-section">
        <div className="db-section-heading">
          <div><Table2 size={20} /><div><h3>Bases espelhadas da API</h3><p>Colunas acompanham os nomes enviados pela UNLTD; listas são armazenadas em tabelas filhas.</p></div></div>
          <span>{principalTables.length} bases principais</span>
        </div>
        {!dashboard?.tables.length ? (
          <div className="db-empty-state"><Database size={42} /><strong>Nenhuma base sincronizada ainda</strong><p>Use “Sincronizar agora” para fazer a primeira carga no DEV.</p></div>
        ) : (
          <div className="db-tables-grid">
            {dashboard.tables.map(table => {
              const expanded = expandedTable === table.nome;
              return (
                <article className={`db-table-card ${table.tipo.toLowerCase()}`} key={table.nome}>
                  <button type="button" className="db-table-summary" onClick={() => setExpandedTable(expanded ? null : table.nome)}>
                    <span className="db-table-icon"><Table2 size={19} /></span>
                    <span className="db-table-name"><strong>{table.nome}</strong><small>{table.tipo === 'FILHA' ? `Detalhes de ${table.recurso}` : 'Base principal'}</small></span>
                    <span className="db-table-count"><strong>{formatNumber(table.registros)}</strong><small>registros</small></span>
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {expanded && (
                    <div className="db-table-details">
                      <div><span>Última atualização</span><strong>{formatDateTime(table.ultimaSincronizacao)}</strong></div>
                      <div><span>Colunas da API</span><strong>{table.columns.length}</strong></div>
                      <div className="db-column-list">{table.columns.map(column => <code key={column}>{column}</code>)}</div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="db-section">
        <div className="db-section-heading"><div><Clock3 size={20} /><div><h3>Histórico de sincronizações</h3><p>Execuções manuais e automáticas ficam registradas no próprio SQLite.</p></div></div></div>
        <div className="db-history-wrap">
          <table className="db-history-table">
            <thead><tr><th>Status</th><th>Origem</th><th>Início</th><th>Duração</th><th>Recebidos</th><th>Mensagem</th></tr></thead>
            <tbody>
              {!dashboard?.executions.length ? <tr><td colSpan={6} className="db-history-empty">Nenhuma execução registrada.</td></tr> : dashboard.executions.map(execution => (
                <tr key={execution.id}>
                  <td><span className={`db-history-status ${execution.status.toLowerCase()}`}>{execution.status === 'SUCESSO' ? <CheckCircle2 size={15} /> : execution.status === 'ERRO' ? <XCircle size={15} /> : <RefreshCw size={15} />}{statusLabel(execution.status)}</span></td>
                  <td>{execution.origem === 'AGENDADO' ? 'Automática' : 'Manual'}<small>{execution.solicitadoPor}</small></td>
                  <td>{formatDateTime(execution.iniciadoEm || execution.criadoEm)}</td><td>{formatDuration(execution)}</td>
                  <td>{formatNumber(execution.registrosRecebidos)}</td><td className="db-history-message">{execution.erro || execution.mensagem || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="db-security-note"><Server size={20} /><div><strong>Execução protegida na VPS</strong><p>O navegador apenas solicita a tarefa. Token, consultas e gravações permanecem no servidor; duas sincronizações nunca são executadas ao mesmo tempo.</p></div></footer>
    </div>
  );
};

export default DatabaseManagement;
