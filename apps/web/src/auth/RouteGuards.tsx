import { Result, Spin } from 'antd';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { UserRole } from '../services/api';
import { useAuth } from './AuthContext';

export function RequireAuth() {
  const auth = useAuth(); const location = useLocation();
  if (auth.loading) return <div className="route-loading"><Spin size="large" /></div>;
  if (!auth.authenticated) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (auth.user?.mustChangePassword && location.pathname !== '/change-password') return <Navigate to="/change-password" replace />;
  return <Outlet />;
}
export function RequireRole({ roles }: { roles: UserRole[] }) { const auth = useAuth(); return auth.hasRole(...roles) ? <Outlet /> : <Result status="403" title="Permission required" subTitle="Your current role cannot access this platform area." />; }
