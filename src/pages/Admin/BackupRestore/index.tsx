import { MainLayout, DashboardIcon, UsersIcon, DepartmentIcon, BackupIcon } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState } from 'react';
import { getStatusColor } from '../../../constants';

const AdminBackupRestore = () => {
  const { user } = useAuth();
  const [backupProgress, setBackupProgress] = useState(0);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const menuItems = [
    { icon: <DashboardIcon />, label: 'Dashboard', path: '/admin' },
    { icon: <UsersIcon />, label: 'User Management', path: '/admin/users' },
    { icon: <DepartmentIcon />, label: 'Department Management', path: '/admin/departments' },
    { icon: <BackupIcon />, label: 'Backup & Restore', path: '/admin/backup' },
  ];

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const backupHistory = [
    {
      id: 'BKP-001',
      filename: 'ams_backup_2025-10-25_10-30.zip',
      size: '245 MB',
      type: 'Full Backup',
      status: 'Resolved',
      createdBy: 'Admin',
      createdDate: '2025-10-25 10:30',
      duration: '5m 23s',
    },
    {
      id: 'BKP-002',
      filename: 'ams_backup_2025-10-24_10-30.zip',
      size: '243 MB',
      type: 'Full Backup',
      status: 'Resolved',
      createdBy: 'System Auto',
      createdDate: '2025-10-24 10:30',
      duration: '5m 18s',
    },
    {
      id: 'BKP-003',
      filename: 'ams_backup_2025-10-23_10-30.zip',
      size: '241 MB',
      type: 'Full Backup',
      status: 'Resolved',
      createdBy: 'System Auto',
      createdDate: '2025-10-23 10:30',
      duration: '5m 15s',
    },
    {
      id: 'BKP-004',
      filename: 'ams_incremental_2025-10-22_18-00.zip',
      size: '28 MB',
      type: 'Incremental',
      status: 'Resolved',
      createdBy: 'System Auto',
      createdDate: '2025-10-22 18:00',
      duration: '1m 05s',
    },
    {
      id: 'BKP-005',
      filename: 'ams_backup_2025-10-22_10-30.zip',
      size: '240 MB',
      type: 'Full Backup',
      status: 'Resolved',
      createdBy: 'System Auto',
      createdDate: '2025-10-22 10:30',
      duration: '5m 20s',
    },
  ];

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Full Backup': 'bg-primary-100 text-primary-700 border-primary-200',
      'Incremental': 'bg-blue-100 text-blue-700 border-blue-200',
      'Manual': 'bg-purple-100 text-purple-700 border-purple-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  // Using imported getStatusColor from constants

  const handleBackupNow = () => {
    setIsBackingUp(true);
    setBackupProgress(0);
    
    const interval = setInterval(() => {
      setBackupProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsBackingUp(false);
            setBackupProgress(0);
            alert('Backup resolved successfully!');
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const stats = {
    total: backupHistory.length,
    lastBackup: backupHistory[0].createdDate,
    totalSize: backupHistory.reduce((sum, b) => sum + parseFloat(b.size), 0).toFixed(0),
    autoBackup: 'Enabled',
  };

  return (
    <MainLayout menuItems={menuItems} user={layoutUser}>
      {/* Header */}
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">Backup & Restore</h1>
          <p className="text-gray-600 text-sm mt-1">Manage system backups and data recovery</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Backups</p>
                <p className="text-3xl font-bold text-primary-600 mt-1">{stats.total}</p>
              </div>
              <div className="bg-primary-100 p-3 rounded-lg">
                <span className="text-2xl">💾</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-green-100 shadow-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Last Backup</p>
                <p className="text-sm font-bold text-green-600 mt-1">{stats.lastBackup.split(' ')[0]}</p>
                <p className="text-xs text-gray-500">{stats.lastBackup.split(' ')[1]}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-blue-100 shadow-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Size</p>
                <p className="text-3xl font-bold text-blue-600 mt-1">{stats.totalSize}</p>
                <p className="text-xs text-gray-500">MB</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <span className="text-2xl">📦</span>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl border border-purple-100 shadow-md p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Auto Backup</p>
                <p className="text-2xl font-bold text-purple-600 mt-1">{stats.autoBackup}</p>
                <p className="text-xs text-gray-500">Daily at 10:30 AM</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <span className="text-2xl">⚙️</span>
              </div>
            </div>
          </div>
        </div>

        {/* Backup Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Create Backup */}
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary-100 p-3 rounded-lg">
                <span className="text-2xl">💾</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-primary-600">Create New Backup</h3>
                <p className="text-sm text-gray-600">Manually create a system backup</p>
              </div>
            </div>

            {isBackingUp && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-700 mb-2">
                  <span>Backup in progress...</span>
                  <span>{backupProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div 
                    className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${backupProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Backup Type</label>
                <select 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  disabled={isBackingUp}
                >
                  <option>Full Backup</option>
                  <option>Incremental Backup</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., Before major update"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  disabled={isBackingUp}
                />
              </div>
            </div>

            <button 
              onClick={handleBackupNow}
              disabled={isBackingUp}
              className={`w-full px-6 py-3 rounded-lg font-medium transition-all duration-150 ${
                isBackingUp 
                  ? 'bg-gray-400 text-white cursor-not-allowed' 
                  : 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm hover:shadow-md'
              }`}
            >
              {isBackingUp ? 'Creating Backup...' : '💾 Start Backup Now'}
            </button>
          </div>

          {/* Restore */}
          <div className="bg-white rounded-xl border border-orange-100 shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-orange-100 p-3 rounded-lg">
                <span className="text-2xl">🔄</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-orange-600">Restore from Backup</h3>
                <p className="text-sm text-gray-600">Restore system from a previous backup</p>
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
              <div className="flex gap-2">
                <span className="text-orange-600 text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-orange-800 mb-1">Warning</p>
                  <p className="text-xs text-orange-700">
                    Restoring will overwrite current data. Please ensure you have a recent backup before proceeding.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Backup File</label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500">
                  <option>Select a backup to restore...</option>
                  {backupHistory.slice(0, 5).map((backup) => (
                    <option key={backup.id} value={backup.id}>
                      {backup.filename} ({backup.createdDate})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="rounded border-gray-300 text-orange-600 focus:ring-orange-500" />
                  I understand this will overwrite current data
                </label>
              </div>
            </div>

            <button className="w-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">
              🔄 Restore System
            </button>
          </div>
        </div>

        {/* Auto Backup Settings */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
          <h3 className="text-lg font-semibold text-primary-600 mb-4">Automatic Backup Settings</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                defaultValue="10:30"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Retention (Days)</label>
              <input
                type="number"
                defaultValue="30"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              Enable automatic backup
            </label>
            <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-medium text-sm transition-all duration-150">
              Save Settings
            </button>
          </div>
        </div>

        {/* Backup History */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Backup History</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Backup ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Filename</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created By</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Duration</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {backupHistory.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-primary-600">{backup.id}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 font-mono">{backup.filename}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(backup.type)}`}>
                        {backup.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-700">{backup.size}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(backup.status)}`}>
                        {backup.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-700">{backup.createdBy}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{backup.createdDate}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{backup.duration}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                          Download
                        </button>
                        <span className="text-gray-300">|</span>
                        <button className="text-orange-600 hover:text-orange-700 text-sm font-medium">
                          Restore
                        </button>
                        <span className="text-gray-300">|</span>
                        <button className="text-red-600 hover:text-red-700 text-sm font-medium">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminBackupRestore;
