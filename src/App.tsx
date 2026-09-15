import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';

// Módulos Internos Carregados Dinamicamente (Code Splitting)
const Dashboard = lazy(() => import('./internal/modules/home/Dashboard'));
const Permissions = lazy(() => import('./internal/modules/administracao/permissoes/Permissions'));
const Groups = lazy(() => import('./internal/modules/administracao/grupos/Groups'));
const MovimentoFalimentar = lazy(() => import('./internal/modules/business-intelligence/movimento-falimentar/MovimentoFalimentar'));
const AssociadosDashboard = lazy(() => import('./internal/modules/business-intelligence/associados/AssociadosDashboard'));
const MesaOperacaoDashboard = lazy(() => import('./internal/modules/business-intelligence/mesa-operacao/MesaOperacaoDashboard'));
const DashboardsView = lazy(() => import('./internal/modules/dashboards/DashboardsView'));
const CreateUser = lazy(() => import('./internal/modules/administracao/criar-usuario/CreateUser'));
const Marketing = lazy(() => import('./internal/modules/calendario/Marketing'));
const NossoFeed = lazy(() => import('./internal/modules/marketing/nosso-feed/NossoFeed'));
const Finance = lazy(() => import('./internal/modules/financeiro/processar-extrato/Finance'));
const FinanceDashboard = lazy(() => import('./internal/modules/financeiro/FinanceDashboard'));
const GrafenoIntegration = lazy(() => import('./internal/modules/financeiro/grafeno/GrafenoIntegration'));
const FinanceRefundsExpenses = lazy(() => import('./internal/modules/financeiro/central-pagamentos/FinanceRefundsExpenses'));
const FinancePaymentCalendar = lazy(() => import('./internal/modules/financeiro/calendario-pagamentos/FinancePaymentCalendar'));
const CustomerAnalysis = lazy(() => import('./internal/modules/intelligence/analise-clientes/CustomerAnalysis'));
const CustomerRegistration = lazy(() => import('./internal/modules/intelligence/cadastro-clientes/CustomerRegistration'));
const RiskAnalysis = lazy(() => import('./internal/modules/intelligence/analise-riscos/RiskAnalysis'));
const NplManagement = lazy(() => import('./internal/modules/intelligence/npl/NplManagement'));
const CommitteePipeline = lazy(() => import('./internal/modules/intelligence/esteira-comite/CommitteePipeline'));
const SmartFactorQuery = lazy(() => import('./internal/modules/intelligence/consulta-smartfactor/SmartFactorQuery'));
const ManagerRegistration = lazy(() => import('./internal/modules/intelligence/cadastro-gerentes/ManagerRegistration'));
const DatabaseManagement = lazy(() => import('./internal/modules/banco-de-dados/DatabaseManagement'));
const PurchaseApproval = lazy(() => import('./internal/modules/administrativo/solicitacoes-financeiras/PurchaseApproval'));
const PurchaseWorkflowConfig = lazy(() => import('./internal/modules/administrativo/configuracao-aprovadores/PurchaseWorkflowConfig'));
const MeetingRoomBooking = lazy(() => import('./internal/modules/administrativo/agendar-sala-reuniao/MeetingRoomBooking'));
const EmailConfig = lazy(() => import('./internal/modules/administracao/configuracao-email/EmailConfig'));
const ConfirmationSystem = lazy(() => import('./internal/modules/mesa-operacoes/relatorio-diario/ConfirmationSystem'));
const ConfirmationAnalise = lazy(() => import('./internal/modules/confirmacao/analise-confirmacao/ConfirmationAnalise'));
const OverdueAnalysis = lazy(() => import('./internal/modules/cobranca/analise-vencidos/OverdueAnalysis'));
const InconsistentBacking = lazy(() => import('./internal/modules/cobranca/lastro-inconsistente/InconsistentBacking'));
const CartaAnuencia = lazy(() => import('./internal/modules/cobranca/carta-anuencia/CartaAnuencia'));
const LegalPaymentApproval = lazy(() => import('./internal/modules/juridico/aprovacao-pagamentos/LegalPaymentApproval'));
const LegalApproversConfig = lazy(() => import('./internal/modules/juridico/configuracao-aprovadores-juridicos/LegalApproversConfig'));
const OperationsAnalysis = lazy(() => import('./internal/modules/mesa-operacoes/analise-operacao/OperationsAnalysis'));
const ValidateCepsCnab = lazy(() => import('./internal/modules/mesa-operacoes/validar-ceps/ValidateCepsCnab'));
const MonitorDashboard = lazy(() => import('./internal/modules/monitor/MonitorDashboard'));
import ProtectedRoute from './internal/core/ProtectedRoute';
import InternalLayout from './internal/core/InternalLayout';
import AccessRoute from './internal/core/AccessRoute';
import { AuthProvider } from './internal/core/AuthContext';
import { SystemErrorBoundary } from './internal/core/SystemErrorBoundary';
import './App.css';

import { API_BASE_URL } from './config/api';

