import React, { useState, useEffect } from 'react';
import {
  Mail, Server, Lock, Send, CheckCircle2, AlertCircle, Eye, EyeOff,
  RefreshCw, ShieldCheck, Globe, Check, Users, UserPlus, Plus,
  FileText, CheckCheck, XCircle, Clock, DollarSign,
  AlertTriangle, Key, ShieldAlert
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './EmailConfig.css';

interface EmailConfigData {
  auth_type?: 'GRAPH' | 'SMTP';
  azure_tenant_id?: string;
  azure_client_id?: string;
  hasAzureSecret?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  from_name?: string;
  from_email?: string;
  to_finance_email?: string;
  app_base_url?: string;
  hasPassword?: boolean;
}

interface DestinatarioItem {
  type: 'USER' | 'CUSTOM';
  email: string;
  name?: string;
  userId?: string;
}

interface FluxoEventoConfig {
  evento: string;
  destinatarios: DestinatarioItem[];
  notificar_solicitante: boolean;
  updated_at?: string;
  updated_by?: string;
}

interface SystemUser {
  id: string;
  username: string;
  email: string;
  role?: string;
}

// Utilitário de normalização ultra-defensivo para evitar qualquer crash
function safeNormalizeDestinatario(dest: any): DestinatarioItem | null {
  if (!dest) return null;
  if (typeof dest === 'string') {
    const clean = dest.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return null;
    return {
      type: 'CUSTOM',
      email: clean,
      name: clean.split('@')[0]
    };
  }
  if (typeof dest === 'object') {
    const email = typeof dest.email === 'string' ? dest.email.trim().toLowerCase() : '';
    if (!email || !email.includes('@')) return null;
    return {
      type: dest.type === 'USER' ? 'USER' : 'CUSTOM',
      email,
      name: typeof dest.name === 'string' && dest.name ? dest.name : email.split('@')[0],
      userId: typeof dest.userId === 'string' ? dest.userId : undefined
    };
  }
  return null;
}

const EVENTOS_METADATA: Record<string, {
  categoria: 'CRIAÇÃO' | 'DIRETORIA' | 'JURÍDICO' | 'FINANCEIRO';
  titulo: string;
  descricao: string;
  badge: string;
  badgeClass: string;
  icon: React.FC<{ size?: number; className?: string }>;
}> = {
  SOLICITACAO_CRIADA: {
    categoria: 'CRIAÇÃO',
    titulo: '1. Nova Solicitação Criada',
    descricao: 'Disparado assim que uma nova solicitação é registrada no sistema.',
    badge: 'Nova Solicitação',
    badgeClass: 'badge-sky',
    icon: FileText
  },
  DIRETORIA_APROVADA: {
    categoria: 'DIRETORIA',
    titulo: '2. Aprovada pela Diretoria',
    descricao: 'Disparado quando um aprovador da diretoria ou master aprova a solicitação.',
    badge: 'Diretoria Aprovou',
    badgeClass: 'badge-green',
    icon: CheckCheck
  },
  DIRETORIA_NEGADA: {
    categoria: 'DIRETORIA',
    titulo: '3. Negada pela Diretoria',
    descricao: 'Disparado quando a solicitação é recusada/negada pela diretoria.',
    badge: 'Diretoria Negou',
    badgeClass: 'badge-red',
    icon: XCircle
  },
  JURIDICO_APROVADO: {
    categoria: 'JURÍDICO',
    titulo: '4. Parecer Jurídico Aprovado',
    descricao: 'Disparado quando o departamento jurídico valida e aprova a solicitação.',
    badge: 'Jurídico Aprovou',
    badgeClass: 'badge-purple',
    icon: CheckCheck
  },
  JURIDICO_NEGADO: {
    categoria: 'JURÍDICO',
    titulo: '5. Parecer Jurídico Reprovado',
    descricao: 'Disparado quando o parecer jurídico for desfavorável ou rejeitado.',
    badge: 'Jurídico Reprovou',
    badgeClass: 'badge-red',
    icon: XCircle
  },
  FINANCEIRO_RECEBIDA: {
    categoria: 'FINANCEIRO',
    titulo: '6. Chegada ao Financeiro',
    descricao: 'Disparado quando a solicitação completa aprovações e entra na fila do Financeiro.',
    badge: 'Pronta p/ Pagamento',
    badgeClass: 'badge-blue',
    icon: DollarSign
  },
  FINANCEIRO_AGENDADA: {
    categoria: 'FINANCEIRO',
    titulo: '7. Pagamento Agendado',
    descricao: 'Disparado quando o Financeiro define a data prevista de pagamento ou cronograma de parcelas.',
    badge: 'Data Agendada',
    badgeClass: 'badge-amber',
    icon: Clock
  },
  FINANCEIRO_PAGA: {
    categoria: 'FINANCEIRO',
    titulo: '8. Pagamento Concluído / Aprovado',
    descricao: 'Disparado quando o Financeiro efetua o pagamento e realiza a baixa da solicitação.',
    badge: 'Baixa Concluída',
    badgeClass: 'badge-emerald',
    icon: CheckCheck
  },
  FINANCEIRO_REJEITADA: {
    categoria: 'FINANCEIRO',
    titulo: '9. Devolvida para Revisão',
    descricao: 'Disparado quando o Financeiro encontra pendências e devolve para reaprovação.',
    badge: 'Devolvida p/ Revisão',
    badgeClass: 'badge-orange',
    icon: AlertTriangle
  }
};

// Error Boundary para proteger abas de qualquer erro imprevisto
class TabErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; errorText: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorText: error?.message || 'Erro inesperado na renderização.' };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('Erro capturado no TabErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ec-alert error" style={{ margin: '2rem', padding: '1.5rem' }}>
          <AlertCircle size={24} />
          <div>
            <strong>Ocorreu um problema ao exibir os destinatários:</strong>
            <p style={{ margin: '6px 0 0 0', fontSize: '0.85rem' }}>{this.state.errorText}</p>
            <button
              type="button"
              className="ec-btn-save"
              style={{ marginTop: '12px' }}
              onClick={() => this.setState({ hasError: false, errorText: '' })}
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const EmailConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'remetente' | 'destinatarios'>('remetente');

  // Configurações do Microsoft Entra ID (Azure AD) - Exclusivo para sistema@lepta.com.br
  const [azureTenantId, setAzureTenantId] = useState('f376d8b7-1a55-4cfb-a8e1-3e2799e0918e');
  const [azureClientId, setAzureClientId] = useState('27281728-09ae-4d31-9fa6-3c93f748e78b');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  const [showAzureSecret, setShowAzureSecret] = useState(false);
  const [hasAzureSecretSaved, setHasAzureSecretSaved] = useState(true);

  // Remetente fixo padrão da Lepta
  const [fromName, setFromName] = useState('LeptaSys');
  const [fromEmail, setFromEmail] = useState('sistema@lepta.com.br');
  const [toFinanceEmail, setToFinanceEmail] = useState('pagamentos@lepta.com.br');
  const [appBaseUrl, setAppBaseUrl] = useState('https://lepta.com.br');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testWarning, setTestWarning] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Estados dos Destinatários do Fluxo
  const [fluxoEventos, setFluxoEventos] = useState<FluxoEventoConfig[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [savingFluxo, setSavingFluxo] = useState(false);
  const [fluxoSuccess, setFluxoSuccess] = useState<string | null>(null);
  const [fluxoError, setFluxoError] = useState<string | null>(null);

  // Inputs locais de seleção
  const [selectedUserPerEvento, setSelectedUserPerEvento] = useState<Record<string, string>>({});
  const [manualEmailPerEvento, setManualEmailPerEvento] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchConfig();
    fetchFluxoConfig();
    fetchSystemUsers();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracao-email`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data: EmailConfigData = await res.json();
        setAzureTenantId(data.azure_tenant_id || 'f376d8b7-1a55-4cfb-a8e1-3e2799e0918e');
        setAzureClientId(data.azure_client_id || '27281728-09ae-4d31-9fa6-3c93f748e78b');
        setHasAzureSecretSaved(Boolean(data.hasAzureSecret));
        setFromName(data.from_name || 'LeptaSys');
        setFromEmail(data.from_email || 'sistema@lepta.com.br');
        setToFinanceEmail(data.to_finance_email || 'pagamentos@lepta.com.br');
        setAppBaseUrl(data.app_base_url || 'https://lepta.com.br');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de e-mail:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFluxoConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracao-email/fluxo`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.eventos)) {
          // Normaliza os destinatários de cada evento recebido
          const sanitized = data.eventos.map((ev: any) => {
            const rawList = Array.isArray(ev?.destinatarios) ? ev.destinatarios : [];
            const cleanList = rawList
              .map(safeNormalizeDestinatario)
              .filter((d: any): d is DestinatarioItem => d !== null);
            return {
              evento: String(ev?.evento || ''),
              destinatarios: cleanList,
              notificar_solicitante: Boolean(ev?.notificar_solicitante)
            };
          });
          setFluxoEventos(sanitized);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar fluxo de e-mails:', error);
    }
  };

  const fetchSystemUsers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracao-email/usuarios-sistema`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          // Garante apenas usuários que tenham email válido em string
          const validUsers = data.users.filter(
            (u: any) => u && typeof u.email === 'string' && u.email.trim().includes('@')
          );
          setSystemUsers(validUsers);
        }
      }
    } catch (error) {
      console.error('Erro ao listar usuários do sistema:', error);
    }
  };

  const handleSaveRemetente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setTestError(null);
    setTestWarning(null);
    setTestSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracao-email`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auth_type: 'GRAPH',
          azure_tenant_id: azureTenantId,
          azure_client_id: azureClientId,
          azure_client_secret: azureClientSecret || undefined,
          from_name: fromName,
          from_email: fromEmail,
          to_finance_email: toFinanceEmail,
          app_base_url: appBaseUrl
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSaveSuccess('Configurações do Microsoft Entra ID salvas com sucesso!');
        if (azureClientSecret) {
          setHasAzureSecretSaved(true);
          setAzureClientSecret('');
        }
        setTimeout(() => setSaveSuccess(null), 5000);
      } else {
        setTestError(data.error || 'Não foi possível salvar as configurações.');
      }
    } catch (error: any) {
      setTestError(error.message || 'Erro de conexão ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestSuccess(null);
    setTestWarning(null);
    setTestError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracao-email/test`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auth_type: 'GRAPH',
          azure_tenant_id: azureTenantId,
          azure_client_id: azureClientId,
          azure_client_secret: azureClientSecret || undefined,
          from_name: fromName,
          from_email: fromEmail,
          test_recipient: toFinanceEmail
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestSuccess(`✅ ${data.message || 'Autenticado no Azure e e-mail de teste disparado com sucesso!'}`);
      } else if (data.adminConsentPending) {
        setTestWarning(`⚠️ ${data.error}`);
      } else {
        setTestError(`❌ Falha no teste Microsoft Graph: ${data.error || 'Verifique as credenciais.'}`);
      }
    } catch (error: any) {
      setTestError(`❌ Erro ao testar: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleToggleNotificarSolicitante = (eventoKey: string) => {
    setFluxoEventos(prev =>
      prev.map(ev =>
        ev.evento === eventoKey
          ? { ...ev, notificar_solicitante: !ev.notificar_solicitante }
          : ev
      )
    );
  };

  const handleAddSystemUser = (eventoKey: string) => {
    const userId = selectedUserPerEvento[eventoKey];
    if (!userId) return;

    const userObj = systemUsers.find(u => u.id === userId);
    if (!userObj || !userObj.email) return;

    setFluxoEventos(prev =>
      prev.map(ev => {
        if (ev.evento !== eventoKey) return ev;
        const currentList = Array.isArray(ev.destinatarios) ? ev.destinatarios : [];
        const exists = currentList.some(
          d => (d?.email || '').toLowerCase() === userObj.email.toLowerCase()
        );
        if (exists) return ev;
        return {
          ...ev,
          destinatarios: [
            ...currentList,
            {
              type: 'USER',
              email: userObj.email.toLowerCase(),
              name: userObj.username,
              userId: userObj.id
            }
          ]
        };
      })
    );

    setSelectedUserPerEvento(prev => ({ ...prev, [eventoKey]: '' }));
  };

  const handleAddManualEmail = (eventoKey: string) => {
    const emailRaw = (manualEmailPerEvento[eventoKey] || '').trim().toLowerCase();
    if (!emailRaw) return;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      alert('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    setFluxoEventos(prev =>
      prev.map(ev => {
        if (ev.evento !== eventoKey) return ev;
        const currentList = Array.isArray(ev.destinatarios) ? ev.destinatarios : [];
        const exists = currentList.some(
          d => (d?.email || '').toLowerCase() === emailRaw
        );
        if (exists) return ev;
        return {
          ...ev,
          destinatarios: [
            ...currentList,
            {
              type: 'CUSTOM',
              email: emailRaw,
              name: emailRaw.split('@')[0]
            }
          ]
        };
      })
    );

    setManualEmailPerEvento(prev => ({ ...prev, [eventoKey]: '' }));
  };

  const handleRemoveDestinatario = (eventoKey: string, emailToRemove: string) => {
    setFluxoEventos(prev =>
      prev.map(ev => {
        if (ev.evento !== eventoKey) return ev;
        const currentList = Array.isArray(ev.destinatarios) ? ev.destinatarios : [];
        return {
          ...ev,
          destinatarios: currentList.filter(
            d => (d?.email || '').toLowerCase() !== emailToRemove.toLowerCase()
          )
        };
      })
    );
  };

  const handleSaveFluxo = async () => {
    setSavingFluxo(true);
    setFluxoSuccess(null);
    setFluxoError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracao-email/fluxo`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventos: fluxoEventos })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFluxoSuccess('Destinatários do fluxo financeiro salvos com sucesso!');
        setTimeout(() => setFluxoSuccess(null), 5000);
      } else {
        setFluxoError(data.error || 'Erro ao salvar configuração de fluxo.');
      }
    } catch (err: any) {
      setFluxoError(err.message || 'Erro ao conectar ao servidor.');
    } finally {
      setSavingFluxo(false);
    }
  };

  if (loading) {
    return (
      <div className="ec-container" style={{ textAlign: 'center', padding: '4rem' }}>
        <RefreshCw size={32} className="pwc-spinner" style={{ color: '#38bdf8' }} />
        <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Carregando configurações...</p>
      </div>
    );
  }

  const etapasAgrupadas = [
    {
      fase: '1. Início do Fluxo',
      eventos: ['SOLICITACAO_CRIADA']
    },
    {
      fase: '2. Diretoria',
      eventos: ['DIRETORIA_APROVADA', 'DIRETORIA_NEGADA']
    },
    {
      fase: '3. Jurídico',
      eventos: ['JURIDICO_APROVADO', 'JURIDICO_NEGADO']
    },
    {
      fase: '4. Financeiro',
      eventos: ['FINANCEIRO_RECEBIDA', 'FINANCEIRO_AGENDADA', 'FINANCEIRO_PAGA', 'FINANCEIRO_REJEITADA']
    }
  ];

  return (
    <div className="ec-container">
      {/* Cabeçalho */}
      <div className="ec-header">
        <h1 className="ec-title">
          <Mail size={28} color="#38bdf8" /> Central de Notificações por E-mail
        </h1>
        <p className="ec-subtitle">
          Gerencie o remetente oficial (<strong>sistema@lepta.com.br</strong> via Microsoft Entra ID / Azure) e os destinatários das 9 etapas do fluxo financeiro.
        </p>
      </div>

      {/* Submenu Horizontal com Abas */}
      <div className="ec-tabs-bar">
        <button
          type="button"
          className={`ec-tab-btn ${activeTab === 'remetente' ? 'active' : ''}`}
          onClick={() => setActiveTab('remetente')}
        >
          <Server size={18} />
          <span>Configuração do Remetente (Microsoft Entra ID)</span>
        </button>

        <button
          type="button"
          className={`ec-tab-btn ${activeTab === 'destinatarios' ? 'active' : ''}`}
          onClick={() => setActiveTab('destinatarios')}
        >
          <Users size={18} />
          <span>Destinatários do Fluxo Financeiro</span>
          <span className="ec-tab-badge">9 etapas</span>
        </button>
      </div>

      {/* --- ABA 1: REMETENTE OFICIAL VIA AZURE / ENTRA ID --- */}
      {activeTab === 'remetente' && (
        <div className="ec-tab-content fade-in">
          {saveSuccess && (
            <div className="ec-alert success">
              <CheckCircle2 size={20} />
              <div>{saveSuccess}</div>
            </div>
          )}

          {testSuccess && (
            <div className="ec-alert success">
              <CheckCircle2 size={20} />
              <div>{testSuccess}</div>
            </div>
          )}

          {testWarning && (
            <div className="ec-alert warning">
              <ShieldAlert size={22} color="#fbbf24" style={{ flexShrink: 0 }} />
              <div>{testWarning}</div>
            </div>
          )}

          {testError && (
            <div className="ec-alert error">
              <AlertCircle size={20} />
              <div>{testError}</div>
            </div>
          )}

          <div className="ec-card">
            <form onSubmit={handleSaveRemetente}>
              <div className="ec-card-header-bar" style={{ marginBottom: '1.25rem' }}>
                <div>
                  <h2 className="ec-card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Key size={20} color="#38bdf8" /> Envio Oficial via Microsoft Entra ID (Azure Graph API)
                  </h2>
                  <p className="ec-card-subtitle">
                    Todos os e-mails são enviados de forma segura e oficial através do aplicativo <strong>LeptaSys - Mail Sender</strong> registrado no Azure da Lepta.
                  </p>
                </div>
              </div>

              {/* Informação sobre Consentimento no Azure */}
              <div className="ec-consent-info-box">
                <ShieldAlert size={18} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Remetente Oficial Configurado:</strong> <code>sistema@lepta.com.br</code>.
                  <div style={{ marginTop: '4px', fontSize: '0.82rem', color: '#cbd5e1' }}>
                    Para que o aplicativo possa disparar e-mails corporativos, solicite a um Administrador Geral no Azure Portal (<em>Registros de Aplicativo &gt; LeptaSys - Mail Sender &gt; Permissões de APIs</em>) para clicar no botão <strong>"Conceder consentimento do administrador para Lepta"</strong> na permissão <code>Mail.Send</code>.
                  </div>
                </div>
              </div>

              <div className="ec-form-grid">
                <div className="ec-form-group">
                  <label>
                    <Mail size={16} color="#38bdf8" /> E-mail Remetente Oficial (Caixa Postal)
                  </label>
                  <input
                    type="email"
                    className="ec-input"
                    value={fromEmail}
                    onChange={e => setFromEmail(e.target.value)}
                    placeholder="sistema@lepta.com.br"
                    required
                  />
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Caixa postal corporativa licenciada no Microsoft 365.
                  </span>
                </div>

                <div className="ec-form-group">
                  <label>
                    <Globe size={16} color="#38bdf8" /> Nome de Exibição do Remetente
                  </label>
                  <input
                    type="text"
                    className="ec-input"
                    value={fromName}
                    onChange={e => setFromName(e.target.value)}
                    placeholder="LeptaSys"
                    required
                  />
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Nome que aparece na caixa de entrada dos destinatários.
                  </span>
                </div>

                <div className="ec-form-group">
                  <label>
                    <Server size={16} color="#38bdf8" /> ID do Diretório (Locatário / Tenant ID)
                  </label>
                  <input
                    type="text"
                    className="ec-input"
                    value={azureTenantId}
                    onChange={e => setAzureTenantId(e.target.value)}
                    placeholder="f376d8b7-1a55-4cfb-a8e1-3e2799e0918e"
                    required
                  />
                </div>

                <div className="ec-form-group">
                  <label>
                    <Key size={16} color="#38bdf8" /> ID do Aplicativo (Cliente / Client ID)
                  </label>
                  <input
                    type="text"
                    className="ec-input"
                    value={azureClientId}
                    onChange={e => setAzureClientId(e.target.value)}
                    placeholder="27281728-09ae-4d31-9fa6-3c93f748e78b"
                    required
                  />
                </div>

                <div className="ec-form-group full-width">
                  <label>
                    <Lock size={16} color="#38bdf8" /> Valor do Segredo do Cliente (Client Secret)
                  </label>
                  <div className="ec-password-wrapper">
                    <input
                      type={showAzureSecret ? 'text' : 'password'}
                      className="ec-input"
                      value={azureClientSecret}
                      onChange={e => setAzureClientSecret(e.target.value)}
                      placeholder={hasAzureSecretSaved ? '•••••••••••••••••••••••••••••••••••• (Segredo configurado e protegido)' : 'Cole o segredo do cliente da Azure'}
                    />
                    <button
                      type="button"
                      className="ec-password-toggle"
                      onClick={() => setShowAzureSecret(!showAzureSecret)}
                      title={showAzureSecret ? 'Ocultar segredo' : 'Ver segredo'}
                    >
                      {showAzureSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {hasAzureSecretSaved && !azureClientSecret && (
                    <span className="ec-security-badge">
                      <ShieldCheck size={13} /> Segredo do Entra ID protegido com criptografia AES-256 no banco
                    </span>
                  )}
                </div>

                <div className="ec-form-group">
                  <label>
                    <Mail size={16} color="#38bdf8" /> E-mail Padrão para Testes e Pagamentos
                  </label>
                  <input
                    type="email"
                    className="ec-input"
                    value={toFinanceEmail}
                    onChange={e => setToFinanceEmail(e.target.value)}
                    placeholder="pagamentos@lepta.com.br"
                    required
                  />
                </div>

                <div className="ec-form-group">
                  <label>
                    <Globe size={16} color="#38bdf8" /> URL Base do Sistema
                  </label>
                  <input
                    type="url"
                    className="ec-input"
                    value={appBaseUrl}
                    onChange={e => setAppBaseUrl(e.target.value)}
                    placeholder="https://lepta.com.br"
                    required
                  />
                </div>
              </div>

              {/* Ações / Botões */}
              <div className="ec-actions">
                <button
                  type="button"
                  className="ec-btn-test"
                  onClick={handleTestConnection}
                  disabled={testing || saving || (!azureClientSecret && !hasAzureSecretSaved)}
                >
                  {testing ? <RefreshCw size={18} className="pwc-spinner" /> : <Send size={18} />}
                  {testing ? 'Testando Conexão...' : 'Testar Conexão / Disparar E-mail de Teste'}
                </button>

                <button
                  type="submit"
                  className="ec-btn-save"
                  disabled={saving || testing}
                >
                  {saving ? <RefreshCw size={18} className="pwc-spinner" /> : <Check size={18} />}
                  {saving ? 'Salvando...' : 'Salvar Configurações do Remetente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ABA 2: DESTINATÁRIOS DO FLUXO FINANCEIRO --- */}
      {activeTab === 'destinatarios' && (
        <TabErrorBoundary>
          <div className="ec-tab-content fade-in">
            {fluxoSuccess && (
              <div className="ec-alert success">
                <CheckCircle2 size={20} />
                <div>{fluxoSuccess}</div>
              </div>
            )}

            {fluxoError && (
              <div className="ec-alert error">
                <AlertCircle size={20} />
                <div>{fluxoError}</div>
              </div>
            )}

            <div className="ec-top-save-bar">
              <div>
                <h2 className="ec-section-title">Destinatários do Ciclo de Solicitações</h2>
                <p className="ec-section-subtitle">
                  Adicione usuários cadastrados no LeptaSys ou insira qualquer e-mail manual para ser notificado em cada etapa.
                </p>
              </div>
              <button
                type="button"
                className="ec-btn-save primary"
                onClick={handleSaveFluxo}
                disabled={savingFluxo}
              >
                {savingFluxo ? <RefreshCw size={18} className="pwc-spinner" /> : <Check size={18} />}
                {savingFluxo ? 'Salvando...' : 'Salvar Todas as Configurações'}
              </button>
            </div>

            <div className="ec-fluxo-groups">
              {etapasAgrupadas.map(faseObj => (
                <div key={faseObj.fase} className="ec-fase-section">
                  <div className="ec-fase-header">
                    <h3 className="ec-fase-title">{faseObj.fase}</h3>
                  </div>

                  <div className="ec-eventos-grid">
                    {faseObj.eventos.map(eventoKey => {
                      const meta = EVENTOS_METADATA[eventoKey] || {
                        titulo: eventoKey,
                        descricao: '',
                        badge: 'Evento',
                        badgeClass: 'badge-sky',
                        icon: Mail
                      };
                      const IconComponent = meta.icon;
                      const foundConfig = fluxoEventos.find(ev => ev && ev.evento === eventoKey);
                      const eventoConfig = {
                        evento: eventoKey,
                        destinatarios: Array.isArray(foundConfig?.destinatarios)
                          ? foundConfig.destinatarios.map(safeNormalizeDestinatario).filter((d): d is DestinatarioItem => d !== null)
                          : [],
                        notificar_solicitante: foundConfig?.notificar_solicitante !== false
                      };

                      const selectedUserId = selectedUserPerEvento[eventoKey] || '';
                      const manualEmail = manualEmailPerEvento[eventoKey] || '';

                      return (
                        <div key={eventoKey} className="ec-evento-card">
                          <div className="ec-evento-header">
                            <div className="ec-evento-title-area">
                              <span className="ec-evento-icon-wrap">
                                <IconComponent size={20} />
                              </span>
                              <div>
                                <h4 className="ec-evento-title">{meta.titulo}</h4>
                                <p className="ec-evento-desc">{meta.descricao}</p>
                              </div>
                            </div>
                            <span className={`ec-badge-status ${meta.badgeClass}`}>{meta.badge}</span>
                          </div>

                          {/* Toggle Notificar Solicitante */}
                          <div className="ec-solicitante-toggle">
                            <label className="ec-toggle-label">
                              <input
                                type="checkbox"
                                checked={eventoConfig.notificar_solicitante}
                                onChange={() => handleToggleNotificarSolicitante(eventoKey)}
                              />
                              <span>Notificar também o solicitante da requisição</span>
                            </label>
                          </div>

                          {/* Chips / Lista de Destinatários Configurados */}
                          <div className="ec-destinatarios-box">
                            <div className="ec-destinatarios-header">
                              <span className="ec-dest-count">
                                Destinatários cadastrados ({eventoConfig.destinatarios.length}):
                              </span>
                            </div>

                            {eventoConfig.destinatarios.length === 0 ? (
                              <div className="ec-empty-destinatarios">
                                Nenhum e-mail ou usuário específico adicionado.
                                {eventoConfig.notificar_solicitante && (
                                  <span style={{ display: 'block', color: '#38bdf8', marginTop: '2px' }}>
                                    (O solicitante receberá a notificação)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="ec-chips-container">
                                {eventoConfig.destinatarios.map((dest, idx) => {
                                  const keyVal = `${dest.email}-${idx}`;
                                  return (
                                    <div key={keyVal} className={`ec-chip ${dest.type === 'USER' ? 'chip-user' : 'chip-custom'}`}>
                                      <span className="ec-chip-icon">
                                        {dest.type === 'USER' ? <Users size={12} /> : <Mail size={12} />}
                                      </span>
                                      <span className="ec-chip-text" title={dest.email}>
                                        <strong>{dest.name || dest.email.split('@')[0]}</strong>
                                        {dest.type === 'USER' && <small> ({dest.email})</small>}
                                        {dest.type === 'CUSTOM' && <small> {dest.email}</small>}
                                      </span>
                                      <button
                                        type="button"
                                        className="ec-chip-remove"
                                        onClick={() => handleRemoveDestinatario(eventoKey, dest.email)}
                                        title="Remover destinatário"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Painel para Adicionar Novos Destinatários */}
                          <div className="ec-add-destinatario-panel">
                            {/* Opção 1: Selecionar Usuário do Sistema */}
                            <div className="ec-add-group">
                              <label className="ec-add-label">
                                <UserPlus size={14} color="#38bdf8" /> Adicionar Usuário do Sistema:
                              </label>
                              <div className="ec-add-row">
                                <select
                                  className="ec-select"
                                  value={selectedUserId}
                                  onChange={e =>
                                    setSelectedUserPerEvento(prev => ({
                                      ...prev,
                                      [eventoKey]: e.target.value
                                    }))
                                  }
                                >
                                  <option value="">Selecione um usuário...</option>
                                  {systemUsers.map(userItem => {
                                    if (!userItem || !userItem.email) return null;
                                    const userEmailLower = String(userItem.email).trim().toLowerCase();
                                    const alreadyAdded = eventoConfig.destinatarios.some(
                                      d => d.email.toLowerCase() === userEmailLower
                                    );
                                    return (
                                      <option
                                        key={userItem.id}
                                        value={userItem.id}
                                        disabled={alreadyAdded}
                                      >
                                        {userItem.username} ({userItem.email}) {alreadyAdded ? '— Já adicionado' : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                                <button
                                  type="button"
                                  className="ec-btn-add"
                                  onClick={() => handleAddSystemUser(eventoKey)}
                                  disabled={!selectedUserId}
                                  title="Adicionar usuário selecionado"
                                >
                                  <Plus size={16} /> Adicionar
                                </button>
                              </div>
                            </div>

                            {/* Opção 2: Inserir E-mail Manual */}
                            <div className="ec-add-group" style={{ marginTop: '10px' }}>
                              <label className="ec-add-label">
                                <Mail size={14} color="#38bdf8" /> Ou Inserir E-mail Manualmente:
                              </label>
                              <div className="ec-add-row">
                                <input
                                  type="email"
                                  className="ec-input-small"
                                  placeholder="exemplo@lepta.com.br"
                                  value={manualEmail}
                                  onChange={e =>
                                    setManualEmailPerEvento(prev => ({
                                      ...prev,
                                      [eventoKey]: e.target.value
                                    }))
                                  }
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddManualEmail(eventoKey);
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  className="ec-btn-add outline"
                                  onClick={() => handleAddManualEmail(eventoKey)}
                                  disabled={!manualEmail.trim()}
                                  title="Adicionar e-mail avulso"
                                >
                                  <Plus size={16} /> Inserir
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Botão Salvar Fixo no Rodapé */}
            <div className="ec-footer-save-bar">
              <button
                type="button"
                className="ec-btn-save primary lg"
                onClick={handleSaveFluxo}
                disabled={savingFluxo}
              >
                {savingFluxo ? <RefreshCw size={20} className="pwc-spinner" /> : <Check size={20} />}
                {savingFluxo ? 'Salvando Destinatários...' : 'Salvar Destinatários do Fluxo'}
              </button>
            </div>
          </div>
        </TabErrorBoundary>
      )}
    </div>
  );
};

export default EmailConfig;
