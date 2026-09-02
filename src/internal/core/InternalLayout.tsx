import { useState, useEffect } from 'react';
import { LogOut, User, ShieldAlert, Shield, UserPlus, Users, ChevronDown, ChevronRight, LayoutDashboard, Sliders, Home, Calendar, CalendarCheck, Menu, X, Wallet, FileSpreadsheet, BrainCircuit, Database, ClipboardCheck, ContactRound, ShieldCheck, Landmark, Briefcase, ShoppingCart, SlidersHorizontal, DollarSign, Mail, Search, TrendingUp, UserCheck, Scale, FileCheck } from 'lucide-react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import NotificationBell from './NotificationBell';
import TopHeaderTicker from './TopHeaderTicker';
import SystemSearchModal from './SystemSearchModal';
import './styles/Dashboard.css';
import { hasAnyPermission, hasPermission } from './permissions';
import { API_BASE_URL, getAuthHeaders } from '../../config/api';

const InternalLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isPermissionsActive = location.pathname.startsWith('/permissions');
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  
  const isFinanceActive = location.pathname.startsWith('/financeiro');
  const [isFinanceOpen, setIsFinanceOpen] = useState(false);

  const isIntelligenceActive = location.pathname.startsWith('/intelligence');
  const [isIntelligenceOpen, setIsIntelligenceOpen] = useState(false);

  const isAdministrativeActive = location.pathname.startsWith('/administrativo');
  const [isAdministrativeOpen, setIsAdministrativeOpen] = useState(false);

  const isConfirmationActive = location.pathname.startsWith('/confirmacao');
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const isCobrancaActive = location.pathname.startsWith('/cobranca');
  const [isCobrancaOpen, setIsCobrancaOpen] = useState(false);

  const isLegalActive = location.pathname.startsWith('/juridico');
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  
  // Mobile sidebar state
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Global shortcut (Ctrl+K or Cmd+K) to toggle search modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close sidebar on navigation on mobile
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [location.pathname]);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isMobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileSidebarOpen]);

  // Envia heartbeat de presença para o monitor a cada 30s e na troca de módulo
  useEffect(() => {
    if (!user) return;
    const sendHeartbeat = () => {
      fetch(`${API_BASE_URL}/api/monitor/heartbeat`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: location.pathname, moduleName: document.title || 'Lepta System' })
      }).catch(() => {});
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [location.pathname, user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const hasAccess = (areaId: string) => {
    return hasPermission(user, areaId);
  };

  const navItemClass = (path: string) => {
    return `nav-item ${location.pathname === path ? 'active' : ''}`;
  };

  return (
    <div className="internal-dashboard-page">
      {/* Mobile Overlay Background */}
      {isMobileSidebarOpen && (
        <div 
          className="mobile-sidebar-overlay" 
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <aside className={`internal-sidebar glass ${isMobileSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <img src="/logo2.png" alt="Lepta Capital" className="sidebar-logo" />
          <button className="mobile-close-btn" onClick={() => setIsMobileSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <div className="user-profile">
          <div className="user-avatar">
            <User size={24} />
          </div>
          <div className="user-info">
            <h4>{user?.username}</h4>
            <p>{user?.email || 'Nenhum email'}</p>
          </div>
        </div>
        
        <nav className="internal-nav">
          <p className="nav-group-title">INTRANET</p>
          <Link to="/dashboard" className={navItemClass('/dashboard')}>
            <Home size={20} /> Home
          </Link>
          
          <p className="nav-group-title">GRUPOS</p>
          {hasAccess('6') && (
            <Link to="/marketing" className={navItemClass('/marketing')}>
              <Calendar size={20} /> Calendário
            </Link>
          )}
          {hasAnyPermission(user, ['7.1', '7.2', '7.3', '7.4']) && (
            <div className="nav-menu-group">
              <div 
                className={`nav-item nav-item-parent ${isFinanceActive ? 'active' : ''}`}
                onClick={() => setIsFinanceOpen(!isFinanceOpen)}
                style={{ cursor: 'pointer', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Wallet size={20} /> Financeiro
                </div>
                {isFinanceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>

              {isFinanceOpen && (
                <div className="nav-submenu" style={{ paddingLeft: '1rem' }}>
                  {hasAccess('7.1') && (
                    <Link to="/financeiro/extratos" className={navItemClass('/financeiro/extratos')}>
                      <FileSpreadsheet size={18} /> Processar Extrato
                    </Link>
                  )}
                  {hasAccess('7.2') && (
                    <Link to="/financeiro/grafeno" className={navItemClass('/financeiro/grafeno')}>
                      <Landmark size={18} /> LEPTA x GRAFENO
                    </Link>
                  )}
                  {hasAccess('7.4') && (
                    <Link to="/financeiro/reembolsos-despesas" className={navItemClass('/financeiro/reembolsos-despesas')}>
                      <DollarSign size={18} /> Central de Pagamentos
                    </Link>
                  )}
                  {hasAccess('7.5') && (
                    <Link to="/financeiro/calendario-pagamentos" className={navItemClass('/financeiro/calendario-pagamentos')}>
                      <Calendar size={18} /> Calendário de Pagamentos
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {hasAnyPermission(user, ['8.1', '8.2', '8.3', '8.4', '8.5', '8.6']) && (
            <div className="nav-menu-group">
              <div 
                className={`nav-item nav-item-parent ${isIntelligenceActive ? 'active' : ''}`}
                onClick={() => setIsIntelligenceOpen(!isIntelligenceOpen)}
                style={{ cursor: 'pointer', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <BrainCircuit size={20} /> Lepta Intelligence
                </div>
                {isIntelligenceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>

              {isIntelligenceOpen && (
                <div className="nav-submenu" style={{ paddingLeft: '1rem' }}>
                  {hasAccess('8.1') && (
                    <Link to="/intelligence/analise-clientes" className={navItemClass('/intelligence/analise-clientes')}>
                      <Users size={18} /> Análise de Clientes
                    </Link>
                  )}
                  {hasAccess('8.2') && (
                    <Link to="/intelligence/cadastro-clientes" className={navItemClass('/intelligence/cadastro-clientes')}>
                      <ContactRound size={18} /> Cadastro de Clientes
                    </Link>
                  )}
                  {hasAccess('8.3') && (
                    <Link to="/intelligence/analise-riscos" className={navItemClass('/intelligence/analise-riscos')}>
                      <ShieldCheck size={18} /> Análise de Riscos
                    </Link>
                  )}
                  {hasAccess('8.4') && (
                    <Link to="/intelligence/npl" className={navItemClass('/intelligence/npl')}>
                      <TrendingUp size={18} /> NPL
                    </Link>
                  )}
                  {hasAccess('8.5') && (
                    <Link to="/intelligence/esteira-comite" className={navItemClass('/intelligence/esteira-comite')}>
                      <ClipboardCheck size={18} /> Esteira de Comitê
                    </Link>
                  )}
                  {(hasAccess('8.6') || hasAccess('8.1') || hasAccess('8')) && (
                    <Link to="/intelligence/consulta-smartfactor" className={navItemClass('/intelligence/consulta-smartfactor')}>
                      <Search size={18} /> Consulta SmartFactor
                    </Link>
                  )}
                  {hasAccess('8.7') && (
                    <Link to="/intelligence/cadastro-gerentes" className={navItemClass('/intelligence/cadastro-gerentes')}>
                      <UserCheck size={18} /> Cadastro de Gerentes
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {hasAnyPermission(user, ['11.1', '11.2', '11.3', '11']) && (
            <div className="nav-menu-group">
              <div 
                className={`nav-item nav-item-parent ${isAdministrativeActive ? 'active' : ''}`}
                onClick={() => setIsAdministrativeOpen(!isAdministrativeOpen)}
                style={{ cursor: 'pointer', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Briefcase size={20} /> Administrativo
                </div>
                {isAdministrativeOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>

              {isAdministrativeOpen && (
                <div className="nav-submenu" style={{ paddingLeft: '1rem' }}>
                  {hasAccess('11.1') && (
                    <Link to="/administrativo/compras" className={navItemClass('/administrativo/compras')}>
                      <ShoppingCart size={18} /> Solicitações Financeiras
                    </Link>
                  )}
                  {hasAccess('11.2') && (
                    <Link to="/administrativo/configuracao-compras" className={navItemClass('/administrativo/configuracao-compras')}>
                      <SlidersHorizontal size={18} /> Configuração de Esteira de Compras
                    </Link>
                  )}
                  {hasAccess('11.3') && (
                    <Link to="/administrativo/salas-reuniao" className={navItemClass('/administrativo/salas-reuniao')}>
                      <CalendarCheck size={18} /> Agendar Sala de Reunião
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {hasAnyPermission(user, ['10.1', '10.2', '10']) && (
            <div className="nav-menu-group">
              <div
                className={`nav-item nav-item-parent ${isConfirmationActive ? 'active' : ''}`}
                onClick={() => setIsConfirmationOpen(!isConfirmationOpen)}
                style={{ cursor: 'pointer', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <ClipboardCheck size={20} /> Confirmação
                </div>
                {isConfirmationOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>

              {isConfirmationOpen && (
                <div className="nav-submenu" style={{ paddingLeft: '1rem' }}>
                  {hasAccess('10.1') && (
                    <Link to="/confirmacao/sistema" className={navItemClass('/confirmacao/sistema')}>
                      <ClipboardCheck size={18} /> Sistema de Confirmação
                    </Link>
                  )}
                  {hasAccess('10.2') && (
                    <Link to="/confirmacao/analise" className={navItemClass('/confirmacao/analise')}>
                      <Search size={18} /> Análise de Confirmação
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {hasAnyPermission(user, ['12.1', '12']) && (
            <div className="nav-menu-group">
              <div
                className={`nav-item nav-item-parent ${isCobrancaActive ? 'active' : ''}`}
                onClick={() => setIsCobrancaOpen(!isCobrancaOpen)}
                style={{ cursor: 'pointer', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <DollarSign size={20} /> Cobrança
                </div>
                {isCobrancaOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>

              {isCobrancaOpen && (
                <div className="nav-submenu" style={{ paddingLeft: '1rem' }}>
                  {hasAccess('12.1') && (
                    <Link to="/cobranca/analise-vencidos" className={navItemClass('/cobranca/analise-vencidos')}>
                      <FileSpreadsheet size={18} /> Análise de Vencidos
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {hasAnyPermission(user, ['13.1', '13']) && (
            <div className="nav-menu-group">
              <div
                className={`nav-item nav-item-parent ${isLegalActive ? 'active' : ''}`}
                onClick={() => setIsLegalOpen(!isLegalOpen)}
                style={{ cursor: 'pointer', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Scale size={20} /> Jurídico
                </div>
                {isLegalOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>

              {isLegalOpen && (
                <div className="nav-submenu" style={{ paddingLeft: '1rem' }}>
                  {hasAccess('13.1') && (
                    <Link to="/juridico/aprovacao-pagamentos" className={navItemClass('/juridico/aprovacao-pagamentos')}>
                      <FileCheck size={18} /> Aprovação de Pagamentos
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {hasAccess('9') && (
            <Link to="/banco-de-dados" className={navItemClass('/banco-de-dados')}>
              <Database size={20} /> Banco de Dados
            </Link>
          )}
          {hasAccess('5') && (
            <Link to="/dashboards" className={navItemClass('/dashboards')}>
              <LayoutDashboard size={20} /> Dashboards
            </Link>
          )}
          {hasAccess('4') && (
            <Link to="/bi" className={navItemClass('/bi')}>
              <Sliders size={20} /> Business Intelligence
            </Link>
          )}

          {user?.role === 'MASTER' && (
            <>
              <p className="nav-group-title">ADMINISTRAÇÃO</p>
              <div className="nav-menu-group">
                <div 
                  className={`nav-item nav-item-parent ${isPermissionsActive ? 'active' : ''}`}
                  onClick={() => setIsPermissionsOpen(!isPermissionsOpen)}
                  style={{ cursor: 'pointer', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ShieldAlert size={20} /> Permissões e Acessos
                  </div>
                  {isPermissionsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>

                {isPermissionsOpen && (
                  <div className="nav-submenu" style={{ paddingLeft: '1rem' }}>
                    <Link to="/permissions" className={navItemClass('/permissions')}>
                      <Shield size={18} /> Gestão de Permissões
                    </Link>
                    <Link to="/permissions/create-user" className={navItemClass('/permissions/create-user')}>
                      <UserPlus size={18} /> Criar Usuário
                    </Link>
                    <Link to="/permissions/groups" className={navItemClass('/permissions/groups')}>
                      <Users size={18} /> Configurar Grupos
                    </Link>
                    <Link to="/permissions/email-config" className={navItemClass('/permissions/email-config')}>
                      <Mail size={18} /> Configuração de E-mail
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>
        
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="btn-outline logout-btn">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <main className="internal-content">
        <header className="internal-header">
          <div className="header-left">
            <button className="mobile-menu-btn" onClick={() => setIsMobileSidebarOpen(true)}>
              <Menu size={24} />
            </button>

            <button 
              className="header-search-btn" 
              onClick={() => setIsSearchOpen(true)}
              title="Buscar módulos, recursos ou termos no sistema (Ctrl + K)"
            >
              <div className="header-search-icon-circle">
                <Search size={15} />
              </div>
              <span className="header-search-label">Buscar no sistema...</span>
              <span className="header-search-shortcut">Ctrl K</span>
            </button>
          </div>

          <TopHeaderTicker />

          <div className="header-actions">
            <NotificationBell />
          </div>
        </header>

        <div className="internal-body">
          <Outlet />
        </div>
      </main>

      {/* Global System Search & Navigation Assistant */}
      <SystemSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
};

export default InternalLayout;
