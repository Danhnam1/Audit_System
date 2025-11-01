import type { ReactNode } from 'react';
import { Sidebar } from '../components/Sidebar.tsx';
import type { SidebarMenuItem, SidebarTheme } from '../components/Sidebar.tsx';
import './icons.tsx';
import { useAuth } from '../contexts';
import { getRoleMenu } from '../helpers/roleMenus';

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

  // Default menu handled by role-based helper. If caller passes `menuItems`, that will be used instead.
  const { user: authUser } = useAuth();
  const role = authUser?.role;
  const defaultMenuItems: SidebarMenuItem[] = getRoleMenu(role);
  // Debug: log menu items for roles that reported missing items
  if (role === 'Admin' || role === 'SQAHead') {
    // eslint-disable-next-line no-console
    console.debug('[MainLayout] role:', role, 'menuItems:', defaultMenuItems);
  }

 
  // Default user
  const defaultUser: User = {
    name: 'User',
    avatar: undefined,
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {showSidebar && (
        <Sidebar
          // logo={logo || defaultLogo}
          menuItems={menuItems || defaultMenuItems}
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
