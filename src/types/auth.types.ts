// Authentication types
export type UserRole = 
  | 'Admin'
  | 'SQAStaff'
  | 'SQAHead'
  | 'DepartmentStaff'
  | 'DepartmentHead'
  | 'Director';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}
