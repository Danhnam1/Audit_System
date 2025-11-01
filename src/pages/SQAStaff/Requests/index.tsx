import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState } from 'react';
import { StatCard } from '../../../components';
import { RequestsTable, RequestDetailsModal } from './Components/index';
import type { RequestItem } from './Components/index';

const SQAStaffRequests = () => {
  const { user } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // menuItems are now provided centrally by MainLayout (role-based). Remove per-page menu definitions.

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const requests = [
    {
      id: 'REQ-2025-001',
      type: 'Audit Request',
      title: 'Safety Management System Audit',
      requestedBy: 'Operations Manager',
      department: 'Flight Operations',
      priority: 'High',
      status: 'Pending Review',
      requestDate: '2025-10-25',
      dueDate: '2025-11-10',
      description: 'Request for comprehensive SMS audit covering all operational procedures and documentation.',
      standards: ['CAAV', 'ICAO Annex 19'],
      scope: 'Department Level'
    },
    {
      id: 'REQ-2025-002',
      type: 'Document Review',
      title: 'Training Manual Update Review',
      requestedBy: 'Training Director',
      department: 'Training',
      priority: 'Medium',
      status: 'In Progress',
      requestDate: '2025-10-22',
      dueDate: '2025-11-05',
      description: 'Review updated training manuals for compliance with latest regulations.',
      standards: ['EASA', 'CAAV'],
      scope: 'Document Level'
    },
    {
      id: 'REQ-2025-003',
      type: 'Finding Follow-up',
      title: 'CAPA Verification Request',
      requestedBy: 'QA Manager',
      department: 'Quality Assurance',
      priority: 'High',
      status: 'Pending Review',
      requestDate: '2025-10-26',
      dueDate: '2025-11-08',
      description: 'Verify implementation of corrective actions from previous audit findings.',
      standards: ['ISO 9001'],
      scope: 'Organization Level'
    },
    {
      id: 'REQ-2025-004',
      type: 'Ad-hoc Audit',
      title: 'Maintenance Record Spot Check',
      requestedBy: 'Chief Inspector',
      department: 'Maintenance',
      priority: 'Critical',
      status: 'Approved',
      requestDate: '2025-10-27',
      dueDate: '2025-10-30',
      description: 'Urgent spot check of maintenance records following incident report.',
      standards: ['EASA Part-145', 'CAAV'],
      scope: 'Department Level'
    },
    {
      id: 'REQ-2025-005',
      type: 'Consultation',
      title: 'New Procedure Compliance Review',
      requestedBy: 'Safety Manager',
      department: 'Safety',
      priority: 'Low',
      status: 'Resolved',
      requestDate: '2025-10-20',
      dueDate: '2025-10-28',
      description: 'Consultation on new safety procedures compliance requirements.',
      standards: ['ICAO Annex 19'],
      scope: 'Procedure Level'
    },
  ];

  const statsData = {
    total: requests.length,
    pendingReview: requests.filter(r => r.status === 'Pending Review').length,
    inProgress: requests.filter(r => r.status === 'In Progress').length,
    resolved: requests.filter(r => r.status === 'Resolved').length,
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">Requests Management</h1>
          <p className="text-gray-600 text-sm mt-1">Manage and track all audit and review requests</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Requests"
            value={statsData.total}
            icon={
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            }
            variant="primary"
          />
          <StatCard
            title="Pending Review"
            value={statsData.pendingReview}
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="In Progress"
            value={statsData.inProgress}
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="Resolved"
            value={statsData.resolved}
            icon={
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-dark"
          />
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">All Requests</h2>
          </div>
          <RequestsTable
            requests={requests}
            onViewDetails={(req: RequestItem) => {
              setSelectedRequest(req);
              setShowDetailsModal(true);
            }}
          />
        </div>
      </div>

      {/* Request Details Modal */}
      <RequestDetailsModal
        open={showDetailsModal}
        request={selectedRequest}
        onClose={() => setShowDetailsModal(false)}
      />
    </MainLayout>
  );
};

export default SQAStaffRequests;