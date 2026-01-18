import React, { useState, useEffect } from 'react';
import { getActionById, getActionsByFinding, type Action } from '../../api/actions';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById, type AdminUserDto } from '../../api/adminUsers';
import { getRootCauseById, type RootCause } from '../../api/rootCauses';
import { getStatusColor } from '../../constants';

interface ActionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string | undefined;
  findingId?: string; // Optional: to load all related actions
  showReviewButtons?: boolean;
  expectedStatus?: string; // Expected status for showing review buttons
  onApprove?: (actionId: string, feedback: string) => Promise<void>;
  onReject?: (actionId: string, feedback: string) => Promise<void>;
  isProcessing?: boolean;
}

const ActionDetailModal = ({ 
  isOpen, 
  onClose, 
  actionId, 
  findingId,
  showReviewButtons = false,
  expectedStatus,
  onApprove,
  onReject,
  isProcessing = false
}: ActionDetailModalProps) => {
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [assignedToUser, setAssignedToUser] = useState<AdminUserDto | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [rootCause, setRootCause] = useState<RootCause | null>(null);
  const [loadingRootCause, setLoadingRootCause] = useState(false);
  const [showResponsiblePersonModal, setShowResponsiblePersonModal] = useState(false);
  
  // Multi-action support
  const [relatedActions, setRelatedActions] = useState<Action[]>([]);
  const [loadingRelatedActions, setLoadingRelatedActions] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | undefined>(actionId);
  // const [showActionsList, setShowActionsList] = useState(false);
  const [relatedActionsUsers, setRelatedActionsUsers] = useState<Record<string, AdminUserDto>>({});

  // Sync selectedActionId with actionId prop when modal opens
  useEffect(() => {
    if (isOpen && actionId) {
      setSelectedActionId(actionId);
    }
  }, [isOpen, actionId]);

  useEffect(() => {
   
    
    if (isOpen && selectedActionId) {
      loadAction();
      if (findingId) {
        loadRelatedActions();
      } else {
      }
    } else {
      // Reset state when modal closes
      setAction(null);
      setAssignedToUser(null);
      setAttachments([]);
      setError(null);
      setReviewFeedback('');
      setShowFeedbackInput(false);
      setRelatedActions([]);
    }
  }, [isOpen, selectedActionId, findingId]);

  // Listen for action updates to reload attachments (e.g., when LeadAuditor approves action)
  useEffect(() => {
    if (!isOpen || !selectedActionId) return;

    const handleActionUpdated = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const updatedActionId = customEvent.detail?.actionId;
      
      // Only reload if the updated action matches the current action
      if (updatedActionId === selectedActionId) {
        // Wait a bit for backend to update
        await new Promise(resolve => setTimeout(resolve, 500));
        // Reload attachments to get updated status
        try {
          await loadAttachments(selectedActionId);
          // Also reload action to get updated status
          const data = await getActionById(selectedActionId);
          setAction(data);
        } catch (err) {
        }
      }
    };

    window.addEventListener('actionUpdated', handleActionUpdated as EventListener);
    
    return () => {
      window.removeEventListener('actionUpdated', handleActionUpdated as EventListener);
    };
  }, [isOpen, selectedActionId]);

  const loadRelatedActions = async () => {
    if (!findingId) {
      return;
    }
    
    setLoadingRelatedActions(true);
    try {
      // Load all actions for this finding using the correct API function
      const actions = await getActionsByFinding(findingId);
    
      setRelatedActions(actions || []);
      
      // Load user info for all actions
      const usersMap: Record<string, AdminUserDto> = {};
      for (const action of actions || []) {
        if (action.assignedTo && !usersMap[action.assignedTo]) {
          try {
            const user = await getUserById(action.assignedTo);
            if (user) {
              usersMap[action.assignedTo] = user;
            }
          } catch (error) {
            console.error(`Error loading user ${action.assignedTo}:`, error);
          }
        }
      }
      setRelatedActionsUsers(usersMap);
    } catch (err: any) {
      console.error('Error loading related actions:', err);
    } finally {
      setLoadingRelatedActions(false);
    }
  };

  const loadAction = async () => {
    if (!selectedActionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getActionById(selectedActionId);
    
      setAction(data);
      // Load attachments for this action
      if (selectedActionId) loadAttachments(selectedActionId);
      // Load assignedTo user info
      if (data.assignedTo) {
        loadAssignedToUser(data.assignedTo);
      }
      // Load root cause if rootCauseId exists
      if (data.rootCauseId) {
        loadRootCause(data.rootCauseId);
      } else {
        setRootCause(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load action details');
    } finally {
      setLoading(false);
    }
  };

  const loadRootCause = async (rootCauseId: string) => {
    setLoadingRootCause(true);
    try {
      const data = await getRootCauseById(rootCauseId);
      setRootCause(data);
    } catch (err: any) {
      console.error('Error loading root cause:', err);
      setRootCause(null);
    } finally {
      setLoadingRootCause(false);
    }
  };

  const loadAssignedToUser = async (userId: string) => {
    try {
      const userData = await getUserById(userId);
      setAssignedToUser(userData);
    } catch (err: any) {
      console.error('Error loading assignedTo user:', err);
      // Don't show error, just log it
    }
  };

  const loadAttachments = async (actionId: string) => {
    try {
      const data = await getAttachments('Action', actionId);
      setAttachments(data);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
      // Don't show error for attachments, just log it
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Get status badge for attachment
  const getAttachmentStatusBadge = (status?: string) => {
    if (!status) return null;
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'rejected') {
      return (
        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-300 flex-shrink-0">
          Rejected
        </span>
      );
    }
    if (statusLower === 'approved') {
      return (
        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded border border-green-300 flex-shrink-0">
          Approved
        </span>
      );
    }
    if (statusLower === 'open') {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded border border-blue-300 flex-shrink-0">
          Open
        </span>
      );
    }
    // Default: show status as-is
    return (
      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded border border-gray-300 flex-shrink-0">
        {status}
      </span>
    );
  };

  if (!isOpen) return null;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    } catch {
      return dateString;
    }
  };

  const normalizeStatus = (status: string): string => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'completed' || statusLower === 'approved') return 'Approved';
    if (statusLower === 'active' || statusLower === 'open') return 'InProgress';
    if (statusLower === 'closed') return 'Closed';
    if (statusLower === 'pending') return 'Pending';
    if (statusLower === 'reviewed') return 'Reviewed';
    return status;
  };

  return (
    <React.Fragment>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="relative bg-white rounded-xl shadow-lg w-full max-w-6xl max-h-[95vh] overflow-hidden flex"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sidebar for Related Actions */}
          {relatedActions.length > 1 && (
            <div className="w-72 bg-gray-50 border-r border-gray-300 flex-shrink-0">
              <div className="sticky top-0 bg-primary-600 px-4 py-4 border-b border-gray-300">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <div>
                      <h3 className="text-sm font-bold text-white">Team Members</h3>
                      <p className="text-xs text-white/80">
                        {(() => {
                          const uniqueUsers = new Set(relatedActions.filter(a => a.assignedTo).map(a => a.assignedTo));
                          return `${uniqueUsers.size} ${uniqueUsers.size === 1 ? 'member' : 'members'}`;
                        })()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      loadRelatedActions();
                      loadAction();
                    }}
                    disabled={loadingRelatedActions}
                    className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Refresh"
                  >
                    <svg className={`w-4 h-4 ${loadingRelatedActions ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="p-3 space-y-2 overflow-y-auto max-h-[calc(95vh-120px)]">
                {(() => {
                  // Group actions by assignedTo user to avoid duplicates
                  // IMPORTANT: Only include actions that have assignedTo
                  const userActionsMap = new Map<string, Action[]>();
                  relatedActions.forEach(action => {
                    const userId = action.assignedTo;
                    if (userId) { // Only add if assignedTo exists
                      if (!userActionsMap.has(userId)) {
                        userActionsMap.set(userId, []);
                      }
                      userActionsMap.get(userId)!.push(action);
                    }
                  });
                  
                  // Create array of unique users with their actions
                  const uniqueUsers = Array.from(userActionsMap.entries()).map(([userId, actions]) => ({
                    userId,
                    actions,
                    // Use first action's data for display
                    representativeAction: actions[0]
                  }));
                  
                  return uniqueUsers.map((userGroup, index) => {
                    const user = relatedActionsUsers[userGroup.userId];
                    const userName = user?.fullName || 'Unknown User';
                    const hasSelectedAction = userGroup.actions.some(a => a.actionId === selectedActionId);
                    
                    return (
                      <div key={userGroup.userId} className="space-y-1">
                        {/* User header */}
                        <div className={`w-full text-left p-3 rounded-lg ${
                          hasSelectedAction
                            ? 'bg-primary-600 text-white'
                            : 'bg-white border border-gray-300'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              hasSelectedAction ? 'bg-white/20' : 'bg-gray-100'
                            }`}>
                              <svg className={`w-4 h-4 ${
                                hasSelectedAction ? 'text-white' : 'text-gray-600'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-bold ${
                                hasSelectedAction ? 'text-white' : 'text-gray-900'
                              }`}>
                                #{index + 1} - {userName}
                              </p>
                              {userGroup.actions.length > 1 && (
                                <p className={`text-xs ${
                                  hasSelectedAction ? 'text-white/80' : 'text-gray-500'
                                }`}>
                                  {userGroup.actions.length} actions
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Show all actions for this user */}
                        {userGroup.actions.map((action, actionIndex) => {
                          const isSelected = selectedActionId === action.actionId;
                          
                          return (
                            <button
                              key={action.actionId}
                              onClick={() => {
                                setSelectedActionId(action.actionId);
                                setShowFeedbackInput(false);
                                setReviewFeedback('');
                              }}
                              className={`w-full text-left p-2 pl-12 rounded-lg transition-colors ${
                                isSelected
                                  ? 'bg-primary-500 text-white'
                                  : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <span className={`font-medium ${
                                  isSelected ? 'text-white' : 'text-gray-700'
                                }`}>
                                  Action {actionIndex + 1}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded border ${
                                    isSelected
                                      ? 'bg-white/20 text-white border-white/30'
                                      : getStatusColor(normalizeStatus(action.status)) + ' border-gray-200'
                                  }`}>
                                    {action.status}
                                  </span>
                                  <span className={isSelected ? 'text-white' : 'text-gray-600'}>
                                    {action.progressPercent || 0}%
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 bg-blue-600 px-6 py-5 flex items-center justify-between z-10 border-b border-blue-700">
              <div className="flex-1 min-w-0">
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    <span className="text-white font-medium">Loading action details...</span>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-2xl font-bold text-white">Action Details</h2>
                    <p className="text-blue-100 text-sm mt-1">
                      {relatedActions.length > 1 
                        ? `Viewing action ${relatedActions.findIndex(a => a.actionId === selectedActionId) + 1} of ${relatedActions.length}`
                        : 'Comprehensive action information and attachments'}
                    </p>
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-blue-700 rounded-lg transition-colors text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-white">
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  <span className="ml-3 text-gray-600">Loading action details...</span>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                  <p className="font-medium">Error</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              ) : action ? (
                <div className="space-y-6">
                  {/* Information Grid */}
                  <div className="space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Title
                      </label>
                      <div className="px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-medium break-words leading-snug whitespace-pre-wrap min-h-[48px]">
                        {action.title || 'N/A'}
                      </div>
                    </div>

                    {/* Status and Progress Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Status */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                          Status
                        </label>
                        <div className="px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium">
                          {action.status || 'N/A'}
                        </div>
                      </div>

                      {/* Progress */}
                      {action.progressPercent > 0 && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                            Progress
                          </label>
                          <div className="px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium">
                            {action.progressPercent}% Complete
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Root Cause (if available) */}
                  {(() => {
                    // Check if root cause exists (from API or legacy description)
                    const hasRootCauseFromApi = rootCause || loadingRootCause;
                    
                    // Parse legacy root cause from description
                    let legacyRootCauseName = null;
                    let legacyRootCauseDesc = null;
                    if (!hasRootCauseFromApi && action.description) {
                      const match = action.description.match(/\n\nAssigned Root Cause:([\s\S]*?)(?:\n\nAssigned to:|$)/);
                      if (match) {
                        const fullText = match[1].trim();
                        // Parse format: "• name (category)\n  Description: desc"
                        const nameMatch = fullText.match(/^[•\-\*]\s*(.+?)\s*\([^)]+\)/);
                        const descMatch = fullText.match(/Description:\s*(.+)$/s);
                        
                        if (nameMatch) {
                          legacyRootCauseName = nameMatch[1].trim();
                        }
                        if (descMatch) {
                          legacyRootCauseDesc = descMatch[1].trim();
                        }
                        
                        // If parsing failed, use the whole text as name
                        if (!legacyRootCauseName && !legacyRootCauseDesc) {
                          legacyRootCauseName = fullText;
                        }
                      }
                    }
                    
                    if (!hasRootCauseFromApi && !legacyRootCauseName) return null;
                    
                    return (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                          Assigned Root Cause
                        </label>
                        {loadingRootCause ? (
                          <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg border border-gray-300">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-500"></div>
                            <span className="text-sm text-gray-600">Loading root cause...</span>
                          </div>
                        ) : rootCause ? (
                          <div className="border border-gray-300 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-indigo-50 space-y-4">
                            {/* Title */}
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Root Cause Title
                              </label>
                              <p className="text-sm font-semibold text-gray-900 break-words leading-snug whitespace-pre-wrap px-4 py-2.5 bg-white border border-blue-200 rounded-lg">
                                {rootCause.name || 'N/A'}
                              </p>
                            </div>

                            {/* Description */}
                            {rootCause.description && (
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                  Description
                                </label>
                                <p className="text-sm text-gray-700 break-words leading-relaxed whitespace-pre-wrap px-4 py-2.5 bg-white border border-blue-200 rounded-lg min-h-[80px]">
                                  {rootCause.description}
                                </p>
                              </div>
                            )}

                            {/* Proposed Action / Remediation Proposal */}
                            {rootCause.proposedAction && (
                              <div>
                                <label className="block text-xs font-semibold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Proposed Remediation Action
                                </label>
                                <p className="text-sm text-gray-700 break-words leading-relaxed whitespace-pre-wrap px-4 py-2.5 bg-green-50 border border-green-300 rounded-lg min-h-[80px]">
                                  {rootCause.proposedAction}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : legacyRootCauseName ? (
                          <div className="border border-gray-300 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-indigo-50 space-y-4">
                            {/* Title */}
                            <div>
                              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Root Cause Title
                              </label>
                              <p className="text-sm font-semibold text-gray-900 break-words leading-snug whitespace-pre-wrap px-4 py-2.5 bg-white border border-blue-200 rounded-lg">
                                {legacyRootCauseName}
                              </p>
                            </div>

                            {/* Description */}
                            {legacyRootCauseDesc && (
                              <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                  Description
                                </label>
                                <p className="text-sm text-gray-700 break-words leading-relaxed whitespace-pre-wrap px-4 py-2.5 bg-white border border-blue-200 rounded-lg min-h-[80px]">
                                  {legacyRootCauseDesc}
                                </p>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Description */}
                  {action.description && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Description
                      </label>
                      <div className="px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 break-words leading-relaxed whitespace-pre-wrap min-h-[100px]">
                        {(() => {
                          // Clean up legacy descriptions that have embedded root cause info
                          let cleanDescription = action.description;
                          // Remove "Assigned Root Cause:" section if it exists (legacy data)
                          const rootCauseMatch = cleanDescription.match(/\n\nAssigned Root Cause:[\s\S]*/);
                          if (rootCauseMatch) {
                            cleanDescription = cleanDescription.substring(0, rootCauseMatch.index);
                          }
                          return cleanDescription;
                        })()}
                      </div>
                    </div>
                  )}


                  {/* Additional Information Grid */}
                  <div className="space-y-6">
                    {/* Responsible Person */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Responsible Person
                      </label>
                      <div className="relative">
                        <div className="px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium pr-10">
                          {assignedToUser?.fullName || action.assignedTo || 'N/A'}
                        </div>
                        {assignedToUser && (
                          <button
                            onClick={() => setShowResponsiblePersonModal(true)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                            title="Click to view responsible person details"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Date Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Created Date */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                          Created Date
                        </label>
                        <div className="px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium">
                          {formatDate(action.createdAt)}
                        </div>
                      </div>

                      {/* Due Date */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                          Due Date
                        </label>
                        <div className="px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium">
                          {formatDate(action.dueDate)}
                        </div>
                      </div>

                      {/* Closed Date */}
                      {action.closedAt && (
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                            Closed Date
                          </label>
                          <div className="px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium">
                            {formatDate(action.closedAt)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Attachments */}
                  {action.findingId && attachments.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Attachments ({attachments.length})
                      </label>
                      <div className="space-y-3">
                      {[...attachments].sort((a, b) => {
                        // Sort: Rejected attachments first, then others
                        const aIsRejected = a.status?.toLowerCase() === 'rejected';
                        const bIsRejected = b.status?.toLowerCase() === 'rejected';
                        if (aIsRejected && !bIsRejected) return -1;
                        if (!aIsRejected && bIsRejected) return 1;
                        return 0;
                      }).map((attachment) => {
                        const isImage = attachment.contentType?.startsWith('image/');
                        const imageUrl = attachment.filePath || attachment.blobPath || '';
                        
                        return (
                          <div
                            key={attachment.attachmentId}
                            className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm"
                          >
                            {/* Image preview - Full width, good quality */}
                            {isImage && imageUrl && (
                              <div className="relative bg-gray-100">
                                <img
                                  src={imageUrl}
                                  alt={attachment.fileName}
                                  className="w-full h-auto max-h-96 object-contain"
                                  onError={(e) => {
                                    console.error('Image load error:', attachment.filePath);
                                    e.currentTarget.parentElement!.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* File info bar */}
                            <div className="p-3 bg-gray-50 border-t border-gray-200">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isImage ? (
                                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-gray-700 font-medium truncate">{attachment.fileName}</p>
                                      {getAttachmentStatusBadge(attachment.status)}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      {formatFileSize(attachment.fileSize || 0)} • {new Date(attachment.uploadedAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={imageUrl || attachment.filePath}
                                  download={attachment.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-3 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Feedback Input */}
            {showFeedbackInput && onApprove && onReject && action && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-rose-100">
                    <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <label className="text-sm font-bold uppercase tracking-wide text-rose-700">
                      Rejection Feedback (Required)
                    </label>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Please provide a reason for rejection
                    </p>
                  </div>
                </div>
                <textarea
                  value={reviewFeedback}
                  onChange={(e) => setReviewFeedback(e.target.value)}
                  rows={4}
                  placeholder="Enter a detailed reason for rejection..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-none font-medium"
                />
                <div className="flex items-center justify-end gap-3 mt-4">
                  <button
                    onClick={() => {
                      setShowFeedbackInput(false);
                      setReviewFeedback('');
                    }}
                    disabled={isProcessing}
                    className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-all disabled:opacity-50 shadow-sm border-2 border-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      
                      if (reviewFeedback.trim() && onReject && selectedActionId) {
                        await onReject(selectedActionId, reviewFeedback);
                        await loadAction();
                        setShowFeedbackInput(false);
                        setReviewFeedback('');
                      } else {
                      }
                    }}
                    disabled={isProcessing || !reviewFeedback.trim()}
                    className="px-5 py-2.5 text-sm font-bold text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg border-2 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 border-rose-600/30"
                  >
                    <div className="flex items-center gap-2">
                      {isProcessing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Processing...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Confirm Rejection
                        </>
                      )}
                    </div>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footer with Review Buttons */}
          {(() => {
            // Check if status matches expected status (if provided)
            const statusMatches = expectedStatus 
              ? action?.status?.toLowerCase() === expectedStatus.toLowerCase()
              : true; // If no expected status, don't filter by status
            
            const shouldShowButtons = showReviewButtons && onApprove && onReject && action && !showFeedbackInput && statusMatches;
        
            
            return shouldShowButtons;
          })() && (
            <div className="sticky bottom-0 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100 px-6 sm:px-8 py-4 flex items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Ready for review</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setShowFeedbackInput(true);
                  }}
                  disabled={isProcessing}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </div>
                </button>
                <button
                  onClick={async () => {
              
                    if (onApprove && selectedActionId) {
                      await onApprove(selectedActionId, '');
                      await loadAction();
                    }
                  }}
                  disabled={isProcessing}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-2">
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Approve
                      </>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
      </div>

      {/* Responsible Person Detail Modal */}
      {showResponsiblePersonModal && assignedToUser && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setShowResponsiblePersonModal(false)}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-xl shadow-lg w-full max-w-2xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-blue-600 text-white p-6 rounded-t-xl">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-1">Responsible Person Details</h3>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-8 space-y-4">
                {/* Full Name */}
                {assignedToUser.fullName && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <label className="block text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Full Name</label>
                    <p className="text-xl font-bold text-gray-900">{assignedToUser.fullName}</p>
                  </div>
                )}

                {/* Email */}
                {assignedToUser.email && (
                  <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Email</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px]">{assignedToUser.email}</p>
                  </div>
                )}

                {/* Role */}
                {assignedToUser.roleName && (
                  <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Role</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px]">{assignedToUser.roleName}</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end">
                <button
                  onClick={() => setShowResponsiblePersonModal(false)}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

export default ActionDetailModal;

