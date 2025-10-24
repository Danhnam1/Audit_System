import type { ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar.tsx';
import type { SidebarMenuItem } from '../components/Sidebar.tsx';

interface MainLayoutProps {
  children: ReactNode;
}

// Alias for backward compatibility
export interface AdminLayoutProps extends MainLayoutProps {}

// Admin specific icons
const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"
      fill="currentColor"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
      fill="currentColor"
    />
  </svg>
);

const DashboardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"
      fill="currentColor"
    />
  </svg>
);

const AuditIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"
      fill="currentColor"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
      fill="currentColor"
    />
  </svg>
);

const ReportsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"
      fill="currentColor"
    />
  </svg>
);

const DatabaseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path
      d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"
      fill="currentColor"
    />
    <path
      d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"
      fill="currentColor"
    />
    <path
      d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"
      fill="currentColor"
    />
  </svg>
);

export const MainLayout = ({ children }: MainLayoutProps) => {
  // Logo
  const Logo = () => (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-to-r from-sky-600 to-sky-700 rounded-lg flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
          <path d="M10 2L3 7v6c0 5.5 3.8 7.7 7 9 3.2-1.3 7-3.5 7-9V7l-7-5z" />
        </svg>
      </div>
      <span className="font-bold text-lg text-gray-800">AMS</span>
    </div>
  );

  // Admin menu items
  const menuItems: SidebarMenuItem[] = [
    {
      icon: <DashboardIcon />,
      label: 'Dashboard',
      path: '/admin',
      badge: '5',
    },
    {
      icon: <UsersIcon />,
      label: 'User Management',
      path: '/admin/users',
    },
    {
      icon: <AuditIcon />,
      label: 'Audit Logs',
      path: '/admin/audit-logs',
      badge: '12',
    },
    {
      icon: <ReportsIcon />,
      label: 'Reports',
      path: '/admin/reports',
      badge: '20+',
    },
    {
      icon: <DatabaseIcon />,
      label: 'Database',
      path: '/admin/database',
    },
    {
      icon: <SettingsIcon />,
      label: 'Settings',
      path: '/admin/settings',
    },
  ];

  // Departments as teams
  const departments = [
    { id: '1', name: 'IT Department', initial: 'IT' },
    { id: '2', name: 'HR Department', initial: 'HR' },
    { id: '3', name: 'Finance', initial: 'F' },
  ];

  // Current user
  const user = {
    name: 'Admin User',
    avatar: undefined, // Will show initial
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <Sidebar
        logo={<Logo />}
        menuItems={menuItems}
        teams={departments}
        user={user}
      />
      <main className="flex-1 overflow-y-auto w-full">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

// Export alias for backward compatibility
export { MainLayout as AdminLayout };