const PublicLayout = () => {
  useEffect(() => {
    try {
      let sessionId = sessionStorage.getItem('site_analytics_session_id');
      if (!sessionId) {
        sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        sessionStorage.setItem('site_analytics_session_id', sessionId);
      }

      fetch(`${API_BASE_URL}/api/analytics/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          path: window.location.pathname,
          referrer: document.referrer || 'Direto'
        })
      }).catch(() => {});
    } catch {}
  }, []);

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

function App() {
  // Intercepta erros de carregamento assíncrono de chunks do Vite após novo deploy
  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = String(event?.reason?.message || event?.reason || '');
      if (
        reason.includes('Failed to fetch dynamically imported module') ||
        reason.includes('Loading chunk') ||
        reason.includes('ChunkLoadError')
      ) {
        console.warn('Detectada divergência de chunks atualizados no servidor:', reason);
        window.dispatchEvent(new CustomEvent('lepta_system_update_available', {
          detail: { reason: 'chunk_load_error' }
        }));
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return (
    <SystemErrorBoundary>
      <AuthProvider>
        <Router>
          <Suspense fallback={null}>
            <Routes>
            {/* Rotas Públicas com Navbar e Footer */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Rotas Internas protegidas com o InternalLayout */}
            <Route element={<ProtectedRoute />}>
              <Route element={<InternalLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/marketing" element={<AccessRoute permission="6"><Marketing /></AccessRoute>} />
                <Route path="/marketing/nosso-feed" element={<AccessRoute permission="6"><NossoFeed /></AccessRoute>} />
                <Route path="/dashboards" element={<AccessRoute permission="5"><DashboardsView /></AccessRoute>} />
                <Route path="/bi" element={<Navigate to="/bi/movimento-falimentar" replace />} />
                <Route path="/bi/movimento-falimentar" element={<AccessRoute permission="4.1"><MovimentoFalimentar /></AccessRoute>} />
                <Route path="/bi/associados" element={<AccessRoute permission="4.2"><AssociadosDashboard /></AccessRoute>} />
                <Route path="/bi/mesa-operacao" element={<AccessRoute permission="4.3"><MesaOperacaoDashboard /></AccessRoute>} />
                <Route path="/financeiro" element={<AccessRoute permission="7"><FinanceDashboard /></AccessRoute>} />
                <Route path="/financeiro/extratos" element={<AccessRoute permission="7.1"><Finance /></AccessRoute>} />
                <Route path="/financeiro/grafeno" element={<AccessRoute permission="7.2"><GrafenoIntegration /></AccessRoute>} />
                <Route path="/financeiro/reembolsos-despesas" element={<AccessRoute permission="7.4"><FinanceRefundsExpenses /></AccessRoute>} />
                <Route path="/financeiro/calendario-pagamentos" element={<AccessRoute permission="7.5"><FinancePaymentCalendar /></AccessRoute>} />
                <Route path="/intelligence/analise-clientes" element={<AccessRoute permission="8.1"><CustomerAnalysis /></AccessRoute>} />
                <Route path="/intelligence/cadastro-clientes" element={<AccessRoute permission="8.2"><CustomerRegistration /></AccessRoute>} />
                <Route path="/intelligence/analise-riscos" element={<AccessRoute permission="8.3"><RiskAnalysis /></AccessRoute>} />
                <Route path="/intelligence/npl" element={<AccessRoute permission="8.4"><NplManagement /></AccessRoute>} />
                <Route path="/intelligence/esteira-comite" element={<AccessRoute permission="8.5"><CommitteePipeline /></AccessRoute>} />
                <Route path="/intelligence/consulta-smartfactor" element={<AccessRoute permission="8.6"><SmartFactorQuery /></AccessRoute>} />
                <Route path="/intelligence/cadastro-gerentes" element={<AccessRoute permission="8.7"><ManagerRegistration /></AccessRoute>} />
                <Route path="/administrativo/compras" element={<AccessRoute permission="11.1"><PurchaseApproval /></AccessRoute>} />
                <Route path="/administrativo/configuracao-compras" element={<AccessRoute permission="11.2"><PurchaseWorkflowConfig /></AccessRoute>} />
                <Route path="/administrativo/salas-reuniao" element={<AccessRoute permission="11.3"><MeetingRoomBooking /></AccessRoute>} />
                <Route path="/confirmacao/sistema" element={<Navigate to="/mesa-operacoes/relatorio-diario" replace />} />
                <Route path="/confirmacao/analise" element={<AccessRoute permission="10.2"><ConfirmationAnalise /></AccessRoute>} />
                <Route path="/cobranca/analise-vencidos" element={<AccessRoute permission="12.1"><OverdueAnalysis /></AccessRoute>} />
                <Route path="/cobranca/lastro-inconsistente" element={<AccessRoute permission="12.2"><InconsistentBacking /></AccessRoute>} />
                <Route path="/cobranca/carta-anuencia" element={<AccessRoute permission="12.3"><CartaAnuencia /></AccessRoute>} />
                <Route path="/juridico/aprovacao-pagamentos" element={<AccessRoute permission="13.1"><LegalPaymentApproval /></AccessRoute>} />
                <Route path="/juridico/configuracao-aprovadores" element={<AccessRoute permission="13.2"><LegalApproversConfig /></AccessRoute>} />
                <Route path="/mesa-operacoes/analise" element={<AccessRoute permission="14.1"><OperationsAnalysis /></AccessRoute>} />
                <Route path="/mesa-operacoes/validar-ceps" element={<AccessRoute permission="14.2"><ValidateCepsCnab /></AccessRoute>} />
                <Route path="/mesa-operacoes/relatorio-diario" element={<AccessRoute permission="14.3"><ConfirmationSystem /></AccessRoute>} />
                <Route path="/banco-de-dados" element={<AccessRoute permission="9"><DatabaseManagement /></AccessRoute>} />
                <Route path="/permissions" element={<AccessRoute masterOnly><Permissions /></AccessRoute>} />
                <Route path="/permissions/create-user" element={<AccessRoute masterOnly><CreateUser /></AccessRoute>} />
                <Route path="/permissions/groups" element={<AccessRoute masterOnly><Groups /></AccessRoute>} />
                <Route path="/permissions/email-config" element={<AccessRoute masterOnly><EmailConfig /></AccessRoute>} />
                <Route path="/monitor" element={<AccessRoute masterOnly><MonitorDashboard /></AccessRoute>} />
              </Route>
            </Route>
          </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </SystemErrorBoundary>
  );
}

export default App;
