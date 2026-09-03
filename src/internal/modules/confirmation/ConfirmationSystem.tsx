import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, LayoutDashboard, TrendingUp, Layers,
  Search, Users, DollarSign, RefreshCw, Calendar, Database, CheckCircle2, AlertCircle, X, FileText
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import { useAuth } from '../../core/AuthContext';
import ConfirmationDashboard from './ConfirmationDashboard';
import ConfirmationCotas from './ConfirmationCotas';
import ConfirmationCarteira from './ConfirmationCarteira';
import ConfirmationTitulos from './ConfirmationTitulos';
import ConfirmationCedentes from './ConfirmationCedentes';
import ConfirmationReceitas from './ConfirmationReceitas';
import ConfirmationRelatorioDiario from './ConfirmationRelatorioDiario';
import './ConfirmationSystem.css';

type ActiveTab = 'dashboard' | 'cotas' | 'carteira' | 'titulos' | 'cedentes' | 'receitas' | 'relatorio';

export const ConfirmationSystem: React.FC = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const todayStr = new Date().toISOString().substring(0, 10);
  const [fundoId, setFundoId] = useState<'MULTISETORIAL' | 'SPECIAL'>('MULTISETORIAL');
  const [dataPosicao, setDataPosicao] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [fundosData, setFundosData] = useState<{ fundos: any[]; classes: any[] }>({ fundos: [], classes: [] });
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [importStatus, setImportStatus] = useState<any>(null);

  // Modal de Restauração de Banco
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [localBackups, setLocalBackups] = useState<any[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [restoringPath, setRestoringPath] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchImportStatus = useCallback(async () => {
    try {
      let url = `${API_BASE_URL}/api/confirmacao/importacoes/status`;
      if (dataPosicao) url += `?data=${dataPosicao}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setImportStatus(json);
      }
    } catch (_) {}
  }, [dataPosicao]);

  useEffect(() => {
    fetchImportStatus();
  }, [fetchImportStatus]);

  const fetchLocalBackups = useCallback(async () => {
    setLoadingBackups(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/local-backups`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setLocalBackups(json);
      }
    } catch (err) {
      console.error('Erro ao buscar backups locais:', err);
    } finally {
      setLoadingBackups(false);
    }
  }, []);

  useEffect(() => {
    if (isRestoreModalOpen) {
      fetchLocalBackups();
    }
  }, [isRestoreModalOpen, fetchLocalBackups]);

  // 1. Carrega Fundos e Classes
  const fetchFundos = useCallback(() => {
    fetch(`${API_BASE_URL}/api/confirmacao/fundos`, { headers: getAuthHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setFundosData(data);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchFundos();
  }, [fetchFundos]);

  // 2. Carrega Dashboard do FIDC
  const fetchDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      let url = `${API_BASE_URL}/api/confirmacao/dashboard?fundo_id=${fundoId}`;
      if (dataPosicao) url += `&data=${dataPosicao}`;

      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (err) {
      console.error('Erro ao buscar dashboard:', err);
    } finally {
      setLoadingDashboard(false);
    }
  }, [fundoId, dataPosicao]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRestoreLocalBackup = async (targetPath: string) => {
    setRestoringPath(targetPath);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/confirmacao/restore-local-backup`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ targetPath })
      });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {
        if (res.status === 504 || res.status === 502) {
          throw new Error('A importação excedeu o tempo de resposta do servidor web (504 Timeout). O arquivo é muito volumoso (~876MB) e pode ainda estar sendo processado em background.');
        }
        throw new Error(`Resposta inesperada do servidor (${res.status}): ${text.substring(0, 120)}`);
      }

      if (res.ok && json.success) {
        setUploadSuccess(`✅ ${json.message}`);
        fetchFundos();
        fetchDashboard();
        setTimeout(() => {
          setIsRestoreModalOpen(false);
          setUploadSuccess(null);
        }, 4000);
      } else {
        setUploadError(json.error || 'Erro ao restaurar backup local.');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Erro de comunicação ao restaurar.');
    } finally {
      setRestoringPath(null);
    }
  };

  const handleFundoChange = (newFundo: 'MULTISETORIAL' | 'SPECIAL') => {
    setFundoId(newFundo);
  };

  return (
    <div className="cs-container">
      {/* ── HEADER & CONTROLS ── */}
      <div className="cs-header">
        <div className="cs-title-group">
          <div>
            <h1 className="cs-title">
              <ClipboardCheck size={26} color="#38bdf8" /> Sistema de Confirmação & FIDCs
            </h1>
            <p className="cs-subtitle">
              Monitoramento diário de carteiras, subordinação de cotas, estoque de títulos e limites regulamentares.
            </p>
          </div>
        </div>

        <div className="cs-controls">
          {/* Seletor de FIDC */}
          <div className="cs-fundo-selector">
            <button
              className={`cs-fundo-btn ${fundoId === 'MULTISETORIAL' ? 'active multi' : ''}`}
              onClick={() => handleFundoChange('MULTISETORIAL')}
            >
              🔵 LEPTA MULTISETORIAL
            </button>
            <button
              className={`cs-fundo-btn ${fundoId === 'SPECIAL' ? 'active special' : ''}`}
              onClick={() => handleFundoChange('SPECIAL')}
            >
              🟡 LEPTA SPECIAL
            </button>
          </div>

          {/* Data de Posição */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="#94a3b8" />
            <input
              type="date"
              className="cs-date-input"
              value={dataPosicao}
              onChange={e => setDataPosicao(e.target.value)}
              title="Data de Posição do FIDC"
            />
          </div>

          <button
            className="cs-page-btn"
            onClick={() => {
              fetchDashboard();
              fetchImportStatus();
            }}
            title="Atualizar Dados"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loadingDashboard ? 'pwc-spinner' : ''} />
            Atualizar
          </button>

          {isMaster && (
            <button
              className="cs-page-btn"
              onClick={() => setIsRestoreModalOpen(true)}
              title="Restaurar / Importar Banco FIDC (.db)"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(56, 189, 248, 0.15)', borderColor: '#38bdf8', color: '#38bdf8' }}
            >
              <Database size={14} />
              Restaurar Banco FIDC
            </button>
          )}
        </div>
      </div>

      {/* ── HORIZONTAL TABS NAVEGAÇÃO ── */}
      <div className="cs-tabs">
        <button
          className={`cs-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={18} /> Dashboard FIDC
          {importStatus && (
            <span
              style={{
                marginLeft: '6px',
                background: importStatus.diaValido ? 'rgba(74, 222, 128, 0.2)' : 'rgba(251, 191, 36, 0.25)',
                color: importStatus.diaValido ? '#4ade80' : '#fbbf24',
                border: `1px solid ${importStatus.diaValido ? '#4ade80' : '#fbbf24'}`,
                borderRadius: '10px',
                padding: '1px 6px',
                fontSize: '0.68rem',
                fontWeight: 800
              }}
            >
              {importStatus.diaValido ? '✓ OK' : `⚠️ ${importStatus.totalPendencias}`}
            </span>
          )}
        </button>
        <button
          className={`cs-tab-btn ${activeTab === 'cotas' ? 'active' : ''}`}
          onClick={() => setActiveTab('cotas')}
        >
          <TrendingUp size={18} /> Cotas & Subordinação
        </button>
        <button
          className={`cs-tab-btn ${activeTab === 'carteira' ? 'active' : ''}`}
          onClick={() => setActiveTab('carteira')}
        >
          <Layers size={18} /> Carteira & PDD
        </button>
        <button
          className={`cs-tab-btn ${activeTab === 'titulos' ? 'active' : ''}`}
          onClick={() => setActiveTab('titulos')}
        >
          <Search size={18} /> Consulta de Títulos
        </button>
        <button
          className={`cs-tab-btn ${activeTab === 'cedentes' ? 'active' : ''}`}
          onClick={() => setActiveTab('cedentes')}
        >
          <Users size={18} /> Cedentes & Gestores
        </button>
        <button
          className={`cs-tab-btn ${activeTab === 'receitas' ? 'active' : ''}`}
          onClick={() => setActiveTab('receitas')}
        >
          <DollarSign size={18} /> Lançamentos de Receita
        </button>
        <button
          className={`cs-tab-btn ${activeTab === 'relatorio' ? 'active' : ''}`}
          onClick={() => setActiveTab('relatorio')}
        >
          <FileText size={18} /> Relatório Diário
        </button>
      </div>

      {/* ── CONTEÚDO DA ABA ATIVA ── */}
      {activeTab === 'dashboard' && (
        <ConfirmationDashboard
          data={dashboardData}
          loading={loadingDashboard}
          dataPosicao={dataPosicao}
          onNavigateTab={(tab, targetFundo) => {
            if (targetFundo) setFundoId(targetFundo);
            setActiveTab(tab as ActiveTab);
          }}
        />
      )}

      {activeTab === 'cotas' && (
        <ConfirmationCotas fundoId={fundoId} classes={fundosData.classes} />
      )}

      {activeTab === 'carteira' && (
        <ConfirmationCarteira fundoId={fundoId} dataPosicao={dataPosicao} />
      )}

      {activeTab === 'titulos' && (
        <ConfirmationTitulos fundoId={fundoId} dataPosicao={dataPosicao} />
      )}

      {activeTab === 'cedentes' && (
        <ConfirmationCedentes />
      )}

      {activeTab === 'receitas' && (
        <ConfirmationReceitas fundoId={fundoId} />
      )}

      {activeTab === 'relatorio' && (
        <ConfirmationRelatorioDiario initialData={dataPosicao} />
      )}

      {/* Modal de Restauração de Banco FIDC */}
      {isRestoreModalOpen && (
        <div className="cs-modal-overlay" onClick={() => !restoringPath && setIsRestoreModalOpen(false)}>
          <div className="cs-modal" onClick={e => e.stopPropagation()}>
            <div className="cs-modal-header">
              <h3 className="cs-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={20} color="#38bdf8" /> Restaurar Banco FIDC da VPS (.db)
              </h3>
              {!restoringPath && (
                <button className="cs-modal-close" onClick={() => setIsRestoreModalOpen(false)}>
                  <X size={20} />
                </button>
              )}
            </div>

            {uploadSuccess && (
              <div className="cs-badge success" style={{ padding: '12px 16px', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }}>
                <CheckCircle2 size={18} /> {uploadSuccess}
              </div>
            )}

            {uploadError && (
              <div className="cs-badge danger" style={{ padding: '12px 16px', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }}>
                <AlertCircle size={18} /> {uploadError}
              </div>
            )}

            {/* Lista de backups encontrados na VPS */}
            <div style={{ marginBottom: '1.5rem', background: 'rgba(15, 23, 42, 0.6)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={16} color="#38bdf8" /> Arquivos de Backup Encontrados na VPS
                </span>
                <button
                  type="button"
                  className="cs-page-btn"
                  onClick={fetchLocalBackups}
                  disabled={loadingBackups}
                  style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={12} className={loadingBackups ? 'pwc-spinner' : ''} />
                  Escanear VPS
                </button>
              </div>

              {loadingBackups ? (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Buscando arquivos de backup no servidor...
                </div>
              ) : localBackups.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {localBackups.map((bk, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: bk.isRecommended ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                        border: bk.isRecommended ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '10px 14px',
                        borderRadius: '6px'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem' }}>{bk.name}</span>
                          {bk.isRecommended && (
                            <span style={{ background: '#0369a1', color: '#e0f2fe', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 600 }}>
                              Recomendado
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                          Tamanho: <strong style={{ color: '#cbd5e1' }}>{bk.sizeMb}</strong> • Modificado: {bk.modifiedAt}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="cs-btn-save"
                        disabled={restoringPath !== null}
                        onClick={() => handleRestoreLocalBackup(bk.fullPath)}
                        style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {restoringPath === bk.fullPath ? (
                          <RefreshCw size={14} className="pwc-spinner" />
                        ) : (
                          <Database size={14} />
                        )}
                        {restoringPath === bk.fullPath ? 'Integrando...' : 'Restaurar Este'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                  Nenhum arquivo <code>.db</code> encontrado nas pastas do servidor ainda.
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Envie o arquivo <code>lepta_backup_2026-08-17.db</code> para a pasta da aplicação na VPS (ex: <code>server/data/</code> ou raiz) e clique em <strong>Escanear VPS</strong>.
                  </p>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="cs-page-btn"
                disabled={restoringPath !== null}
                onClick={() => setIsRestoreModalOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmationSystem;
