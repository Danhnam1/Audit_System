import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import useAuthStore from '../store/useAuthStore';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { token, user, loading } = useAuthStore();
  const isAuthenticated = !!token;
  const isLoading = loading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Get role from user.role or user.roleName
  const userRole = (user?.role || user?.roleName) as UserRole | undefined;

  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    // Redirect to their appropriate dashboard
    return <Navigate to={getRoleHomePath(userRole)} replace />;
  }

  return <>{children}</>;
}

// Helper function to get the home path based on role
function getRoleHomePath(role: UserRole): string {
  const rolePathMap: Record<UserRole, string> = {
    Admin: '/admin',
    "Auditor": '/auditor',
    "Lead Auditor": '/lead-auditor',
    "CAPAOwner": '/capa-owner',
    "AuditeeOwner": '/auditee-owner',
    Director: '/director',
  };
  return rolePathMap[role] || '/';
}
