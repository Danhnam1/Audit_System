import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { getCriteriaForAudit } from '../../../../api/auditCriteriaMap';
import { getUserFriendlyErrorMessage } from '../../../../utils/errorMessages';
import { getAuditCriterionById } from '../../../../api/auditCriteria';
import { getAuditSchedules } from '../../../../api/auditSchedule';
import { getAuditorsByAuditId } from '../../../../api/auditTeam';
import { unwrap } from '../../../../utils/normalize';
import { useAuth } from '../../../../contexts';
import { Button } from '../../../../components';

// Badge variant type matching the constants definition
type BadgeVariant = 'primary-light' | 'primary-medium' | 'primary-dark' | 'primary-solid' | 'gray-light' | 'gray-medium';

interface PlanDetailsModalProps {
  showModal: boolean;
  selectedPlanDetails: any;
  // List of checklist templates attached to this audit (via AuditChecklistTemplateMaps)
  templatesForPlan?: Array<{
    templateId?: string | number;
    id?: string | number;
    $id?: string | number;
    name?: string;
    title?: string;
    version?: string;
    description?: string;
    deptId?: number | string | null;
  }>;
  onClose: () => void;
  onEdit?: (auditId: string) => void;
  onDelete?: (auditId: string) => Promise<void>;
  onSubmitToLead?: (auditId: string) => Promise<void>;
  // Optional callbacks for Lead Auditor actions
  onForwardToDirector?: (auditId: string, comment?: string) => Promise<void>;
  onRejectPlan?: (auditId: string, comment?: string) => Promise<void>;
  onRequestRevision?: (auditId: string, comment?: string) => Promise<void>;
  // Optional callback for Director approval
  onApprove?: (auditId: string, comment?: string) => Promise<void>;
  // Optional custom text for approve button
  approveButtonText?: string;
  // kept for interface backward-compatibility (no longer used)
  getCriterionName: (criterionId: string) => string;
  getDepartmentName: (deptId: string | number) => string;
  getStatusColor: (status: string) => string;
  getBadgeVariant: (variant: BadgeVariant) => string;
  getAuditTypeBadgeColor?: (auditType: string, variant?: 'default' | 'light') => string;
  ownerOptions: any[];
  auditorOptions?: any[];
  getTemplateName?: (templateId: string | number | null | undefined) => string;
  // Optional function to get full template info (name, version, description)
  getTemplateInfo?: (templateId: string | number | null | undefined) => { name?: string; version?: string; description?: string } | null;
  // Optional prop to hide specific sections
  hideSections?: string[];
  // Optional prop to check if current user is Lead Auditor of THIS specific plan
  currentUserId?: string | null;
  // Optional prop to pass audit teams for this specific plan
  auditTeamsForPlan?: any[];
}

