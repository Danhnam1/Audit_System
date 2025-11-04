// import { createContext, useContext, useState, useEffect } from 'react';
// import type { ReactNode } from 'react';
// import type { User, LoginCredentials, AuthContextType } from '../types';
// import { useLocalStorage } from '../hooks/useLocalStorage';

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// // Mock users for demonstration - In production, this should be from backend API
// const MOCK_USERS = [
//   {
//     id: '1',
//     username: 'admin',
//     password: 'admin123',
//     email: 'admin@ams.com',
//     role: 'Admin' as const,
//     fullName: 'Admin User',
//   },
//   {
//     id: '2',
//     username: 'sqa',
//     password: 'sqa123',
//     email: 'sqa@ams.com',
//     role: 'SQAStaff' as const,
//     fullName: 'SQA Staff User',
//   },
//   {
//     id: '3',
//     username: 'sqahead',
//     password: 'sqahead123',
//     email: 'sqahead@ams.com',
//     role: 'SQAHead' as const,
//     fullName: 'SQA Head User',
//   },
//   {
//     id: '4',
//     username: 'deptstaff',
//     password: 'dept123',
//     email: 'deptstaff@ams.com',
//     role: 'DepartmentStaff' as const,
//     fullName: 'Department Staff User',
//   },
//   {
//     id: '5',
//     username: 'depthead',
//     password: 'head123',
//     email: 'depthead@ams.com',
//     role: 'DepartmentHead' as const,
//     fullName: 'Department Head User',
//   },
//   {
//     id: '6',
//     username: 'director',
//     password: 'director123',
//     email: 'director@ams.com',
//     role: 'Director' as const,
//     fullName: 'Director User',
//   },
// ];

// interface AuthProviderProps {
//   children: ReactNode;
// }

// export function AuthProvider({ children }: AuthProviderProps) {
//   const [user, setUser] = useLocalStorage<User | null>('ams_user', null);
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     // Check if user is stored in localStorage on mount
//     setIsLoading(false);
//   }, []);

//   const login = async (credentials: LoginCredentials) => {
//     setIsLoading(true);
//     try {
//       // Simulate API call delay
//       await new Promise((resolve) => setTimeout(resolve, 1000));

//       // Find user by username and password
//       const foundUser = MOCK_USERS.find(
//         (u) => u.username === credentials.username && u.password === credentials.password
//       );

//       if (!foundUser) {
//         throw new Error('Invalid username or password');
//       }

//       // Remove password from user object
//       const { password, ...userWithoutPassword } = foundUser;
//       setUser(userWithoutPassword);
//     } catch (error) {
//       setIsLoading(false);
//       throw error;
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const logout = () => {
//     setUser(null);
//   };

//   const value: AuthContextType = {
//     user,
//     isAuthenticated: !!user,
//     isLoading,
//     login,
//     logout,
//   };

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// }

// export function useAuth() {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// }
