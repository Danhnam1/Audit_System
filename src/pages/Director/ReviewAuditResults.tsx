import { useState } from 'react';
import { MainLayout } from '../../layouts';
import { useNavigate } from 'react-router-dom';

interface AuditResult {
  id: number;
  resultId: string;
  title: string;
  department: string;
  auditDate: string;
  auditor: string;
  status: 'Pending Review' | 'Approved' | 'Rejected';
  findingsCount: number;
  criticalFindings: number;
  majorFindings: number;
  minorFindings: number;
  correctiveActionsCount: number;
}

const ReviewAuditResults = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'All' | 'Pending Review' | 'Approved' | 'Rejected'>('All');

  // Mock data
  const auditResults: AuditResult[] = [
    {
      id: 1,
      resultId: 'AR-2024-001',
      title: 'ISO 9001:2015 Quality Management System Audit Results',
      department: 'IT Department',
      auditDate: '2024-10-25',
      auditor: 'Trần Thị B',
      status: 'Pending Review',
      findingsCount: 8,
      criticalFindings: 1,
      majorFindings: 3,
      minorFindings: 4,
      correctiveActionsCount: 8,
    },
    {
      id: 2,
      resultId: 'AR-2024-002',
      title: 'Information Security Audit Results',
      department: 'HR Department',
      auditDate: '2024-10-18',
      auditor: 'Hoàng Văn E',
      status: 'Pending Review',
      findingsCount: 5,
      criticalFindings: 0,
      majorFindings: 2,
      minorFindings: 3,
      correctiveActionsCount: 5,
    },
    {
      id: 3,
      resultId: 'AR-2024-003',
      title: 'Process Improvement Audit Results',
      department: 'Finance Department',
      auditDate: '2024-10-10',
      auditor: 'Trần Văn G',
      status: 'Approved',
      findingsCount: 3,
      criticalFindings: 0,
      majorFindings: 1,
      minorFindings: 2,
      correctiveActionsCount: 3,
    },
  ];

  const filteredResults = filter === 'All' ? auditResults : auditResults.filter(result => result.status === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Pending Review': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleViewDetail = (resultId: number) => {
    navigate(`/director/review-results/${resultId}`);
  };

  const stats = {
    total: auditResults.length,
    pending: auditResults.filter(r => r.status === 'Pending Review').length,
    approved: auditResults.filter(r => r.status === 'Approved').length,
    rejected: auditResults.filter(r => r.status === 'Rejected').length,
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Review Audit Results</h1>
            <p className="text-gray-600 mt-1">Review findings and corrective actions</p>
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
                <p className="text-sm text-gray-600">Total Results</p>
                <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
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

        {/* Results List */}
        <div className="space-y-4">
          {filteredResults.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No audit results found for the selected filter</p>
            </div>
          ) : (
            filteredResults.map((result) => (
              <div key={result.id} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-800">{result.title}</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                          {result.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Result ID: {result.resultId}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Department</p>
                      <p className="font-medium text-gray-800">{result.department}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Audit Date</p>
                      <p className="font-medium text-gray-800">{new Date(result.auditDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Auditor</p>
                      <p className="font-medium text-gray-800">{result.auditor}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Total Findings</p>
                      <p className="font-medium text-gray-800">{result.findingsCount}</p>
                    </div>
                  </div>

                  {/* Findings Breakdown */}
                  <div className="grid grid-cols-3 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{result.criticalFindings}</p>
                      <p className="text-sm text-gray-600">Critical</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-orange-600">{result.majorFindings}</p>
                      <p className="text-sm text-gray-600">Major</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{result.minorFindings}</p>
                      <p className="text-sm text-gray-600">Minor</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg mb-4">
                    <span className="text-sm font-medium text-gray-700">Corrective Actions Planned</span>
                    <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-semibold">
                      {result.correctiveActionsCount}
                    </span>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleViewDetail(result.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      View Details
                    </button>
                    {result.status === 'Pending Review' && (
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

export default ReviewAuditResults;
