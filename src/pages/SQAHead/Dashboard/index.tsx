import { MainLayout, DashboardIcon, AuditIcon, DocumentIcon, QualityIcon, ClockIcon, SearchCheckIcon, CheckCircleIcon, ChartBarIcon } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState } from 'react';
import { StatCard } from '../../../components';

const SQAHeadDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'verification' | 'closure'>('pending');

  // Menu items cho SQA Head
  const menuItems = [
    { icon: <DashboardIcon />, label: 'Dashboard', path: '/sqa-head' },
    { icon: <AuditIcon />, label: 'Audit Review', path: '/sqa-head/audit-review', badge: '5' },
    { icon: <DocumentIcon />, label: 'Report Review', path: '/sqa-head/report-review', badge: '3' },
    { icon: <QualityIcon />, label: 'CAPA Review', path: '/sqa-head/capa-review', badge: '7' },
  ];

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Mock data
  const auditsByTab = {
    pending: [
      { id: 'AUD-2025-001', department: 'Flight Operations', submittedBy: 'John Smith', submittedDate: '2025-10-20', type: 'Audit Plan' },
      { id: 'AUD-2025-002', department: 'Maintenance', submittedBy: 'Jane Doe', submittedDate: '2025-10-21', type: 'Audit Plan' },
      { id: 'AUD-2025-003', department: 'Training', submittedBy: 'Mike Wilson', submittedDate: '2025-10-22', type: 'Report' },
      { id: 'AUD-2025-008', department: 'Safety', submittedBy: 'Sarah Connor', submittedDate: '2025-10-23', type: 'Audit Plan' },
      { id: 'AUD-2025-012', department: 'Ground Ops', submittedBy: 'Tom Hardy', submittedDate: '2025-10-24', type: 'Report' },
    ],
    verification: [
      { id: 'AUD-2025-004', department: 'Quality Assurance', assignedTo: 'QA Team', deadline: '2025-11-15', capaCount: 5 },
      { id: 'AUD-2025-005', department: 'Flight Operations', assignedTo: 'Flight Dept', deadline: '2025-11-18', capaCount: 3 },
      { id: 'AUD-2025-006', department: 'Maintenance', assignedTo: 'Maintenance Team', deadline: '2025-11-20', capaCount: 8 },
      { id: 'AUD-2025-009', department: 'Training', assignedTo: 'Training Dept', deadline: '2025-11-22', capaCount: 4 },
      { id: 'AUD-2025-011', department: 'Safety', assignedTo: 'Safety Team', deadline: '2025-11-25', capaCount: 6 },
      { id: 'AUD-2025-013', department: 'Ground Ops', assignedTo: 'Ground Staff', deadline: '2025-11-28', capaCount: 2 },
      { id: 'AUD-2025-015', department: 'Cabin Crew', assignedTo: 'Cabin Dept', deadline: '2025-11-30', capaCount: 7 },
    ],
    closure: [
      { id: 'AUD-2025-007', department: 'Safety', completedDate: '2025-10-18', findingsCount: 4, status: 'All Verified' },
      { id: 'AUD-2025-010', department: 'Quality Assurance', completedDate: '2025-10-19', findingsCount: 6, status: 'All Verified' },
      { id: 'AUD-2025-014', department: 'Training', completedDate: '2025-10-20', findingsCount: 3, status: 'All Verified' },
    ],
  } as const;

  const getTabCount = (tab: keyof typeof auditsByTab) => auditsByTab[tab].length;

  return (
    <MainLayout menuItems={menuItems} user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">SQA Head Dashboard</h1>
          <p className="text-gray-600 text-sm mt-1">Review and approve audits, reports, and CAPA</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Pending Reviews" value="5" icon={<ClockIcon />} variant="primary-light" />
          <StatCard title="CAPA Under Verification" value="7" icon={<SearchCheckIcon />} variant="primary-medium" />
          <StatCard title="Ready for Closure" value="3" icon={<CheckCircleIcon />} variant="primary-dark" />
          <StatCard title="Total Reviewed" value="28" icon={<ChartBarIcon />} variant="primary" />
        </div>

        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option>All Departments</option>
                <option>Flight Operations</option>
                <option>Maintenance</option>
                <option>Training</option>
                <option>Safety</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option>Last 30 Days</option>
                <option>Last 60 Days</option>
                <option>Last 90 Days</option>
                <option>Custom Range</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option>All Status</option>
                <option>Pending</option>
                <option>Under Review</option>
                <option>Approved</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Audit List</h2>
          </div>

          <div className="border-b border-gray-200">
            <div className="flex">
              <button onClick={() => setActiveTab('pending')} className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'pending' ? 'text-primary-600 bg-primary-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}>
                Pending for Review
                <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">{getTabCount('pending')}</span>
                {activeTab === 'pending' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"></div>}
              </button>
              <button onClick={() => setActiveTab('verification')} className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'verification' ? 'text-primary-600 bg-primary-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}>
                Under CAPA Verification
                <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">{getTabCount('verification')}</span>
                {activeTab === 'verification' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"></div>}
              </button>
              <button onClick={() => setActiveTab('closure')} className={`px-6 py-3 text-sm font-medium transition-colors relative ${activeTab === 'closure' ? 'text-primary-600 bg-primary-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'}`}>
                Ready for Closure
                <span className="ml-2 px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold">{getTabCount('closure')}</span>
                {activeTab === 'closure' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600"></div>}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {activeTab === 'pending' && (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Audit ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Submitted By</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditsByTab.pending.map((audit, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-primary-600">{audit.id}</span></td>
                      <td className="px-6 py-4"><span className="text-sm text-gray-700">{audit.department}</span></td>
                      <td className="px-6 py-4"><span className="px-2 py-1 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">{audit.type}</span></td>
                      <td className="px-6 py-4"><span className="text-sm text-gray-600">{audit.submittedBy}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{audit.submittedDate}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><div className="flex gap-2"><button className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-all">Review</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'verification' && (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Audit ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Assigned To</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">CAPA Count</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Deadline</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditsByTab.verification.map((audit, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-primary-600">{audit.id}</span></td>
                      <td className="px-6 py-4"><span className="text-sm text-gray-700">{audit.department}</span></td>
                      <td className="px-6 py-4"><span className="text-sm text-gray-600">{audit.assignedTo}</span></td>
                      <td className="px-6 py-4"><span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">{audit.capaCount} CAPA</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{audit.deadline}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Verify CAPA</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'closure' && (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Audit ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Findings</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Completed</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditsByTab.closure.map((audit, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-primary-600">{audit.id}</span></td>
                      <td className="px-6 py-4"><span className="text-sm text-gray-700">{audit.department}</span></td>
                      <td className="px-6 py-4"><span className="text-sm text-gray-600">{audit.findingsCount} findings</span></td>
                      <td className="px-6 py-4"><span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold">{audit.status}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{audit.completedDate}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><button className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-all">Send to Director</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SQAHeadDashboard;
