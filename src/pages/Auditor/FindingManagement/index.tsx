import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { StatCard } from '../../../components';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuditFindings } from '../../../hooks/useAuditFindings';

const SQAStaffFindingManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedAudit, setSelectedAudit] = useState('all');

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Use the audit findings hook to get audit plans
  const {
    loading: loadingAudits,
    error: auditsError,
    auditPlans,
    fetchAuditPlans,
  } = useAuditFindings();

  // Load audit plans on mount
  useEffect(() => {
    fetchAuditPlans();
  }, [fetchAuditPlans]);

  const openChecklist = (auditPlan: any) => {
    // Navigate to detail page for execution
    navigate(`/auditor/findings/${auditPlan.auditId}`);
  };

  const stats = {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary-600">Finding Management</h1>
          <p className="text-gray-600 text-sm mt-1">Execute checklists and manage audit findings</p>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Findings"
            value={stats.total}
            icon={
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            variant="primary"
          />
          <StatCard
            title="Open"
            value={stats.open}
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-dark"
          />
        </div>

        {/* Loading State */}
        {loadingAudits && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit plans...</p>
          </div>
        )}
        
        {/* Error State */}
        {auditsError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700">Error loading audits: {auditsError}</p>
            <button
              onClick={() => fetchAuditPlans()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Available Audit Plans */}
        {!loadingAudits && !auditsError && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
            {/* Content will be added here */}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default SQAStaffFindingManagement;
