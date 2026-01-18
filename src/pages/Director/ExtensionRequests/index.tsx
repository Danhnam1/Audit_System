import { useEffect, useState } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { PageHeader, Button } from '../../../components';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { getUserFriendlyErrorMessage } from '../../../utils/errorMessages';
import {
  getPendingRevisionRequestsForDirector,
  approveAuditPlanRevisionRequest,
  rejectAuditPlanRevisionRequest,
  type ViewAuditPlanRevisionRequest,
} from '../../../api/auditPlanRevisionRequest';
import { getOverdueChecklistItems, getChecklistTemplates } from '../../../api/checklists';
import { getAuditChecklistTemplateMapsByAudit } from '../../../api/auditChecklistTemplateMaps';
import { getAuditPlanById, getSensitiveDepartments } from '../../../api/audits';
import { getFindingsByAudit } from '../../../api/findings';
import { unwrap, normalizePlanDetails } from '../../../utils/normalize';
import { getAuditTeam } from '../../../api/auditTeam';
import { PlanDetailsModal } from '../../Auditor/AuditPlanning/components/PlanDetailsModal';
import { getDepartmentName, getCriterionName } from '../../../helpers/auditPlanHelpers';
import { getStatusColor, getBadgeVariant, getAuditTypeBadgeColor } from '../../../constants';
import { getDepartments } from '../../../api/departments';
import { getAuditCriteria } from '../../../api/auditCriteria';
import { getAdminUsers } from '../../../api/adminUsers';

