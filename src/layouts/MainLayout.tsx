import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Sidebar } from '../components/Sidebar.tsx';
import type { SidebarMenuItem, SidebarTheme } from '../components/Sidebar.tsx';
import { Navigation } from '../components';
import { ChatBot } from '../components/ChatBot';
import './icons.tsx';
import useAuthStore, { useUserId } from '../store/useAuthStore';
import { getRoleMenu } from '../helpers/roleMenus';
import { hasAuditPlanCreationPermission } from '../api/auditPlanAssignment';


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
  user,
  sidebarTheme,
  showSidebar = true,
}: MainLayoutProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
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
  const { user: authUser } = useAuthStore();
  const userIdFromToken = useUserId();
  // Get role from either 'role' or 'roleName' field
  const role = authUser?.role || (authUser as any)?.roleName;
  const normalizedRole = role?.toLowerCase().replace(/\s+/g, '') || '';
  
  
  // Check if auditor has permission to create plans
  const [hasPlanPermission, setHasPlanPermission] = useState<boolean | null>(null);
  
  useEffect(() => {
    const checkPermission = async () => {
      if (normalizedRole === 'auditor') {
        // Get userId from token (JWT)
        const userId = userIdFromToken;
        
        if (!userId) {
          setHasPlanPermission(false);
          return;
        }
        
        try {
       
      
          
          if (!userId) {
            setHasPlanPermission(false);
            return;
          }
          
          // Pass userId directly (string or number)
          const hasPermission = await hasAuditPlanCreationPermission(userId);
          setHasPlanPermission(hasPermission);
        } catch (error) {
          console.error('[MainLayout] Failed to check plan creation permission', error);
          setHasPlanPermission(false);
        }
      } else {
        setHasPlanPermission(null);
      }
    };
    
    checkPermission();
  }, [normalizedRole, userIdFromToken]);
  
  const defaultMenuItems: SidebarMenuItem[] = getRoleMenu(role);
  const finalMenuItems: SidebarMenuItem[] = menuItems || defaultMenuItems;
  

 
  // Default user
  const defaultUser: User = {
    name: 'User',
    avatar: undefined,
  };
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const handler = () => setIsMobileSidebarOpen((v) => !v);
    window.addEventListener('ams:toggle-sidebar', handler as EventListener);
    return () => window.removeEventListener('ams:toggle-sidebar', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = () => setIsCollapsed((v) => !v);
    window.addEventListener('ams:toggle-sidebar-collapse', handler as EventListener);
    return () => window.removeEventListener('ams:toggle-sidebar-collapse', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = () => setIsCollapsed((v) => !v);
    window.addEventListener('ams:toggle-sidebar-collapse', handler as EventListener);
    return () => window.removeEventListener('ams:toggle-sidebar-collapse', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = () => setIsCollapsed((v) => !v);
    window.addEventListener('ams:toggle-sidebar-collapse', handler as EventListener);
    return () => window.removeEventListener('ams:toggle-sidebar-collapse', handler as EventListener);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#eff1f3]">
      {showSidebar && (
        <>
          {/* Desktop sidebar - Full Height */}
          <div className={`hidden md:block transition-all duration-300 ${isCollapsed ? 'w-[70px]' : 'w-[280px]'}`}>
            <Sidebar
              logo={logo || defaultLogo}
              menuItems={menuItems || finalMenuItems}
              user={user || defaultUser}
              theme={sidebarTheme}
              className={isCollapsed ? 'w-[70px]' : 'w-[280px]'}
              isCollapsed={isCollapsed}
            />
          </div>

          {/* Mobile sidebar (off-canvas) */}
          <div className={`md:hidden fixed inset-0 z-40 ${isMobileSidebarOpen ? '' : 'pointer-events-none'}`}>
            {/* Backdrop */}
            <div
              className={`fixed inset-0 bg-black/40 transition-opacity ${isMobileSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
              onClick={() => setIsMobileSidebarOpen(false)}
            />

            {/* Panel */}
            <div className={`fixed top-0 left-0 bottom-0 w-64 bg-white border-r border-gray-800 transform transition-transform ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                  <div>{logo || defaultLogo}</div>
                  <button onClick={() => setIsMobileSidebarOpen(false)} className="p-2 rounded-md hover:bg-gray-700">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <Sidebar
                    logo={undefined}
                    menuItems={menuItems || finalMenuItems}
                    user={user || defaultUser}
                    theme={sidebarTheme}
                    className="h-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Right side: Header + Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header on top */}
        <Navigation />
        {/* Content below header */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      {/* ChatBot - Available on all pages */}
      <ChatBot />
    </div>
  );
};
