import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { getFindingsByAudit, type Finding } from '../../../api/findings';
import {
  getAuditPlanById,
  getAuditScopeDepartmentsByAuditId,
  approveForwardDirector,
  rejectPlanContent,
} from '../../../api/audits';
import { getUserById } from '../../../api/adminUsers';
import { getAuditorsByAuditId } from '../../../api/auditTeam';
import { toast } from 'react-toastify';
import { unwrap } from '../../../utils/normalize';
import FindingsTab from './components/FindingsTab';
import DepartmentTab from './components/DepartmentTab';
import AuditTeamTab from './components/AuditTeamTab';

const AuditDetail = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'findings' | 'department' | 'auditteam'>('findings');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [auditDetails, setAuditDetails] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [auditors, setAuditors] = useState<any[]>([]);
  const [createdByFullName, setCreatedByFullName] = useState<string>('');
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingAuditors, setLoadingAuditors] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => {
    if (auditId) {
      loadFindings();
      loadAuditDetails();
      loadDepartments();
      loadAuditors();
    }
  }, [auditId]);


  const loadFindings = async () => {
    if (!auditId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getFindingsByAudit(auditId);
      setFindings(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load findings', err);
      setError(err?.message || 'Failed to load findings');
      toast.error('Failed to load findings: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const loadAuditDetails = async () => {
    if (!auditId) return;
    
    setLoadingDetails(true);
    try {
      const data = await getAuditPlanById(auditId);
      setAuditDetails(data);
      
      // Load createdBy user info to get fullName
      if (data?.createdBy) {
        try {
          const user = await getUserById(data.createdBy);
          setCreatedByFullName(user?.fullName || 'N/A');
        } catch (err) {
          console.error('Failed to load user info', err);
          setCreatedByFullName('N/A');
        }
      }
    } catch (err: any) {
      console.error('Failed to load audit details', err);
      toast.error('Failed to load audit details: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadDepartments = async () => {
    if (!auditId) return;
    
    setLoadingDepartments(true);
    try {
      const data = await getAuditScopeDepartmentsByAuditId(auditId);
      const deptList = unwrap(data);
      setDepartments(Array.isArray(deptList) ? deptList : []);
    } catch (err: any) {
      console.error('Failed to load departments', err);
      toast.error('Failed to load departments: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadAuditors = async () => {
    if (!auditId) return;
    
    setLoadingAuditors(true);
    try {
      const data = await getAuditorsByAuditId(auditId);
      const auditorList = unwrap(data);
      setAuditors(Array.isArray(auditorList) ? auditorList : []);
    } catch (err: any) {
      console.error('Failed to load auditors', err);
      toast.error('Failed to load audit team: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingAuditors(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Only show Approve/Reject when any status field (on plan or nested audit) is PendingReview
  const canReviewPlan = (plan: any) => {
    if (!plan) return false;

    const normalize = (s: any) =>
      String(s || '')
        .toLowerCase()
        .replace(/\s+/g, '');

    const nested = plan.audit || {};

    const candidates = [
      plan.status,
      plan.state,
      plan.approvalStatus,
      plan.statusName,
      nested.status,
      nested.state,
      nested.approvalStatus,
      nested.statusName,
    ];

    // Match any value that contains "pendingreview"
    return candidates.some((s) => normalize(s).includes('pendingreview'));
  };

  const handleApprove = async () => {
    if (!auditId) return;
    try {
      setActionLoading(true);
      await approveForwardDirector(auditId);
      toast.success('Plan approved and forwarded to Director.');
      // Reload details to reflect new status
      await loadAuditDetails();
    } catch (err: any) {
      console.error('Approve & forward failed', err);
      toast.error('Failed to approve and forward plan: ' + (err?.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!auditId) return;
    const reason = rejectComment.trim();
    if (!reason) {
      toast.warning('Please enter a reason for rejection.');
      return;
    }
    try {
      setActionLoading(true);
      await rejectPlanContent(auditId, { comment: reason });
      toast.success('Plan has been rejected.');
      await loadAuditDetails();
      setShowRejectModal(false);
    } catch (err: any) {
      console.error('Reject plan failed', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Unknown error';
      toast.error('Failed to reject plan: ' + errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/lead-auditor/auditplanning')}
              className="text-primary-600 hover:text-primary-700 mb-2 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Audit Planning
            </button>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              {loadingDetails ? 'Loading...' : auditDetails?.title || 'Audit Detail'}
            </h1>
          </div>

          {/* Actions for plans that haven't been reviewed yet */}
          {auditDetails && canReviewPlan(auditDetails) && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setRejectComment('');
                  setShowRejectModal(true);
                }}
                disabled={actionLoading}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 shadow-sm disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Approve & Forward'}
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('findings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'findings'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Findings
              </button>
              <button
                onClick={() => setActiveTab('department')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'department'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Department
              </button>
              <button
                onClick={() => setActiveTab('auditteam')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'auditteam'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Audit Team
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'findings' && (
              <FindingsTab findings={findings} loading={loading} />
            )}
            {activeTab === 'department' && (
              <DepartmentTab 
                departments={departments} 
                loading={loadingDepartments}
                onViewAuditDetail={() => setShowAuditDetailModal(true)}
              />
            )}
            {activeTab === 'auditteam' && (
              <AuditTeamTab 
                auditors={auditors} 
                loading={loadingAuditors}
              />
            )}
          </div>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {showAuditDetailModal && auditDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] overflow-hidden flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-8 py-6 shadow-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-white">Audit Details</h3>
                  <p className="text-sm text-white/90 mt-1">Complete audit information</p>
                </div>
                <button
                  onClick={() => setShowAuditDetailModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-all duration-200"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-8">
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Audit ID</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.auditId || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Title</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.title || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Type</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.type || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Scope</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.scope || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.status || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Template ID</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.templateId || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Start Date</span>
                      <p className="text-sm text-gray-900 mt-1">{formatDate(auditDetails.startDate)}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">End Date</span>
                      <p className="text-sm text-gray-900 mt-1">{formatDate(auditDetails.endDate)}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Created By</span>
                      <p className="text-sm text-gray-900 mt-1">{createdByFullName || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Created At</span>
                      <p className="text-sm text-gray-900 mt-1">{formatDateTime(auditDetails.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Published</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.isPublished ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                  {auditDetails.objective && (
                    <div className="mt-4">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Objective</span>
                      <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{auditDetails.objective}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-white px-8 py-5 border-t border-gray-200 shadow-lg">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAuditDetailModal(false)}
                  className="px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject confirmation modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50">
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Rejection</h3>
              <p className="text-sm text-gray-600">
                Please provide a reason for rejecting this audit plan. The Auditor will see this reason.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection reason
                </label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter rejection reason..."
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Reject Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
};

export default AuditDetail;

