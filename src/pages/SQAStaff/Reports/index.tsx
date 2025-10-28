import { MainLayout, DashboardIcon, AuditIcon, DocumentIcon, ReportsIcon, RequestIcon } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getStatusColor } from '../../../constants';
import { StatCard, AreaChartCard, LineChartCard, BarChartCard } from '../../../components';

const SQAStaffReports = () => {
  const { user } = useAuth();

  const menuItems = [
    { icon: <DashboardIcon />, label: 'Dashboard', path: '/sqa-staff' },
    { icon: <AuditIcon />, label: 'Audit Planning', path: '/sqa-staff/planning' },
    { icon: <DocumentIcon />, label: 'Finding Management', path: '/sqa-staff/findings' },
    { icon: <ReportsIcon />, label: 'Reports', path: '/sqa-staff/reports', badge: '3' },
    { icon: <RequestIcon />, label: 'Requests', path: '/sqa-staff/requests', badge: '5' },
  ];

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const reportsByMonth = [
    { month: 'Jan', draft: 8, final: 12, approved: 10 },
    { month: 'Feb', draft: 6, final: 14, approved: 12 },
    { month: 'Mar', draft: 9, final: 16, approved: 14 },
    { month: 'Apr', draft: 7, final: 11, approved: 9 },
    { month: 'May', draft: 10, final: 18, approved: 16 },
    { month: 'Jun', draft: 8, final: 15, approved: 13 },
    { month: 'Jul', draft: 11, final: 17, approved: 15 },
    { month: 'Aug', draft: 9, final: 19, approved: 17 },
    { month: 'Sep', draft: 12, final: 20, approved: 18 },
    { month: 'Oct', draft: 7, final: 14, approved: 12 },
  ];

  const findingsVsCapas = [
    { month: 'Jan', findings: 45, capas: 38 },
    { month: 'Feb', findings: 52, capas: 44 },
    { month: 'Mar', findings: 48, capas: 40 },
    { month: 'Apr', findings: 39, capas: 33 },
    { month: 'May', findings: 61, capas: 52 },
    { month: 'Jun', findings: 55, capas: 47 },
    { month: 'Jul', findings: 58, capas: 50 },
    { month: 'Aug', findings: 63, capas: 54 },
    { month: 'Sep', findings: 67, capas: 58 },
    { month: 'Oct', findings: 42, capas: 36 },
  ];

  const reportsByType = [
    { type: 'Safety', count: 45 },
    { type: 'Maintenance', count: 38 },
    { type: 'Training', count: 31 },
    { type: 'Operations', count: 29 },
    { type: 'Security', count: 25 },
    { type: 'Compliance', count: 42 },
  ];

  const reports = [
    { id: 'RPT-2025-001', auditId: 'AUD-2025-001', title: 'Annual Safety Audit - Final Report', type: 'Final Report', status: 'Pending Review', createdDate: '2025-10-22', findings: 5, capas: 3 },
    { id: 'RPT-2025-002', auditId: 'AUD-2025-002', title: 'Maintenance Quality Check - Draft', type: 'Draft Report', status: 'In Progress', createdDate: '2025-10-20', findings: 8, capas: 5 },
    { id: 'RPT-2025-003', auditId: 'AUD-2025-003', title: 'Training Compliance Review - Final Report', type: 'Final Report', status: 'Approved', createdDate: '2025-10-15', findings: 3, capas: 2 },
  ];

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Draft Report': 'bg-gray-100 text-gray-700 border-gray-200',
      'Final Report': 'bg-primary-100 text-primary-700 border-primary-200',
    };
    return colors[type] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <MainLayout menuItems={menuItems} user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Report Management</h1>
            <p className="text-gray-600 text-sm mt-1">Create and manage audit reports</p>
          </div>
          <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">+ Generate New Report</button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Reports" value={reports.length} icon={<svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>} variant="primary" />
          <StatCard title="Pending Review" value={reports.filter(r => r.status === 'Pending Review').length} icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>} variant="primary-light" />
          <StatCard title="In Progress" value={reports.filter(r => r.status === 'In Progress').length} icon={<svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>} variant="primary-light" />
          <StatCard title="Approved" value={reports.filter(r => r.status === 'Approved').length} icon={<svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} variant="primary-dark" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AreaChartCard title="Report Status Timeline (2025)" data={reportsByMonth} xAxisKey="month" areas={[{ dataKey: 'approved', stroke: '#0369a1', fill: '#0369a1', name: 'Approved', stackId: '1' }, { dataKey: 'final', stroke: '#38bdf8', fill: '#38bdf8', name: 'Final', stackId: '1' }, { dataKey: 'draft', stroke: '#bae6fd', fill: '#bae6fd', name: 'Draft', stackId: '1' }]} />
          <LineChartCard title="Findings vs CAPAs Trend" data={findingsVsCapas} xAxisKey="month" lines={[{ dataKey: 'findings', stroke: '#0369a1', name: 'Findings' }, { dataKey: 'capas', stroke: '#38bdf8', name: 'CAPAs' }]} />
        </div>

        <BarChartCard title="Reports by Audit Type" data={reportsByType} xAxisKey="type" bars={[{ dataKey: 'count', fill: '#0369a1', name: 'Total Reports' }]} />

        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Audit Reports</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Report ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Findings</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">CAPAs</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-primary-600">{report.id}</span></td>
                    <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{report.title}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{report.auditId}</span></td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getTypeColor(report.type)}`}>{report.type}</span></td>
                    <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>{report.status}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-100 text-red-700 text-sm font-semibold">{report.findings}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">{report.capas}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{report.createdDate}</span></td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">View</button>
                        <span className="text-gray-300">|</span>
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Export PDF</button>
                        {report.status === 'In Progress' && (<>
                          <span className="text-gray-300">|</span>
                          <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Edit</button>
                        </>)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
          <h2 className="text-lg font-semibold text-primary-600 mb-4">Report Templates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border border-gray-200 rounded-lg p-5 hover:border-primary-300 hover:shadow-md transition-all duration-150 cursor-pointer">
              <div className="flex items-center gap-3 mb-3"><div className="bg-blue-100 p-2 rounded-lg"><span className="text-xl">📄</span></div><h3 className="font-semibold text-gray-800">Initial Audit Report</h3></div>
              <p className="text-sm text-gray-600 mb-3">Standard template for first-time audits with comprehensive sections.</p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Use Template →</button>
            </div>
            <div className="border border-gray-200 rounded-lg p-5 hover:border-primary-300 hover:shadow-md transition-all duration-150 cursor-pointer">
              <div className="flex items-center gap-3 mb-3"><div className="bg-green-100 p-2 rounded-lg"><span className="text-xl">🔄</span></div><h3 className="font-semibold text-gray-800">Follow-up Audit Report</h3></div>
              <p className="text-sm text-gray-600 mb-3">Template for follow-up audits tracking CAPA implementation.</p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Use Template →</button>
            </div>
            <div className="border border-gray-200 rounded-lg p-5 hover:border-primary-300 hover:shadow-md transition-all duration-150 cursor-pointer">
              <div className="flex items-center gap-3 mb-3"><div className="bg-purple-100 p-2 rounded-lg"><span className="text-xl">⚡</span></div><h3 className="font-semibold text-gray-800">Quick Summary Report</h3></div>
              <p className="text-sm text-gray-600 mb-3">Simplified template for executive summaries and brief audits.</p>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Use Template →</button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SQAStaffReports;
