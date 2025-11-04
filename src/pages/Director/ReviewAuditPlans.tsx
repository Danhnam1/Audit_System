import { useState } from 'react';
import { MainLayout } from '../../layouts';
import { useNavigate } from 'react-router-dom';

interface AuditPlan {
  id: number;
  planId: string;
  title: string;
  department: string;
  scope: string;
  startDate: string;
  endDate: string;
  submittedBy: string;
  submittedDate: string;
  status: 'Pending Review' | 'Approved' | 'Rejected';
  objectives: string[];
  auditTeam: string[];
}

const ReviewAuditPlans = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'All' | 'Pending Review' | 'Approved' | 'Rejected'>('All');

  // Mock data
  const auditPlans: AuditPlan[] = [
    {
      id: 1,
      planId: 'AP-2024-001',
      title: 'ISO 9001:2015 Quality Management System Audit',
      department: 'IT Department',
      scope: 'Document Control, Training Records, Internal Audit Process',
      startDate: '2024-11-20',
      endDate: '2024-11-25',
  submittedBy: 'Nguyễn Văn A (Lead Auditor)',
      submittedDate: '2024-11-01',
      status: 'Pending Review',
      objectives: [
        'Verify compliance with ISO 9001:2015 standards',
        'Assess effectiveness of quality management processes',
        'Identify areas for improvement',
      ],
      auditTeam: ['Trần Thị B', 'Lê Văn C', 'Phạm Thị D'],
    },
    {
      id: 2,
      planId: 'AP-2024-002',
      title: 'Information Security Management Audit',
      department: 'HR Department',
      scope: 'Access Control, Data Protection, Security Policies',
      startDate: '2024-11-15',
      endDate: '2024-11-18',
  submittedBy: 'Nguyễn Văn A (Lead Auditor)',
      submittedDate: '2024-10-28',
      status: 'Pending Review',
      objectives: [
        'Evaluate information security controls',
        'Review access management procedures',
        'Assess compliance with security policies',
      ],
      auditTeam: ['Hoàng Văn E', 'Nguyễn Thị F'],
    },
    {
      id: 3,
      planId: 'AP-2024-003',
      title: 'Process Improvement Audit',
      department: 'Finance Department',
      scope: 'Financial Controls, Reporting Procedures',
      startDate: '2024-10-20',
      endDate: '2024-10-25',
  submittedBy: 'Nguyễn Văn A (Lead Auditor)',
      submittedDate: '2024-10-15',
      status: 'Approved',
      objectives: [
        'Review financial control processes',
        'Assess reporting accuracy',
        'Identify cost optimization opportunities',
      ],
      auditTeam: ['Trần Văn G', 'Lê Thị H'],
    },
  ];

  const filteredPlans = filter === 'All' ? auditPlans : auditPlans.filter(plan => plan.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Pending Review': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewDetail = (planId: number) => {
    navigate(`/director/review-plans/${planId}`);
  };

  const stats = {
    total: auditPlans.length,
    pending: auditPlans.filter(p => p.status === 'Pending Review').length,
    approved: auditPlans.filter(p => p.status === 'Approved').length,
    rejected: auditPlans.filter(p => p.status === 'Rejected').length,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Review Audit Plans</h1>
            <p className="text-gray-600 mt-1">Review plans approved by Lead Auditor</p>
          </div>
          <button
            onClick={() => navigate('/director')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Plans</p>
                <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Review</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-3xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(['All', 'Pending Review', 'Approved', 'Rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Plans List */}
        <div className="space-y-4">
          {filteredPlans.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No audit plans found for the selected filter</p>
            </div>
          ) : (
            filteredPlans.map((plan) => (
              <div key={plan.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{plan.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                          {plan.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Plan ID: {plan.planId}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Department</p>
                      <p className="font-medium text-gray-800">{plan.department}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Audit Period</p>
                      <p className="font-medium text-gray-800">
                        {new Date(plan.startDate).toLocaleDateString()} - {new Date(plan.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Submitted By</p>
                      <p className="font-medium text-gray-800">{plan.submittedBy}</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="text-sm text-gray-500 mb-1">Scope</p>
                    <p className="text-gray-700">{plan.scope}</p>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleViewDetail(plan.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      View Details
                    </button>
                    {plan.status === 'Pending Review' && (
                      <>
                        <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium">
                          Approve
                        </button>
                        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default ReviewAuditPlans;
