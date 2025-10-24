import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../contexts';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth();

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

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to their appropriate dashboard
    return <Navigate to={getRoleHomePath(user.role)} replace />;
  }

  return <>{children}</>;
}

// Helper function to get the home path based on role
function getRoleHomePath(role: UserRole): string {
  const rolePathMap: Record<UserRole, string> = {
    Admin: '/admin',
    SQAStaff: '/sqa-staff',
    SQAHead: '/sqa-head',
    DepartmentStaff: '/department-staff',
    DepartmentHead: '/department-head',
    Director: '/director',
  };
  return rolePathMap[role] || '/';
}
