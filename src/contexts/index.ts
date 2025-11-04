// Temporary wrapper for backward compatibility
// Using useAuthStore instead of AuthContext
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';

export function useAuth() {
  const { token, user, logout: storeLogout } = useAuthStore();
  const navigate = useNavigate();
  
  const logout = async () => {
    await storeLogout();
    navigate('/login');
  };

  return {
    isAuthenticated: !!token,
    user,
    logout,
    isLoading: false,
  };
}

// Keep AuthProvider export for compatibility (passthrough)
export function AuthProvider({ children }: { children: any }) {
  return children;
}
