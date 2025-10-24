import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export interface SidebarMenuItem {
  icon: ReactNode;
  label: string;
  path: string;
  badge?: string | number;
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
}

export const Sidebar = ({ logo, menuItems, teams, user, theme, className = '' }: SidebarProps) => {
  // Default theme (Aviation Blue - Primary colors)
  const defaultTheme: SidebarTheme = {
    activeBg: 'bg-primary-50',
    activeText: 'text-primary-600',
    inactiveText: 'text-gray-700',
    hoverBg: 'hover:bg-gray-100',
    avatarBg: 'bg-primary-100',
    avatarText: 'text-primary-600',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-600',
  };

  const currentTheme = { ...defaultTheme, ...theme };

  return (
    <aside className={`w-[280px] h-screen bg-white border-r border-gray-200 flex flex-col ${className}`}>
      {/* Logo */}
      {logo && (
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          {logo}
        </div>
      )}

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-3 space-y-1">
          {menuItems.map((item, index) => (
            <NavLink
              key={index}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? `${currentTheme.activeBg} ${currentTheme.activeText}`
                    : `${currentTheme.inactiveText} ${currentTheme.hoverBg}`
                }`
              }
            >
              <span className="w-5 h-5 flex items-center justify-center">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className={`px-2 py-0.5 text-xs font-medium ${currentTheme.badgeBg} ${currentTheme.badgeText} rounded`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
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
      {user && (
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
      )}
    </aside>
  );
};
