import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/internal/Dashboard';
import Permissions from './pages/internal/Permissions';
import Groups from './pages/internal/Groups';
import Credits from './pages/internal/Credits';
import Risks from './pages/internal/Risks';
import Committee from './pages/internal/Committee';
import BI from './pages/internal/BI';
import DashboardsView from './pages/internal/DashboardsView';
import CreateUser from './pages/internal/CreateUser';
import Marketing from './pages/internal/Marketing';
import Finance from './pages/internal/Finance';
import FinanceDashboard from './pages/internal/FinanceDashboard';
import CustomerAnalysis from './pages/internal/CustomerAnalysis';
import DatabaseManagement from './pages/internal/DatabaseManagement';
import ProtectedRoute from './components/ProtectedRoute';
import InternalLayout from './components/InternalLayout';
import AccessRoute from './components/AccessRoute';
import { AuthProvider } from './contexts/AuthContext';
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
