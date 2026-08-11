import { useState } from 'react';
import { LogOut, User, Bell, ShieldAlert, DollarSign, Shield, Scale, UserPlus, Users, ChevronDown, ChevronRight, LayoutDashboard, Sliders, Home, Calendar } from 'lucide-react';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../pages/internal/Dashboard.css';

const InternalLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();

  const isPermissionsActive = location.pathname.startsWith('/permissions');
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const hasAccess = (areaId: string) => {
    return user?.role === 'MASTER' || user?.permissions.includes(areaId);
  };

  const navItemClass = (path: string) => {
    return `nav-item ${location.pathname === path ? 'active' : ''}`;
  };

  return (
    <div className="internal-dashboard-page">
      <aside className="internal-sidebar glass">
        <div className="sidebar-brand">
          <img src="/logo2.png" alt="Lepta Capital" className="sidebar-logo" />
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
          {hasAccess('1') && (
            <Link to="/creditos" className={navItemClass('/creditos')}>
              <DollarSign size={20} /> Créditos
            </Link>
          )}
          {hasAccess('2') && (
            <Link to="/riscos" className={navItemClass('/riscos')}>
              <Shield size={20} /> Análise de Riscos
            </Link>
          )}
          {hasAccess('3') && (
            <Link to="/comite" className={navItemClass('/comite')}>
              <Scale size={20} /> Comitê de Crédito
            </Link>
          )}
          {hasAccess('6') && (
            <Link to="/marketing" className={navItemClass('/marketing')}>
              <Calendar size={20} /> Calendário
            </Link>
          )}
          {(hasAccess('5') || user?.role === 'MASTER') && (
            <Link to="/dashboards" className={navItemClass('/dashboards')}>
              <LayoutDashboard size={20} /> Dashboards
            </Link>
          )}
          {(hasAccess('4') || user?.role === 'MASTER') && (
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
          <div className="header-search">
            <input type="text" placeholder="Pesquisar..." className="input-field search-input" />
          </div>
          <div className="header-actions">
            <button className="icon-btn">
              <Bell size={20} />
            </button>
          </div>
        </header>

        <div className="internal-body">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default InternalLayout;
