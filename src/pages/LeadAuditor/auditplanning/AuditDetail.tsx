import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { getFindingsByAudit, type Finding } from '../../../api/findings';
import { getAuditPlanById, getAuditScopeDepartmentsByAuditId } from '../../../api/audits';
import { getUserById } from '../../../api/adminUsers';
import { getAuditorsByAuditId } from '../../../api/auditTeam';
import { getCriteriaForAudit } from '../../../api/auditCriteriaMap';
import { getAuditCriterionById } from '../../../api/auditCriteria';
import { toast } from 'react-toastify';
import { unwrap } from '../../../utils/normalize';
import FindingsTab from './components/FindingsTab';
import DepartmentTab from './components/DepartmentTab';
import AuditTeamTab from './components/AuditTeamTab';
import CriteriaTab from './components/CriteriaTab';

const AuditDetail = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'findings' | 'department' | 'auditteam' | 'criteria'>('findings');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [auditDetails, setAuditDetails] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [auditors, setAuditors] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [createdByFullName, setCreatedByFullName] = useState<string>('');
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingAuditors, setLoadingAuditors] = useState(false);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auditId) {
      loadFindings();
      loadAuditDetails();
      loadDepartments();
      loadAuditors();
      loadCriteria();
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

  const loadCriteria = async () => {
    if (!auditId) return;
    
    setLoadingCriteria(true);
    try {
      // Get criteria mapping for this audit
      const criteriaMap = await getCriteriaForAudit(auditId);
      const criteriaList = unwrap(criteriaMap);
      
      if (!Array.isArray(criteriaList) || criteriaList.length === 0) {
        setCriteria([]);
        return;
      }

      // Fetch detailed information for each criterion using getAuditCriterionById
      const criteriaDetails = await Promise.allSettled(
        criteriaList.map(async (item: any) => {
          try {
            const response = await getAuditCriterionById(item.criteriaId);
            console.log('Criterion detail response for', item.criteriaId, ':', response);
            
            // hooks/axios interceptor already returns response.data, so response is the actual data
            const detail = response || {};
            
            console.log('Processed criterion detail:', detail);
            
            return {
              criteriaId: detail.criteriaId || item.criteriaId,
              name: detail.name || 'N/A',
              description: detail.description || 'No description',
              referenceCode: detail.referenceCode || 'N/A',
              status: item.status || detail.status || 'Active',
            };
          } catch (err: any) {
            console.error(`Failed to load criterion ${item.criteriaId}:`, err);
            console.error('Error details:', err?.response?.data || err?.message);
            // Return basic info if detail fetch fails
            return {
              criteriaId: item.criteriaId,
              name: 'N/A',
              description: 'No description',
              referenceCode: 'N/A',
              status: item.status || 'Active',
            };
          }
        })
      );

      const validCriteria = criteriaDetails
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<any>).value);

      setCriteria(validCriteria);
    } catch (err: any) {
      console.error('Failed to load criteria', err);
      toast.error('Failed to load criteria: ' + (err?.message || 'Unknown error'));
      setCriteria([]);
    } finally {
      setLoadingCriteria(false);
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
              <button
                onClick={() => setActiveTab('criteria')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'criteria'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Criteria
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
            {activeTab === 'criteria' && (
              <CriteriaTab 
                criteria={criteria} 
                loading={loadingCriteria}
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

    </MainLayout>
  );
};

export default AuditDetail;

