import React, { useState, useEffect } from 'react';
import {
  Mail, Server, Lock, Send, CheckCircle2, AlertCircle, Eye, EyeOff,
  RefreshCw, ShieldCheck, Globe, Check
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

export const EmailConfig: React.FC = () => {
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

  useEffect(() => {
    fetchConfig();
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

  const handleSave = async (e: React.FormEvent) => {
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
        setSaveSuccess('Configurações de e-mail salvas e criptografadas no banco SQLite com sucesso!');
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
        setTestError(`❌ Falha na conexão SMTP: ${data.error || 'Verifique as credenciais e permissões de SMTP Autenticado.'}`);
      }
    } catch (error: any) {
      setTestError(`❌ Erro ao testar: ${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="ec-container" style={{ textAlign: 'center', padding: '4rem' }}>
        <RefreshCw size={32} className="pwc-spinner" style={{ color: '#38bdf8' }} />
        <p style={{ marginTop: '1rem', color: '#94a3b8' }}>Carregando configurações de e-mail...</p>
      </div>
    );
  }

  return (
    <div className="ec-container">
      <div className="ec-header">
        <h1 className="ec-title">
          <Mail size={26} color="#38bdf8" /> Configuração de E-mail (SMTP)
        </h1>
        <p className="ec-subtitle">
          Configure a caixa postal remetente para envio automático de aprovações de pagamentos e notificações do LeptaSys.
        </p>
      </div>

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

        <form onSubmit={handleSave}>
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
                <Lock size={16} color="#38bdf8" /> Senha do Remetente (Criptografada no Banco)
              </label>
              <div className="ec-password-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="ec-input"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={hasPasswordSaved ? '••••••••••••• (Senha já configurada)' : 'Digite a senha da conta'}
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
                  <ShieldCheck size={13} /> Senha salva com criptografia AES-256 no banco
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
                Os botões <strong>"Visualizar Solicitação no Sistema"</strong> enviados nos e-mails apontarão para esta URL.
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
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailConfig;
