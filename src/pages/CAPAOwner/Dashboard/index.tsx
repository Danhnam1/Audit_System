import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getMyAssignedActions, type Action } from '../../../api/actions';
import { getFindingById } from '../../../api/findings';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

interface AuditInfo {
  auditId: string;
  auditTitle: string;
  taskCount: number;
  completedCount: number;
  inProgressCount: number;
  overdueCount: number;
}

const CAPAOwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [actions, setActions] = useState<Action[]>([]);
  const [audits, setAudits] = useState<AuditInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const actionsData = await getMyAssignedActions();
        const actionsArray = Array.isArray(actionsData) ? actionsData : [];
        setActions(actionsArray);

        // Get unique audit IDs from actions
        const uniqueFindingIds = Array.from(new Set(actionsArray.map(a => a.findingId).filter(Boolean)));
        
        // Fetch findings to get audit information
        const findingPromises = uniqueFindingIds.map(async (findingId: string) => {
          try {
            const finding = await getFindingById(findingId);
            return finding;
          } catch (err) {
            console.error(`Error loading finding ${findingId}:`, err);
            return null;
          }
        });

        const findings = await Promise.all(findingPromises);
        const validFindings = findings.filter(f => f !== null);

        // Group actions by audit
        const auditMap = new Map<string, AuditInfo>();
        
        actionsArray.forEach(action => {
          const finding = validFindings.find(f => {
            const fid = (f as any).findingId || (f as any).FindingId;
            return fid === action.findingId;
          });
          
          if (finding) {
            const auditId = (finding as any).auditId || (finding as any).AuditId || (finding as any).audit?.auditId || '';
            const auditTitle = (finding as any).audit?.title || (finding as any).auditTitle || 'Unknown Audit';
            
            if (auditId) {
              if (!auditMap.has(auditId)) {
                auditMap.set(auditId, {
                  auditId,
                  auditTitle,
                  taskCount: 0,
                  completedCount: 0,
                  inProgressCount: 0,
                  overdueCount: 0,
                });
              }
              
              const auditInfo = auditMap.get(auditId)!;
              auditInfo.taskCount++;
              
              const status = action.status?.toLowerCase() || '';
              const isCompleted = status === 'completed' || status === 'approved' || status === 'verified';
              const isInProgress = status === 'inprogress' || status === 'in-progress' || status === 'active' || status === 'reviewed';
              
              if (isCompleted) {
                auditInfo.completedCount++;
              } else if (isInProgress) {
                auditInfo.inProgressCount++;
              }
              
              if (action.dueDate) {
                const dueDate = new Date(action.dueDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (dueDate < today && !isCompleted) {
                  auditInfo.overdueCount++;
                }
              }
            }
          }
        });

        const auditsArray = Array.from(auditMap.values());
        setAudits(auditsArray);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Calculate statistics
  const stats = {
    totalAudits: audits.length || 0,
    totalTasks: actions.length || 0,
    inProgressTasks: actions.filter(a => {
      const status = a.status?.toLowerCase() || '';
      return status === 'inprogress' || status === 'in-progress' || status === 'active' || status === 'reviewed';
    }).length,
    completedTasks: actions.filter(a => {
      const status = a.status?.toLowerCase() || '';
      return status === 'completed' || status === 'approved' || status === 'verified';
    }).length,
    overdueTasks: actions.filter(a => {
      if (!a.dueDate) return false;
      const dueDate = new Date(a.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const status = a.status?.toLowerCase() || '';
      const isCompleted = status === 'completed' || status === 'approved' || status === 'verified';
      return dueDate < today && !isCompleted;
    }).length,
  };

  // Prepare data for charts
  const tasksByStatus = actions.reduce((acc, a) => {
    const status = a.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusChartData = Object.entries(tasksByStatus).map(([name, value]) => ({
    name,
    value,
  }));

  // Tasks by Audit
  const tasksByAuditData = audits.map(audit => ({
    name: audit.auditTitle.length > 20 ? audit.auditTitle.substring(0, 20) + '...' : audit.auditTitle,
    fullName: audit.auditTitle,
    Tasks: audit.taskCount,
    Completed: audit.completedCount,
    'In Progress': audit.inProgressCount,
  }));

  // Progress overview
  const progressOverview = [
    { name: 'Completed', value: stats.completedTasks, color: '#10b981' },
    { name: 'In Progress', value: stats.inProgressTasks, color: '#3b82f6' },
    { name: 'Pending', value: stats.totalTasks - stats.completedTasks - stats.inProgressTasks, color: '#f59e0b' },
    { name: 'Overdue', value: stats.overdueTasks, color: '#ef4444' },
  ];

  // Calculate max value for Y-axis
  const maxTaskValue = Math.max(...statusChartData.map(d => d.value), 0);
  const yAxisDomain = [0, Math.max(10, Math.ceil(maxTaskValue / 5) * 5)];

  const layoutUser = user ? { name: (user as any).fullName || (user as any).name || 'User', avatar: undefined } : undefined;

  if (loading) {
    return (
      <MainLayout user={layoutUser}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">Loading dashboard...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-3">CAPA Owner Dashboard</h1>
          
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Audits */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-lg p-6 border-l-4 border-blue-500 hover:shadow-xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-semibold mb-1 uppercase tracking-wide">Audits Participating</p>
                <p className="text-4xl font-bold text-blue-900">{stats.totalAudits}</p>
                <p className="text-xs text-blue-700 mt-2">Active audits</p>
              </div>
              <div className="bg-blue-500 rounded-full p-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Tasks */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-lg p-6 border-l-4 border-purple-500 hover:shadow-xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-semibold mb-1 uppercase tracking-wide">Total Tasks</p>
                <p className="text-4xl font-bold text-purple-900">{stats.totalTasks}</p>
                <p className="text-xs text-purple-700 mt-2">All assigned tasks</p>
              </div>
              <div className="bg-purple-500 rounded-full p-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
          </div>

          {/* In Progress Tasks */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl shadow-lg p-6 border-l-4 border-amber-500 hover:shadow-xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-600 text-sm font-semibold mb-1 uppercase tracking-wide">In Progress</p>
                <p className="text-4xl font-bold text-amber-900">{stats.inProgressTasks}</p>
                <p className="text-xs text-amber-700 mt-2">Currently working</p>
              </div>
              <div className="bg-amber-500 rounded-full p-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Overdue Tasks */}
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl shadow-lg p-6 border-l-4 border-red-500 hover:shadow-xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-semibold mb-1 uppercase tracking-wide">Overdue</p>
                <p className="text-4xl font-bold text-red-900">{stats.overdueTasks}</p>
                <p className="text-xs text-red-700 mt-2">Requires attention</p>
              </div>
              <div className="bg-red-500 rounded-full p-4 shadow-lg">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks by Status */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded"></span>
              Tasks by Status
            </h3>
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barCategoryGap="30%">
                  <defs>
                    {statusChartData.map((entry, index) => {
                      let startColor = '#3b82f6';
                      let endColor = '#1d4ed8';
                      const statusName = (entry.name || '').toLowerCase();
                      
                      if (statusName.includes('completed') || statusName.includes('approved')) {
                        startColor = '#10b981';
                        endColor = '#059669';
                      } else if (statusName.includes('pending') || statusName.includes('review')) {
                        startColor = '#8b5cf6';
                        endColor = '#7c3aed';
                      } else if (statusName.includes('inprogress') || statusName.includes('in-progress')) {
                        startColor = '#f59e0b';
                        endColor = '#d97706';
                      } else if (statusName.includes('rejected') || statusName.includes('overdue')) {
                        startColor = '#ef4444';
                        endColor = '#dc2626';
                      }
                      
                      return (
                        <linearGradient key={`gradient-bar-${index}`} id={`gradient-bar-${index}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={startColor} stopOpacity={1} />
                          <stop offset="50%" stopColor={startColor} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={endColor} stopOpacity={0.8} />
                        </linearGradient>
                      );
                    })}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    domain={yAxisDomain}
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <Tooltip 
                    wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    contentStyle={{ borderRadius: 8 }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[10, 10, 0, 0]}
                    maxBarSize={80}
                  >
                    {statusChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#gradient-bar-${index})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center" style={{ height: 350 }}>
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </div>

          {/* Progress Overview */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded"></span>
              Progress Overview
            </h3>
            {progressOverview.filter(p => p.value > 0).length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <defs>
                    <linearGradient id="gradient-completed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradient-progress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradient-pending" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={1} />
                      <stop offset="100%" stopColor="#d97706" stopOpacity={1} />
                    </linearGradient>
                    <linearGradient id="gradient-overdue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={1} />
                      <stop offset="100%" stopColor="#dc2626" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <Pie
                    data={progressOverview.filter(p => p.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => {
                      const { name, percent, value } = props;
                      return `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`;
                    }}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {progressOverview.filter(p => p.value > 0).map((entry, index) => {
                      let gradientId = 'gradient-completed';
                      if (entry.name === 'In Progress') gradientId = 'gradient-progress';
                      else if (entry.name === 'Pending') gradientId = 'gradient-pending';
                      else if (entry.name === 'Overdue') gradientId = 'gradient-overdue';
                      
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`url(#${gradientId})`}
                          stroke="#fff"
                          strokeWidth={3}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip 
                    wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center" style={{ height: 350 }}>
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 gap-6">
          {/* Tasks by Audit */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-500 rounded"></span>
              Tasks by Audit
            </h3>
            {tasksByAuditData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={tasksByAuditData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    tick={{ fill: '#6b7280', fontSize: 11 }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <YAxis 
                    tick={{ fill: '#6b7280', fontSize: 12 }}
                    axisLine={{ stroke: '#e5e7eb' }}
                  />
                  <Tooltip 
                    wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                    contentStyle={{ borderRadius: 8 }}
                    formatter={(value: any, name: string) => {
                      if (name === 'fullName') return null;
                      return [value, name];
                    }}
                    labelFormatter={(label, payload) => {
                      if (payload && payload[0] && (payload[0].payload as any).fullName) {
                        return (payload[0].payload as any).fullName;
                      }
                      return label;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Tasks" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Total Tasks" maxBarSize={60} />
                  <Bar dataKey="Completed" fill="#10b981" radius={[8, 8, 0, 0]} name="Completed" maxBarSize={60} />
                  <Bar dataKey="In Progress" fill="#f59e0b" radius={[8, 8, 0, 0]} name="In Progress" maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center" style={{ height: 350 }}>
                <p className="text-gray-500">No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default CAPAOwnerDashboard;
