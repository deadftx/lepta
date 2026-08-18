import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './internal/modules/home/Dashboard';
import Permissions from './internal/modules/administration/access/Permissions';
import Groups from './internal/modules/administration/access/Groups';
import Credits from './internal/modules/credits/Credits';
import Risks from './internal/modules/risks/Risks';
import Committee from './internal/modules/credit-committee/Committee';
import BI from './internal/modules/business-intelligence/BI';
import DashboardsView from './internal/modules/dashboards/DashboardsView';
import CreateUser from './internal/modules/administration/access/CreateUser';
import Marketing from './internal/modules/calendar/Marketing';
import Finance from './internal/modules/finance/statement-processing/Finance';
import FinanceDashboard from './internal/modules/finance/FinanceDashboard';
import CustomerAnalysis from './internal/modules/intelligence/customer-analysis/CustomerAnalysis';
import CustomerRegistration from './internal/modules/intelligence/customer-registration/CustomerRegistration';
import DatabaseManagement from './internal/modules/database/DatabaseManagement';
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
              <Route path="/creditos" element={<AccessRoute permission="1"><Credits /></AccessRoute>} />
              <Route path="/riscos" element={<AccessRoute permission="2"><Risks /></AccessRoute>} />
              <Route path="/comite" element={<AccessRoute permission="3"><Committee /></AccessRoute>} />
              <Route path="/marketing" element={<AccessRoute permission="6"><Marketing /></AccessRoute>} />
              <Route path="/dashboards" element={<AccessRoute permission="5"><DashboardsView /></AccessRoute>} />
              <Route path="/bi" element={<AccessRoute permission="4"><BI /></AccessRoute>} />
              <Route path="/financeiro" element={<AccessRoute permission="7.1"><FinanceDashboard /></AccessRoute>} />
              <Route path="/financeiro/extratos" element={<AccessRoute permission="7.1"><Finance /></AccessRoute>} />
              <Route path="/intelligence/analise-clientes" element={<AccessRoute permission="8.1"><CustomerAnalysis /></AccessRoute>} />
              <Route path="/intelligence/cadastro-clientes" element={<AccessRoute permission="8.2"><CustomerRegistration /></AccessRoute>} />
              <Route path="/banco-de-dados" element={<AccessRoute permission="9"><DatabaseManagement /></AccessRoute>} />
              <Route path="/permissions" element={<AccessRoute masterOnly><Permissions /></AccessRoute>} />
              <Route path="/permissions/create-user" element={<AccessRoute masterOnly><CreateUser /></AccessRoute>} />
              <Route path="/permissions/groups" element={<AccessRoute masterOnly><Groups /></AccessRoute>} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
