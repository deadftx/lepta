import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, LayoutDashboard, TrendingUp, Layers,
  Search, Users, DollarSign, RefreshCw, Calendar
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../../config/api';
import ConfirmationDashboard from './ConfirmationDashboard';
import ConfirmationCotas from './ConfirmationCotas';
import ConfirmationCarteira from './ConfirmationCarteira';
import ConfirmationTitulos from './ConfirmationTitulos';
import ConfirmationCedentes from './ConfirmationCedentes';
import ConfirmationReceitas from './ConfirmationReceitas';
import './ConfirmationSystem.css';

type ActiveTab = 'dashboard' | 'cotas' | 'carteira' | 'titulos' | 'cedentes' | 'receitas';

export const ConfirmationSystem: React.FC = () => {
  const [fundoId, setFundoId] = useState<'MULTISETORIAL' | 'SPECIAL'>('MULTISETORIAL');
  const [dataPosicao, setDataPosicao] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  const [fundosData, setFundosData] = useState<{ fundos: any[]; classes: any[] }>({ fundos: [], classes: [] });
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  // 1. Carrega Fundos e Classes
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/confirmacao/fundos`, { headers: getAuthHeaders() })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setFundosData(data);
      })
      .catch(console.error);
  }, []);

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
    </div>
  );
};

export default ConfirmationSystem;
