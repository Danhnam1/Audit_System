import { useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import useAuthStore from "../store/useAuthStore";
import { NotificationBell } from "./NotificationBell";
import { Sidebar } from "./Sidebar";

export const Navigation = () => {
  const { token, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const isAuthenticated = !!token;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    if (isProfileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!isAuthenticated) {
    return null; // Don't show navigation when not logged in
  }

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50 border-b border-gray-800">
      <div className="max-w px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand Section */}


          <div className="flex items-center gap-3">
            {/* Mobile hamburger to toggle sidebar */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('ams:toggle-sidebar'))}
              className="mr-1 md:hidden p-3 rounded-full text-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Desktop hamburger to collapse sidebar */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('ams:toggle-sidebar-collapse'))}
              className="mr-1 hidden md:block p-3 rounded-full transition-colors"
              aria-label="Toggle sidebar collapse"
            >
              <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
<div>
  <h1 className="text-gray-800 font-bold text-xl">Hi,  {user?.fullName}</h1>
            </div>
          </div>
       

          {/* User Info & Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            

            {/* Role Badge */}
            <div className="hidden sm:flex items-center gap-2 text-gray-900 px-3 py-2 rounded-lg border border-gray-800">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              <span className="text-sm font-medium">{user?.role}</span>
            </div>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#3d4349] transition-colors"
                aria-label="User menu"
              >
                <div className="w-9 h-9 bg-gradient-to-r from-sky-600 to-sky-700 rounded-full flex items-center justify-center border-2 border-gray-600">
                  <span className="text-white text-sm font-semibold">
                    {user?.fullName?.charAt(0)}
                  </span>
                </div>
                <svg 
                  className={`w-4 h-4 text-gray-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#2b3035] rounded-lg shadow-xl border border-gray-700 py-2 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-r from-sky-600 to-sky-700 rounded-full flex items-center justify-center">
                        <span className="text-white text-lg font-semibold">
                          {user?.fullName?.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{user?.fullName}</p>
                        <p className="text-xs text-gray-400">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                

                  {/* Logout */}
                  <div className="border-t border-gray-700 pt-2">
                    <button
                      onClick={async () => {
                        setIsProfileOpen(false);
                        await logout();
                        navigate('/login');
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-[#3d4349] transition-colors flex items-center gap-3"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
