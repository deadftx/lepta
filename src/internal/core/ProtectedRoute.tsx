import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  // If not authenticated, redirect to login page with original location state
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If authenticated, render the child routes (Outlet)
  return <Outlet />;
};

export default ProtectedRoute;
