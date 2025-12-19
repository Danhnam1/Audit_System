import { useState, useEffect } from 'react';
import { MainLayout } from '../../layouts';
import useAuthStore, { useUserId } from '../../store/useAuthStore';
import { getUserById } from '../../api/adminUsers';
import { getDepartmentById } from '../../api/departments';
import { toast } from 'react-toastify';

export default function Profile() {
  const { user: authUser } = useAuthStore();
  const userId = useUserId();
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string>('N/A');
  const [roleName, setRoleName] = useState<string>('N/A');

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) {
      toast.error('User ID not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const userData = await getUserById(userId);
      
      setFullName(userData?.fullName || authUser?.fullName || '');
      setRoleName(userData?.roleName || authUser?.role || 'N/A');
      
      // Load avatar URL if available
      const avatar = (userData as any)?.avatarUrl || (userData as any)?.avatar || null;
      setAvatarUrl(avatar);
      
      // Load department name
      if (userData?.deptId) {
        try {
          const dept = await getDepartmentById(Number(userData.deptId));
          setDepartmentName(dept?.name || 'N/A');
        } catch (e) {
          console.warn('Failed to load department:', e);
          setDepartmentName('N/A');
        }
      } else {
        setDepartmentName('N/A');
      }
    } catch (error: any) {
      console.error('Failed to load profile:', error);
      toast.error('Failed to load profile information');
      // Fallback to auth store data
      setFullName(authUser?.fullName || '');
      setRoleName(authUser?.role || 'N/A');
    } finally {
      setLoading(false);
    }
  };



  const displayAvatar = avatarUrl;
  const displayInitial = fullName?.charAt(0)?.toUpperCase() || authUser?.fullName?.charAt(0)?.toUpperCase() || '?';

  const layoutUser = authUser ? { name: authUser.fullName, avatar: undefined } : undefined;

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-semibold text-gray-900">My Profile</h1>
            <p className="text-gray-600 text-sm mt-1">
              View and update your profile information
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-600">Loading profile...</span>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {/* Avatar Section */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative">
                    {displayAvatar ? (
                      <img
                        src={displayAvatar}
                        alt="Profile"
                        className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent) {
                            const fallback = parent.querySelector('.avatar-fallback') as HTMLElement;
                            if (fallback) fallback.style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    <div
                      className={`avatar-fallback w-32 h-32 rounded-full bg-gradient-to-r from-sky-600 to-sky-700 flex items-center justify-center border-4 border-gray-200 ${displayAvatar ? 'hidden' : ''}`}
                    >
                      <span className="text-white text-4xl font-semibold">
                        {displayInitial}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Profile Information */}
                <div className="space-y-4">
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </label>
                    <p className="text-gray-900 font-medium">{fullName || 'N/A'}</p>
                  </div>

                  {/* Department (Read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department
                    </label>
                    <p className="text-gray-900">{departmentName}</p>
                  </div>

                  {/* Role (Read-only) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Role
                    </label>
                    <p className="text-gray-900">{roleName}</p>
                  </div>
                </div>

            
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

