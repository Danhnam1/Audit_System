import type { ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar.tsx';
import type { SidebarMenuItem, SidebarTheme } from '../components/Sidebar.tsx';
import {
  UsersIcon,
  SettingsIcon,
  DashboardIcon,
  AuditIcon,
  ReportsIcon,
  DatabaseIcon,
} from './icons.tsx';

export interface Team {
  id: string;
  name: string;
  initial: string;
}

export interface User {
  name: string;
  avatar?: string;
}

export interface MainLayoutProps {
  children: ReactNode;
  logo?: ReactNode;
  menuItems?: SidebarMenuItem[];
  teams?: Team[];
  user?: User;
  sidebarTheme?: SidebarTheme;
  showSidebar?: boolean;
}

// Re-export SidebarMenuItem for convenience
export type { SidebarMenuItem };

export const MainLayout = ({
  children,
  logo,
  menuItems,
  teams,
  user,
  sidebarTheme,
  showSidebar = true,
}: MainLayoutProps) => {
  // Default Logo (using global primary theme)
  const defaultLogo = (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
          <path d="M10 2L3 7v6c0 5.5 3.8 7.7 7 9 3.2-1.3 7-3.5 7-9V7l-7-5z" />
        </svg>
      </div>
      <span className="font-bold text-lg text-gray-800">AMS</span>
    </div>
  );

  // Default menu items
  const defaultMenuItems: SidebarMenuItem[] = [
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

  // Default teams
  const defaultTeams: Team[] = [
    { id: '1', name: 'IT Department', initial: 'IT' },
    { id: '2', name: 'HR Department', initial: 'HR' },
    { id: '3', name: 'Finance', initial: 'F' },
  ];

  // Default user
  const defaultUser: User = {
    name: 'User',
    avatar: undefined,
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {showSidebar && (
        <Sidebar
          logo={logo || defaultLogo}
          menuItems={menuItems || defaultMenuItems}
          teams={teams || defaultTeams}
          user={user || defaultUser}
          theme={sidebarTheme}
        />
      )}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};
