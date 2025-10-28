import { MainLayout, DashboardIcon, AuditIcon, DocumentIcon, QualityIcon, ClockIcon, ChartBarIcon } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState } from 'react';
import { StatCard } from '../../../components';
import { getPriorityColor } from '../../../constants/statusColors';

const SQAHeadAuditReview = () => {
  const { user } = useAuth();
  const [selectedAudit, setSelectedAudit] = useState<string | null>(null);

  const menuItems = [
    { icon: <DashboardIcon />, label: 'Dashboard', path: '/sqa-head' },
    { icon: <AuditIcon />, label: 'Audit Review', path: '/sqa-head/audit-review', badge: '5' },
    { icon: <DocumentIcon />, label: 'Report Review', path: '/sqa-head/report-review', badge: '3' },
    { icon: <QualityIcon />, label: 'CAPA Review', path: '/sqa-head/capa-review', badge: '7' },
  ];

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const pendingAudits = [
    {
      id: 'AUD-2025-001',
      title: 'Annual Safety Audit',
      department: 'Safety',
      scope: 'Full Audit',
      submittedBy: 'John Smith',
      submittedDate: '2025-10-22',
      findings: 5,
      priority: 'High',
      objective: 'Comprehensive review of safety protocols and equipment maintenance in accordance with ICAO standards.',
      schedule: { start: '2025-11-01', end: '2025-11-15' },
    },
    {
      id: 'AUD-2025-002',
      title: 'Maintenance Quality Check',
      department: 'Maintenance',
      scope: 'Process Audit',
      submittedBy: 'Sarah Johnson',
      submittedDate: '2025-10-20',
      findings: 8,
      priority: 'Medium',
      objective: 'Verify compliance with maintenance procedures and tool calibration standards per AS9100D requirements.',
      schedule: { start: '2025-10-28', end: '2025-11-10' },
    },
    {
      id: 'AUD-2025-003',
      title: 'Training Compliance Review',
      department: 'Training',
      scope: 'Compliance Audit',
      submittedBy: 'Mike Chen',
      submittedDate: '2025-10-18',
      findings: 3,
      priority: 'Low',
      objective: 'Ensure all training records and certifications meet regulatory requirements and are up to date.',
      schedule: { start: '2025-10-25', end: '2025-11-05' },
    },
  ];

  const handleApprove = (auditId: string) => {
    alert(`Audit ${auditId} approved!`);
    setSelectedAudit(null);
  };

  const handleReject = (auditId: string) => {
    const reason = prompt('Please provide rejection reason:');
    if (reason) {
      alert(`Audit ${auditId} rejected. Reason: ${reason}`);
      setSelectedAudit(null);
    }
  };

  const handleRequestRevision = (auditId: string) => {
    const comments = prompt('Please provide revision comments:');
    if (comments) {
      alert(`Revision requested for ${auditId}. Comments: ${comments}`);
      setSelectedAudit(null);
    }
  };

  const selectedAuditData = pendingAudits.find(a => a.id === selectedAudit);

  return (
    <MainLayout menuItems={menuItems} user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">Audit Review</h1>
          <p className="text-gray-600 text-sm mt-1">Review and approve audit plans submitted by SQA Staff</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Pending Review" value={pendingAudits.length.toString()} icon={<ClockIcon />} variant="primary-light" />
          <StatCard title="High Priority" value={pendingAudits.filter(a => a.priority === 'High').length.toString()} icon={<AuditIcon />} variant="primary-dark" />
          <StatCard title="Total Findings" value={pendingAudits.reduce((sum, a) => sum + a.findings, 0).toString()} icon={<ChartBarIcon />} variant="primary" />
        </div>

        {!selectedAudit ? (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
              <h2 className="text-lg font-semibold text-white">Pending Audit Plans</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit ID</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Findings</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Submitted By</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Submitted</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingAudits.map((audit) => (
                    <tr key={audit.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-medium text-primary-600">{audit.id}</span></td>
                      <td className="px-6 py-4"><span className="text-sm font-medium text-gray-900">{audit.title}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{audit.department}</span></td>
                      <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getPriorityColor(audit.priority)}`}>{audit.priority}</span></td>
                      <td className="px-6 py-4 text-center"><span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold">{audit.findings}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-700">{audit.submittedBy}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm text-gray-600">{audit.submittedDate}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap"><button onClick={() => setSelectedAudit(audit.id)} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-150">Review</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          selectedAuditData && (
            <div className="space-y-6">
              <button onClick={() => setSelectedAudit(null)} className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2">← Back to List</button>

              <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-semibold text-primary-600">{selectedAuditData.title}</h2>
                    <p className="text-gray-600 text-sm mt-1">Audit ID: {selectedAuditData.id}</p>
                  </div>
                  <span className={`px-4 py-2 rounded-lg text-sm font-semibold border ${getPriorityColor(selectedAuditData.priority)}`}>{selectedAuditData.priority} Priority</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Department</h3>
                    <p className="text-gray-900">{selectedAuditData.department}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Audit Scope</h3>
                    <p className="text-gray-900">{selectedAuditData.scope}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Submitted By</h3>
                    <p className="text-gray-900">{selectedAuditData.submittedBy}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Submitted Date</h3>
                    <p className="text-gray-900">{selectedAuditData.submittedDate}</p>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Objective</h3>
                  <p className="text-gray-700 leading-relaxed">{selectedAuditData.objective}</p>
                </div>

                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Schedule</h3>
                  <div className="flex gap-6">
                    <div><span className="text-sm text-gray-600">Start Date:</span><span className="ml-2 text-gray-900 font-medium">{selectedAuditData.schedule.start}</span></div>
                    <div><span className="text-sm text-gray-600">End Date:</span><span className="ml-2 text-gray-900 font-medium">{selectedAuditData.schedule.end}</span></div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Expected Findings</h3>
                  <div className="flex items-center gap-2"><span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 text-lg font-bold">{selectedAuditData.findings}</span><span className="text-gray-600">findings expected based on initial assessment</span></div>
                </div>

                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Review Comments (Optional)</h3>
                  <textarea rows={4} placeholder="Add any comments or feedback for the SQA Staff..." className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button onClick={() => handleApprove(selectedAuditData.id)} className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">Approve</button>
                  <button onClick={() => handleRequestRevision(selectedAuditData.id)} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">Request Revision</button>
                  <button onClick={() => handleReject(selectedAuditData.id)} className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">Reject</button>
                  <button onClick={() => setSelectedAudit(null)} className="border-2 border-gray-400 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150">Cancel</button>
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </MainLayout>
  );
};

export default SQAHeadAuditReview;
