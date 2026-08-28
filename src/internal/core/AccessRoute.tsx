import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { hasPermission, hasAnyPermission } from './permissions';

interface AccessRouteProps {
  permission?: string | string[];
  masterOnly?: boolean;
  children: ReactNode;
}

const AccessRoute = ({ permission, masterOnly = false, children }: AccessRouteProps) => {
  const { user } = useAuth();
  const allowed = masterOnly
    ? user?.role === 'MASTER'
    : Array.isArray(permission)
      ? hasAnyPermission(user, permission)
      : Boolean(permission && hasPermission(user, permission));

  return allowed ? children : <Navigate to="/dashboard" replace />;
};

export default AccessRoute;
