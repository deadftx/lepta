import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL } from '../../config/api';
import {
  PieChart,
  Maximize2,
  ExternalLink,
  ChevronDown,
  LayoutDashboard,
  LogIn,
  X
} from 'lucide-react';
import './Operations.css';

interface Dashboard {
  id: string;
  title: string;
  url: string;
  embedUrl: string;
  description?: string;
  accessType: 'ALL' | 'GROUPS' | 'USERS';
  allowedGroups?: string[];
  allowedUsers?: string[];
  createdBy?: string;
  createdAt?: string;
}

const DashboardsView = () => {
  const { user } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [selectedDashboardId, setSelectedDashboardId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const isBIMember = user?.role === 'MASTER' || user?.permissions?.includes('4');

  useEffect(() => {
    const fetchDashboards = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE_URL}/dashboards`);
        const dashData: Dashboard[] = await res.json();

        // Filter dashboards for this user
        const visible = (dashData || []).filter(d => {
          if (isBIMember) return true;
          if (d.accessType === 'ALL') return true;
          if (d.accessType === 'GROUPS' && user?.groupId && d.allowedGroups?.includes(user.groupId)) return true;
          if (d.accessType === 'USERS' && (d.allowedUsers?.includes(user?.id || '') || d.allowedUsers?.includes(user?.email || ''))) return true;
          return false;
        });

        setDashboards(visible);
      } catch (err) {
        console.error('Erro ao carregar dashboards:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboards();
  }, [user]);

  const currentDashboard = dashboards.find(d => d.id === selectedDashboardId);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const handleFullscreen = () => {
    // Check if it's a mobile device/small screen
    if (window.innerWidth <= 768) {
      setIsMobileExpanded(true);
      
      // Request native fullscreen on the document body to allow orientation lock
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => {
          // Try to lock orientation to landscape if supported by the browser
          try {
            if (screen.orientation && screen.orientation.lock) {
              screen.orientation.lock('landscape').catch(() => {});
            }
          } catch (e) {
            // Ignore if not supported
          }
        }).catch(err => console.error("Error attempting to enable full-screen mode:", err));
      }
    } else {
      // Native fullscreen for desktop
      const iframeElem = document.getElementById('viewer-powerbi-frame');
      if (iframeElem && iframeElem.requestFullscreen) {
        iframeElem.requestFullscreen().catch(err => {
          console.error("Error attempting to enable full-screen mode:", err.message);
        });
      }
    }
  };

  const closeMobileExpanded = () => {
    setIsMobileExpanded(false);
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    } catch (e) {
      // Ignore
    }
  };

  const [iframeKey, setIframeKey] = useState(0);

  const handlePowerBiLogin = () => {
    const loginUrl = 'https://app.powerbi.com/singleSignOn?experience=power-bi';
    const width = 640;
    const height = 720;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      loginUrl,
      'PowerBiLoginWindow',
      `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,status=yes`
    );

    if (popup) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          // Força o recarregamento do iframe após fechar o login
          setIframeKey(prev => prev + 1);
        }
      }, 500);
    }
  };

  const getEffectiveEmbedUrl = (dash: Dashboard) => {
    let url = dash.embedUrl || dash.url;
    if (!url) return '';

    // If iframe HTML snippet:
    const iframeSrcMatch = url.match(/src=["']([^"']+)["']/i);
    if (iframeSrcMatch && iframeSrcMatch[1]) {
      url = iframeSrcMatch[1];
    }

    if (url.includes('reportEmbed')) {
      if (!url.includes('autoAuth')) {
        url += (url.includes('?') ? '&' : '?') + 'autoAuth=true';
      }
      return url;
    }

    const groupsMatch = url.match(/\/groups\/([^\/]+)\/reports\/([^\/]+)/i);
    if (groupsMatch) {
      const groupId = groupsMatch[1];
      const reportId = groupsMatch[2];
      return `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${groupId}&autoAuth=true`;
    }

    return url;
  };

  return (
    <div className="operations-page">
      <div className="page-header">
        <div>
          <h2>Dashboards</h2>
          <p>Consulte os relatórios gerenciais e acompanhe os indicadores operacionais.</p>
        </div>
      </div>

      {/* Selector Container */}
      <div className="internal-card glass" style={{ marginBottom: '1.5rem', padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexGrow: 1, maxWidth: '650px' }}>
            <LayoutDashboard size={24} style={{ color: 'var(--accent-orange)' }} />
            <div style={{ flexGrow: 1 }}>
              <label style={{ display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                Escolha o Dashboard para Visualizar:
              </label>
              {loading ? (
                <p style={{ margin: 0, color: 'var(--text-muted)' }}>Carregando relatórios...</p>
              ) : (
                <div style={{ position: 'relative' }}>
                  <select
                    className="input-field"
                    style={{ width: '100%', padding: '10px 14px', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer' }}
                    value={selectedDashboardId}
                    onChange={e => setSelectedDashboardId(e.target.value)}
                  >
                    <option value="">-- Selecione um Dashboard para visualizar --</option>
                    {dashboards.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handlePowerBiLogin}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #f2c811 0%, #e2a200 100%)',
                color: '#000',
                fontWeight: 600,
                padding: '0.6rem 1.1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.9rem',
                boxShadow: '0 2px 8px rgba(242, 200, 17, 0.25)',
                transition: 'transform 0.2s, opacity 0.2s'
              }}
              title="Fazer login na sua conta do Power BI / Microsoft 365 para manter todos os relatórios autorizados"
            >
              <LogIn size={18} /> Login Power BI
            </button>

            {currentDashboard && (
              <>
                <button
                  className="btn-icon"
                  onClick={handleFullscreen}
                  title="Modo Tela Cheia"
                  style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Maximize2 size={16} /> Tela Cheia
                </button>

                <a
                  href={currentDashboard.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-icon"
                  title="Abrir no Power BI"
                  style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'none' }}
                >
                  <ExternalLink size={16} /> Power BI
                </a>
              </>
            )}
          </div>
        </div>

        {currentDashboard?.description && (
          <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
            <strong>Descrição:</strong> {currentDashboard.description}
          </p>
        )}
      </div>

      {/* Main Content Area */}
      {selectedDashboardId && currentDashboard ? (
        <div>
          <div style={{ padding: '10px 16px', background: 'rgba(255, 153, 0, 0.1)', border: '1px solid rgba(255, 153, 0, 0.25)', borderRadius: '8px', marginBottom: '12px', fontSize: '0.85rem', color: '#ffaa33', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <span>💡 <strong>Dica Power BI:</strong> Caso a tela continue no carregamento do logotipo do Power BI, sua organização exige sessão ativa na conta Microsoft.</span>
            <a href={currentDashboard.url} target="_blank" rel="noreferrer" style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', padding: '4px 12px', borderRadius: '4px', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem' }}>
              Entrar na Conta Microsoft / Power BI ↗
            </a>
          </div>

          <div className="internal-card glass" style={{ padding: '8px', minHeight: '700px' }}>
            <iframe
              key={iframeKey}
              id="viewer-powerbi-frame"
              title={currentDashboard.title}
              src={getEffectiveEmbedUrl(currentDashboard)}
              style={{
                width: '100%',
                height: '730px',
                border: 'none',
                borderRadius: '8px',
                background: '#fff'
              }}
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="internal-card glass" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
          <PieChart size={64} style={{ color: 'var(--accent-orange)', opacity: 0.5, marginBottom: '1.25rem' }} />
          <h3>Selecione um Dashboard</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '520px', margin: '0.5rem auto 1.5rem', lineHeight: 1.5 }}>
            {dashboards.length > 0
              ? 'Por favor, selecione qual relatório disponibilizado você deseja abrir utilizando o menu seletor acima.'
              : 'Nenhum relatório foi disponibilizado para o seu perfil no momento. Entre em contato com a equipe de BI.'}
          </p>
          {dashboards.length > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.75rem 1.5rem', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <ChevronDown size={18} style={{ color: 'var(--accent-orange)' }} /> Use a caixa de seleção acima para carregar o relatório
            </div>
          )}
        </div>
      )}

      {/* Mobile Expanded Overlay */}
      {isMobileExpanded && currentDashboard && (
        <div className="mobile-expanded-overlay">
          <button className="mobile-expanded-close" onClick={closeMobileExpanded}>
            <X size={24} /> Sair
          </button>
          <iframe
            title={currentDashboard.title}
            src={getEffectiveEmbedUrl(currentDashboard)}
            className="mobile-expanded-iframe"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
};

export default DashboardsView;
