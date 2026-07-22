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
import ProtectedRoute from './components/ProtectedRoute';
import InternalLayout from './components/InternalLayout';
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
              <Route path="/creditos" element={<Credits />} />
              <Route path="/riscos" element={<Risks />} />
              <Route path="/comite" element={<Committee />} />
              <Route path="/bi" element={<BI />} />
              <Route path="/permissions" element={<Permissions />} />
              <Route path="/permissions/groups" element={<Groups />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
