import React, { useState, useEffect } from 'react';
import {
  Mail, Server, Lock, Send, CheckCircle2, AlertCircle, Eye, EyeOff,
  RefreshCw, ShieldCheck, Globe, Check, Users, UserPlus, Plus,
  FileText, CheckCheck, XCircle, Clock, DollarSign,
  AlertTriangle
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../../config/api';
import './EmailConfig.css';

interface EmailConfigData {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from_name: string;
  from_email: string;
  to_finance_email: string;
  app_base_url: string;
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
  role: string;
}

// Definições visuais e estruturais para as 9 etapas solicitadas
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

export const EmailConfig: React.FC = () => {
  // Aba ativa: 'remetente' | 'destinatarios'
  const [activeTab, setActiveTab] = useState<'remetente' | 'destinatarios'>('remetente');

  // Estados do Remetente (SMTP)
  const [host, setHost] = useState('smtp.office365.com');
  const [port, setPort] = useState(587);
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('webmaster@lepta.com.br');
  const [fromName, setFromName] = useState('LeptaSys');
  const [fromEmail, setFromEmail] = useState('webmaster@lepta.com.br');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [toFinanceEmail, setToFinanceEmail] = useState('pagamentos@lepta.com.br');
  const [appBaseUrl, setAppBaseUrl] = useState('https://lepta.com.br');
  const [hasPasswordSaved, setHasPasswordSaved] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [activePreset, setActivePreset] = useState<'m365' | 'hostinger' | 'gmail' | 'custom'>('m365');

  // Estados dos Destinatários do Fluxo
  const [fluxoEventos, setFluxoEventos] = useState<FluxoEventoConfig[]>([]);
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [savingFluxo, setSavingFluxo] = useState(false);
  const [fluxoSuccess, setFluxoSuccess] = useState<string | null>(null);
  const [fluxoError, setFluxoError] = useState<string | null>(null);

  // Estados de inputs locais de adição por evento
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
        setHost(data.host || 'smtp.office365.com');
        setPort(data.port || 587);
        setSecure(Boolean(data.secure));
        setUser(data.user || 'webmaster@lepta.com.br');
        setFromName(data.from_name || 'LeptaSys');
        setFromEmail(data.from_email || data.user || 'webmaster@lepta.com.br');
        setToFinanceEmail(data.to_finance_email || 'pagamentos@lepta.com.br');
        setAppBaseUrl(data.app_base_url || 'https://lepta.com.br');
        setHasPasswordSaved(Boolean(data.hasPassword));

        if (data.host?.includes('office365') || data.host?.includes('outlook')) {
          setActivePreset('m365');
        } else if (data.host?.includes('hostinger')) {
          setActivePreset('hostinger');
        } else if (data.host?.includes('gmail') || data.host?.includes('google')) {
          setActivePreset('gmail');
        } else {
          setActivePreset('custom');
        }
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
          setFluxoEventos(data.eventos);
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
          setSystemUsers(data.users);
        }
      }
    } catch (error) {
      console.error('Erro ao listar usuários do sistema:', error);
    }
  };

  const applyPreset = (preset: 'm365' | 'hostinger' | 'gmail' | 'custom') => {
    setActivePreset(preset);
    setTestSuccess(null);
    setTestError(null);

    if (preset === 'm365') {
      setHost('smtp.office365.com');
      setPort(587);
      setSecure(false);
    } else if (preset === 'hostinger') {
      setHost('smtp.hostinger.com');
      setPort(465);
      setSecure(true);
    } else if (preset === 'gmail') {
      setHost('smtp.gmail.com');
      setPort(587);
      setSecure(false);
    }
  };

  const handleSaveRemetente = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setTestError(null);
    setTestSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracao-email`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host,
          port,
          secure,
          user,
          password: password || undefined,
          from_name: fromName,
          from_email: fromEmail,
          to_finance_email: toFinanceEmail,
          app_base_url: appBaseUrl
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSaveSuccess('Configurações de remetente salvas com sucesso!');
        if (password) {
          setHasPasswordSaved(true);
          setPassword('');
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
    setTestError(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/configuracao-email/test`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host,
          port,
          secure,
          user,
          password: password || undefined,
          from_name: fromName,
          from_email: fromEmail,
          test_recipient: toFinanceEmail
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestSuccess(`✅ ${data.message || 'Conexão estabelecida e e-mail de teste enviado com sucesso!'}`);
      } else {
        setTestError(`❌ Falha na conexão SMTP: ${data.error || 'Verifique as credenciais e permissões.'}`);
      }
    } catch (error: any) {
      setTestError(`❌ Erro ao testar: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  // --- Manipulação dos Destinatários por Evento ---
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
        const exists = ev.destinatarios.some(d => d.email.toLowerCase() === userObj.email.toLowerCase());
        if (exists) return ev;
        return {
          ...ev,
          destinatarios: [
            ...ev.destinatarios,
            {
              type: 'USER',
              email: userObj.email,
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

    // Validação básica de formato de e-mail
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      alert('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    setFluxoEventos(prev =>
      prev.map(ev => {
        if (ev.evento !== eventoKey) return ev;
        const exists = ev.destinatarios.some(d => d.email.toLowerCase() === emailRaw);
        if (exists) return ev;
        return {
          ...ev,
          destinatarios: [
            ...ev.destinatarios,
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
        return {
          ...ev,
          destinatarios: ev.destinatarios.filter(d => d.email.toLowerCase() !== emailToRemove.toLowerCase())
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

  // Agrupa os eventos por fase
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
          Gerencie o servidor remetente (SMTP) e os destinatários para todas as etapas do ciclo de solicitações financeiras.
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
          <span>Configuração do Remetente (SMTP)</span>
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

      {/* --- ABA 1: REMETENTE & SERVIDOR SMTP --- */}
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

          {testError && (
            <div className="ec-alert error">
              <AlertCircle size={20} />
              <div>{testError}</div>
            </div>
          )}

          <div className="ec-card">
            <div className="ec-card-header-bar">
              <div>
                <h2 className="ec-card-title">Parâmetros do Servidor SMTP</h2>
                <p className="ec-card-subtitle">
                  Configure a conta de e-mail utilizada pelo LeptaSys para disparar as mensagens automáticas.
                </p>
              </div>
            </div>

            <div className="ec-presets-container">
              <span className="ec-presets-label">Provedor de E-mail / Preset Rápido</span>
              <div className="ec-presets-grid">
                <button
                  type="button"
                  className={`ec-preset-btn ${activePreset === 'm365' ? 'active' : ''}`}
                  onClick={() => applyPreset('m365')}
                >
                  🏢 Microsoft 365 / Exchange
                </button>
                <button
                  type="button"
                  className={`ec-preset-btn ${activePreset === 'hostinger' ? 'active' : ''}`}
                  onClick={() => applyPreset('hostinger')}
                >
                  🌐 Hostinger Webmail
                </button>
                <button
                  type="button"
                  className={`ec-preset-btn ${activePreset === 'gmail' ? 'active' : ''}`}
                  onClick={() => applyPreset('gmail')}
                >
                  📮 Google Workspace
                </button>
                <button
                  type="button"
                  className={`ec-preset-btn ${activePreset === 'custom' ? 'active' : ''}`}
                  onClick={() => applyPreset('custom')}
                >
                  ⚙️ Personalizado
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveRemetente}>
              <div className="ec-form-grid">
                <div className="ec-form-group">
                  <label>
                    <Server size={16} color="#38bdf8" /> Servidor SMTP (Host)
                  </label>
                  <input
                    type="text"
                    className="ec-input"
                    value={host}
                    onChange={e => setHost(e.target.value)}
                    placeholder="smtp.office365.com"
                    required
                  />
                </div>

                <div className="ec-form-group">
                  <label>
                    <Server size={16} color="#38bdf8" /> Porta e Segurança
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      type="number"
                      className="ec-input"
                      value={port}
                      onChange={e => setPort(Number(e.target.value))}
                      style={{ width: '100px' }}
                      required
                    />
                    <select
                      className="ec-input"
                      value={secure ? 'SSL' : 'STARTTLS'}
                      onChange={e => setSecure(e.target.value === 'SSL')}
                      style={{ flex: 1 }}
                    >
                      <option value="STARTTLS">STARTTLS (Porta 587 - Padrão M365)</option>
                      <option value="SSL">SSL / TLS Direto (Porta 465)</option>
                    </select>
                  </div>
                </div>

                <div className="ec-form-group">
                  <label>
                    <Mail size={16} color="#38bdf8" /> Usuário / E-mail Remetente
                  </label>
                  <input
                    type="email"
                    className="ec-input"
                    value={user}
                    onChange={e => {
                      setUser(e.target.value);
                      if (!fromEmail || fromEmail === user) setFromEmail(e.target.value);
                    }}
                    placeholder="webmaster@lepta.com.br"
                    required
                  />
                </div>

                <div className="ec-form-group">
                  <label>
                    <Lock size={16} color="#38bdf8" /> Senha do Remetente (Criptografada)
                  </label>
                  <div className="ec-password-wrapper">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="ec-input"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder={hasPasswordSaved ? '••••••••••••• (Senha configurada)' : 'Digite a senha da conta'}
                    />
                    <button
                      type="button"
                      className="ec-password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {hasPasswordSaved && !password && (
                    <span className="ec-security-badge">
                      <ShieldCheck size={13} /> Protegida com criptografia AES-256 no banco
                    </span>
                  )}
                </div>

                <div className="ec-form-group">
                  <label>Nome de Exibição do Remetente</label>
                  <input
                    type="text"
                    className="ec-input"
                    value={fromName}
                    onChange={e => setFromName(e.target.value)}
                    placeholder="LeptaSys"
                    required
                  />
                </div>

                <div className="ec-form-group">
                  <label>E-mail de Destino do Financeiro (Pagamentos)</label>
                  <input
                    type="email"
                    className="ec-input"
                    value={toFinanceEmail}
                    onChange={e => setToFinanceEmail(e.target.value)}
                    placeholder="pagamentos@lepta.com.br"
                    required
                  />
                </div>

                <div className="ec-form-group full-width">
                  <label>
                    <Globe size={16} color="#38bdf8" /> URL Base do Sistema (para os links nos e-mails)
                  </label>
                  <input
                    type="url"
                    className="ec-input"
                    value={appBaseUrl}
                    onChange={e => setAppBaseUrl(e.target.value)}
                    placeholder="https://lepta.com.br"
                    required
                  />
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                    Os botões de acesso direto enviados nos e-mails direcionarão os usuários para esta URL.
                  </span>
                </div>
              </div>

              <div className="ec-actions">
                <button
                  type="button"
                  className="ec-btn-test"
                  onClick={handleTestConnection}
                  disabled={testing || saving || (!password && !hasPasswordSaved)}
                >
                  {testing ? <RefreshCw size={18} className="pwc-spinner" /> : <Send size={18} />}
                  {testing ? 'Testando Conexão...' : 'Testar Conexão / Enviar E-mail de Teste'}
                </button>

                <button
                  type="submit"
                  className="ec-btn-save"
                  disabled={saving || testing}
                >
                  {saving ? <RefreshCw size={18} className="pwc-spinner" /> : <Check size={18} />}
                  {saving ? 'Salvando...' : 'Salvar Remetente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ABA 2: DESTINATÁRIOS DO FLUXO FINANCEIRO --- */}
      {activeTab === 'destinatarios' && (
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
                    const eventoConfig = fluxoEventos.find(ev => ev.evento === eventoKey) || {
                      evento: eventoKey,
                      destinatarios: [],
                      notificar_solicitante: true
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
                              {eventoConfig.destinatarios.map(dest => (
                                <div key={dest.email} className={`ec-chip ${dest.type === 'USER' ? 'chip-user' : 'chip-custom'}`}>
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
                              ))}
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
                                  const alreadyAdded = eventoConfig.destinatarios.some(
                                    d => d.email.toLowerCase() === userItem.email.toLowerCase()
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
      )}
    </div>
  );
};

export default EmailConfig;
