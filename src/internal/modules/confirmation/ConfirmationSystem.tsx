import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardCheck, LayoutDashboard, TrendingUp, Layers,
  Search, Users, DollarSign, RefreshCw, Calendar, Upload, Database, CheckCircle2, AlertCircle, X
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import { useAuth } from '../../core/AuthContext';
import ConfirmationDashboard from './ConfirmationDashboard';
import ConfirmationCotas from './ConfirmationCotas';
import ConfirmationCarteira from './ConfirmationCarteira';
import ConfirmationTitulos from './ConfirmationTitulos';
import ConfirmationCedentes from './ConfirmationCedentes';
import ConfirmationReceitas from './ConfirmationReceitas';
import './ConfirmationSystem.css';

type ActiveTab = 'dashboard' | 'cotas' | 'carteira' | 'titulos' | 'cedentes' | 'receitas';

export const ConfirmationSystem: React.FC = () => {
  const { user } = useAuth();
  const isMaster = user?.role === 'MASTER';

  const [fundoId, setFundoId] = useState<'MULTISETORIAL' | 'SPECIAL'>('MULTISETORIAL');
  const [dataPosicao, setDataPosicao] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [fundosData, setFundosData] = useState<{ fundos: any[]; classes: any[] }>({ fundos: [], classes: [] });
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // Modal de Restauração de Banco
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedDbFile, setSelectedDbFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        if (!dataPosicao && data.data) {
          setDataPosicao(data.data);
        }
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

  const [chunkStatusText, setChunkStatusText] = useState('');

  const handleUploadBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDbFile) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    setUploadSuccess(null);
    setChunkStatusText('Preparando envio do arquivo...');

    const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB por pedaço (passa liso por qualquer Cloudflare / Nginx / Hostinger)
    const totalChunks = Math.ceil(selectedDbFile.size / CHUNK_SIZE);
    const uploadId = `fidc_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(selectedDbFile.size, start + CHUNK_SIZE);
        const chunkBlob = selectedDbFile.slice(start, end);

        setChunkStatusText(`Enviando pedaço ${i + 1} de ${totalChunks}...`);

        let attempts = 0;
        let success = false;
        let lastError = '';

        while (attempts < 3 && !success) {
          attempts++;
          try {
            const formData = new FormData();
            formData.append('chunk', chunkBlob, selectedDbFile.name);
            formData.append('uploadId', uploadId);
            formData.append('chunkIndex', String(i));
            formData.append('totalChunks', String(totalChunks));
            formData.append('fileName', selectedDbFile.name);

            const headers = getAuthHeaders() as Record<string, string>;

            const res = await fetch(`${API_BASE_URL}/api/confirmacao/upload-chunk`, {
              method: 'POST',
              headers,
              body: formData
            });

            if (!res.ok) {
              const errText = await res.text();
              throw new Error(errText || `Erro HTTP ${res.status}`);
            }

            const json = await res.json();

            if (json.done) {
              setUploadProgress(100);
              setChunkStatusText('Finalizando e integrando ao banco principal...');
              setUploadSuccess(
                `✅ ${json.message} (${json.counts?.titulos?.toLocaleString('pt-BR')} títulos, ${json.counts?.cotas?.toLocaleString('pt-BR')} cotas carregadas)`
              );
              setSelectedDbFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
              fetchFundos();
              fetchDashboard();
              setTimeout(() => {
                setIsRestoreModalOpen(false);
                setUploadSuccess(null);
              }, 4000);
            }

            success = true;
            const pct = Math.round(((i + 1) / totalChunks) * 100);
            setUploadProgress(pct);
          } catch (chunkErr: any) {
            lastError = chunkErr.message;
            if (attempts < 3) {
              setChunkStatusText(`Reconectando pedaço ${i + 1}... tentativa ${attempts + 1}/3`);
              await new Promise(r => setTimeout(r, 1500));
            }
          }
        }

        if (!success) {
          throw new Error(`Falha ao enviar pedaço ${i + 1} após 3 tentativas: ${lastError}`);
        }
      }
    } catch (err: any) {
      console.error('Erro no upload fatiado:', err);
      setUploadError(err.message || 'Erro durante o envio do arquivo.');
    } finally {
      setUploading(false);
    }
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
              onClick={() => setFundoId('MULTISETORIAL')}
            >
              🔵 LEPTA MULTISETORIAL
            </button>
            <button
              className={`cs-fundo-btn ${fundoId === 'SPECIAL' ? 'active special' : ''}`}
              onClick={() => setFundoId('SPECIAL')}
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
            onClick={fetchDashboard}
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
              <Upload size={14} />
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
      </div>

      {/* ── CONTEÚDO DA ABA ATIVA ── */}
      {activeTab === 'dashboard' && (
        <ConfirmationDashboard data={dashboardData} loading={loadingDashboard} />
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

      {/* Modal de Restauração de Banco FIDC */}
      {isRestoreModalOpen && (
        <div className="cs-modal-overlay" onClick={() => !uploading && setIsRestoreModalOpen(false)}>
          <div className="cs-modal" onClick={e => e.stopPropagation()}>
            <div className="cs-modal-header">
              <h3 className="cs-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={20} color="#38bdf8" /> Restaurar / Importar Banco FIDC (.db)
              </h3>
              {!uploading && (
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

            <form onSubmit={handleUploadBackup}>
              <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
                Selecione o arquivo de banco de dados do FIDC (ex: <code>lepta_backup_2026-08-17.db</code> ou <code>lepta.db</code>).
                O servidor receberá o arquivo e atualizará todos os fundos, cotas, títulos e dashboards instantaneamente.
              </p>

              <div style={{ marginBottom: '1.5rem' }}>
                <input
                  type="file"
                  accept=".db,.sqlite,.db3"
                  ref={fileInputRef}
                  disabled={uploading}
                  onChange={e => setSelectedDbFile(e.target.files?.[0] || null)}
                  className="cs-search-input"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '10px' }}
                  required
                />
              </div>

              {uploading && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '6px' }}>
                    <span>{chunkStatusText || 'Enviando banco de dados para o servidor...'}</span>
                    <span style={{ fontWeight: 700, color: '#38bdf8' }}>{uploadProgress}%</span>
                  </div>
                  <div style={{ background: 'rgba(255, 255, 255, 0.1)', borderRadius: '10px', height: '10px', overflow: 'hidden' }}>
                    <div
                      style={{
                        background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                        height: '100%',
                        width: `${uploadProgress}%`,
                        transition: 'width 0.2s ease'
                      }}
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="cs-page-btn"
                  disabled={uploading}
                  onClick={() => setIsRestoreModalOpen(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cs-btn-save"
                  disabled={uploading || !selectedDbFile}
                  style={{ padding: '8px 22px' }}
                >
                  {uploading ? <RefreshCw size={16} className="pwc-spinner" /> : <Upload size={16} />}
                  {uploading ? `Enviando (${uploadProgress}%)...` : 'Iniciar Restauração'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfirmationSystem;
