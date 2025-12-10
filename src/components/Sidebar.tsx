import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import Logo from '../../public/icon/logo.png';
import AA from '../../public/icon/A.png';

export interface SidebarMenuItem {
  icon?: ReactNode;
  label: string;
  path?: string;
  badge?: string | number;
  children?: SidebarMenuItem[];
}

export interface SidebarTeam {
  id: string;
  name: string;
  avatar?: string;
  initial?: string;
}

export interface SidebarTheme {
  // Active state colors
  activeBg?: string;        // e.g., 'bg-sky-50'
  activeText?: string;      // e.g., 'text-sky-600'
  // Inactive/default state colors
  inactiveText?: string;    // e.g., 'text-gray-700'
  hoverBg?: string;         // e.g., 'hover:bg-gray-100'
  // User avatar colors
  avatarBg?: string;        // e.g., 'bg-sky-100'
  avatarText?: string;      // e.g., 'text-sky-600'
  // Badge colors
  badgeBg?: string;         // e.g., 'bg-gray-100'
  badgeText?: string;       // e.g., 'text-gray-600'
}

export interface SidebarProps {
  logo?: ReactNode;
  menuItems: SidebarMenuItem[];
  teams?: SidebarTeam[];
  user?: {
    name: string;
    avatar?: string;
  };
  theme?: SidebarTheme;
  className?: string;
  isCollapsed?: boolean;
}

const depthIndentClasses = ['pl-0', 'pl-4', 'pl-6', 'pl-8'];

const getIndentClass = (depth: number) => {
  const index = Math.min(depthIndentClasses.length - 1, depth);
  return depthIndentClasses[index];
};

export const Sidebar = ({ logo: _logo, menuItems, teams, user: _user, theme, className = '', isCollapsed = false }: SidebarProps) => {
  // Default theme (Dark Sidebar)
  const defaultTheme: SidebarTheme = {
    activeBg: 'bg-[#f2f9ff]',           // Màu nền khi active
    activeText: 'text-[#008cff]',            // Màu chữ khi active
    inactiveText: 'text-[5f5f5f]',       // Màu chữ khi không active (THAY ĐỔI TẠI ĐÂY)
    hoverBg: 'hover:bg-[#f2f9ff]',      // Màu nền khi hover (THAY ĐỔI TẠI ĐÂY)
    avatarBg: 'bg-gray-700',
    avatarText: 'text-gray-300',
    badgeBg: 'bg-gray-700',
    badgeText: 'text-gray-300',
  };

  const currentTheme = { ...defaultTheme, ...theme };

  return (
    <aside className={`${isCollapsed ? 'w-[70px]' : 'w-[280px]'} h-screen bg-white border-r flex flex-col transition-all duration-300 ${className}`}>
      <div className="w-auto h-20 overflow-hidden">
    <img
  src={isCollapsed ? AA : Logo}
  alt="Logo"
  className="w-full h-full object-contain"
/>
      </div>


      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto ">
        <div className="px-3 space-y-1">
          {menuItems.map((item, index) =>
            item.children && item.children.length > 0 ? (
              <div key={`group-${index}`} className="pt-4">
                {!isCollapsed && (
                  <div className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    {item.label}
                  </div>
                )}
                <div className="space-y-1">
                  {item.children.map((child, childIndex) => (
                    <MenuLink
                      key={child.path || `${child.label}-${childIndex}`}
                      item={child}
                      depth={1}
                      currentTheme={currentTheme}
                      isCollapsed={isCollapsed}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <MenuLink
                key={item.path || `${item.label}-${index}`}
                item={item}
                depth={0}
                currentTheme={currentTheme}
                isCollapsed={isCollapsed}
              />
            )
          )}
        </div>

        {/* Teams Section */}
        {teams && teams.length > 0 && (
          <div className="mt-6 px-3">
            <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Your teams
            </h3>
            <div className="space-y-1">
              {teams.map((team) => (
                <button
                  key={team.id}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 text-xs font-semibold rounded">
                    {team.initial || team.name.charAt(0).toUpperCase()}
                  </div>
                  <span>{team.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User Profile */}
      {/* {user && (
        <div className="border-t border-gray-200 p-4">
          <button className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 transition-colors">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className={`w-8 h-8 rounded-full ${currentTheme.avatarBg} ${currentTheme.avatarText} flex items-center justify-center font-semibold text-sm`}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-medium text-gray-700">{user.name}</span>
          </button>
        </div>
      )} */}
    </aside>
  );
};

interface MenuLinkProps {
  item: SidebarMenuItem;
  depth: number;
  currentTheme: SidebarTheme;
  isCollapsed?: boolean;
}

const MenuLink = ({ item, depth, currentTheme, isCollapsed = false }: MenuLinkProps) => {
  if (!item.path) return null;

  const indentClass = getIndentClass(depth);

  return (
    <NavLink
      to={item.path}
      title={isCollapsed ? item.label : undefined}
      className={({ isActive }) =>
        `flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} ${indentClass} pr-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
          isActive
            ? `${currentTheme.activeBg} ${currentTheme.activeText}`
            : `${currentTheme.inactiveText} ${currentTheme.hoverBg}`
        }`
      }
    >
      {item.icon && <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>}
      {!isCollapsed && (
        <>
          <span className="flex-1">{item.label}</span>
          {item.badge && (
            <span className={`px-2 py-0.5 text-xs font-medium ${currentTheme.badgeBg} ${currentTheme.badgeText} rounded`}>
              {item.badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
};
