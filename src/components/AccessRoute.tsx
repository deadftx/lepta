import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission } from '../config/permissions';

interface AccessRouteProps {
  permission?: string;
  masterOnly?: boolean;
  children: ReactNode;
}

const AccessRoute = ({ permission, masterOnly = false, children }: AccessRouteProps) => {
  const { user } = useAuth();
  const allowed = masterOnly
    ? user?.role === 'MASTER'
    : Boolean(permission && hasPermission(user, permission));

  return allowed ? children : <Navigate to="/dashboard" replace />;
};

export default AccessRoute;
