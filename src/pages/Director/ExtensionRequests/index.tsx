import { useEffect, useState } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { PageHeader, Button } from '../../../components';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import {
  getPendingRevisionRequestsForDirector,
  approveAuditPlanRevisionRequest,
  rejectAuditPlanRevisionRequest,
  type ViewAuditPlanRevisionRequest,
} from '../../../api/auditPlanRevisionRequest';
import { getOverdueChecklistItems, getChecklistTemplates } from '../../../api/checklists';
import { getAuditChecklistTemplateMapsByAudit } from '../../../api/auditChecklistTemplateMaps';

export default function DirectorExtensionRequestsPage() {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [requests, setRequests] = useState<ViewAuditPlanRevisionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ViewAuditPlanRevisionRequest | null>(null);
  const [responseComment, setResponseComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [overdueItems, setOverdueItems] = useState<any[]>([]);
  const [loadingOverdue, setLoadingOverdue] = useState(false);
  const [templateMap, setTemplateMap] = useState<Record<string, string>>({});
  const [auditTemplateMaps, setAuditTemplateMaps] = useState<Record<string, string[]>>({});

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
    // Load checklist templates for mapping
    const loadTemplates = async () => {
      try {
        const templates = await getChecklistTemplates();
        const map: Record<string, string> = {};
        templates.forEach((t: any) => {
          if (t.templateId && t.name) {
            map[t.templateId] = t.name;
          }
        });
        setTemplateMap(map);
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    };
    loadTemplates();
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
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to approve request';
      toast.error(errorMessage);
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
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to reject request';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const openReviewModal = (request: ViewAuditPlanRevisionRequest) => {
    setSelectedRequest(request);
    setResponseComment('');
    setShowApproveModal(true);
  };

  const openRejectModal = (request: ViewAuditPlanRevisionRequest) => {
    setSelectedRequest(request);
    setResponseComment('');
    setShowRejectModal(true);
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Extension Requests"
          subtitle="Review and approve/reject requests from Lead Auditors to extend evidence due dates"
        />

        {loading ? (
          <div className="bg-white border border-primary-200 rounded-lg p-8 flex items-center justify-center gap-3 text-sm text-primary-700">
            <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading extension requests...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
            No pending extension requests at this time.
          </div>
        ) : (
          <div className="bg-white border border-primary-200 rounded-xl shadow-sm">
            <div className="px-4 py-3 border-b border-primary-300 bg-gradient-primary rounded-t-lg">
              <h2 className="text-sm font-semibold text-white uppercase">
                Pending Extension Requests ({requests.length})
              </h2>
            </div>
            <div className="p-4 space-y-4">
              {requests.map((request) => (
                <div
                  key={request.requestId}
                  className="border border-primary-200 rounded-lg p-4 bg-primary-50/30 hover:bg-primary-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {request.auditTitle || `Audit ${request.auditId.slice(0, 8)}...`}
                        </h3>
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          PENDING
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">
                        Requested by: <span className="font-medium">{request.requestedByName || 'Lead Auditor'}</span>
                        {' • '}
                        {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : ''}
                      </p>
                      {request.comment && (
                        <div className="mt-2 p-3 bg-white rounded-md border border-gray-200">
                          <p className="text-xs font-medium text-gray-700 mb-1">Request Comment:</p>
                          <p className="text-xs text-gray-600 whitespace-pre-line">{request.comment}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openReviewModal(request)}
                        className="px-4 py-2 text-xs font-medium rounded-md bg-primary-600 hover:bg-primary-700 text-white transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Review Request
                      </button>
                    </div>
                  </div>
                </div>
              ))}
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
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Review Extension Request
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Review extension request for: <span className="font-medium">{selectedRequest.auditTitle}</span>
                </p>
                
                {/* Request Details */}
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs font-medium text-gray-700 mb-1">Requested by:</p>
                  <p className="text-xs text-gray-600">{selectedRequest.requestedByName || 'Lead Auditor'}</p>
                  {selectedRequest.requestedAt && (
                    <>
                      <p className="text-xs font-medium text-gray-700 mb-1 mt-2">Requested at:</p>
                      <p className="text-xs text-gray-600">{new Date(selectedRequest.requestedAt).toLocaleString()}</p>
                    </>
                  )}
                  {selectedRequest.comment && (
                    <>
                      <p className="text-xs font-medium text-gray-700 mb-1 mt-2">Comment:</p>
                      <p className="text-xs text-gray-600 whitespace-pre-line">{selectedRequest.comment}</p>
                    </>
                  )}
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

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Response Comment (optional):
                  </label>
                  <textarea
                    value={responseComment}
                    onChange={(e) => setResponseComment(e.target.value)}
                    placeholder="Add any comments about the approval..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 justify-end">
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
                    Reject
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={submitting}
                    variant="success"
                    size="md"
                  >
                    {submitting ? 'Approving...' : 'Approve'}
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
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Reject Extension Request
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Reject the extension request for: <span className="font-medium">{selectedRequest.auditTitle}</span>
                </p>

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

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason:
                  </label>
                  <textarea
                    value={responseComment}
                    onChange={(e) => setResponseComment(e.target.value)}
                    placeholder="Please provide a reason for rejecting this extension request..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    rows={4}
                  />
                </div>
                <div className="flex gap-3 justify-end">
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
                    {submitting ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </MainLayout>
  );
}

