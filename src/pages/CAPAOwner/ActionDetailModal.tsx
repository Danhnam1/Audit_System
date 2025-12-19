import { useState, useEffect } from 'react';
import { getActionById, getActionsByFinding, type Action } from '../../api/actions';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById, type AdminUserDto } from '../../api/adminUsers';
import { getRootCauseById, type RootCause } from '../../api/rootCauses';

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
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [assignedToUser, setAssignedToUser] = useState<AdminUserDto | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [rootCause, setRootCause] = useState<RootCause | null>(null);
  const [loadingRootCause, setLoadingRootCause] = useState(false);
  
  // Multi-action support
  const [relatedActions, setRelatedActions] = useState<Action[]>([]);
  const [loadingRelatedActions, setLoadingRelatedActions] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | undefined>(actionId);
  // const [showActionsList, setShowActionsList] = useState(false);
  const [relatedActionsUsers, setRelatedActionsUsers] = useState<Record<string, AdminUserDto>>({});

  // Sync selectedActionId with actionId prop when modal opens
  useEffect(() => {
    if (isOpen && actionId) {
      console.log('🔄 Syncing selectedActionId with actionId prop:', actionId);
      setSelectedActionId(actionId);
    }
  }, [isOpen, actionId]);

  useEffect(() => {
    console.log('=== ActionDetailModal useEffect ===');
    console.log('isOpen:', isOpen);
    console.log('selectedActionId:', selectedActionId);
    console.log('findingId:', findingId);
    console.log('Current action state:', action ? {
      actionId: action.actionId,
      status: action.status,
      progressPercent: action.progressPercent
    } : null);
    
    if (isOpen && selectedActionId) {
      loadAction();
      if (findingId) {
        console.log('✅ findingId exists, calling loadRelatedActions()');
        loadRelatedActions();
      } else {
        console.log('⚠️ No findingId provided, skipping loadRelatedActions()');
      }
    } else {
      console.log('❌ Modal closed or no selectedActionId, resetting state');
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

  const loadRelatedActions = async () => {
    if (!findingId) {
      console.log('No findingId provided, skipping related actions load');
      return;
    }
    
    console.log('🔄 [loadRelatedActions] Loading actions for finding:', findingId);
    setLoadingRelatedActions(true);
    try {
      // Load all actions for this finding using the correct API function
      const actions = await getActionsByFinding(findingId);
      console.log('✅ [loadRelatedActions] Loaded actions:', actions?.map((a, i) => ({
        index: i + 1,
        actionId: a.actionId,
        status: a.status,
        progressPercent: a.progressPercent,
        assignedTo: a.assignedTo
      })));
      setRelatedActions(actions || []);
      
      // Load user info for all actions
      const usersMap: Record<string, AdminUserDto> = {};
      for (const action of actions || []) {
        if (action.assignedTo && !usersMap[action.assignedTo]) {
          try {
            const user = await getUserById(action.assignedTo);
            if (user) {
              usersMap[action.assignedTo] = user;
              console.log('Loaded user:', user.fullName, 'for action:', action.actionId);
            }
          } catch (error) {
            console.error(`Error loading user ${action.assignedTo}:`, error);
          }
        }
      }
      setRelatedActionsUsers(usersMap);
      console.log('Total users loaded:', Object.keys(usersMap).length);
    } catch (err: any) {
      console.error('Error loading related actions:', err);
    } finally {
      setLoadingRelatedActions(false);
    }
  };

  const loadAction = async () => {
    if (!selectedActionId) return;
    console.log('📥 [loadAction] Fetching action:', selectedActionId);
    setLoading(true);
    setError(null);
    try {
      const data = await getActionById(selectedActionId);
      console.log('✅ [loadAction] Received data:', {
        actionId: data.actionId,
        title: data.title,
        status: data.status,
        progressPercent: data.progressPercent,
        assignedTo: data.assignedTo,
        rootCauseId: data.rootCauseId
      });
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
      console.error('❌ [loadAction] Error loading action:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load action details');
    } finally {
      setLoading(false);
    }
  };

  const loadRootCause = async (rootCauseId: number) => {
    setLoadingRootCause(true);
    try {
      const data = await getRootCauseById(rootCauseId);
      console.log('✅ Loaded root cause:', data);
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
    setLoadingAttachments(true);
    try {
      const data = await getAttachments('Action', actionId);
      setAttachments(data);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
      // Don't show error for attachments, just log it
    } finally {
      setLoadingAttachments(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'completed' || statusLower === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (statusLower === 'active' || statusLower === 'open') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (statusLower === 'closed') return 'bg-gray-100 text-gray-700 border-gray-200';
    if (statusLower === 'pending' || statusLower === 'reviewed') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] overflow-hidden flex animate-slideUp"
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
                          const uniqueUsers = new Set(relatedActions.map(a => a.assignedTo));
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
                  const userActionsMap = new Map<string, Action[]>();
                  relatedActions.forEach(action => {
                    const userId = action.assignedTo;
                    if (!userActionsMap.has(userId)) {
                      userActionsMap.set(userId, []);
                    }
                    userActionsMap.get(userId)!.push(action);
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
                    const userName = user?.fullName || userGroup.userId || 'Unknown';
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
                                console.log('🖱️ [Sidebar Click] Switching to action:', action.actionId);
                                console.log('Previous selectedActionId:', selectedActionId);
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
                                  <span className={`px-2 py-0.5 rounded ${
                                    isSelected
                                      ? 'bg-white/20 text-white'
                                      : getStatusColor(action.status)
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
            {/* Header with Gradient */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 px-6 sm:px-8 py-6 shadow-lg z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">Action Details</h2>
                    {relatedActions.length > 1 && (
                      <p className="text-sm text-white/70 mt-0.5">
                        Viewing action {relatedActions.findIndex(a => a.actionId === selectedActionId) + 1} of {relatedActions.length}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-gradient-to-b from-gray-50 to-white">
              {(() => {
                console.log('📺 [Modal Display] Currently showing action:', {
                  selectedActionId,
                  actionData: action ? {
                    actionId: action.actionId,
                    status: action.status,
                    title: action.title?.substring(0, 50) + '...'
                  } : 'null'
                });
                return null;
              })()}
              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg font-medium">Loading action details...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5 mb-6 shadow-sm">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-orange-700 font-medium">{error}</p>
                  </div>
                </div>
              ) : action ? (
                <div className="space-y-6">
                  {/* Title and Status */}
                  <div className="bg-gradient-to-r from-primary-50 to-blue-50 border-l-4 border-primary-600 p-6 rounded-r-xl shadow-md">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-primary-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-primary-700 uppercase tracking-wide mb-2">Title</label>
                        <h3 className="text-xl font-bold text-gray-900 break-words leading-tight">
                          {action.title}
                        </h3>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-[52px]">
                      <span className={`px-4 py-2 rounded-xl text-sm font-bold shadow-sm border-2 ${getStatusColor(action.status)}`}>
                        {action.status}
                      </span>
                      {action.progressPercent > 0 && (
                        <span className="px-4 py-2 rounded-xl text-sm font-bold bg-primary-100 text-primary-700 border-2 border-primary-200 shadow-sm">
                          {action.progressPercent}% Complete
                        </span>
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
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-2 border-purple-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center flex-shrink-0">
                            <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          </div>
                          <label className="text-xs font-bold text-purple-700 uppercase tracking-wide pt-2">Assigned Root Cause</label>
                        </div>
                        {loadingRootCause ? (
                          <div className="flex items-center gap-2 pl-[52px]">
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-300 border-t-purple-600"></div>
                            <span className="text-sm text-purple-600">Loading root cause...</span>
                          </div>
                        ) : rootCause ? (
                          <div className="pl-[52px] space-y-2">
                            <p className="text-lg font-bold text-purple-900">
                              {rootCause.name}
                            </p>
                            {rootCause.description && (
                              <p className="text-base text-gray-700 leading-relaxed">
                                {rootCause.description}
                              </p>
                            )}
                          </div>
                        ) : legacyRootCauseName ? (
                          <div className="pl-[52px] space-y-3">
                            <div className="space-y-2">
                              <p className="text-lg font-bold text-purple-900">
                               Rootcause: {legacyRootCauseName}
                              </p>
                              {legacyRootCauseDesc && (
                                <p className="text-base text-gray-700 leading-relaxed">
                                Description:  {legacyRootCauseDesc}
                                </p>
                              )}
                            </div>
                       
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Description */}
                  {action.description && (
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide pt-2">Description</label>
                      </div>
                      <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap break-words min-h-[80px] pl-[52px]">
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
                      </p>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {action.progressPercent > 0 && (
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-200 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                          </div>
                          <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Progress</h4>
                        </div>
                        <span className="text-2xl font-bold text-primary-600">{action.progressPercent}%</span>
                      </div>
                      <div className="relative">
                        <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                          <div
                            className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-500 relative overflow-hidden"
                            style={{ width: `${action.progressPercent}%` }}
                          >
                            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Responsible Person */}
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-2 border-purple-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow md:col-span-2">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-purple-700 uppercase tracking-wide">Responsible Person</label>
                      </div>
                      <p className="text-lg font-bold text-purple-900 pl-[52px]">
                        {assignedToUser?.fullName || action.assignedTo || 'N/A'}
                      </p>
                    </div>

                    {/* Created Date */}
                    <div className="bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-200 rounded-xl p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-green-700 uppercase tracking-wide">Created Date</label>
                      </div>
                      <p className="text-lg font-bold text-green-900 pl-[52px]">
                        {formatDate(action.createdAt)}
                      </p>
                    </div>

                    {/* Due Date */}
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-2 border-orange-200 rounded-xl p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-orange-700 uppercase tracking-wide">Due Date</label>
                      </div>
                      <p className="text-lg font-bold text-orange-900 pl-[52px]">
                        {formatDate(action.dueDate)}
                      </p>
                    </div>

                    {/* Closed Date - Full Width (if exists) */}
                    {action.closedAt && (
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl p-6 shadow-md md:col-span-2">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Closed Date</label>
                        </div>
                        <p className="text-lg font-bold text-gray-900 pl-[52px]">
                          {formatDate(action.closedAt)}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Attachments */}
                  {action.findingId && (
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-indigo-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Attachments</label>
                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-bold rounded-full">
                          {attachments.length}
                        </span>
                      </div>
                    {loadingAttachments ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mx-auto mb-3"></div>
                          <span className="text-base text-gray-600 font-medium">Loading attachments...</span>
                        </div>
                      </div>
                    ) : attachments.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </div>
                        <p className="text-base text-gray-500 font-medium">No attachments found</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {attachments.map((attachment) => {
                          const isImage = attachment.contentType?.toLowerCase().startsWith('image/');
                          const filePath = attachment.filePath || attachment.blobPath || '';
                          
                          // If it's an image, always show the image preview
                          if (isImage && filePath) {
                            return (
                              <div
                                key={attachment.attachmentId}
                                className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl overflow-hidden hover:border-primary-300 hover:shadow-lg transition-all"
                              >
                                {/* Image Header */}
                                <div className="p-4 border-b-2 border-gray-200 bg-white">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-base font-bold text-gray-900 truncate">{attachment.fileName}</p>
                                        <p className="text-sm text-gray-500 font-medium">{formatFileSize(attachment.fileSize || 0)}</p>
                                      </div>
                                    </div>
                                    <a
                                      href={filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0 ml-3 p-2.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
                                      title="Open image in new tab"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  </div>
                                </div>
                                {/* Image Preview */}
                                <div className="p-4 bg-gray-50">
                                  <img
                                    src={filePath}
                                    alt={attachment.fileName}
                                    className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 bg-white cursor-pointer hover:opacity-90 transition-opacity shadow-md"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = `
                                          <div class="p-8 text-center text-gray-500">
                                            <svg class="w-16 h-16 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p class="text-base font-medium">Image failed to load</p>
                                          </div>
                                        `;
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          }
                          
                          // Non-image files
                          return (
                              <div
                                key={attachment.attachmentId}
                                className="bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl p-4 hover:bg-gray-100 hover:border-primary-300 transition-all shadow-sm"
                              >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* File Icon */}
                                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-bold text-gray-900 truncate">{attachment.fileName}</p>
                                    <p className="text-sm text-gray-500 font-medium">{formatFileSize(attachment.fileSize || 0)}</p>
                                  </div>
                                </div>
                                {/* Download Button */}
                                {filePath && (
                                  <a
                                    href={filePath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 ml-3 px-4 py-2.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-medium border border-primary-200 flex items-center gap-2"
                                    title="Open file"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Open
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : null}

            {/* Feedback Input */}
            {showFeedbackInput && onApprove && onReject && action && (
              <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl shadow-lg p-6 mt-6">
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
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm resize-none font-medium shadow-sm"
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
                      console.log('🔵 Confirm Rejection button clicked');
                      console.log('reviewFeedback:', reviewFeedback);
                      console.log('onReject exists:', !!onReject);
                      
                      if (reviewFeedback.trim() && onReject && selectedActionId) {
                        console.log('❌ Calling onReject with actionId:', selectedActionId, 'feedback:', reviewFeedback);
                        await onReject(selectedActionId, reviewFeedback);
                        console.log('🔄 Reloading action details in modal...');
                        await loadAction();
                        console.log('✅ Action reloaded in modal');
                        setShowFeedbackInput(false);
                        setReviewFeedback('');
                      } else {
                        console.log('⚠️ No action taken - feedback required for rejection');
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
            
            console.log('🔍 [Footer Buttons Check - DETAILED]', {
              '1_showReviewButtons': showReviewButtons,
              '2_onApprove_exists': !!onApprove,
              '3_onReject_exists': !!onReject,
              '4_hasAction': !!action,
              '5_showFeedbackInput': showFeedbackInput,
              '6_action_status_raw': action?.status,
              '7_action_status_lower': action?.status?.toLowerCase(),
              '8_expectedStatus': expectedStatus,
              '9_expectedStatus_lower': expectedStatus?.toLowerCase(),
              '10_statusMatches': statusMatches,
              '11_FINAL_shouldShowButtons': shouldShowButtons,
              'ALL_CONDITIONS': {
                showReviewButtons,
                hasCallbacks: !!(onApprove && onReject),
                hasAction: !!action,
                showFeedbackInput,
                statusMatches
              }
            });
            
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
                  className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg border-2 border-rose-600/30"
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
                    console.log('✅ [Footer] Approve button clicked - Direct approval for action:', {
                      selectedActionId,
                      currentActionId: action?.actionId,
                      currentStatus: action?.status
                    });
                    if (onApprove && selectedActionId) {
                      console.log('✅ Calling onApprove directly without feedback');
                      await onApprove(selectedActionId, '');
                      console.log('🔄 Reloading action details in modal...');
                      await loadAction();
                      console.log('✅ Action reloaded in modal');
                    }
                  }}
                  disabled={isProcessing}
                  className="px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg border-2 border-green-600/30"
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
  );
};

export default ActionDetailModal;

