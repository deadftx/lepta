import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Landmark, RefreshCw, Copy, Check, Play, ShieldCheck,
  CheckCircle2, AlertTriangle, Search, FileJson,
  Layers, ArrowUpRight, DollarSign, Calendar, X
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './GrafenoIntegration.css';

interface WebhookEventItem {
  id: string;
  event_type: string;
  event_id?: string;
  transaction_id?: string;
  amount?: number;
  document?: string;
  name?: string;
  status: string;
  raw_payload: Record<string, unknown>;
  headers?: Record<string, string>;
  ip_address?: string;
  created_at: string;
}

interface GrafenoMetrics {
  totalEvents: number;
  todayEvents: number;
  totalTransactions: number;
  totalAmountNotified: number;
  lastEventTime: string | null;
  lastEventType: string | null;
  status: string;
}

const formatCurrency = (value?: number) => {
  return (value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Aguardando';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium'
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export const GrafenoIntegration: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [metrics, setMetrics] = useState<GrafenoMetrics | null>(null);
  const [events, setEvents] = useState<WebhookEventItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [selectedPayload, setSelectedPayload] = useState<WebhookEventItem | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [overviewRes, eventsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/grafeno/overview`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE_URL}/api/grafeno/events?limit=100`, { headers: getAuthHeaders() })
      ]);

      if (overviewRes.ok) {
        const overviewData = await overviewRes.json();
        // Constrói URL absoluta baseada no navegador ou retornado pelo backend
        const fullUrl = overviewData.webhookUrl || `${window.location.origin}/api/webhooks/grafeno`;
        setWebhookUrl(fullUrl);
        setMetrics(overviewData.metrics);
      }

      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.items || []);
      }
    } catch (error) {
      console.error('Erro ao carregar dados da Grafeno:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
    const interval = setInterval(() => loadData(false), 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyJson = async (data: Record<string, unknown>) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSimulateTest = async () => {
    setSimulating(true);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/grafeno/test-webhook`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          eventType: 'cobranca.liquidada',
          amount: 24800.00
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao simular webhook.');

      setNotice({ type: 'success', text: 'Evento de teste simulado com sucesso e persistido no SQLite!' });
      await loadData(false);
    } catch (error) {
      setNotice({
        type: 'error',
        text: error instanceof Error ? error.message : 'Erro ao simular webhook.'
      });
    } finally {
      setSimulating(false);
    }
  };

  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return events;
    const term = searchTerm.toLowerCase();
    return events.filter(e =>
      e.event_type.toLowerCase().includes(term) ||
      (e.name && e.name.toLowerCase().includes(term)) ||
      (e.document && e.document.toLowerCase().includes(term)) ||
      (e.transaction_id && e.transaction_id.toLowerCase().includes(term)) ||
      (e.status && e.status.toLowerCase().includes(term))
    );
  }, [events, searchTerm]);

  return (
    <div className="grafeno-page">
      {/* Cabeçalho */}
      <header className="grafeno-header">
        <div>
          <span className="grafeno-kicker">
            <Landmark size={16} /> Financeiro • Integração Bancária
          </span>
          <h2>LEPTA x GRAFENO</h2>
          <p>
            Receptor de webhooks, confirmação de API e alimentação de transações bancárias no SQLite da LEPTA.
          </p>
        </div>
        <div className="grafeno-header-actions">
          <button
            type="button"
            className="grafeno-btn grafeno-btn-secondary"
            onClick={() => loadData(true)}
            disabled={loading}
          >
            <RefreshCw size={17} className={loading ? 'grafeno-spin' : ''} />
            Atualizar Feed
          </button>
          <button
            type="button"
            className="grafeno-btn grafeno-btn-orange"
            onClick={handleSimulateTest}
            disabled={simulating}
          >
            <Play size={17} />
            {simulating ? 'Simulando...' : 'Simular Webhook de Teste'}
          </button>
        </div>
      </header>

      {/* Notificações */}
      {notice && (
        <div className={`grafeno-notice ${notice.type}`}>
          {notice.type === 'success' ? <CheckCircle2 size={19} /> : <AlertTriangle size={19} />}
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      )}

      {/* Hero Card - URL Oficial de Confirmação */}
      <section className="grafeno-hero-card">
        <div className="grafeno-hero-top">
          <div className="grafeno-hero-title-wrap">
            <div className="grafeno-hero-icon">
              <ShieldCheck size={24} />
            </div>
            <div>
              <strong>URL Oficial de Confirmação & Webhook</strong>
              <span>Esta é a URL que você deve enviar para a Grafeno validar e liberar a API.</span>
            </div>
          </div>
          <div className="grafeno-status-tag">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
            Receptor Ativo na VPS (200 OK)
          </div>
        </div>

        <div className="grafeno-url-input-container">
          <input
            type="text"
            readOnly
            value={webhookUrl || `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/grafeno`}
            className="grafeno-url-input"
            onClick={e => (e.target as HTMLInputElement).select()}
          />
          <button
            type="button"
            className={`grafeno-url-copy-btn ${copiedUrl ? 'copied' : ''}`}
            onClick={handleCopyUrl}
          >
            {copiedUrl ? <Check size={17} /> : <Copy size={17} />}
            {copiedUrl ? 'Copiada!' : 'Copiar URL'}
          </button>
        </div>

        <div className="grafeno-hero-footer">
          <div className="grafeno-specs-list">
            <span><strong>Métodos:</strong> POST e GET (Handshake)</span>
            <span><strong>Content-Type:</strong> application/json</span>
            <span><strong>Resposta:</strong> 200 OK Imediato</span>
          </div>
          <span>Pronto para receber notificações 24/7 na VPS</span>
        </div>
      </section>

      {/* Métricas Rápidas */}
      <section className="grafeno-metrics-grid">
        <article className="grafeno-metric-card">
          <div className="grafeno-metric-icon">
            <Layers size={22} />
          </div>
          <div className="grafeno-metric-info">
            <small>Total de Eventos</small>
            <strong>{metrics?.totalEvents || 0}</strong>
            <em>Notificações recebidas</em>
          </div>
        </article>

        <article className="grafeno-metric-card">
          <div className="grafeno-metric-icon green">
            <Calendar size={22} />
          </div>
          <div className="grafeno-metric-info">
            <small>Eventos Hoje</small>
            <strong>{metrics?.todayEvents || 0}</strong>
            <em>Recebidos hoje</em>
          </div>
        </article>

        <article className="grafeno-metric-card">
          <div className="grafeno-metric-icon orange">
            <DollarSign size={22} />
          </div>
          <div className="grafeno-metric-info">
            <small>Volume Notificado</small>
            <strong>{formatCurrency(metrics?.totalAmountNotified)}</strong>
            <em>Total transacionado</em>
          </div>
        </article>

        <article className="grafeno-metric-card">
          <div className="grafeno-metric-icon purple">
            <ArrowUpRight size={22} />
          </div>
          <div className="grafeno-metric-info">
            <small>Último Evento</small>
            <strong>{metrics?.lastEventTime ? formatDateTime(metrics.lastEventTime) : 'Nenhum'}</strong>
            <em>{metrics?.lastEventType || 'Aguardando primeira chamada'}</em>
          </div>
        </article>
      </section>

      {/* Feed de Eventos e Transações */}
      <section className="grafeno-section">
        <div className="grafeno-section-header">
          <div className="grafeno-section-title">
            <FileJson size={20} />
            <div>
              <h3>Feed de Eventos e Transações em Tempo Real</h3>
              <p>Histórico completo de notificações e payloads recebidos pela URL de confirmação.</p>
            </div>
          </div>
          <div className="grafeno-search-wrap">
            <Search size={16} color="#64748b" />
            <input
              type="text"
              placeholder="Buscar por evento, documento, nome..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {!filteredEvents.length ? (
          <div className="grafeno-empty">
            <Landmark size={44} opacity={0.35} />
            <strong>Nenhum evento registrado no momento</strong>
            <p>
              Assim que a Grafeno enviar a confirmação ou transações para a URL acima, elas aparecerão aqui automaticamente.
            </p>
            <button
              type="button"
              className="grafeno-btn grafeno-btn-secondary"
              onClick={handleSimulateTest}
              style={{ marginTop: '0.6rem' }}
            >
              <Play size={16} /> Disparar Evento de Teste Agora
            </button>
          </div>
        ) : (
          <div className="grafeno-table-wrap">
            <table className="grafeno-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Tipo do Evento</th>
                  <th>ID Transação</th>
                  <th>Valor</th>
                  <th>Favorecido / Pagador</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map(event => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.created_at)}</td>
                    <td>
                      <span className="grafeno-badge-event">{event.event_type}</span>
                    </td>
                    <td>{event.transaction_id || event.event_id || '—'}</td>
                    <td style={{ color: event.amount ? '#34d399' : '#94a3b8', fontWeight: 700 }}>
                      {event.amount ? formatCurrency(event.amount) : '—'}
                    </td>
                    <td>
                      <div>
                        <strong style={{ color: '#cbd5e1', display: 'block', fontSize: '0.82rem' }}>
                          {event.name || '—'}
                        </strong>
                        {event.document && (
                          <small style={{ color: '#64748b' }}>{event.document}</small>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`grafeno-badge-status ${String(event.status).toLowerCase()}`}>
                        {event.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="grafeno-view-btn"
                        onClick={() => setSelectedPayload(event)}
                      >
                        <FileJson size={14} /> Ver JSON
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Guia de Homologação */}
      <section className="grafeno-guide-card">
        <h4>
          <ShieldCheck size={18} color="#38bdf8" /> Como homologar e liberar a API da Grafeno
        </h4>
        <div className="grafeno-guide-steps">
          <div className="grafeno-guide-step">
            <span className="grafeno-step-num">1</span>
            <strong>Copie a URL</strong>
            <span>Copie a URL Oficial de Confirmação no card superior desta página.</span>
          </div>
          <div className="grafeno-guide-step">
            <span className="grafeno-step-num">2</span>
            <strong>Envie para a Grafeno</strong>
            <span>Forneça o link para a equipe de integração ou cadastre no portal de desenvolvedores da Grafeno.</span>
          </div>
          <div className="grafeno-guide-step">
            <span className="grafeno-step-num">3</span>
            <strong>Validação Automática</strong>
            <span>A Grafeno enviará uma requisição de validação. Nosso servidor responderá 200 OK imediatamente.</span>
          </div>
          <div className="grafeno-guide-step">
            <span className="grafeno-step-num">4</span>
            <strong>Liberação das Chaves</strong>
            <span>Com a URL validada, a Grafeno liberará as chaves de API para consultas ativas de extratos e saldos.</span>
          </div>
        </div>
      </section>

      {/* Modal de Visualização de Payload JSON */}
      {selectedPayload && (
        <div className="grafeno-modal-backdrop" onClick={() => setSelectedPayload(null)}>
          <div className="grafeno-modal-card" onClick={e => e.stopPropagation()}>
            <header className="grafeno-modal-header">
              <h3>
                <FileJson size={18} /> Payload Completo do Evento ({selectedPayload.event_type})
              </h3>
              <button
                type="button"
                className="grafeno-view-btn"
                style={{ border: 0, padding: 6 }}
                onClick={() => setSelectedPayload(null)}
              >
                <X size={20} />
              </button>
            </header>
            <div className="grafeno-modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  Recebido em: <strong>{formatDateTime(selectedPayload.created_at)}</strong> • IP: {selectedPayload.ip_address || '—'}
                </span>
                <button
                  type="button"
                  className="grafeno-view-btn"
                  onClick={() => handleCopyJson(selectedPayload.raw_payload)}
                >
                  {copiedJson ? <Check size={14} /> : <Copy size={14} />}
                  {copiedJson ? 'Copiado!' : 'Copiar JSON'}
                </button>
              </div>
              <pre className="grafeno-json-viewer">
                {JSON.stringify(selectedPayload.raw_payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GrafenoIntegration;
