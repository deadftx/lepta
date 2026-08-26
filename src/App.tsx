import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './internal/modules/home/Dashboard';
import Permissions from './internal/modules/administration/access/Permissions';
import Groups from './internal/modules/administration/access/Groups';
import BI from './internal/modules/business-intelligence/BI';
import DashboardsView from './internal/modules/dashboards/DashboardsView';
import CreateUser from './internal/modules/administration/access/CreateUser';
import Marketing from './internal/modules/calendar/Marketing';
import Finance from './internal/modules/finance/statement-processing/Finance';
import FinanceDashboard from './internal/modules/finance/FinanceDashboard';
import GrafenoIntegration from './internal/modules/finance/grafeno/GrafenoIntegration';
import FinanceRefundsExpenses from './internal/modules/finance/FinanceRefundsExpenses';
import FinancePaymentCalendar from './internal/modules/finance/FinancePaymentCalendar';
import CustomerAnalysis from './internal/modules/intelligence/customer-analysis/CustomerAnalysis';
import CustomerRegistration from './internal/modules/intelligence/customer-registration/CustomerRegistration';
import RiskAnalysis from './internal/modules/intelligence/risk-analysis/RiskAnalysis';
import DatabaseManagement from './internal/modules/database/DatabaseManagement';
import PurchaseApproval from './internal/modules/administrative/purchases/PurchaseApproval';
import PurchaseWorkflowConfig from './internal/modules/administrative/purchases/PurchaseWorkflowConfig';
import EmailConfig from './internal/modules/administration/access/EmailConfig';
import ConfirmationSystem from './internal/modules/confirmation/ConfirmationSystem';
import ConfirmationAnalise from './internal/modules/confirmation/ConfirmationAnalise';
import ProtectedRoute from './internal/core/ProtectedRoute';
import InternalLayout from './internal/core/InternalLayout';
import AccessRoute from './internal/core/AccessRoute';
import { AuthProvider } from './internal/core/AuthContext';
import './App.css';

const PublicLayout = () => {
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
  return (
    <AuthProvider>
      <Router>
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
              <Route path="/dashboards" element={<AccessRoute permission="5"><DashboardsView /></AccessRoute>} />
              <Route path="/bi" element={<AccessRoute permission="4"><BI /></AccessRoute>} />
              <Route path="/financeiro" element={<AccessRoute permission="7"><FinanceDashboard /></AccessRoute>} />
              <Route path="/financeiro/extratos" element={<AccessRoute permission="7.1"><Finance /></AccessRoute>} />
              <Route path="/financeiro/grafeno" element={<AccessRoute permission="7.2"><GrafenoIntegration /></AccessRoute>} />
              <Route path="/financeiro/reembolsos-despesas" element={<AccessRoute permission="7.4"><FinanceRefundsExpenses /></AccessRoute>} />
              <Route path="/financeiro/calendario-pagamentos" element={<AccessRoute permission="7.5"><FinancePaymentCalendar /></AccessRoute>} />
              <Route path="/intelligence/analise-clientes" element={<AccessRoute permission="8.1"><CustomerAnalysis /></AccessRoute>} />
              <Route path="/intelligence/cadastro-clientes" element={<AccessRoute permission="8.2"><CustomerRegistration /></AccessRoute>} />
              <Route path="/intelligence/analise-riscos" element={<AccessRoute permission="8.3"><RiskAnalysis /></AccessRoute>} />
              <Route path="/administrativo/compras" element={<AccessRoute permission="11.1"><PurchaseApproval /></AccessRoute>} />
              <Route path="/administrativo/configuracao-compras" element={<AccessRoute permission="11.2"><PurchaseWorkflowConfig /></AccessRoute>} />
              <Route path="/confirmacao/sistema" element={<AccessRoute permission="10.1"><ConfirmationSystem /></AccessRoute>} />
              <Route path="/confirmacao/analise" element={<AccessRoute permission="10.2"><ConfirmationAnalise /></AccessRoute>} />
              <Route path="/banco-de-dados" element={<AccessRoute permission="9"><DatabaseManagement /></AccessRoute>} />
              <Route path="/permissions" element={<AccessRoute masterOnly><Permissions /></AccessRoute>} />
              <Route path="/permissions/create-user" element={<AccessRoute masterOnly><CreateUser /></AccessRoute>} />
              <Route path="/permissions/groups" element={<AccessRoute masterOnly><Groups /></AccessRoute>} />
              <Route path="/permissions/email-config" element={<AccessRoute masterOnly><EmailConfig /></AccessRoute>} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
