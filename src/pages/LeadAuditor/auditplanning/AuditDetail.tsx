import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { getAuditPlanById, getAuditScopeDepartmentsByAuditId } from '../../../api/audits';
import { getUserById } from '../../../api/adminUsers';
import { getAuditorsByAuditId } from '../../../api/auditTeam';
import { getCriteriaForAudit } from '../../../api/auditCriteriaMap';
import { getAuditCriterionById } from '../../../api/auditCriteria';
import { getChecklistTemplateById, type ChecklistTemplateDto } from '../../../api/checklists';
import { getFindingsByAudit } from '../../../api/findings';
import { toast } from 'react-toastify';
import { unwrap } from '../../../utils/normalize';
import DepartmentTab from './components/DepartmentTab';
import AuditTeamTab from './components/AuditTeamTab';
import CriteriaTab from './components/CriteriaTab';
import FindingsTab from './components/FindingsTab';

const AuditDetail = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'department' | 'auditteam' | 'criteria' | 'template' | 'findings'>('department');
  const [auditDetails, setAuditDetails] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [auditors, setAuditors] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [template, setTemplate] = useState<ChecklistTemplateDto | null>(null);
  const [findings, setFindings] = useState<any[]>([]);
  const [createdByFullName, setCreatedByFullName] = useState<string>('');
  const [templateCreatedByFullName, setTemplateCreatedByFullName] = useState<string>('');
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingAuditors, setLoadingAuditors] = useState(false);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [loadingFindings, setLoadingFindings] = useState(false);

  useEffect(() => {
    if (auditId) {
      loadAuditDetails();
      loadDepartments();
      loadAuditors();
      loadCriteria();
    }
  }, [auditId]);

  // Load template when audit details are loaded
  useEffect(() => {
    const templateId = auditDetails?.audit?.templateId || auditDetails?.templateId;
    console.log('[useEffect Template] auditDetails:', auditDetails);
    console.log('[useEffect Template] auditDetails?.audit?.templateId:', auditDetails?.audit?.templateId);
    console.log('[useEffect Template] auditDetails?.templateId:', auditDetails?.templateId);
    console.log('[useEffect Template] Final templateId:', templateId);
    
    if (templateId && !template && !loadingTemplate) {
      console.log('[useEffect Template] Calling loadTemplate');
      loadTemplate();
    } else {
      console.log('[useEffect Template] No templateId found or template already loaded');
    }
  }, [auditDetails?.audit?.templateId, auditDetails?.templateId]);

  // Load template when Template tab is clicked
  useEffect(() => {
    const templateId = auditDetails?.audit?.templateId || auditDetails?.templateId;
    if (activeTab === 'template' && templateId && !template && !loadingTemplate) {
      console.log('[useEffect ActiveTab] Template tab active, loading template');
      loadTemplate();
    }
  }, [activeTab, auditDetails?.audit?.templateId, auditDetails?.templateId, template, loadingTemplate]);

  // Load findings when audit is approved and findings tab is active
  useEffect(() => {
    const auditStatus = auditDetails?.audit?.status || auditDetails?.status;
    if (activeTab === 'findings' && auditStatus === 'Approved' && auditId && findings.length === 0 && !loadingFindings) {
      loadFindings();
    }
  }, [activeTab, auditDetails?.audit?.status, auditDetails?.status, auditId]);

  const loadAuditDetails = async () => {
    if (!auditId) return;
    
    console.log('[loadAuditDetails] Starting to load audit details for auditId:', auditId);
    setLoadingDetails(true);
    try {
      const data = await getAuditPlanById(auditId);
      console.log('[loadAuditDetails] Audit data:', data);
      console.log('[loadAuditDetails] TemplateId:', data?.templateId);
      console.log('[loadAuditDetails] Data keys:', data ? Object.keys(data) : 'null');
      setAuditDetails(data);
      
      // Template will be loaded by useEffect when auditDetails is set
      if (data?.templateId) {
        console.log('[loadAuditDetails] TemplateId found:', data.templateId);
      } else {
        console.log('[loadAuditDetails] No templateId in audit data');
      }
      
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

  const loadTemplate = async () => {
    // templateId is nested in auditDetails.audit.templateId
    const templateId = auditDetails?.audit?.templateId || auditDetails?.templateId;
    
    if (!templateId) {
      console.log('[loadTemplate] No templateId found in auditDetails');
      console.log('[loadTemplate] auditDetails.audit:', auditDetails?.audit);
      return;
    }

    console.log('[loadTemplate] Starting to load template');
    console.log('[loadTemplate] TemplateId from audit:', templateId);
    
    setLoadingTemplate(true);
    try {
      // Call API directly with templateId
      console.log('[loadTemplate] Calling API: /ChecklistTemplates/' + templateId);
      const data = await getChecklistTemplateById(templateId);
      console.log('[loadTemplate] API response:', data);
      
      // Handle response - could be direct data or wrapped
      const templateData = data?.data || data;
      console.log('[loadTemplate] Processed template data:', templateData);
      console.log('[loadTemplate] Template data keys:', templateData ? Object.keys(templateData) : 'null');
      
      if (templateData) {
        setTemplate(templateData);
        
        // Load createdBy user info to get fullName
        if (templateData.createdBy) {
          try {
            const user = await getUserById(templateData.createdBy);
            setTemplateCreatedByFullName(user?.fullName || 'N/A');
          } catch (err) {
            console.error('Failed to load template creator info', err);
            setTemplateCreatedByFullName('N/A');
          }
        }
      } else {
        console.error('[loadTemplate] No template data received');
        setTemplate(null);
        toast.error('Template data not found');
      }
    } catch (err: any) {
      console.error('[loadTemplate] Failed to load template:', err);
      console.error('[loadTemplate] Error details:', {
        message: err?.message,
        response: err?.response?.data,
        status: err?.response?.status,
        url: err?.config?.url
      });
      toast.error('Failed to load template: ' + (err?.response?.data?.message || err?.message || 'Unknown error'));
      setTemplate(null);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const loadFindings = async () => {
    if (!auditId) return;
    
    setLoadingFindings(true);
    try {
      const data = await getFindingsByAudit(auditId);
      const findingsList = Array.isArray(data) ? data : [];
      setFindings(findingsList);
    } catch (err: any) {
      console.error('Failed to load findings', err);
      toast.error('Failed to load findings: ' + (err?.message || 'Unknown error'));
      setFindings([]);
    } finally {
      setLoadingFindings(false);
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
              <button
                onClick={() => setActiveTab('template')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'template'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Template
              </button>
              {/* Only show Findings tab when audit status is Approved */}
              {((auditDetails?.audit?.status || auditDetails?.status) === 'Approved') && (
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
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
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
            {activeTab === 'findings' && (
              <FindingsTab 
                findings={findings} 
                loading={loadingFindings}
              />
            )}
            {activeTab === 'template' && (
              <div>
                {(() => {
                  console.log('=== TEMPLATE TAB DEBUG ===');
                  console.log('[Template Tab Render] auditId from URL:', auditId);
                  console.log('[Template Tab Render] auditDetails:', auditDetails);
                  // templateId is nested in audit.audit.templateId
                  const templateId = auditDetails?.audit?.templateId || auditDetails?.templateId;
                  console.log('[Template Tab Render] auditDetails?.audit?.templateId:', auditDetails?.audit?.templateId);
                  console.log('[Template Tab Render] auditDetails?.templateId:', auditDetails?.templateId);
                  console.log('[Template Tab Render] Final templateId:', templateId);
                  console.log('[Template Tab Render] auditDetails keys:', auditDetails ? Object.keys(auditDetails) : 'null');
                  console.log('[Template Tab Render] loadingTemplate:', loadingTemplate);
                  console.log('[Template Tab Render] template:', template);
                  console.log('[Template Tab Render] template?.templateId:', template?.templateId);
                  
                  // Check if we can get templateId
                  if (auditDetails) {
                    console.log('[Template Tab Render] ✅ auditDetails exists');
                    if (templateId) {
                      console.log('[Template Tab Render] ✅ templateId found:', templateId);
                    } else {
                      console.log('[Template Tab Render] ❌ templateId NOT found in auditDetails');
                    }
                  } else {
                    console.log('[Template Tab Render] ❌ auditDetails is null/undefined');
                  }
                  
                  // Load template if not loaded yet and templateId exists
                  if (!template && !loadingTemplate && templateId) {
                    console.log('[Template Tab Render] Triggering loadTemplate from render');
                    setTimeout(() => {
                      loadTemplate();
                    }, 0);
                  }
                  
                  return null;
                })()}
                {loadingTemplate ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-gray-600">Loading template...</span>
                  </div>
                ) : !template ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No template found for this audit</p>
                    <p className="text-xs text-gray-400 mt-2">Template ID: {auditDetails?.templateId || 'N/A'}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-6">Template Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Name
                          </label>
                          <p className="text-sm text-gray-900 font-medium">{template.name || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                            Version
                          </label>
                          <p className="text-sm text-gray-900">{template.version || 'N/A'}</p>
                        </div>
                        {template.description && (
                          <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                              Description
                            </label>
                            <p className="text-sm text-gray-900 whitespace-pre-wrap">{template.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