export const PlanDetailsModal: React.FC<PlanDetailsModalProps> = ({
  showModal,
  selectedPlanDetails,
  templatesForPlan = [],
  onClose,
  onEdit: _onEdit,
  onDelete,
  onSubmitToLead,
  onForwardToDirector,
  onRejectPlan,
  onRequestRevision,
  onApprove,
  approveButtonText = 'Approve',
  getCriterionName: _getCriterionName,
  getDepartmentName,
  getStatusColor,
  getBadgeVariant,
  getAuditTypeBadgeColor,
  ownerOptions,
  auditorOptions = [],
  getTemplateName,
  getTemplateInfo,
  hideSections = [],
  currentUserId = null,
  auditTeamsForPlan = [],
}) => {
  const { user } = useAuth();
  
  // Reset processing states when modal closes
  useEffect(() => {
    if (!showModal) {
      setIsProcessingForward(false);
      setIsProcessingReject(false);
      setIsProcessingApprove(false);
      setIsProcessingSubmit(false);
    }
  }, [showModal]);
  
  if (!showModal || !selectedPlanDetails) return null;

  // Check if current user is Lead Auditor of THIS specific plan
  // const isLeadAuditor = React.useMemo(() => {
  //   if (!currentUserId || !auditTeamsForPlan.length) return false;
    
  //   const currentAuditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
  //   if (!currentAuditId) return false;
    
  //   // Check if user has isLead: true in THIS plan's audit team
  //   const isLead = auditTeamsForPlan.some((m: any) => {
  //     const teamAuditId = String(m?.auditId || '').trim();
  //     const teamUserId = String(m?.userId || '').trim();
  //     const userIdMatch = teamUserId === String(currentUserId).trim() || 
  //                        teamUserId.toLowerCase() === String(currentUserId).trim().toLowerCase();
  //     const auditIdMatch = teamAuditId === String(currentAuditId).trim() ||
  //                         teamAuditId.toLowerCase() === String(currentAuditId).trim().toLowerCase();
  //     const isLeadMatch = m?.isLead === true;
  //     return userIdMatch && auditIdMatch && isLeadMatch;
  //   });
    
  //   return isLead;
  // }, [currentUserId, auditTeamsForPlan, selectedPlanDetails.auditId, selectedPlanDetails.id]);

  // Check if current user is the plan creator
  const isCreator = React.useMemo(() => {
    if (!selectedPlanDetails) {
      return false;
    }
    
    const planCreatedBy = selectedPlanDetails.createdBy || selectedPlanDetails.createdByUser?.userId;
    const planCreatedByEmail = selectedPlanDetails.createdByUser?.email;
    
    if (!planCreatedBy && !planCreatedByEmail) {
      return false;
    }
    
    // Priority 1: Match by email (most reliable, works even if userId formats differ)
    if (user?.email && planCreatedByEmail) {
      const currentUserEmail = String(user.email).toLowerCase().trim();
      const createdByEmail = String(planCreatedByEmail).toLowerCase().trim();
      if (currentUserEmail && createdByEmail && currentUserEmail === createdByEmail) {
        return true;
      }
    }
    
    // Priority 2: Direct userId match (if currentUserId is provided)
    if (currentUserId && planCreatedBy) {
      const normalizedCurrentUserId = String(currentUserId).toLowerCase().trim();
      const normalizedCreatedBy = String(planCreatedBy).toLowerCase().trim();
      if (normalizedCurrentUserId === normalizedCreatedBy) {
        return true;
      }
    }
    
    // Priority 3: Match via auditorOptions/ownerOptions by userId
    if (currentUserId) {
      const allUsersForLookup = [...(auditorOptions || []), ...(ownerOptions || [])];
      const currentUserInList = allUsersForLookup.find((u: any) => {
        const uId = String(u?.userId || '').toLowerCase().trim();
        return uId === String(currentUserId).toLowerCase().trim();
      });
      
      if (currentUserInList) {
        // Match by email if available
        if (currentUserInList.email && planCreatedByEmail) {
          const currentUserEmail = String(currentUserInList.email || '').toLowerCase().trim();
          const createdByEmail = String(planCreatedByEmail).toLowerCase().trim();
          if (currentUserEmail && createdByEmail && currentUserEmail === createdByEmail) {
            return true;
          }
        }
        
        // Match by userId
        if (planCreatedBy) {
          const currentUserListId = String(currentUserInList.userId || '').toLowerCase().trim();
          const normalizedCreatedBy = String(planCreatedBy).toLowerCase().trim();
          if (currentUserListId === normalizedCreatedBy) {
            return true;
          }
        }
      }
    }
    return false;
  }, [currentUserId, selectedPlanDetails, auditorOptions, ownerOptions, user?.email]);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRejectionReasonModal, setShowRejectionReasonModal] = useState(false);
  const [reviewComments, setReviewComments] = useState(''); // Review comments for actions
  
  // Processing states to prevent double-click
  const [isProcessingForward, setIsProcessingForward] = useState(false);
  const [isProcessingReject, setIsProcessingReject] = useState(false);
  const [isProcessingApprove, setIsProcessingApprove] = useState(false);
  const [isProcessingSubmit, setIsProcessingSubmit] = useState(false);
  
  // Shared standards for this audit
  const [sharedCriteria, setSharedCriteria] = useState<any[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  
  // State for schedules and teams to allow refresh
  const [refreshedSchedules, setRefreshedSchedules] = useState<any[]>([]);
  const [refreshedTeams, setRefreshedTeams] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasLoadedRefreshedData, setHasLoadedRefreshedData] = useState(false);
  
  // Modal states (if not already declared)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Load shared criteria when modal opens
  useEffect(() => {
    const loadSharedCriteria = async () => {
      if (!showModal || !selectedPlanDetails) {
        setSharedCriteria([]);
        return;
      }

      const auditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
      if (!auditId) {
        setSharedCriteria([]);
        return;
      }

      setLoadingCriteria(true);
      try {
        // Call GET /api/AuditCriteriaMap/audit/{auditId}
        const criteriaMapResponse = await getCriteriaForAudit(String(auditId));
        const criteriaList = unwrap(criteriaMapResponse);
        
        if (!Array.isArray(criteriaList) || criteriaList.length === 0) {
          setSharedCriteria([]);
          return;
        }

        // Fetch detailed information for each criterion
        const criteriaDetails = await Promise.allSettled(
          criteriaList.map(async (item: any) => {
            try {
              const criteriaId = item.criteriaId || item.id || item;
              const response = await getAuditCriterionById(criteriaId);
              const detail = response || {};
              return {
                criteriaId: detail.criteriaId || criteriaId,
                name: detail.name || 'N/A',
                description: detail.description || '',
                referenceCode: detail.referenceCode || '',
                status: item.status || detail.status || 'Active',
              };
            } catch (err) {
              console.error('Failed to load criterion detail:', err);
              return {
                criteriaId: item.criteriaId || item.id || item,
                name: item.name || 'N/A',
                description: item.description || '',
                referenceCode: item.referenceCode || '',
                status: item.status || 'Active',
              };
            }
          })
        );

        const validCriteria = criteriaDetails
          .filter((result) => result.status === 'fulfilled')
          .map((result) => (result as PromiseFulfilledResult<any>).value);

        setSharedCriteria(validCriteria);
      } catch (error) {
        console.error('Failed to load shared criteria:', error);
        setSharedCriteria([]);
      } finally {
        setLoadingCriteria(false);
      }
    };

    loadSharedCriteria();
  }, [showModal, selectedPlanDetails]);

  // Reload schedules and teams when modal opens or refreshKey changes
  useEffect(() => {
    const reloadSchedulesAndTeams = async () => {
      if (!showModal || !selectedPlanDetails) {
        setRefreshedSchedules([]);
        setRefreshedTeams([]);
        setHasLoadedRefreshedData(false);
        return;
      }

      const auditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
      if (!auditId) {
        setRefreshedSchedules([]);
        setRefreshedTeams([]);
        setHasLoadedRefreshedData(false);
        return;
      }

      try {
        const [schedulesRes, teamsRes] = await Promise.all([
          getAuditSchedules(String(auditId)),
          getAuditorsByAuditId(String(auditId)),
        ]);

        const schedules = unwrap(schedulesRes) || [];
        const teams = unwrap(teamsRes) || [];

        const schedulesArray = Array.isArray(schedules) ? schedules : [];
        const teamsArray = Array.isArray(teams) ? teams : [];

     
        
        // Force state update to trigger re-render by creating new array references
        setRefreshedSchedules([...schedulesArray]); // Create new array reference
        setRefreshedTeams([...teamsArray]); // Create new array reference
        setHasLoadedRefreshedData(true); // Mark that we've loaded refreshed data
        
      } catch (error) {
        console.error('PlanDetailsModal: Failed to reload schedules and teams:', error);
        // Fallback to original data
        setRefreshedSchedules([]);
        setRefreshedTeams([]);
        setHasLoadedRefreshedData(false);
      }
    };

    // Always reload when modal opens or refreshKey changes
    reloadSchedulesAndTeams();
  }, [showModal, selectedPlanDetails?.auditId, selectedPlanDetails?.id, refreshKey]);

  // Poll for changes when modal is open (fallback mechanism)
  useEffect(() => {
    if (!showModal) {
      return;
    }
    
    const auditId = selectedPlanDetails?.auditId || selectedPlanDetails?.id;
    if (!auditId) {
      return;
    }


    // Check localStorage periodically for updates
    const checkForUpdates = () => {
      try {
        const stored = localStorage.getItem('auditPlanUpdated');
        if (stored) {
          const data = JSON.parse(stored);
          const updatedAuditId = data.auditId;
          const timestamp = data._timestamp || data.timestamp;
          const now = Date.now();
          const age = timestamp ? (now - timestamp) : Infinity;
          
          // Only refresh if timestamp is recent (within last 30 seconds - increased window)
          const isRecent = timestamp && age < 30000;
          const matches = updatedAuditId && String(updatedAuditId).toLowerCase().trim() === String(auditId).toLowerCase().trim();
          
      
          if (isRecent && matches) {
            // Clear localStorage to prevent duplicate refreshes
            localStorage.removeItem('auditPlanUpdated');
            setRefreshKey(prev => {
              const newKey = prev + 1;
              setHasLoadedRefreshedData(false);
              return newKey;
            });
          }
        } else {
        }
      } catch (err) {
      }
    };

    // Check immediately and then every 2 seconds
    checkForUpdates();
    const interval = setInterval(checkForUpdates, 2000);

    return () => {
      clearInterval(interval);
    };
  }, [showModal, selectedPlanDetails?.auditId, selectedPlanDetails?.id]);

  // Listen for custom events to trigger refresh (when update happens in same tab)
  useEffect(() => {
    if (!showModal) return;

    const auditId = selectedPlanDetails?.auditId || selectedPlanDetails?.id;
    
    const handleRefresh = () => {
      setRefreshKey(prev => {
        const newKey = prev + 1;
        setHasLoadedRefreshedData(false);
        return newKey;
      });
    };

    const handleAuditPlanUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const updatedAuditId = customEvent.detail?.auditId;
      
    
      
      // Compare with case-insensitive string comparison
      if (updatedAuditId && String(updatedAuditId).toLowerCase().trim() === String(auditId).toLowerCase().trim()) {
        handleRefresh();
      } else {
     
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'auditPlanUpdated' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          const updatedAuditId = data.auditId;
      
          
          if (updatedAuditId && String(updatedAuditId).toLowerCase().trim() === String(auditId).toLowerCase().trim()) {
            handleRefresh();
          }
        } catch (err) {
          console.warn('PlanDetailsModal: Failed to parse storage event:', err);
        }
      }
    };

    // Listen for custom event on both window and document
    window.addEventListener('auditPlanUpdated', handleAuditPlanUpdate, true);
    document.addEventListener('auditPlanUpdated', handleAuditPlanUpdate, true);
    window.addEventListener('storage', handleStorageEvent);
    
    
    return () => {
      window.removeEventListener('auditPlanUpdated', handleAuditPlanUpdate, true);
      document.removeEventListener('auditPlanUpdated', handleAuditPlanUpdate, true);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [showModal, selectedPlanDetails?.auditId, selectedPlanDetails?.id]);

  // Always use refreshed data if we've loaded it, otherwise fallback to original prop data
  // Use useMemo to ensure re-computation when dependencies change
  const schedulesToDisplay = useMemo(() => {
    const result = hasLoadedRefreshedData
      ? refreshedSchedules 
      : (selectedPlanDetails.schedules?.values || []);

    return result;
  }, [hasLoadedRefreshedData, refreshedSchedules, refreshKey, selectedPlanDetails.schedules?.values]);

  // Build a list of audit team members to render. Filter out AuditeeOwner immediately.
  const auditTeamsFromDetails: any[] = useMemo(() => {
    const result = hasLoadedRefreshedData
      ? refreshedTeams.filter((m: any) => {
          const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
          return role !== 'auditeeowner';
        })
      : (Array.isArray(selectedPlanDetails.auditTeams?.values)
    ? selectedPlanDetails.auditTeams.values.filter((m: any) => {
        const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
        return role !== 'auditeeowner';
      })
          : []);
   
    return result;
  }, [hasLoadedRefreshedData, refreshedTeams, refreshKey, selectedPlanDetails.auditTeams?.values]);
 


  // Build user lookup map from auditorOptions and ownerOptions
  const allUsers = [...(auditorOptions || []), ...(ownerOptions || [])];
  const userMap = new Map<string, any>();
  
  allUsers.forEach((u: any) => {
    // Get all possible ID fields
    const possibleIds = [
      u.userId,
      u.id,
      u.$id,
    ].filter(id => id !== undefined && id !== null && id !== '');
    
    // Index by all possible ID formats (string, lowercase, number)
    possibleIds.forEach((id: any) => {
      const idStr = String(id);
      // Store with lowercase key
      userMap.set(idStr.toLowerCase(), u);
      // Also store with original case (in case of exact match needed)
      userMap.set(idStr, u);
      // Try as number if it's a valid number string
      if (!isNaN(Number(idStr)) && idStr.trim() !== '') {
        userMap.set(String(Number(idStr)), u);
      }
    });
    
    // Also index by email for fallback lookup
    if (u.email) {
      const emailStr = String(u.email);
      userMap.set(emailStr.toLowerCase(), u);
      userMap.set(emailStr, u);
    }
  });

  // Enrich audit team members with fullName from userMap
  const enrichedAuditTeam = auditTeamsFromDetails.map((member: any) => {
    const userId = member.userId || member.id || member.$id;
    const userIdStr = userId ? String(userId).trim() : '';
    
    // Try multiple lookup strategies
    let user = null;
    if (userIdStr) {
      // Try exact match (case-insensitive first, then original case)
      user = userMap.get(userIdStr.toLowerCase()) || userMap.get(userIdStr);
      
      // If still not found, try with the original userId value (in case it's a different type)
      if (!user && userId) {
        const originalStr = String(userId).trim();
        user = userMap.get(originalStr.toLowerCase()) || userMap.get(originalStr);
      }
      
      // Try as number if it's a valid number string
      if (!user && !isNaN(Number(userIdStr)) && userIdStr !== '') {
        user = userMap.get(String(Number(userIdStr)));
      }
    }
    
    // Fallback to email lookup
    if (!user && member.email) {
      const emailStr = String(member.email).trim();
      user = userMap.get(emailStr.toLowerCase()) || userMap.get(emailStr);
    }
    
    // Use found user's fullName, or keep existing fullName, or fallback to User ID
    const fullName = member.fullName || user?.fullName || user?.name;
    // Get avatar URL from user data
    const avatarUrl = member.avatarUrl || user?.avatarUrl || user?.avatar || null;
  
    
    return {
      ...member,
      fullName: fullName || (userIdStr ? `User ID: ${userIdStr}` : 'Unknown User'),
      email: member.email || user?.email,
      avatarUrl: avatarUrl,
    };
  });

  // Only include team members that are NOT AuditeeOwner
  // Filter out AuditeeOwner from enrichedAuditTeam and don't include missingOwners
  const combinedAuditTeam = enrichedAuditTeam.filter((m: any) => {
    const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
    return role !== 'auditeeowner';
  });

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] overflow-hidden">
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header with gradient */}
        <div className="sticky top-0 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-8 py-6  shadow-lg">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="text-2xl font-bold text-white">Audit Plan Details</h3>
                
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 rounded-lg p-2 transition-all duration-200"
              title="Close"
            >
              
            </button>
          </div>
        </div>

        {/* Content area with scroll */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
          <div className="p-8 space-y-6">
          {/* Basic Information Section */}
          <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
                
                <h3 className="text-lg font-bold text-primary-700">Basic Information</h3>
              </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">Title:</span>
                <span className="text-sm text-black font-normal">{selectedPlanDetails.title}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">Type:</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-normal ${getAuditTypeBadgeColor ? getAuditTypeBadgeColor(selectedPlanDetails.type || '', 'default') : getBadgeVariant('primary-light')}`}>
                  {selectedPlanDetails.type}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">Start Date:</span>
                <span className="text-sm text-black font-normal">
                  {selectedPlanDetails.startDate
                    ? new Date(selectedPlanDetails.startDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
              {!hideSections.includes('status') && (
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Status:</span>
                  {(() => {
                    const planStatus = String(selectedPlanDetails.status || '').toLowerCase().replace(/\s+/g, '');
                    const isRejected = (planStatus === 'rejected' || planStatus === 'declined') && selectedPlanDetails.latestRejectionComment;
                    
                    if (isRejected) {
                      return (
                        <button
                          onClick={() => setShowRejectionReasonModal(true)}
                          className={`text-xs px-3 py-1 rounded-full font-semibold cursor-pointer hover:opacity-80 transition-opacity ${getStatusColor(
                            selectedPlanDetails.status
                          )}`}
                          title="Click to view rejection reason"
                        >
                          {selectedPlanDetails.status}
                        </button>
                      );
                    }
                    
                    return (
                      <span
                        className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusColor(
                          selectedPlanDetails.status
                        )}`}
                      >
                        {selectedPlanDetails.status}
                      </span>
                    );
                  })()}
                </div>
              )}
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">End Date:</span>
                <span className="text-sm text-black font-normal">
                  {selectedPlanDetails.endDate
                    ? new Date(selectedPlanDetails.endDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'N/A'}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-sm font-bold text-black min-w-[100px]">Scope:</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-normal ${getBadgeVariant('primary-medium')}`}>
                  {selectedPlanDetails.scope || 'N/A'}
                </span>
              </div>
              {selectedPlanDetails.templateId && templatesForPlan.length === 0 && (
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-bold text-black min-w-[100px]">Template:</span>
                    <span className="text-sm text-black font-normal">
                      {getTemplateName
                        ? getTemplateName(selectedPlanDetails.templateId)
                        : String(selectedPlanDetails.templateId)}
                    </span>
                  </div>
                  {(() => {
                    const templateInfo = getTemplateInfo?.(selectedPlanDetails.templateId);
                    return (
                      <>
                        {templateInfo?.version && (
                          <div className="flex items-start gap-3">
                            <span className="text-sm font-bold text-black min-w-[100px]">Version:</span>
                            <span className="text-sm text-black font-normal">{templateInfo.version}</span>
                          </div>
                        )}
                        {templateInfo?.description && (
                          <div className="flex items-start gap-3">
                            <span className="text-sm font-bold text-black min-w-[100px]">Description:</span>
                            <span className="text-sm text-black font-normal flex-1">{templateInfo.description}</span>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              <div className="flex items-start gap-3 md:col-span-2">
                <span className="text-sm font-bold text-black min-w-[100px]">Objective:</span>
                <span className="text-sm text-black font-normal flex-1 leading-relaxed">
                  {selectedPlanDetails.objective || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Checklist Templates Section (supports multi-select mappings) */}
          {templatesForPlan.length > 0 && !hideSections.includes('templates') && (
            <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-primary-700">Checklist Templates</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templatesForPlan.map((tpl: any, index: number) => {
                  const effectiveId = tpl.templateId ?? tpl.id ?? tpl.$id ?? index;
                  // Try to get full template info if available
                  const fullTemplateInfo = getTemplateInfo?.(tpl.templateId || tpl.id);
                  const displayName =
                    tpl.title || tpl.name || fullTemplateInfo?.name || getTemplateName?.(tpl.templateId || tpl.id) || `Template ${index + 1}`;
                  // Use version and description from template, fallback to fullTemplateInfo if available
                  const version = tpl.version || fullTemplateInfo?.version;
                  const description = tpl.description || fullTemplateInfo?.description;
                  const deptId = tpl.deptId;
                  const deptName = deptId != null ? getDepartmentName(String(deptId)) : null;

                  return (
                    <div
                      key={String(effectiveId)}
                      className="border border-gray-200 rounded-xl p-4 shadow-sm bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-gray-900 flex-1 line-clamp-2">
                          {displayName}
                        </h4>
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-semibold">
                          {index + 1}
                        </span>
                      </div>

                      <div className="space-y-1 mb-2">
                        <div className="text-xs text-gray-600">
                          <span className="font-semibold">Version:</span>{' '}
                          <span>{version || 'N/A'}</span>
                        </div>
                        {deptName && (
                          <div className="text-xs text-gray-600">
                            <span className="font-semibold">Department:</span>{' '}
                            <span>{deptName}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-gray-600">
                        <span className="font-semibold">Description:</span>
                        <p className="mt-1 text-gray-700 line-clamp-3">{description || 'No description available'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Created By Section */}
          {selectedPlanDetails.createdByUser && (
            <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
                
                <h3 className="text-lg font-bold text-primary-700">Created By</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Name:</span>
                  <span className="text-sm text-black font-normal">
                    {selectedPlanDetails.createdByUser.fullName}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Email:</span>
                  <span className="text-sm text-black font-normal">
                    {selectedPlanDetails.createdByUser.email}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Role:</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-normal ${getBadgeVariant('primary-light')}`}>
                    {selectedPlanDetails.createdByUser.roleName}
                  </span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-sm font-bold text-black min-w-[100px]">Created At:</span>
                  <span className="text-sm text-black font-normal">
                    {new Date(selectedPlanDetails.createdAt).toLocaleString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Scope Departments */}
          {!hideSections.includes('scopeDepartments') && selectedPlanDetails.scopeDepartments?.values?.length > 0 && (
            <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-200">
                
                <h3 className="text-lg font-bold text-gray-900">Departments</h3>
                <span className="ml-auto text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {selectedPlanDetails.scopeDepartments.values.length} dept{selectedPlanDetails.scopeDepartments.values.length > 1 ? 's' : ''}
                </span>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {selectedPlanDetails.scopeDepartments.values.map((dept: any, idx: number) => {
                const deptName = dept.deptName || getDepartmentName(dept.deptId);
                const deptId = Number(dept.deptId);
                const deptHead = ownerOptions.find(
                  (owner: any) => String(owner.deptId) === String(dept.deptId)
                );
                
                const sensitiveAreasByDept = (selectedPlanDetails as any).sensitiveAreasByDept || {};
                const deptSensitiveAreas = deptId ? (sensitiveAreasByDept[deptId] || []) : [];
                const hasSensitiveAreas = deptSensitiveAreas.length > 0;

                return (
                  <div
                    key={idx}
                    className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
                      hasSensitiveAreas 
                        ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white' 
                        : 'border-gray-100 bg-gradient-to-br from-gray-50 to-white hover:border-primary-200'
                    }`}
                  >
                    {/* Top accent bar */}
                    <div className={`h-1 ${hasSensitiveAreas ? 'bg-amber-400' : 'bg-primary-500'}`}></div>
                    
                    <div className="p-5">
                      {/* Department name and badge */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <h4 className="text-base font-bold text-gray-900 leading-tight">{deptName}</h4>
                        {hasSensitiveAreas && (
                          <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-700">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            Sensitive
                          </span>
                        )}
                      </div>
                      
                      {/* Department Head */}
                      {deptHead && (
                        <div className="flex items-center gap-2 mb-3 p-2 bg-white rounded-lg border border-gray-100">
                          <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-primary-700">
                              {deptHead.fullName?.charAt(0)?.toUpperCase() || 'H'}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500 leading-none">Department Head</p>
                            <p className="text-sm font-medium text-gray-900 truncate">{deptHead.fullName}</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Sensitive Areas */}
                      {hasSensitiveAreas && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sensitive Areas</p>
                          <div className="flex flex-wrap gap-1.5">
                            {deptSensitiveAreas.map((area: string, areaIdx: number) => (
                              <span
                                key={areaIdx}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200"
                              >
                                🔒 {area}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          )}

          {/* Standards Section */}
          {!hideSections.includes('standards') && (
            <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900">Standards</h3>
                {!loadingCriteria && sharedCriteria.length > 0 && (
                  <span className="ml-auto text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {sharedCriteria.length} standard{sharedCriteria.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              
              {loadingCriteria ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600"></div>
                  <span className="ml-4 text-gray-500 text-sm">Loading standards...</span>
                </div>
              ) : sharedCriteria.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500">No standards assigned to this audit.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sharedCriteria.map((criterion: any, idx: number) => {
                    const displayName = criterion.name || criterion.referenceCode || `Criterion ${idx + 1}`;
                    return (
                      <div
                        key={criterion.criteriaId || idx}
                        className="group flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-white rounded-xl px-4 py-3.5 border border-emerald-100 hover:border-emerald-300 hover:shadow-sm transition-all duration-200"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <span className="text-sm text-gray-800 font-medium leading-snug">{displayName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Audit Team Section */}
          {!hideSections.includes('auditTeam') && combinedAuditTeam.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
                <h3 className="text-lg font-bold text-primary-700">Team & Responsibilities</h3>
              </div>
              
              {/* Lead Of The Team */}
              {(() => {
                // Helper function to enrich member with user data
                const enrichMember = (member: any): any => {
                  if (!member) return null;
                  const userId = member.userId || member.id || member.$id;
                  const userIdStr = userId ? String(userId).trim() : '';
                  let user = null;
                  if (userIdStr) {
                    // Try multiple lookup strategies
                    user = userMap.get(userIdStr.toLowerCase()) || userMap.get(userIdStr);
                    // If still not found, try as number
                    if (!user && !isNaN(Number(userIdStr)) && userIdStr !== '') {
                      user = userMap.get(String(Number(userIdStr)));
                    }
                  }
                  // Fallback to email lookup
                  if (!user && member.email) {
                    const emailStr = String(member.email).trim();
                    user = userMap.get(emailStr.toLowerCase()) || userMap.get(emailStr);
                  }
                  if (user) {
                    return {
                      ...member,
                      fullName: member.fullName || user.fullName || user.name,
                      email: member.email || user.email,
                      avatarUrl: member.avatarUrl || user.avatarUrl || user.avatar || null,
                    };
                  }
                  return member;
                };
                
                // Helper function to check if member is lead
                const isLeadMember = (m: any): boolean => {
                  return m.isLead === true || 
                         m.isLeadAuditor === true ||
                         String(m.isLead || '').toLowerCase() === 'true' ||
                         String(m.isLeadAuditor || '').toLowerCase() === 'true';
                };
                
                // Priority 1: Try to find from auditTeamsForPlan (already filtered by auditId, so no need to match again)
                let leadMember = null;
                if (auditTeamsForPlan.length > 0) {
                  leadMember = auditTeamsForPlan.find(isLeadMember);
                  if (leadMember) {
                    leadMember = enrichMember(leadMember);
                  }
                }
                
                // Priority 2: Try from refreshedTeams (most up-to-date data from API)
                if (!leadMember && hasLoadedRefreshedData && refreshedTeams.length > 0) {
                  const filteredRefreshedTeams = refreshedTeams.filter((m: any) => {
                    const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
                    return role !== 'auditeeowner';
                  });
                  leadMember = filteredRefreshedTeams.find(isLeadMember);
                  if (leadMember) {
                    leadMember = enrichMember(leadMember);
                  }
                }
                
                // Priority 3: If not found, try from combinedAuditTeam (already enriched)
                if (!leadMember) {
                  leadMember = combinedAuditTeam.find(isLeadMember);
                }
                
                // Priority 4: If still not found, try from auditTeamsFromDetails (before enrichment)
                if (!leadMember && auditTeamsFromDetails.length > 0) {
                  leadMember = auditTeamsFromDetails.find(isLeadMember);
                  if (leadMember) {
                    leadMember = enrichMember(leadMember);
                  }
                }
                
                if (!leadMember) return null;
                
                return (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lead Of The Team
                    </label>
                    <div className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50">
                      <div className="flex items-center gap-3">
                        {leadMember.avatarUrl ? (
                          <img
                            src={leadMember.avatarUrl}
                            alt={leadMember.fullName || 'Lead Auditor'}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-300"
                            onError={(e) => {
                              // Fallback to initial if image fails to load
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLImageElement).parentElement;
                              if (parent) {
                                const fallback = parent.querySelector('.avatar-fallback');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div className={`w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 ${leadMember.avatarUrl ? 'hidden avatar-fallback' : ''}`}>
                          <span className="text-xs font-bold text-white">
                            {leadMember.fullName?.charAt(0)?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-semibold text-gray-900">
                            {leadMember.fullName || 'Unknown User'}
                          </span>
                          {leadMember.email && (
                            <span className="text-sm text-gray-600 ml-2">
                              ({leadMember.email})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Auditors */}
              {(() => {
                const auditors = combinedAuditTeam.filter((m: any) => !m.isLead);
                if (auditors.length === 0) return null;
                
                return (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Auditors <span className="text-red-500">*</span>
                    </label>
                    <div className="space-y-2">
                      {auditors.map((member: any, idx: number) => {
                        const memberKey = member.auditTeamId || member.id || member.userId || `member-${idx}`;
                        const uniqueKey = `${memberKey}-${refreshKey}`;
                        
                        return (
                          <div
                            key={uniqueKey}
                            className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-gray-200 bg-white"
                          >
                            {member.avatarUrl ? (
                              <img
                                src={member.avatarUrl}
                                alt={member.fullName || 'Auditor'}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-300"
                                onError={(e) => {
                                  // Fallback to initial if image fails to load
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  const parent = (e.target as HTMLImageElement).parentElement;
                                  if (parent) {
                                    const fallback = parent.querySelector('.avatar-fallback');
                                    if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div className={`w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 ${member.avatarUrl ? 'hidden avatar-fallback' : ''}`}>
                              <span className="text-xs font-bold text-gray-700">
                                {member.fullName?.charAt(0)?.toUpperCase() || 'U'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-normal text-gray-800">
                                  {member.fullName}
                                </span>
                                {member.email && (
                                  <span className="text-sm text-gray-600">
                                    ({member.email})
                                  </span>
                                )}
                                {member.roleInTeam && (() => {
                                  const role = String(member.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
                                  if (role === 'auditeeowner') return null;
                                  return (
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getBadgeVariant('primary-light')}`}>
                                      {member.roleInTeam}
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Schedule & Milestones Section */}
          {schedulesToDisplay.length > 0 && (
            <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
                <h3 className="text-lg font-bold">Schedule & Milestones</h3>
              </div>
              
              {/* Schedule List - Vertical Layout */}
              <div className="space-y-3">
                {(() => {
                  // Sort schedules by dueDate ascending
                  const scheduleValues = [...schedulesToDisplay].sort((a: any, b: any) => {
                    const ta = a?.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
                    const tb = b?.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
                    return ta - tb;
                  });

                  return scheduleValues.map((schedule: any, idx: number) => {
                    const hasDate = !!schedule.dueDate;
                    const milestoneName = schedule.milestoneName || schedule.name || `Milestone ${idx + 1}`;
                    const scheduleKey = schedule.scheduleId || schedule.id || `schedule-${idx}`;
                    // Add refreshKey to key to force re-render when data updates
                    const uniqueKey = `${scheduleKey}-${refreshKey}`;
                    
                    return (
                      <div
                        key={uniqueKey}
                        className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all"
                      >
                        {/* Marker dot */}
                        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                          hasDate 
                            ? 'bg-primary-600 border-white shadow-md' 
                            : 'bg-gray-300 border-gray-400'
                        }`}></div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${
                            hasDate ? 'text-gray-900' : 'text-gray-400'
                          }`}>
                            {milestoneName}
                          </div>
                          {hasDate && (
                            <div className="mt-1 text-xs text-gray-500">
                              {new Date(schedule.dueDate).toLocaleDateString('en-US', { 
                                year: 'numeric',
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </div>
                          )}
                          {!hasDate && (
                            <div className="mt-1 text-xs text-gray-400 italic">
                              Not set
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
          </div>
        </div>

        

        {/* Footer with actions */}
        <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-white px-8 py-5  shadow-lg">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>

            {onForwardToDirector && (
              <Button
                onClick={() => setShowForwardModal(true)}
                variant="primary"
                size="md"
              >
                Submit to Director
              </Button>
            )}

            {onRequestRevision && (
              <button
                onClick={async () => {
                  if (isProcessingSubmit) return;
                  setIsProcessingSubmit(true);
                  try {
                    await onRequestRevision(selectedPlanDetails.auditId, reviewComments);
                    onClose();
                  } catch (err) {
                    console.error('Request revision failed', err);
                    toast.error('Failed to request revision. Please try again.');
                  } finally {
                    setIsProcessingSubmit(false);
                  }
                }}
                disabled={isProcessingSubmit}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingSubmit ? 'Processing...' : 'Request Revision'}
              </button>
            )}

            {onRejectPlan && (
              <Button
                onClick={() => {
                  setReviewComments('');
                  setShowRejectModal(true);
                }}
                variant="danger"
                size="md"
              >
                Reject
              </Button>
            )}

            {onApprove && (
              <Button
                onClick={async () => {
                  if (isProcessingApprove) return;
                  setIsProcessingApprove(true);
                  try {
                    await onApprove(selectedPlanDetails.auditId, reviewComments);
                    onClose();
                  } catch (err) {
                    console.error('Approve failed', err);
                    alert('Failed to approve: ' + (err as any)?.message || String(err));
                  } finally {
                    setIsProcessingApprove(false);
                  }
                }}
                disabled={isProcessingApprove}
                variant="primary"
                size="md"
                isLoading={isProcessingApprove}
              >
                {isProcessingApprove ? 'Processing...' : approveButtonText}
              </Button>
            )}

            {/* If the plan is still Draft, allow submitting to Lead Auditor (only if current user is the plan creator) */}
            {(() => {
              const normalizedStatus = String(selectedPlanDetails.status || '').toLowerCase().trim();
              const isDraft = normalizedStatus === 'draft';
              return isDraft && isCreator;
            })() && (
              <div className="flex items-center gap-3">
                {onSubmitToLead && (
                  <button
                    onClick={() => setShowSubmitModal(true)}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-primary-600 hover:bg-primary-700 text-white"
                  >
                    Submit to Lead Auditor
                  </button>
                )}
              </div>
            )}

            
          </div>
        </div>
        </div>
      </div>
    </div>
  );

  // Submit Confirmation Modal
  const submitModalContent = showSubmitModal && createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setShowSubmitModal(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Confirm Submit
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Are you sure to submit this audit plan to Lead Auditor?
          </p>
          
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                if (!isProcessingSubmit) {
                  setShowSubmitModal(false);
                }
              }}
              disabled={isProcessingSubmit}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!onSubmitToLead || isProcessingSubmit) return;
                setIsProcessingSubmit(true);
                try {
                  await onSubmitToLead(selectedPlanDetails.auditId);
                  setShowSubmitModal(false);
                  onClose();
                } catch (err) {
                  console.error('Failed to submit to lead auditor', err);
                  toast.error(getUserFriendlyErrorMessage(err, 'Failed to submit to Lead Auditor. Please try again.'));
                } finally {
                  setIsProcessingSubmit(false);
                }
              }}
              disabled={isProcessingSubmit}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessingSubmit ? 'Processing...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // Delete Confirmation Modal
  const deleteModalContent = showDeleteModal && createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setShowDeleteModal(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Confirm Delete
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Are you sure you want to delete this audit plan? This action cannot be undone.
          </p>
          
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!onDelete) return;
                try {
                  await onDelete(selectedPlanDetails.auditId || selectedPlanDetails.id);
                  setShowDeleteModal(false);
                  onClose();
                } catch (err) {
                  console.error('Delete failed', err);
                  toast.error(getUserFriendlyErrorMessage(err, 'Failed to delete plan. Please try again.'));
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // Forward to Director Confirmation Modal
  const forwardModalContent = showForwardModal && createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setShowForwardModal(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Confirm Forward
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Are you sure to submit to Director?
          </p>
          
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              onClick={() => {
                if (!isProcessingForward) {
                  setShowForwardModal(false);
                }
              }}
              disabled={isProcessingForward}
              variant="secondary"
              size="md"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!onForwardToDirector || isProcessingForward) return;
                setIsProcessingForward(true);
                try {
                  await onForwardToDirector(selectedPlanDetails.auditId, reviewComments);
                  setShowForwardModal(false);
                  toast.success('Submit successfully.');
                  onClose();
                } catch (err) {
                  console.error('Forward to director failed', err);
                  toast.error(getUserFriendlyErrorMessage(err, 'Failed to forward to Director. Please try again.'));
                } finally {
                  setIsProcessingForward(false);
                }
              }}
              disabled={isProcessingForward}
              variant="primary"
              size="md"
              isLoading={isProcessingForward}
            >
              {isProcessingForward ? 'Processing...' : 'Submit'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // Reject Confirmation Modal (with comment input, toast on success)
  const rejectModalContent = showRejectModal && createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => {
          if (!isProcessingReject) {
            setShowRejectModal(false);
          }
        }}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Confirm Rejection
          </h3>
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
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={() => {
                if (!isProcessingReject) {
                  setShowRejectModal(false);
                }
              }}
              disabled={isProcessingReject}
              variant="secondary"
              size="md"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!onRejectPlan || isProcessingReject) return;
                const reason = reviewComments.trim();
                if (!reason) {
                  toast.warning('Please enter a rejection reason.');
                  return;
                }
                setIsProcessingReject(true);
                try {
                  await onRejectPlan(selectedPlanDetails.auditId, reason);
                  // Don't show toast here - let parent component handle it to avoid duplicate
                  setShowRejectModal(false);
                  onClose();
                } catch (err) {
                  console.error('Reject failed', err);
                  toast.error(getUserFriendlyErrorMessage(err, 'Failed to reject plan. Please try again.'));
                } finally {
                  setIsProcessingReject(false);
                }
              }}
              disabled={isProcessingReject}
              variant="danger"
              size="md"
              isLoading={isProcessingReject}
            >
              {isProcessingReject ? 'Processing...' : 'Reject Plan'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // Rejection Reason Modal (shows rejection comment when clicking on rejected status)
  const rejectionReasonModalContent = showRejectionReasonModal && createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => setShowRejectionReasonModal(false)}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Rejection Reason
            </h3>
            <button
              type="button"
              onClick={() => setShowRejectionReasonModal(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-3">
            {/* Show who rejected the plan */}
            {selectedPlanDetails.rejectedBy && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-sm font-semibold text-blue-900">
                    Rejected by {selectedPlanDetails.rejectedBy}
                  </span>
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason
              </label>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 leading-relaxed whitespace-pre-line">
                  {selectedPlanDetails.latestRejectionComment || 'No rejection reason provided.'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-gray-500 pt-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>This plan was rejected{selectedPlanDetails.rejectedBy ? ` by ${selectedPlanDetails.rejectedBy}` : ''}. Please review the reason above and make necessary corrections.</span>
            </div>
          </div>
          
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowRejectionReasonModal(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );

  // Render modal using Portal to ensure it's outside the DOM hierarchy
  return (
    <>
      {createPortal(modalContent, document.body)}
      {submitModalContent}
      {forwardModalContent}
      {rejectModalContent}
      {rejectionReasonModalContent}
      {deleteModalContent}
    </>
  );
};