export default function DirectorExtensionRequestsPage() {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [requests, setRequests] = useState<ViewAuditPlanRevisionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAuditDetailsModal, setShowAuditDetailsModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ViewAuditPlanRevisionRequest | null>(null);
  const [selectedAuditDetails, setSelectedAuditDetails] = useState<any | null>(null);
  const [responseComment, setResponseComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [overdueItems, setOverdueItems] = useState<any[]>([]);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [templateMap, setTemplateMap] = useState<Record<string, string>>({});
  const [auditTemplateMaps, setAuditTemplateMaps] = useState<Record<string, string[]>>({});
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteriaList, setCriteriaList] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [auditTeams, setAuditTeams] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [templatesForCurrentAudit, setTemplatesForCurrentAudit] = useState<any[]>([]);
  const [requestFindings, setRequestFindings] = useState<any[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const data = await getPendingRevisionRequestsForDirector();
      setRequests(data);
    } catch (error) {
      console.error('Failed to load extension requests:', error);
      toast.error('Failed to load extension requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
    
    // Load all necessary data
    const loadAllData = async () => {
      try {
        const [templates, depts, criteria, users, teams] = await Promise.all([
          getChecklistTemplates().catch(() => []),
          getDepartments().catch(() => []),
          getAuditCriteria().catch(() => []),
          getAdminUsers().catch(() => []),
          getAuditTeam().catch(() => [])
        ]);
        
        // Template map
        const map: Record<string, string> = {};
        templates.forEach((t: any) => {
          if (t.templateId && t.name) {
            map[t.templateId] = t.name;
          }
        });
        setTemplateMap(map);
        setChecklistTemplates(templates);
        
        // Departments
        const deptList = Array.isArray(depts)
          ? depts.map((d: any) => ({ deptId: d.deptId ?? d.$id ?? d.id, name: d.name || d.code || '—' }))
          : [];
        setDepartments(deptList);
        
        // Criteria
        setCriteriaList(unwrap(criteria));
        
        // Users
        const usersArray = unwrap(users);
        setOwnerOptions(usersArray);
        setAuditorOptions(usersArray);
        
        // Teams
        const teamsArray = unwrap(teams) || [];
        const filteredTeams = Array.isArray(teamsArray) 
          ? teamsArray.filter((m: any) => {
              const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
              return role !== 'auditeeowner';
            })
          : [];
        setAuditTeams(filteredTeams);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    };
    
    loadAllData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  // Load overdue items and template maps when request is selected
  useEffect(() => {
    const loadOverdueItems = async () => {
      if (!selectedRequest?.auditId) {
        setOverdueItems([]);
        setAuditTemplateMaps({});
        return;
      }
      setLoadingOverdue(true);
      try {
        const [items, templateMaps] = await Promise.all([
          getOverdueChecklistItems(selectedRequest.auditId),
          getAuditChecklistTemplateMapsByAudit(selectedRequest.auditId).catch(() => [])
        ]);
        setOverdueItems(items);
        
        // Build template map for this audit
        const auditMap: Record<string, string[]> = {};
        const templateIds = templateMaps.map((m: any) => m.templateId).filter(Boolean);
        auditMap[selectedRequest.auditId] = templateIds;
        setAuditTemplateMaps(auditMap);
      } catch (error) {
        console.error('Failed to load overdue items:', error);
        setOverdueItems([]);
        setAuditTemplateMaps({});
      } finally {
        setLoadingOverdue(false);
      }
    };
    loadOverdueItems();
  }, [selectedRequest?.auditId]);

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    setSubmitting(true);
    try {
      const res = await approveAuditPlanRevisionRequest(selectedRequest.requestId, responseComment);
      toast.success('Extension request approved successfully.');
      setShowApproveModal(false);
      setSelectedRequest(null);
      setResponseComment('');
      await loadRequests();

      // Notify other screens (e.g. Lead Reports) so "Edit Schedule & Team" button appears immediately
      try {
        const eventDetail = {
          auditId: selectedRequest.auditId,
          requestId: selectedRequest.requestId,
          status: res?.status || 'Approved',
          timestamp: Date.now(),
        };
        const evt = new CustomEvent('auditExtensionApproved', { detail: eventDetail });
        window.dispatchEvent(evt);
      } catch (notifyErr) {
        console.warn('Failed to dispatch auditExtensionApproved event:', notifyErr);
      }
    } catch (error: any) {
      console.error('Failed to approve request:', error);
      toast.error(getUserFriendlyErrorMessage(error, 'Failed to approve request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    setSubmitting(true);
    try {
      await rejectAuditPlanRevisionRequest(selectedRequest.requestId, responseComment);
      toast.success('Extension request rejected.');
      setShowRejectModal(false);
      setSelectedRequest(null);
      setResponseComment('');
      await loadRequests();
    } catch (error: any) {
      console.error('Failed to reject request:', error);
      toast.error(getUserFriendlyErrorMessage(error, 'Failed to reject request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const openReviewModal = async (request: ViewAuditPlanRevisionRequest) => {
    setSelectedRequest(request);
    setResponseComment('');
    setShowApproveModal(true);
    setRequestFindings([]);
    
    console.log('🔍 Extension Request:', request);
    console.log('🔍 Finding IDs:', request.findingIds);
    
    // Load findings if findingIds are present
    if (request.findingIds && request.findingIds.length > 0) {
      setLoadingFindings(true);
      try {
        const allFindings = await getFindingsByAudit(request.auditId);
        console.log('📋 All Findings:', allFindings);
        // Filter to only include the findings that were selected
        const selectedFindings = allFindings.filter((f: any) => 
          request.findingIds?.includes(f.findingId || f.id)
        );
        console.log('✅ Selected Findings:', selectedFindings);
        setRequestFindings(selectedFindings);
      } catch (err) {
        console.error('Failed to load findings:', err);
        setRequestFindings([]);
      } finally {
        setLoadingFindings(false);
      }
    }
  };

  const openRejectModal = (request: ViewAuditPlanRevisionRequest) => {
    setSelectedRequest(request);
    setResponseComment('');
    setShowRejectModal(true);
  };

  const openAuditDetailsModal = async (request: ViewAuditPlanRevisionRequest) => {
    setSelectedRequest(request);
    setShowAuditDetailsModal(true);
    
    try {
      // Load full audit plan details and templates
      const [rawData, templateMapsData] = await Promise.all([
        getAuditPlanById(request.auditId),
        getAuditChecklistTemplateMapsByAudit(request.auditId).catch(() => [])
      ]);
      
      const normalized = normalizePlanDetails(rawData, {
        departments,
        criteriaList,
        users: ownerOptions
      });
      
      // Load sensitive areas
      let sensitiveFlag = false;
      let sensitiveAreas: string[] = [];
      let sensitiveAreasByDept: Record<number, string[]> = {};
      
      try {
        const planIdToUse = String(rawData.planId || rawData.id || request.auditId);
        const sensitiveDepts = await getSensitiveDepartments(planIdToUse);
        
        if (sensitiveDepts && sensitiveDepts.length > 0) {
          sensitiveFlag = sensitiveDepts.some((sd: any) => sd.sensitiveFlag === true);
          
          const allAreas = new Set<string>();
          
          sensitiveDepts.forEach((sd: any) => {
            const deptId = Number(sd.deptId);
            let areasArray: string[] = [];
            
            // Try 'Areas' first (C# convention - backend returns List<string> as Areas)
            if (Array.isArray(sd.Areas)) {
              areasArray = sd.Areas;
            } else if (sd.Areas && typeof sd.Areas === 'string') {
              try {
                const parsed = JSON.parse(sd.Areas);
                areasArray = Array.isArray(parsed) ? parsed : [sd.Areas];
              } catch {
                areasArray = [sd.Areas];
              }
            } else if (sd.Areas && typeof sd.Areas === 'object' && sd.Areas.$values) {
              areasArray = Array.isArray(sd.Areas.$values) ? sd.Areas.$values : [];
            } else if (Array.isArray(sd.areas)) {
              areasArray = sd.areas;
            } else if (sd.areas && typeof sd.areas === 'string') {
              try {
                const parsed = JSON.parse(sd.areas);
                areasArray = Array.isArray(parsed) ? parsed : [sd.areas];
              } catch {
                areasArray = [sd.areas];
              }
            } else if (sd.areas && typeof sd.areas === 'object' && sd.areas.$values) {
              areasArray = Array.isArray(sd.areas.$values) ? sd.areas.$values : [];
            }
            
            // Store areas by deptId with filtering and trimming
            if (deptId && areasArray.length > 0) {
              sensitiveAreasByDept[deptId] = areasArray
                .filter((area: string) => area && typeof area === 'string' && area.trim())
                .map((a: string) => a.trim());
            }
            
            areasArray.forEach((area: string) => {
              if (area && typeof area === 'string' && area.trim()) {
                allAreas.add(area.trim());
              }
            });
          });
          
          sensitiveAreas = Array.from(allAreas);
        }
      } catch (sensErr) {
        console.warn('Failed to load sensitive areas:', sensErr);
      }
      
      // Merge sensitive areas into normalized data
      const enhancedDetails = {
        ...normalized,
        sensitiveFlag,
        sensitiveAreas,
        sensitiveAreasByDept
      };
      
      setSelectedAuditDetails(enhancedDetails);
      
      // Build templates list for this audit
      const templateIds = Array.isArray(templateMapsData) 
        ? templateMapsData.map((m: any) => m.templateId).filter(Boolean)
        : [];
      
      const templatesForAudit = checklistTemplates.filter((t: any) => {
        const tid = t.templateId || t.id || t.$id;
        return templateIds.includes(tid) || templateIds.includes(String(tid));
      });
      
      setTemplatesForCurrentAudit(templatesForAudit);
    } catch (error) {
      console.error('Failed to load audit details:', error);
      toast.error('Failed to load audit details');
      setSelectedAuditDetails(null);
      setTemplatesForCurrentAudit([]);
    }
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Extension Requests"
          subtitle="Review and approve/reject requests from Lead Auditors to extend evidence due dates"
        />

        {loading ? (
          <div className="bg-white border border-primary-100 rounded-xl shadow-md p-8 flex items-center justify-center gap-3 text-sm text-primary-700">
            <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading extension requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl shadow-sm p-8 text-center text-sm text-gray-500">
            No pending extension requests at this time.
          </div>
        ) : (
          <div className="bg-white border border-primary-100 rounded-xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-primary-100 bg-gradient-to-r from-primary-600 to-primary-700">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wide flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pending Extension Requests ({requests.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      #
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Audit Information
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Requested By
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Requested Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request, index) => (
                    <tr 
                      key={request.requestId}
                      className="hover:bg-primary-50/30 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {request.auditTitle || `Audit ${request.auditId.slice(0, 8)}...`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-white">
                              {(request.requestedByName || 'LA').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm text-gray-900">
                            {request.requestedByName || 'Lead Auditor'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          }) : '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {request.requestedAt ? new Date(request.requestedAt).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          }) : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          PENDING
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openAuditDetailsModal(request)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
                            title="View Audit Details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            View Audit
                          </button>
                          <button
                            onClick={() => openReviewModal(request)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
                            title="Review Extension Request"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                            Review Request
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Review/Approve/Reject Modal */}
        {showApproveModal && selectedRequest && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => {
                setShowApproveModal(false);
                setSelectedRequest(null);
                setResponseComment('');
              }}
            />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-auto max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4 border-b border-primary-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Review Extension Request
                      </h3>
                      <p className="text-sm text-white/80 mt-0.5">
                        {selectedRequest.auditTitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowApproveModal(false);
                      setSelectedRequest(null);
                      setResponseComment('');
                    }}
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                
                {/* Request Details */}
                <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Request Information
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-gray-700 min-w-[100px]">Requested by:</span>
                      <span className="text-xs text-gray-900 font-medium">{selectedRequest.requestedByName || 'Lead Auditor'}</span>
                    </div>
                    {selectedRequest.requestedAt && (
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-gray-700 min-w-[100px]">Requested at:</span>
                        <span className="text-xs text-gray-900">{new Date(selectedRequest.requestedAt).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      </div>
                    )}
                    {selectedRequest.comment && (
                      <div className="flex items-start gap-2 pt-2 border-t border-blue-200">
                        <span className="text-xs font-medium text-gray-700 min-w-[100px]">Comment:</span>
                        <span className="text-xs text-gray-900 whitespace-pre-line flex-1">{selectedRequest.comment}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Findings Section */}
                <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Selected Findings ({selectedRequest.findingIds?.length || 0})
                  </h4>
                  
                  {(() => {
                    if (!selectedRequest.findingIds || selectedRequest.findingIds.length === 0) {
                      return (
                        <div className="text-center py-4">
                          <p className="text-xs text-gray-500">No findings were selected for this request</p>
                        </div>
                      );
                    }
                    
                    if (loadingFindings) {
                      return (
                        <div className="flex items-center justify-center py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-gray-600">Loading findings...</span>
                          </div>
                        </div>
                      );
                    }
                    
                    if (requestFindings.length > 0) {
                      return (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {requestFindings.map((finding: any, idx: number) => (
                            <div key={finding.findingId || finding.id || idx} className="bg-white border border-purple-200 rounded-lg p-3">
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-900">{finding.title || finding.findingTitle}</p>
                                  {finding.description && (
                                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{finding.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    {finding.severity && (
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                        finding.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                                        finding.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                                        finding.severity === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>
                                        {finding.severity}
                                      </span>
                                    )}
                                    {finding.departmentName && (
                                      <span className="text-xs text-gray-500">{finding.departmentName}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    
                    return (
                      <div className="text-center py-4">
                        <p className="text-xs text-gray-500">No finding details available</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Overdue Checklist Items Section */}
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-red-900 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Overdue Checklist Items ({loadingOverdue ? 'Loading...' : overdueItems.length})
                    </h4>
                  </div>
                  {loadingOverdue ? (
                    <div className="text-xs text-gray-600 text-center py-2">Loading overdue items...</div>
                  ) : overdueItems.length === 0 ? (
                    <div className="text-xs text-gray-600 text-center py-2">No overdue checklist items found.</div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {(() => {
                        // Get template IDs for this audit
                        const auditId = selectedRequest?.auditId || '';
                        const templateIds = auditTemplateMaps[auditId] || [];
                        
                        // Show templates used in this audit
                        const templatesUsed = templateIds
                          .map(id => templateMap[id])
                          .filter(Boolean);
                        
                        // Group items by Section (as proxy for template grouping)
                        const groupedBySection: Record<string, any[]> = {};
                        overdueItems.forEach((item: any) => {
                          const section = item.section || item.Section || 'Unknown Section';
                          if (!groupedBySection[section]) {
                            groupedBySection[section] = [];
                          }
                          groupedBySection[section].push(item);
                        });

                        return (
                          <>
                            {templatesUsed.length > 0 && (
                              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                                <p className="text-[10px] font-semibold text-blue-900 mb-1">Templates Used in This Audit:</p>
                                <div className="flex flex-wrap gap-1">
                                  {templatesUsed.map((name, idx) => (
                                    <span key={idx} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {Object.entries(groupedBySection).map(([section, items]) => {
                              // Try to match section with a template name (approximate)
                              const sectionTemplateName = templatesUsed.length > 0 ? templatesUsed[0] : section;
                              
                              return (
                                <div key={section} className="bg-white border border-red-300 rounded-lg p-3">
                                  <div className="mb-2 pb-2 border-b border-red-200">
                                    <h5 className="text-xs font-bold text-red-900 uppercase">
                                      📋 {sectionTemplateName}
                                    </h5>
                                    <p className="text-[10px] text-gray-600 mt-0.5">
                                      Section: {section} • {items.length} overdue item{items.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <div className="space-y-2">
                                    {items.map((item: any, idx: number) => (
                                      <div key={item.auditChecklistItemId || item.auditItemId || idx} className="bg-red-50 border border-red-200 rounded-md p-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <p className="text-xs font-semibold text-gray-900 mb-1">
                                              Item {idx + 1}
                                            </p>
                                            {item.questionTextSnapshot && (
                                              <p className="text-xs text-gray-700 mb-2 whitespace-pre-wrap">
                                                {item.questionTextSnapshot}
                                              </p>
                                            )}
                                            {!item.questionTextSnapshot && (item.title || item.itemTitle) && (
                                              <p className="text-xs text-gray-700 mb-2">
                                                {item.title || item.itemTitle}
                                              </p>
                                            )}
                                            <div className="flex flex-wrap gap-2 text-[10px] text-gray-600">
                                              {item.dueDate && (
                                                <span className="inline-flex items-center">
                                                  <span className="font-medium">Due:</span>{' '}
                                                  <span className="text-red-600 font-semibold">
                                                    {new Date(item.dueDate).toLocaleDateString()}
                                                  </span>
                                                </span>
                                              )}
                                              {item.status && (
                                                <span className="inline-flex items-center">
                                                  <span className="font-medium">Status:</span> {item.status}
                                                </span>
                                              )}
                                              {item.section && (
                                                <span className="inline-flex items-center">
                                                  <span className="font-medium">Section:</span> {item.section}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 whitespace-nowrap flex-shrink-0">
                                            OVERDUE
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                    Response Comment (optional)
                  </label>
                  <textarea
                    value={responseComment}
                    onChange={(e) => setResponseComment(e.target.value)}
                    placeholder="Add any comments about the approval decision..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none shadow-sm"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => {
                      setShowApproveModal(false);
                      setSelectedRequest(null);
                      setResponseComment('');
                    }}
                    variant="secondary"
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setShowApproveModal(false);
                      openRejectModal(selectedRequest);
                    }}
                    disabled={submitting}
                    variant="danger"
                    size="md"
                  >
                    Reject Request
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={submitting}
                    variant="success"
                    size="md"
                  >
                    {submitting ? 'Approving...' : 'Approve Request'}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Reject Modal */}
        {showRejectModal && selectedRequest && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => {
                setShowRejectModal(false);
                setSelectedRequest(null);
                setResponseComment('');
              }}
            />
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl mx-auto max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 z-10 bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 border-b border-red-800">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Reject Extension Request
                      </h3>
                      <p className="text-sm text-white/80 mt-0.5">
                        {selectedRequest.auditTitle}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowRejectModal(false);
                      setSelectedRequest(null);
                      setResponseComment('');
                    }}
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-6">

                {/* Overdue Checklist Items Section */}
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-red-900 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Overdue Checklist Items ({loadingOverdue ? 'Loading...' : overdueItems.length})
                    </h4>
                  </div>
                  {loadingOverdue ? (
                    <div className="text-xs text-gray-600 text-center py-2">Loading overdue items...</div>
                  ) : overdueItems.length === 0 ? (
                    <div className="text-xs text-gray-600 text-center py-2">No overdue checklist items found.</div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {(() => {
                        // Get template IDs for this audit
                        const auditId = selectedRequest?.auditId || '';
                        const templateIds = auditTemplateMaps[auditId] || [];
                        
                        // Show templates used in this audit
                        const templatesUsed = templateIds
                          .map(id => templateMap[id])
                          .filter(Boolean);
                        
                        // Group items by Section (as proxy for template grouping)
                        const groupedBySection: Record<string, any[]> = {};
                        overdueItems.forEach((item: any) => {
                          const section = item.section || item.Section || 'Unknown Section';
                          if (!groupedBySection[section]) {
                            groupedBySection[section] = [];
                          }
                          groupedBySection[section].push(item);
                        });

                        return (
                          <>
                            {templatesUsed.length > 0 && (
                              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-md">
                                <p className="text-[10px] font-semibold text-blue-900 mb-1">Templates Used in This Audit:</p>
                                <div className="flex flex-wrap gap-1">
                                  {templatesUsed.map((name, idx) => (
                                    <span key={idx} className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                      {name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {Object.entries(groupedBySection).map(([section, items]) => {
                              // Use first template name if available, otherwise use section
                              const sectionTemplateName = templatesUsed.length > 0 ? templatesUsed[0] : section;
                              
                              return (
                                <div key={section} className="bg-white border border-red-300 rounded-lg p-3">
                                  <div className="mb-2 pb-2 border-b border-red-200">
                                    <h5 className="text-xs font-bold text-red-900 uppercase">
                                      📋 {sectionTemplateName}
                                    </h5>
                                    <p className="text-[10px] text-gray-600 mt-0.5">
                                      Section: {section} • {items.length} overdue item{items.length !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <div className="space-y-2">
                                    {items.map((item: any, idx: number) => (
                                      <div key={item.auditChecklistItemId || item.auditItemId || idx} className="bg-red-50 border border-red-200 rounded-md p-2.5">
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1">
                                            <p className="text-xs font-semibold text-gray-900 mb-1">
                                              Item {idx + 1}
                                            </p>
                                            {item.questionTextSnapshot && (
                                              <p className="text-xs text-gray-700 mb-2 whitespace-pre-wrap">
                                                {item.questionTextSnapshot}
                                              </p>
                                            )}
                                            {!item.questionTextSnapshot && (item.title || item.itemTitle) && (
                                              <p className="text-xs text-gray-700 mb-2">
                                                {item.title || item.itemTitle}
                                              </p>
                                            )}
                                            <div className="flex flex-wrap gap-2 text-[10px] text-gray-600">
                                              {item.dueDate && (
                                                <span className="inline-flex items-center">
                                                  <span className="font-medium">Due:</span>{' '}
                                                  <span className="text-red-600 font-semibold">
                                                    {new Date(item.dueDate).toLocaleDateString()}
                                                  </span>
                                                </span>
                                              )}
                                              {item.status && (
                                                <span className="inline-flex items-center">
                                                  <span className="font-medium">Status:</span> {item.status}
                                                </span>
                                              )}
                                              {item.section && (
                                                <span className="inline-flex items-center">
                                                  <span className="font-medium">Section:</span> {item.section}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 whitespace-nowrap flex-shrink-0">
                                            OVERDUE
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Rejection Reason <span className="text-red-600">*</span>
                  </label>
                  <textarea
                    value={responseComment}
                    onChange={(e) => setResponseComment(e.target.value)}
                    placeholder="Please provide a clear reason for rejecting this extension request..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none shadow-sm"
                    rows={4}
                  />
                  {!responseComment.trim() && (
                    <p className="text-xs text-red-600 mt-1">A rejection reason is required.</p>
                  )}
                </div>
                <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                  <Button
                    onClick={() => {
                      setShowRejectModal(false);
                      setSelectedRequest(null);
                      setResponseComment('');
                    }}
                    variant="secondary"
                    size="md"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReject}
                    disabled={submitting || !responseComment.trim()}
                    variant="danger"
                    size="md"
                  >
                    {submitting ? 'Rejecting...' : 'Confirm Rejection'}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Audit Details Modal - Using PlanDetailsModal component */}
        {showAuditDetailsModal && selectedRequest && selectedAuditDetails && (
          <PlanDetailsModal
            showModal={true}
            selectedPlanDetails={selectedAuditDetails}
            templatesForPlan={templatesForCurrentAudit}
            onClose={() => {
              setShowAuditDetailsModal(false);
              setSelectedRequest(null);
              setSelectedAuditDetails(null);
              setTemplatesForCurrentAudit([]);
            }}
            getCriterionName={(id: any) => getCriterionName(id, criteriaList)}
            getDepartmentName={(id: any) => getDepartmentName(id, departments)}
            getStatusColor={getStatusColor}
            getBadgeVariant={getBadgeVariant}
            getAuditTypeBadgeColor={getAuditTypeBadgeColor}
            ownerOptions={ownerOptions}
            auditorOptions={auditorOptions}
            auditTeamsForPlan={auditTeams.filter((m: any) => {
              const currentAuditId = selectedRequest.auditId;
              if (!currentAuditId) return false;
              const teamAuditId = String(m?.auditId || "").trim();
              return (
                teamAuditId === String(currentAuditId).trim() ||
                teamAuditId.toLowerCase() === String(currentAuditId).toLowerCase()
              );
            })}
            getTemplateName={(tid) => {
              const t = checklistTemplates.find((tpl: any) => String(tpl.templateId || tpl.id || tpl.$id) === String(tid));
              return t?.name || t?.title || `Template ${String(tid ?? '')}`;
            }}
            hideSections={['actions']}
          />
        )}
      </div>
    </MainLayout>
  );
}
