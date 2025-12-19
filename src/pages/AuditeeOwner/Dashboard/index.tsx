import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getFindingsByDepartmentDashboard, type Finding } from '../../../api/findings';
import { getActionsByDepartmentDashboard, type Action } from '../../../api/actions';
import { useDeptId } from '../../../store/useAuthStore';
import { getDepartmentById } from '../../../api/departments';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const AuditeeOwnerDashboard: React.FC = () => {
  const { user } = useAuth();
  const deptId = useDeptId();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [showFindingsModal, setShowFindingsModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'Major' | 'Medium' | 'Minor'>('Major');
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (!deptId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Load department name
        try {
          const dept = await getDepartmentById(deptId);
          setDepartmentName(dept?.name || `Department ${deptId}`);
        } catch (err) {
          console.error('Failed to load department:', err);
          setDepartmentName(`Department ${deptId}`);
        }

        // Load findings and actions in parallel
        const [findingsData, actionsData] = await Promise.all([
          getFindingsByDepartmentDashboard(deptId),
          getActionsByDepartmentDashboard(deptId),
        ]);

        console.log('Findings data from API:', findingsData);
        console.log('Actions data from API:', actionsData);

        const findingsArray = Array.isArray(findingsData) ? findingsData : [];
        const actionsArray = Array.isArray(actionsData) ? actionsData : [];

        console.log('Findings array:', findingsArray);
        console.log('Actions array:', actionsArray);

        setFindings(findingsArray);
        setActions(actionsArray);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [deptId]);

  // Calculate statistics
  const stats = {
    totalFindings: findings.length,
    openFindings: findings.filter(f => {
      const status = f.status?.toLowerCase() || '';
      return status === 'open' || status === 'received';
    }).length,
    closedFindings: findings.filter(f => {
      const status = f.status?.toLowerCase() || '';
      return status === 'closed' || status === 'archived';
    }).length,
    totalActions: actions.length,
    inProgressActions: actions.filter(a => {
      const status = a.status?.toLowerCase() || '';
      return status === 'inprogress' || status === 'in-progress' || status === 'active' || status === 'reviewed';
    }).length,
    completedActions: actions.filter(a => {
      const status = a.status?.toLowerCase() || '';
      return status === 'completed' || status === 'approved' || status === 'verified';
    }).length,
    overdueActions: actions.filter(a => {
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
  const findingsBySeverity = findings.reduce((acc, f) => {
    const severity = f.severity || 'Unknown';
    acc[severity] = (acc[severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Ensure "Minor" is always included in the chart data
  if (!findingsBySeverity['Minor']) {
    findingsBySeverity['Minor'] = 0;
  }

  const severityChartData = Object.entries(findingsBySeverity).map(([name, value]) => ({
    name,
    value,
  }));

  const actionsByStatus = actions.reduce((acc, a) => {
    const status = a.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statusChartData = Object.entries(actionsByStatus).map(([name, value]) => ({
    name,
    value,
  }));

  // Calculate max value for Y-axis (round up to nearest multiple of 5, minimum 20)
  const maxActionValue = Math.max(...statusChartData.map(d => d.value), 0);
  const yAxisDomain = [0, Math.max(20, Math.ceil(maxActionValue / 5) * 5)];



  // Gradient colors for charts
  const GRADIENT_COLORS = [
    { start: '#3b82f6', end: '#1d4ed8' }, // Blue
    { start: '#10b981', end: '#059669' }, // Green
    { start: '#f59e0b', end: '#d97706' }, // Amber
    { start: '#ef4444', end: '#dc2626' }, // Red
    { start: '#8b5cf6', end: '#7c3aed' }, // Purple
    { start: '#06b6d4', end: '#0891b2' }, // Cyan
  ];

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

  if (!deptId) {
    return (
      <MainLayout user={layoutUser}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
            <p className="text-yellow-800 text-center">Department information not found. Please contact administrator.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-500 rounded-2xl shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-primary-100 text-lg">{departmentName}</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Findings */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Total Findings</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalFindings}</p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-green-600 font-medium">{stats.openFindings} open</span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-600">{stats.closedFindings} closed</span>
            </div>
          </div>

          {/* Total Actions */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Total Actions</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalActions}</p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span className="text-blue-600 font-medium">{stats.inProgressActions} in progress</span>
              <span className="text-gray-400">•</span>
              <span className="text-green-600">{stats.completedActions} completed</span>
            </div>
          </div>

          {/* Overdue Actions */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Overdue Actions</p>
                <p className="text-3xl font-bold text-red-600">{stats.overdueActions}</p>
              </div>
              <div className="bg-red-100 rounded-full p-3">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="mt-4 text-sm text-gray-600">Requires immediate attention</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Findings by Severity */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Findings by Severity</h3>
              <button
                onClick={() => setShowFindingsModal(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                Detail
              </button>
            </div>
            {severityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <defs>
                    {GRADIENT_COLORS.map((color, index) => (
                      <linearGradient key={`gradient-${index}`} id={`gradient-pie-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color.start} stopOpacity={1} />
                        <stop offset="100%" stopColor={color.end} stopOpacity={1} />
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={severityChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => {
                      const { name, percent } = props;
                      return `${name}: ${((percent || 0) * 100).toFixed(0)}%`;
                    }}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {severityChartData.map((_entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={`url(#gradient-pie-${index % GRADIENT_COLORS.length})`}
                        stroke="#fff"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center" style={{ height: 300 }}>
                <p>No data available</p>
              </div>
            )}
          </div>

          {/* Actions by Status */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Actions by Status</h3>
              <button
                onClick={() => {
                  // Set default tab to first available status
                  const statuses = Object.keys(actionsByStatus);
                  setActiveActionTab(statuses.length > 0 ? statuses[0] : '');
                  setShowActionsModal(true);
                }}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
              >
                Detail
              </button>
            </div>
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    {statusChartData.map((entry, index) => {
                      // Choose gradient colors based on status name
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
                    wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: '8px' }}
                    contentStyle={{ borderRadius: 8 }}
                  />
                  <Bar 
                    dataKey="value" 
                    radius={[8, 8, 0, 0]}
                  >
                    {statusChartData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#gradient-bar-${index})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center" style={{ height: 300 }}>
                <p>No data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Findings Detail Modal */}
      {showFindingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Findings by Severity</h2>
              <button
                onClick={() => setShowFindingsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6">
              {(['Major', 'Medium', 'Minor'] as const).map((severity) => (
                <button
                  key={severity}
                  onClick={() => setActiveTab(severity)}
                  className={`px-6 py-4 font-medium text-sm transition-colors relative ${
                    activeTab === severity
                      ? 'text-primary-600 border-b-2 border-primary-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {severity}
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    {findings.filter(f => (f.severity || '').toLowerCase() === severity.toLowerCase()).length}
                  </span>
                </button>
              ))}
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto p-6">
              {(() => {
                const filteredFindings = findings.filter(
                  f => (f.severity || '').toLowerCase() === activeTab.toLowerCase()
                );

                if (filteredFindings.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <p>No {activeTab} findings found</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Severity
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Deadline
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Created At
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredFindings.map((finding) => {
                          const daysRemaining = finding.deadline
                            ? Math.ceil((new Date(finding.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
                            : null;
                          
                          return (
                            <tr key={finding.findingId} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                                <div className="font-medium">{finding.title}</div>
                                {finding.description && (
                                  <div className="text-gray-500 text-xs mt-1 line-clamp-2">{finding.description}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    finding.status?.toLowerCase() === 'closed' || finding.status?.toLowerCase() === 'archived'
                                      ? 'bg-green-100 text-green-800'
                                      : finding.status?.toLowerCase() === 'open' || finding.status?.toLowerCase() === 'received'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {finding.status || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  {finding.severity || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {finding.deadline ? (
                                  <div>
                                    <div>{new Date(finding.deadline).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                    {daysRemaining !== null && (
                                      <div
                                        className={`text-xs mt-1 ${
                                          daysRemaining < 0
                                            ? 'text-red-600 font-medium'
                                            : daysRemaining <= 7
                                            ? 'text-amber-600'
                                            : 'text-gray-500'
                                        }`}
                                      >
                                        {daysRemaining < 0
                                          ? `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`
                                          : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {finding.createdAt
                                  ? new Date(finding.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                  : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Actions Detail Modal */}
      {showActionsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Actions by Status</h2>
              <button
                onClick={() => setShowActionsModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 px-6 overflow-x-auto">
              {Object.keys(actionsByStatus).map((status) => (
                <button
                  key={status}
                  onClick={() => setActiveActionTab(status)}
                  className={`px-6 py-4 font-medium text-sm transition-colors relative whitespace-nowrap ${
                    activeActionTab === status
                      ? 'text-primary-600 border-b-2 border-primary-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {status}
                  <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                    {actionsByStatus[status]}
                  </span>
                </button>
              ))}
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto p-6">
              {(() => {
                const filteredActions = actions.filter(
                  a => (a.status || '') === activeActionTab
                );

                if (filteredActions.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500">
                      <p>No {activeActionTab} actions found</p>
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Title
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Progress
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Due Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Created At
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredActions.map((action) => {
                          const daysRemaining = action.dueDate
                            ? Math.ceil((new Date(action.dueDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24))
                            : null;
                          
                          const statusLower = (action.status || '').toLowerCase();
                          const isCompleted = statusLower === 'completed' || statusLower === 'approved' || statusLower === 'verified';
                          
                          return (
                            <tr key={action.actionId} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                                <div className="font-medium">{action.title}</div>
                                {action.description && (
                                  <div className="text-gray-500 text-xs mt-1 line-clamp-2">{action.description}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    isCompleted
                                      ? 'bg-green-100 text-green-800'
                                      : statusLower === 'active' || statusLower === 'inprogress' || statusLower === 'in-progress' || statusLower === 'reviewed'
                                      ? 'bg-blue-100 text-blue-800'
                                      : statusLower === 'rejected' || statusLower === 'leadrejected'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {action.status || 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div
                                      className={`h-2 rounded-full transition-all ${
                                        (action.progressPercent || 0) >= 100
                                          ? 'bg-green-600'
                                          : 'bg-blue-600'
                                      }`}
                                      style={{ width: `${action.progressPercent || 0}%` }}
                                    ></div>
                                  </div>
                                  <span className="text-xs font-medium text-gray-700 min-w-[3rem]">
                                    {action.progressPercent || 0}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {action.dueDate ? (
                                  <div>
                                    <div>{new Date(action.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                    {daysRemaining !== null && (
                                      <div
                                        className={`text-xs mt-1 ${
                                          daysRemaining < 0 && !isCompleted
                                            ? 'text-red-600 font-medium'
                                            : daysRemaining <= 7 && !isCompleted
                                            ? 'text-amber-600'
                                            : 'text-gray-500'
                                        }`}
                                      >
                                        {daysRemaining < 0 && !isCompleted
                                          ? `Overdue by ${Math.abs(daysRemaining)} day${Math.abs(daysRemaining) !== 1 ? 's' : ''}`
                                          : daysRemaining !== null
                                          ? `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
                                          : ''}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">N/A</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {action.createdAt
                                  ? new Date(action.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                                  : 'N/A'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AuditeeOwnerDashboard;

