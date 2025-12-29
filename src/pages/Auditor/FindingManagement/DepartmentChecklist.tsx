import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getChecklistItemsByDepartment, createAuditChecklistItem, updateAuditChecklistItem, deleteAuditChecklistItem, type CreateAuditChecklistItemDto, type UpdateAuditChecklistItemDto, getCompliantIdByAuditItemId } from '../../../api/checklists';
import { getDepartmentById } from '../../../api/departments';
import { getFindings, getMyFindings, getFindingById, updateFinding, type Finding} from '../../../api/findings';
import { getFindingSeverities } from '../../../api/findingSeverity';
import { unwrap } from '../../../utils/normalize';
import CreateFindingModal from './CreateFindingModal';
import CompliantModal from './CompliantModal';
import CompliantDetailsViewer from './CompliantDetailsViewer';
import FindingDetailModal from './FindingDetailModal';
import { toast } from 'react-toastify';
import { getActionsByFinding, type Action } from '../../../api/actions';

// import ActionDetailModal from '../../CAPAOwner/ActionDetailModal';
import { getAuditPlanById, getSensitiveDepartments } from '../../../api/audits';

import AuditorActionReviewModal from './AuditorActionReviewModal';
import ActionDetailsModal from '../../LeadAuditor/auditplanning/components/ActionDetailsModal';

import { getAccessGrants, verifyCode} from '../../../api/accessGrant';
import useAuthStore, { useUserId } from '../../../store/useAuthStore';
import apiClient from '../../../api/client';
// import { getStatusColor } from '../../../constants';


// Helper function to unwrap array from API response
const unwrapArray = (data: any): any[] => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  // Common server-side serializers (e.g., .NET) may return an object with $values
  if (Array.isArray(data.$values)) return data.$values;
  if (Array.isArray(data.values)) return data.values;
  if (Array.isArray(data.data)) return data.data;
  // Fallback: if object contains a single array property, try to return it
  const arrayProp = Object.keys(data).find((k) => Array.isArray((data as any)[k]));
  if (arrayProp) return (data as any)[arrayProp];
  return [];
};

interface ChecklistItem {
  auditItemId: string;
  auditId: string;
  questionTextSnapshot: string;
  section: string;
  order: number;
  status: string;
  comment: string | null;
}

const DepartmentChecklist = () => {
  const { deptId } = useParams<{ deptId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCompliantModal, setShowCompliantModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [findingsMap, setFindingsMap] = useState<Record<string, string>>({}); // auditItemId -> findingId
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [itemToMarkCompliant, setItemToMarkCompliant] = useState<ChecklistItem | null>(null);
  const [showCompliantDetailsViewer, setShowCompliantDetailsViewer] = useState(false);
  const [selectedCompliantId, setSelectedCompliantId] = useState<string | number | null>(null); // Compliant record ID from API response
  const [loadingCompliantId, setLoadingCompliantId] = useState(false); // Loading state for fetching compliant ID
  const [compliantIdMap, setCompliantIdMap] = useState<Record<string, string | number>>({}); // auditItemId -> compliant record id (persisted to sessionStorage)
  
  // Edit finding modal state (for Return status)
  const [showEditFindingModal, setShowEditFindingModal] = useState(false);
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    severity: '',
    deadline: '',
  });
  const [loadingFinding, setLoadingFinding] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [severities, setSeverities] = useState<Array<{ severity: string }>>([]);
  const [loadingSeverities, setLoadingSeverities] = useState(false);
  const [rootCauseStatusMap, setRootCauseStatusMap] = useState<Record<string, { hasPending: boolean; pendingCount: number; hasApproved: boolean; hasRejected: boolean; allApproved: boolean; totalCount: number }>>({}); // findingId -> root cause status

  // Audit info state
  const [auditType, setAuditType] = useState<string>('');

  // Add checklist item modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    questionTextSnapshot: '',
    section: '',
  });
  const [submittingItem, setSubmittingItem] = useState(false);

  // Edit checklist item modal state
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [editItemForm, setEditItemForm] = useState({
    questionTextSnapshot: '',
    section: '',
    order: 0,
    status: '',
    comment: '',
  });
  const [submittingEditItem, setSubmittingEditItem] = useState(false);

  // Delete checklist item modal state
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ChecklistItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);


  const getStatusBadgeColor = (status: string) => {
    return getStatusColor(status) || 'bg-gray-100 text-gray-700';
  };
  // Tab state
  const [activeTab, setActiveTab] = useState<'checklist' | 'action'>('checklist');

  // Action tab state
  const [myFindings, setMyFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [selectedFindingForActions, setSelectedFindingForActions] = useState<Finding | null>(null);
  const [findingActions, setFindingActions] = useState<Action[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [verifiedActionsCount, setVerifiedActionsCount] = useState(0);
  // const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [findingActionsMap, setFindingActionsMap] = useState<Record<string, Action[]>>({}); // findingId -> actions

  // Action detail modal state
  const [showActionDetailModal, setShowActionDetailModal] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [selectedActionFindingId, setSelectedActionFindingId] = useState<string | null>(null);
  const [showActionDetailsModal, setShowActionDetailsModal] = useState(false);

  // QR Scan & Verify Code state
  const [qrScanned, setQrScanned] = useState<boolean>(false);
  const [showQrScanModal, setShowQrScanModal] = useState(false);
  const [showVerifyCodeModal, setShowVerifyCodeModal] = useState(false);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const authStore = useAuthStore();
  const userIdFromToken = useUserId();
  const [scannerUserId, setScannerUserId] = useState<string | null>(null);
  const [isSensitiveDept, setIsSensitiveDept] = useState<boolean | null>(null);

  // Get auditId and auditType from location state (passed from parent component)
  const auditId = (location.state as any)?.auditId || '';
  const auditTypeFromState = (location.state as any)?.auditType || '';

  // Load scanner user ID (for verify code)
  useEffect(() => {
    if (userIdFromToken) {
      setScannerUserId(userIdFromToken);
    } else if (authStore.user?.email) {
      // Fallback: try to get from authStore
      const fallbackUserId = (authStore.user as any)?.userId || (authStore.user as any)?.id || (authStore.user as any)?.$id;
      if (fallbackUserId) {
        setScannerUserId(String(fallbackUserId));
      }
    }
  }, [userIdFromToken, authStore.user?.email]);

  // Determine if current department is sensitive for this audit.
  // If not sensitive -> skip QR requirement.
  useEffect(() => {
    const checkSensitiveDepartment = async () => {
      if (!deptId || !auditId) {
        setIsSensitiveDept(null);
        return;
      }

      try {
        const sensitiveDepts = await getSensitiveDepartments(String(auditId));
        const list: any[] = Array.isArray(sensitiveDepts)
          ? sensitiveDepts
          : (sensitiveDepts as any)?.$values || [];

        const deptIdNum = parseInt(deptId, 10);
        const isSensitive = list.some((item: any) => {
          const itemDeptId = Number(
            item.deptId ?? item.DeptId ?? item.departmentId ?? NaN
          );
          return !Number.isNaN(itemDeptId) && itemDeptId === deptIdNum;
        });

        setIsSensitiveDept(isSensitive);

        if (!isSensitive) {
          // Non-sensitive department: allow access without QR
          setQrScanned(true);
          setShowQrScanModal(false);
          setShowVerifyCodeModal(false);
        }
      } catch (error) {
        console.error(
          '[DepartmentChecklist] Failed to check sensitive department:',
          error
        );
        // Nếu không xác định được, không chặn auditor: cho phép tiếp tục mà không cần QR
        setIsSensitiveDept(null);
        setQrScanned(true);
        setShowQrScanModal(false);
        setShowVerifyCodeModal(false);
      }
    };

    checkSensitiveDepartment();
  }, [deptId, auditId]);

  // Check QR scan status on mount
  useEffect(() => {
    const checkQrScanStatus = async () => {
      if (!deptId || !auditId || !scannerUserId) return;
      // Nếu phòng không sensitive thì không cần check QR
      if (isSensitiveDept === false) {
        return;
      }
      // Chờ xác định sensitive trước khi check QR
      if (isSensitiveDept === null) {
        return;
      }

      try {
        // Check sessionStorage first
        const sessionKey = `qr_verified_${auditId}_${deptId}_${scannerUserId}`;
        const verified = sessionStorage.getItem(sessionKey);
        if (verified === 'true') {
          setQrScanned(true);
          return;
        }

        // Check if QR has been scanned by checking access grants
        const grants = await getAccessGrants({
          auditId: auditId,
          deptId: parseInt(deptId, 10),
          auditorId: scannerUserId,
        });

        if (grants && grants.length > 0) {
          // QR has been issued, check if it's been scanned
          // For now, we'll show verify code modal if grants exist
          // In a real scenario, you might want to check scan status via API
          const activeGrant = grants.find(g => g.status === 'Active');
          if (activeGrant) {
            setQrToken(activeGrant.qrToken);
            setShowVerifyCodeModal(true);
          } else {
            // No active grant, show QR scan required message
            setShowQrScanModal(true);
          }
        } else {
          // No grants found, QR not scanned yet
          setShowQrScanModal(true);
        }
      } catch (error) {
        console.error('Error checking QR scan status:', error);
        // On error, show QR scan modal
        setShowQrScanModal(true);
      }
    };

    if (deptId && auditId && scannerUserId) {
      checkQrScanStatus();
    }
  }, [deptId, auditId, scannerUserId, isSensitiveDept]);

  // Set audit type from state or load from API
  useEffect(() => {
    if (auditTypeFromState) {
      // Use audit type from state (from assignment)
      setAuditType(auditTypeFromState);
    } else if (auditId) {
      // Fallback: Load audit info from API if not in state
      const loadAuditInfo = async () => {
        try {
          const auditData = await getAuditPlanById(auditId);
          // Try different possible field names for type - check both root and nested audit object
          const type = auditData.type || auditData.Type || auditData.auditType ||
            auditData.audit?.type || auditData.audit?.Type || auditData.audit?.auditType || '';
          setAuditType(type);
        } catch (err: any) {
          console.error('Error loading audit info:', err);
          // Don't show error, just log it
        }
      };

      loadAuditInfo();
    }
  }, [auditId, auditTypeFromState]);

  // Save compliantIdMap to sessionStorage whenever it changes
  useEffect(() => {
    if (auditId && Object.keys(compliantIdMap).length > 0) {
      const key = `compliantIdMap_${auditId}`;
      sessionStorage.setItem(key, JSON.stringify(compliantIdMap));
    }
  }, [compliantIdMap, auditId]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Helper function to get background color based on status
  const getStatusColor = (status: string) => {
    const statusLower = (status || '').toLowerCase().trim();

    // Return/Returned - Orange
    if (statusLower === 'return' || statusLower === 'returned') {
      return 'bg-orange-50 hover:bg-orange-100 border-l-4 border-orange-400';
    }

    // NonCompliant
    if (
      statusLower.startsWith('non') ||
      (statusLower.includes('non') && statusLower.includes('compliant'))
    ) {
      return 'bg-red-50 hover:bg-red-200 shadow-sm';
    }

    // Compliant
    if (statusLower === 'compliant' || statusLower.includes('compliant')) {
      return 'bg-green-50 hover:bg-green-100';
    }

    // Default
    return 'bg-white hover:bg-gray-50';
  };


  // Check if item is non-compliant
  const isNonCompliant = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    return statusLower.includes('non') && statusLower.includes('compliant');
  };

  // Check if item is compliant
  const isCompliant = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    // Check if it's compliant but NOT non-compliant
    return (statusLower === 'compliant' || statusLower.includes('compliant')) && !isNonCompliant(status);
  };

  // Check if item is returned - check both checklist item status and finding status
  const isReturned = (item: ChecklistItem, statusToCheck?: string) => {
    // Use provided status or item status
    const statusLower = (statusToCheck || item.status || '').toLowerCase().trim();
    
    // Check if status contains "return" (case-insensitive, handles "Return", "returned", "Returned", etc.)
    if (statusLower === 'return' || statusLower === 'returned' || statusLower.includes('return')) {
      return true;
    }
    
    // Also check finding status if there's a finding associated with this item
    const findingId = findingsMap[item.auditItemId];
    if (findingId && myFindings.length > 0) {
      // Try to get finding status from myFindings
      const finding = myFindings.find(f => f.findingId === findingId);
      if (finding) {
        const findingStatusLower = (finding.status || '').toLowerCase().trim();
        if (findingStatusLower === 'return' || findingStatusLower === 'returned' || findingStatusLower.includes('return')) {
          return true;
        }
      }
    }
    
    return false;
  };

  // Load findings to map auditItemId to findingId
  useEffect(() => {
    const loadFindings = async () => {
      try {
        const findingsResponse = await getFindings();
        // Unwrap the response to handle $values or values arrays
        const findingsArray = unwrap(findingsResponse);

        // Create map: auditItemId -> findingId
        const map: Record<string, string> = {};
        findingsArray.forEach((finding: any) => {
          if (finding.auditItemId && finding.findingId) {
            map[finding.auditItemId] = finding.findingId;
          }
        });
        setFindingsMap(map);
      } catch (err: any) {
        console.error('Error loading findings:', err);
        toast.warning('Failed to load findings');
      }
    };
    loadFindings();
  }, []);

  // Load root cause status for findings (to show indicators for pending reviews)
  const loadRootCauseStatus = async () => {
    if (myFindings.length === 0) return;
    
    const statusMap: Record<string, { hasPending: boolean; pendingCount: number; hasApproved: boolean; hasRejected: boolean; allApproved: boolean; totalCount: number }> = {};
    
    await Promise.all(
      myFindings.map(async (finding) => {
        try {
          const res = await apiClient.get(`/RootCauses/by-finding/${finding.findingId}`);
          const rootCauses = res.data.$values || [];
          const totalCount = rootCauses.length;
          const pendingCount = rootCauses.filter((rc: any) => rc.status?.toLowerCase() === 'pending').length;
          const approvedCount = rootCauses.filter((rc: any) => rc.status?.toLowerCase() === 'approved').length;
          
          statusMap[finding.findingId] = {
            hasPending: pendingCount > 0,
            pendingCount: pendingCount,
            hasApproved: rootCauses.some((rc: any) => rc.status?.toLowerCase() === 'approved'),
            hasRejected: rootCauses.some((rc: any) => rc.status?.toLowerCase() === 'rejected'),
            allApproved: totalCount > 0 && approvedCount === totalCount,
            totalCount: totalCount,
          };
        } catch (err) {
          console.warn(`Failed to load root causes for finding ${finding.findingId}`, err);
          statusMap[finding.findingId] = { hasPending: false, pendingCount: 0, hasApproved: false, hasRejected: false, allApproved: false, totalCount: 0 };
        }
      })
    );
    
    setRootCauseStatusMap(statusMap);
  };

  // Load root cause status when myFindings changes
  useEffect(() => {
    if (activeTab === 'action' && myFindings.length > 0) {
      loadRootCauseStatus();
    }
  }, [myFindings, activeTab]);

  // Handle view finding details
  const handleViewFinding = (item: ChecklistItem) => {
    const findingId = findingsMap[item.auditItemId];
    if (findingId) {
      setSelectedFindingId(findingId);
      setShowDetailModal(true);
    } else {
      console.warn('Finding not found for auditItemId:', item.auditItemId);
      toast.warning('Finding not found for this item');
    }
  };

  // Load severities for edit modal
  const loadSeverities = async () => {
    if (severities.length > 0) return; // Already loaded
    setLoadingSeverities(true);
    try {
      const data = await getFindingSeverities();
      setSeverities(data.map(item => ({ severity: item.severity || item.name || '' })));
    } catch (err) {
      console.error('Error loading severities:', err);
    } finally {
      setLoadingSeverities(false);
    }
  };

  // Handle edit finding submit
  const handleEditFindingSubmit = async () => {
    if (!editingFinding) return;

    // Validate
    if (!editFormData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!editFormData.description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!editFormData.severity) {
      toast.error('Severity is required');
      return;
    }
    if (!editFormData.deadline) {
      toast.error('Deadline is required');
      return;
    }

    setSubmittingEdit(true);
    try {
      const payload = {
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        severity: editFormData.severity,
        deadline: new Date(editFormData.deadline).toISOString(),
        // Keep other fields from original finding
        auditId: editingFinding.auditId,
        auditItemId: editingFinding.auditItemId,
        deptId: editingFinding.deptId || 0,
        status: editingFinding.status,
        rootCauseId: editingFinding.rootCauseId || null,
        reviewerId: editingFinding.reviewerId || null,
        source: editingFinding.source || '',
        externalAuditorName: editingFinding.externalAuditorName || null,
      };

      await updateFinding(editingFinding.findingId, payload);
      toast.success('Finding updated successfully');
      setShowEditFindingModal(false);
      setEditingFinding(null);

      // Reload findings to update the map
      const reloadFindings = async () => {
        try {
          const findingsResponse = await getFindings();
          const findingsArray = unwrap(findingsResponse);
          const map: Record<string, string> = {};
          findingsArray.forEach((finding: any) => {
            if (finding.auditItemId && finding.findingId) {
              map[finding.auditItemId] = finding.findingId;
            }
          });
          setFindingsMap(map);

          // Reload checklist items to update status
          if (deptId) {
            const deptIdNum = parseInt(deptId, 10);
            const allItems = await getChecklistItemsByDepartment(deptIdNum);
            
            // Filter by auditId if available
            let itemsByAudit = allItems;
            if (auditId) {
              itemsByAudit = allItems.filter((item: ChecklistItem | any) => {
                const itemAuditId = item.auditId || 
                                   item.auditPlanId || 
                                   item.AuditId ||
                                   item.audit?.auditId ||
                                   item.audit?.id;
                return String(itemAuditId) === String(auditId);
              });
            }
            
            // Filter out items with status "Archived"
            const filteredItems = itemsByAudit.filter((item: ChecklistItem) => {
              const statusLower = (item.status || '').toLowerCase().trim();
              return statusLower !== 'archived';
            });
            
            // Sort by order
            const sortedItems = filteredItems.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
            
            // Fetch all compliant records to update status and build compliantIdMap
            try {
              const compliantRes = await apiClient.get(`/ChecklistItemNoFinding`);
              const allCompliantRecords = unwrapArray(compliantRes.data);
              
              // Build compliantIdMap: auditChecklistItemId -> compliant record id
              const compliantMap: Record<string, string | number> = {};
              allCompliantRecords.forEach((record: any) => {
                if (record.auditChecklistItemId && record.id) {
                  compliantMap[record.auditChecklistItemId] = record.id;
                }
              });
              
              // Update compliantIdMap state
              setCompliantIdMap(compliantMap);
              
              // Update checklist items status: if item has compliant record, set status to "Compliant"
              const itemsWithCompliantStatus = sortedItems.map((item: ChecklistItem) => {
                if (compliantMap[item.auditItemId] && !isCompliant(item.status)) {
                  return { ...item, status: 'Compliant' };
                }
                return item;
              });
              
              setChecklistItems(itemsWithCompliantStatus);
            } catch (compliantErr: any) {
              console.error('Error loading compliant records:', compliantErr);
              setChecklistItems(sortedItems);
            }
          }
        } catch (err) {
          console.error('Error reloading findings:', err);
        }
      };
      await reloadFindings();
    } catch (err: any) {
      console.error('Error updating finding:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update finding');
    } finally {
      setSubmittingEdit(false);
    }
  };

  // Handle edit checklist item
  const handleEditItem = (item: ChecklistItem) => {
    setEditingItem(item);
    setEditItemForm({
      questionTextSnapshot: item.questionTextSnapshot || '',
      section: item.section || '',
      order: item.order || 0,
      status: item.status || 'Open',
      comment: item.comment || '',
    });
    setShowEditItemModal(true);
  };

  // Handle submit edit checklist item
  const handleEditItemSubmit = async () => {
    if (!editingItem) return;

    if (!editItemForm.questionTextSnapshot.trim()) {
      toast.error('Question text is required');
      return;
    }

    setSubmittingEditItem(true);
    try {
      const payload: UpdateAuditChecklistItemDto = {
        questionTextSnapshot: editItemForm.questionTextSnapshot.trim(),
        section: editItemForm.section || undefined,
        order: editItemForm.order,
        status: editItemForm.status || 'Open',
        comment: editItemForm.comment || '',
      };

      await updateAuditChecklistItem(editingItem.auditItemId, payload);
      toast.success('Checklist item updated successfully');
      setShowEditItemModal(false);
      setEditingItem(null);

      // Reload checklist items
      if (deptId) {
        const deptIdNum = parseInt(deptId, 10);
        const allItems = await getChecklistItemsByDepartment(deptIdNum);
        
        // Filter by auditId if available
        let itemsByAudit = allItems;
        if (auditId) {
          itemsByAudit = allItems.filter((item: ChecklistItem | any) => {
            const itemAuditId = item.auditId || 
                               item.auditPlanId || 
                               item.AuditId ||
                               item.audit?.auditId ||
                               item.audit?.id;
            return String(itemAuditId) === String(auditId);
          });
        }
        
        // Filter out items with status "Archived"
        const filteredItems = itemsByAudit.filter((item: ChecklistItem) => {
          const statusLower = (item.status || '').toLowerCase().trim();
          return statusLower !== 'archived';
        });
        
        // Sort by order
        const sortedItems = filteredItems.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
        
        // Fetch all compliant records to update status and build compliantIdMap
        try {
          const compliantRes = await apiClient.get(`/ChecklistItemNoFinding`);
          const allCompliantRecords = unwrapArray(compliantRes.data);
          
          // Build compliantIdMap: auditChecklistItemId -> compliant record id
          const compliantMap: Record<string, string | number> = {};
          allCompliantRecords.forEach((record: any) => {
            if (record.auditChecklistItemId && record.id) {
              compliantMap[record.auditChecklistItemId] = record.id;
            }
          });
          
          // Update compliantIdMap state
          setCompliantIdMap(compliantMap);
          
          // Update checklist items status: if item has compliant record, set status to "Compliant"
          const itemsWithCompliantStatus = sortedItems.map((item: ChecklistItem) => {
            if (compliantMap[item.auditItemId] && !isCompliant(item.status)) {
              return { ...item, status: 'Compliant' };
            }
            return item;
          });
          
          setChecklistItems(itemsWithCompliantStatus);
        } catch (compliantErr: any) {
          console.error('Error loading compliant records:', compliantErr);
          setChecklistItems(sortedItems);
        }
      }
    } catch (err: any) {
      console.error('Error updating checklist item:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to update checklist item');
    } finally {
      setSubmittingEditItem(false);
    }
  };

  // Handle delete checklist item
  const handleDeleteItem = (item: ChecklistItem) => {
    setItemToDelete(item);
    setShowDeleteItemModal(true);
  };

  // Confirm delete checklist item
  const handleConfirmDeleteItem = async () => {
    if (!itemToDelete) return;

    setDeletingItem(true);
    try {
      await deleteAuditChecklistItem(itemToDelete.auditItemId);
      toast.success('Checklist item deleted successfully');
      setShowDeleteItemModal(false);
      setItemToDelete(null);

      // Reload checklist items
      if (deptId) {
        const deptIdNum = parseInt(deptId, 10);
        const allItems = await getChecklistItemsByDepartment(deptIdNum);
        
        // Filter by auditId if available
        let itemsByAudit = allItems;
        if (auditId) {
          itemsByAudit = allItems.filter((item: ChecklistItem | any) => {
            const itemAuditId = item.auditId || 
                               item.auditPlanId || 
                               item.AuditId ||
                               item.audit?.auditId ||
                               item.audit?.id;
            return String(itemAuditId) === String(auditId);
          });
        }
        
        // Filter out items with status "Archived"
        const filteredItems = itemsByAudit.filter((item: ChecklistItem) => {
          const statusLower = (item.status || '').toLowerCase().trim();
          return statusLower !== 'archived';
        });
        
        // Sort by order
        const sortedItems = filteredItems.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
        
        // Fetch all compliant records to update status and build compliantIdMap
        try {
          const compliantRes = await apiClient.get(`/ChecklistItemNoFinding`);
          const allCompliantRecords = unwrapArray(compliantRes.data);
          
          // Build compliantIdMap: auditChecklistItemId -> compliant record id
          const compliantMap: Record<string, string | number> = {};
          allCompliantRecords.forEach((record: any) => {
            if (record.auditChecklistItemId && record.id) {
              compliantMap[record.auditChecklistItemId] = record.id;
            }
          });
          
          // Update compliantIdMap state
          setCompliantIdMap(compliantMap);
          
          // Update checklist items status: if item has compliant record, set status to "Compliant"
          const itemsWithCompliantStatus = sortedItems.map((item: ChecklistItem) => {
            if (compliantMap[item.auditItemId] && !isCompliant(item.status)) {
              return { ...item, status: 'Compliant' };
            }
            return item;
          });
          
          setChecklistItems(itemsWithCompliantStatus);
        } catch (compliantErr: any) {
          console.error('Error loading compliant records:', compliantErr);
          setChecklistItems(sortedItems);
        }
      }
    } catch (err: any) {
      console.error('Error deleting checklist item:', err);
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete checklist item');
    } finally {
      setDeletingItem(false);
    }
  };

  // Handle mark item as compliant - show modal first
  const handleMarkCompliant = (item: ChecklistItem) => {
    setItemToMarkCompliant(item);
    setShowCompliantModal(true);
  };

  // Confirm and actually mark item as compliant (called from CompliantModal)
  // CompliantModal handles the API call, we need to refetch data to sync with server
  const handleConfirmMarkCompliant = async (compliantData?: any) => {

    if (!itemToMarkCompliant || updatingItemId) {
      return;
    }

    setUpdatingItemId(itemToMarkCompliant.auditItemId);

    try {
      // Save the compliant record ID for later viewing
      const compliantItemId = itemToMarkCompliant.auditItemId;
      const newCompliantId = compliantData?.id;
      
      if (newCompliantId) {

        setCompliantIdMap(prev => {
          const newMap = {
            ...prev,
            [compliantItemId]: newCompliantId
          };
          return newMap;
        });
      } else {
      }

      // Refetch checklist items from API to get updated status from server
      if (!deptId) {
        toast.success('Item marked as compliant successfully');
        return;
      }

      const deptIdNum = parseInt(deptId, 10);
      const allItems = await getChecklistItemsByDepartment(deptIdNum);
      
      // Filter by auditId if available
      let itemsByAudit = allItems;
      if (auditId) {
        itemsByAudit = allItems.filter((item: ChecklistItem | any) => {
          const itemAuditId = item.auditId || 
                             item.auditPlanId || 
                             item.AuditId ||
                             item.audit?.auditId ||
                             item.audit?.id ||
                             item.auditPlan?.auditId;
          return String(itemAuditId) === String(auditId);
        });
      }
      
      // Filter out items with status "Archived"
      const filteredItems = itemsByAudit.filter((item: ChecklistItem) => {
        const statusLower = (item.status || '').toLowerCase().trim();
        return statusLower !== 'archived';
      });
      
      // Sort by order
      const sortedItems = filteredItems.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
      
      // Fetch all compliant records to update status for all items (not just the one we just marked)
      try {
        const compliantRes = await apiClient.get(`/ChecklistItemNoFinding`);
        const allCompliantRecords = unwrapArray(compliantRes.data);
        
        // Build compliantIdMap: auditChecklistItemId -> compliant record id
        const compliantMap: Record<string, string | number> = {};
        allCompliantRecords.forEach((record: any) => {
          if (record.auditChecklistItemId && record.id) {
            compliantMap[record.auditChecklistItemId] = record.id;
          }
        });
        
        // Update compliantIdMap state with all compliant records
        setCompliantIdMap(compliantMap);
        
        // Update status to "Compliant" for ALL items that have compliant records
        // Since backend doesn't automatically update checklist item status, we need to set it manually
        const updatedItems = sortedItems.map((item: ChecklistItem) => {
          if (compliantMap[item.auditItemId] && !isCompliant(item.status)) {
            return { ...item, status: 'Compliant' };
          }
          return item;
        });
        
        
        // Update state with fresh data from API (with compliant status applied to all items)
        setChecklistItems(updatedItems);
      } catch (compliantErr: any) {
        console.error('Error loading compliant records in handleConfirmMarkCompliant:', compliantErr);
        // Fallback: at least update the item we just marked
        const updatedItems = sortedItems.map((item: ChecklistItem) => {
          if (item.auditItemId === compliantItemId && newCompliantId) {
            return { ...item, status: 'Compliant' };
          }
          return item;
        });
        setChecklistItems(updatedItems);
      }

      toast.success('Item marked as compliant successfully');
    } catch (err: any) {
      console.error('Error marking item as compliant:', err);
      toast.error(err?.message || 'Failed to mark item as compliant');
    } finally {
      setUpdatingItemId(null);
      setItemToMarkCompliant(null);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!deptId) {
        setError('Department ID is required');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const deptIdNum = parseInt(deptId, 10);

        // Load department info
        const deptData = await getDepartmentById(deptIdNum);
        setDepartmentName(deptData.name || 'Department');

        // Load checklist items
        const allItems = await getChecklistItemsByDepartment(deptIdNum);
        
        // Filter by auditId if available (from location state)
        let itemsByAudit: ChecklistItem[] = allItems;
        if (auditId) {
          itemsByAudit = allItems.filter((item: ChecklistItem | any) => {
            // Check various possible field names for auditId
            const itemAuditId = item.auditId || 
                               item.auditPlanId || 
                               item.AuditId ||
                               item.audit?.auditId ||
                               item.audit?.id ||
                               item.auditPlan?.auditId;
            
            // Compare auditIds (handle both string and number)
            const matches = String(itemAuditId) === String(auditId);
            
         
            return matches;
          });
      
          if (itemsByAudit.length === 0 && allItems.length > 0) {
          }
        } else {
          console.warn(' No auditId provided, showing all checklist items for this department');
        }
        
        // Filter out items with status "Archived"
        const filteredItems = itemsByAudit.filter((item: ChecklistItem) => {
          const statusLower = (item.status || '').toLowerCase().trim();
          return statusLower !== 'archived';
        });
        
        // Sort by order
        const sortedItems = filteredItems.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
        
        // Fetch all compliant records to update status and build compliantIdMap
        try {
          const compliantRes = await apiClient.get(`/ChecklistItemNoFinding`);
          const allCompliantRecords = unwrapArray(compliantRes.data);
          
          // Build compliantIdMap: auditChecklistItemId -> compliant record id
          const compliantMap: Record<string, string | number> = {};
          allCompliantRecords.forEach((record: any) => {
            if (record.auditChecklistItemId && record.id) {
              compliantMap[record.auditChecklistItemId] = record.id;
            }
          });
          
          // Update compliantIdMap state
          setCompliantIdMap(compliantMap);
          
          // Update checklist items status: if item has compliant record, set status to "Compliant"
          const itemsWithCompliantStatus = sortedItems.map((item: ChecklistItem) => {
            if (compliantMap[item.auditItemId] && !isCompliant(item.status)) {
              return { ...item, status: 'Compliant' };
            }
            return item;
          });
          
          setChecklistItems(itemsWithCompliantStatus);
        } catch (compliantErr: any) {
          console.error('Error loading compliant records:', compliantErr);
          // Continue without compliant status update if fetch fails
          setChecklistItems(sortedItems);
        }
      } catch (err: any) {
        console.error('Error loading checklist items:', err);
        const errorMessage = err?.message || 'Failed to load checklist items';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [deptId, auditId]);

  // Load my findings when action tab is active, or when auditId/deptId changes
  useEffect(() => {
    if (activeTab === 'action' && auditId && deptId) {
      loadMyFindings();
    }
  }, [activeTab, auditId, deptId]);

  // Listen for root cause updates
  useEffect(() => {
    const handleRootCauseUpdated = async (_event: Event) => {
      // const customEvent = event as CustomEvent; // Unused
      // const _findingId = customEvent.detail?.findingId; // Unused
      
      // Small delay to ensure backend has updated
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload root cause status if we have findings
      if (myFindings.length > 0) {
        await loadRootCauseStatus();
      }
    };

    window.addEventListener('rootCauseUpdated', handleRootCauseUpdated);

    return () => {
      window.removeEventListener('rootCauseUpdated', handleRootCauseUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myFindings]);

  const loadMyFindings = async () => {
    setLoadingFindings(true);
    try {
      const allFindings = await getMyFindings();

      // Filter findings by current audit and department
      const filteredFindings = allFindings.filter((finding) => {
        // Check audit match
        const findingAuditId = finding.audit?.auditId || finding.auditId || '';
        const auditMatch = !auditId || String(findingAuditId) === String(auditId);
        
        // Check department match
        const findingDeptId = finding.deptId || null;
        const deptMatch = !deptId || (findingDeptId !== null && findingDeptId === parseInt(deptId, 10));
        
        const matches = auditMatch && deptMatch;
        
      
        
        return matches;
      });

      setMyFindings(filteredFindings);

      // Load actions for each finding and count verified actions
      const actionsMap: Record<string, Action[]> = {};
      let verifiedCount = 0;

      for (const finding of filteredFindings) {
        try {
          const actions = await getActionsByFinding(finding.findingId);
          actionsMap[finding.findingId] = actions || [];
          const verifiedActions = actions.filter((action: Action) =>
            action.status?.toLowerCase() === 'verified'
          );
          verifiedCount += verifiedActions.length;
        } catch (err) {
          console.warn(`Failed to load actions for finding ${finding.findingId}`, err);
          actionsMap[finding.findingId] = [];
        }
      }

      setFindingActionsMap(actionsMap);
      setVerifiedActionsCount(verifiedCount);
      
      // Load root cause status after findings are loaded
      if (filteredFindings.length > 0) {
        // Small delay to ensure state is set
        setTimeout(() => {
          loadRootCauseStatus();
        }, 100);
      }
    } catch (err: any) {
      console.error('Error loading my findings:', err);
      toast.error('Failed to load findings');
    } finally {
      setLoadingFindings(false);
    }
  };

  // Check if all actions for a finding are closed
  const areAllActionsClosed = (findingId: string): boolean => {
    const actions = findingActionsMap[findingId] || [];
    if (actions.length === 0) return false; // No actions means not all closed
    
    // Check if all actions are closed
    return actions.every(action => {
      const status = action.status?.toLowerCase() || '';
      const isClosed = status === 'closed' || action.closedAt !== null;
      return isClosed;
    });
  };

  // Get finding status based on actions
  const getFindingStatus = (findingId: string): { status: string; color: string } | null => {
    const actions = findingActionsMap[findingId] || [];
    if (actions.length === 0) return null;

    // Check all actions to find the most relevant status
    // Priority: 1) Progress < 100% -> In Progress, 2) Progress = 100% and Verified -> Review
    for (const action of actions) {
      const progressPercent = action.progressPercent || 0;
      const status = action.status?.toLowerCase() || '';

      // If progress < 100%, show "In Progress"
      if (progressPercent < 100) {
        return { status: 'In Progress', color: 'bg-blue-100 text-blue-700' };
      }

      // If progress = 100% and status = "Verified", show "Review"
      if (progressPercent === 100 && status === 'verified') {
        return { status: 'Review', color: 'bg-purple-100 text-purple-700' };
      }
    }

    return null;
  };

  // Get display status for finding - override "Closed" if not all actions are closed
  // Keep "Received" if there's at least one action not approved or verified
  const getDisplayStatus = (finding: Finding): string => {
    const originalStatus = finding.status || '';
    const statusLower = originalStatus.toLowerCase();

    // If status is "Received", check if all actions are approved/verified
    if (statusLower === 'received') {
      const actions = findingActionsMap[finding.findingId] || [];
      if (actions.length > 0) {
        // Check if all actions are approved or verified
        const allApprovedOrVerified = actions.every(a => {
          const actionStatus = a.status?.toLowerCase() || '';
          return actionStatus === 'approved' || actionStatus === 'verified' || actionStatus === 'completed';
        });
        
        // If not all actions are approved/verified, keep "Received" status
        if (!allApprovedOrVerified) {
          return 'Received';
        }
        
        // If all actions are approved/verified, change status based on action states
        // Check if all actions are closed
        const allClosed = actions.every(a => {
          const actionStatus = a.status?.toLowerCase() || '';
          return actionStatus === 'closed' || a.closedAt !== null;
        });
        
        if (allClosed) {
          return 'Closed';
        }
        
        // All verified/approved but not all closed - show "Verified" or "Approved" status
        // Check if all are verified
        const allVerified = actions.every(a => {
          const actionStatus = a.status?.toLowerCase() || '';
          return actionStatus === 'verified';
        });
        
        if (allVerified) {
          return 'Verified';
        }
        
        // Check if all are approved
        const allApproved = actions.every(a => {
          const actionStatus = a.status?.toLowerCase() || '';
          return actionStatus === 'approved' || actionStatus === 'completed';
        });
        
        if (allApproved) {
          return 'Approved';
        }
        
        // Mixed verified/approved - show "In Progress"
        return 'In Progress';
      }
      // No actions yet, keep Received
      return 'Received';
    }

    // If status is "Closed", check if all actions are actually closed
    if (statusLower === 'closed') {
      const allClosed = areAllActionsClosed(finding.findingId);
      if (!allClosed) {
        // Not all actions are closed, so don't show "Closed"
        // Return a status based on actions or keep original if no actions
        const actionStatus = getFindingStatus(finding.findingId);
        return actionStatus?.status || 'Open';
      }
    }
    
    return originalStatus;
  };

  const handleViewFindingActions = async (finding: Finding) => {
    setSelectedFindingForActions(finding);
    setShowActionsModal(true);
    setLoadingActions(true);
    try {
      const actions = await getActionsByFinding(finding.findingId);
      setFindingActions(Array.isArray(actions) ? actions : []);
    } catch (err: any) {
      console.error('Error loading actions:', err);
      toast.error('Failed to load actions');
      setFindingActions([]);
    } finally {
      setLoadingActions(false);
    }
  };

  // Handle verify code
  const handleVerifyCode = async () => {
    if (!qrToken || !verifyCodeInput.trim() || !scannerUserId) {
      toast.error('Please enter verify code');
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyCode({
        qrToken: qrToken,
        scannerUserId: scannerUserId,
        verifyCode: verifyCodeInput.trim(),
      });

      if (result.isValid) {
        toast.success('Verify code is correct! Opening checklist...');
        setQrScanned(true);
        setShowVerifyCodeModal(false);
        // Save to sessionStorage
        if (deptId && auditId && scannerUserId) {
          const sessionKey = `qr_verified_${auditId}_${deptId}_${scannerUserId}`;
          sessionStorage.setItem(sessionKey, 'true');
        }
      } else {
        toast.error(result.reason || 'Verify code is incorrect');
      }
    } catch (error: any) {
      console.error('Failed to verify code:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to verify code');
    } finally {
      setVerifying(false);
    }
  };


  // Don't render checklist if QR not scanned/verified
  if (!qrScanned && (showQrScanModal || showVerifyCodeModal)) {
    return (
      <MainLayout user={layoutUser}>
        {/* QR Scan Required Modal */}
        {showQrScanModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full">
                  <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                  QR Code Required
                </h3>
                <p className="text-sm text-gray-600 text-center mb-6">
                  Please have the department scan your QR code to access this checklist.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => navigate('/auditor/findings')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Go Back
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Verify Code Modal */}
        {showVerifyCodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
              <div className="p-6">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                  Enter Verify Code
                </h3>
                <p className="text-sm text-gray-600 text-center mb-6">
                  Please enter the verify code provided by the department to access this checklist.
                </p>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Verify Code
                  </label>
                  <input
                    type="text"
                    value={verifyCodeInput}
                    onChange={(e) => setVerifyCodeInput(e.target.value)}
                    placeholder="Enter 6-digit verify code"
                    maxLength={6}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg tracking-widest"
                  />
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => navigate('/auditor/findings')}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleVerifyCode}
                    disabled={verifying || !verifyCodeInput.trim()}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {verifying ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </MainLayout>
    );
  }

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-white border-b border-primary-100 shadow-sm mb-4 sm:mb-6">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate('/auditor/findings')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl sm:text-2xl font-semibold text-primary-600">
              {departmentName || 'Checklist Items'}
            </h1>
          </div>
          <p className="text-gray-600 text-xs sm:text-sm ml-11">Review and respond to checklist items</p>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-4 sm:pb-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md mb-4 sm:mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('checklist')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'checklist'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                Checklist Items
              </button>
              <button
                onClick={() => setActiveTab('action')}
                className={`px-4 sm:px-6 py-3 sm:py-4 text-sm font-medium border-b-2 transition-colors relative ${activeTab === 'action'
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                My Findings
                {verifiedActionsCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded-full">
                    {verifiedActionsCount}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'checklist' ? (
          <>
            {/* Loading State */}
            {loading && (
              <div className="bg-white rounded-xl border border-primary-100 shadow-md p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading checklist items...</p>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="text-red-700">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Checklist Items List */}
            {!loading && !error && (
              <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
                <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    Checklist Items ({checklistItems.length})
                  </h2>
                </div>

                {checklistItems.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">No checklist items found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {/* Add Item Button - Show at the top of the list if External audit */}
                    {auditType?.toLowerCase() === 'external' && (
                      <div className="px-4 sm:px-6 py-2 bg-gray-50 border-b border-gray-200">
                        <button
                          onClick={() => {
                            setNewItemForm({
                              questionTextSnapshot: '',
                              section: '',
                            });
                            setShowAddItemModal(true);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add New Item
                        </button>
                      </div>
                    )}
                    {checklistItems.map((item, index) => {
                      // Check if this item has a finding with Return status
                      const findingId = findingsMap[item.auditItemId];
                      const associatedFinding = findingId ? myFindings.find(f => f.findingId === findingId) : null;
                      // Use finding status if available, otherwise use checklist item status
                      const itemStatusToCheck = associatedFinding?.status || item.status;
                      
                      return (
                        <div
                          key={item.auditItemId}
                          className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 transition-colors ${getStatusColor(itemStatusToCheck)} focus:outline-none focus:ring-0`}
                        >

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 focus:outline-none focus:ring-0">
                          <div className="flex items-start sm:items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
                            {/* Order Number */}
                            <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center bg-primary-100 text-primary-700 rounded-lg font-semibold text-xs sm:text-sm md:text-base">
                              {item.order || index + 1}
                            </div>
                            <p className="text-xs sm:text-sm md:text-base text-gray-900 flex-1 min-w-0 break-words">
                              {item.questionTextSnapshot}
                            </p>
                          </div>
                          <div className="flex items-center justify-end sm:justify-start gap-2 sm:gap-3 flex-shrink-0">
                            {/* Edit and Delete buttons for External audit type - Only show if no finding and not compliant */}
                            {auditType?.toLowerCase() === 'external' && 
                             !findingsMap[item.auditItemId] && 
                             !isCompliant(item.status) && 
                             !compliantIdMap[item.auditItemId] && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditItem(item);
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 border border-blue-200 shadow-sm hover:shadow-md active:scale-95 transition-colors"
                                  title="Edit Item"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItem(item);
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-600 border border-red-200 shadow-sm hover:shadow-md active:scale-95 transition-colors"
                                  title="Delete Item"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            {isReturned(item, itemStatusToCheck) ? (
                              /* Edit button for Returned items */
                              <div className="flex items-center gap-2">
                                <span className="px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap bg-orange-100 text-orange-700 border border-orange-300">
                                  Returned
                                </span>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const findingId = findingsMap[item.auditItemId];
                                    if (findingId) {
                                      setLoadingFinding(true);
                                      try {
                                        const finding = await getFindingById(findingId);
                                        setEditingFinding(finding);
                                        setEditFormData({
                                          title: finding.title || '',
                                          description: finding.description || '',
                                          severity: finding.severity || '',
                                          deadline: finding.deadline ? new Date(finding.deadline).toISOString().split('T')[0] : '',
                                        });
                                        setShowEditFindingModal(true);
                                        // Load severities for dropdown
                                        await loadSeverities();
                                      } catch (err: any) {
                                        console.error('Error loading finding:', err);
                                        toast.error('Failed to load finding details');
                                      } finally {
                                        setLoadingFinding(false);
                                      }
                                    } else {
                                      toast.warning('Finding not found for this item');
                                    }
                                  }}
                                  disabled={loadingFinding}
                                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                  title="Edit Finding"
                                >
                                  {loadingFinding ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                      <span>Edit</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : isCompliant(item.status) ? (
                              /* View button for Compliant items */
                              <div className="flex items-center gap-2">
                                <div className="px-2 sm:px-4 py-1 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap border shadow-sm flex items-center gap-1.5">
                                  <span className="hidden sm:inline">Meets Requirements</span>
                                  <span className="sm:hidden">Meets</span>
                                </div>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();


                                    // First try to get compliant ID from sessionStorage map
                                    const cachedCompliantId = compliantIdMap[item.auditItemId];

                                    if (cachedCompliantId) {
                                      setSelectedCompliantId(cachedCompliantId);
                                      setShowCompliantDetailsViewer(true);
                                      return;
                                    }

                                    // If not in cache, fetch from API
                                    setLoadingCompliantId(true);
                                    try {

                                      const compliantId = await getCompliantIdByAuditItemId(item.auditItemId);

                                      if (compliantId) {
                                        // Save to sessionStorage map for future use
                                        setCompliantIdMap(prev => ({
                                          ...prev,
                                          [item.auditItemId]: compliantId
                                        }));

                                        setSelectedCompliantId(compliantId);
                                        setShowCompliantDetailsViewer(true);
                                      } else {
                                        toast.warning('Compliant record not found');
                                      }
                                    } catch (err: any) {
                                      toast.error('Failed to load compliant details');
                                    } finally {
                                      setLoadingCompliantId(false);
                                    }
                                  }}
                                  title="View Compliant Details"
                                  disabled={loadingCompliantId}
                                  className={`w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors active:scale-95 ${loadingCompliantId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {loadingCompliantId ? (
                                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="5" cy="12" r="10" strokeWidth="4"></circle>
                                      <path className="opacity-50" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                  )}

                                </button>
                              </div>
                            ) : isNonCompliant(item.status) ? (
                              /* Eye icon for Non-compliant items */
                              <div className="flex items-center gap-2">
                                <button
                                  className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 active:scale-95"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewFinding(item);
                                  }}
                                  title="View Finding Details"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <>
                                {/* Green Checkmark */}
                                <button
                                  className={`w-7 h-7 flex items-center justify-center rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 shadow-sm hover:shadow-md active:scale-95 ${updatingItemId === item.auditItemId ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkCompliant(item);
                                  }}
                                  disabled={updatingItemId === item.auditItemId}
                                  title="Mark as Compliant"
                                >
                                  {updatingItemId === item.auditItemId ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>

                                {/* Red X */}
                                <button
                                  className="w-7 h-7 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white border-2 border-red-600 shadow-md hover:shadow-lg active:scale-95"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItem(item);
                                    setShowCreateModal(true);
                                  }}
                                  title="Mark as Non-Compliant"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Action Tab Content */}
            {loadingFindings ? (
              <div className="bg-white rounded-xl border border-primary-100 shadow-md p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading findings...</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
                <div className="px-4 sm:px-6 py-3 border-b border-gray-200 bg-gray-50">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                    My Findings ({myFindings.length})
                  </h2>
                </div>

                {myFindings.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-gray-500">No findings found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {myFindings.map((finding) => (
                      <div
                        key={finding.findingId}
                        className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleViewFindingActions(finding)}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm sm:text-base font-medium text-gray-900">
                                {finding.title}
                              </h3>
                              {getFindingStatus(finding.findingId) && (() => {
                                const statusInfo = getFindingStatus(finding.findingId);
                                return statusInfo ? (
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                                    {statusInfo.status}
                                  </span>
                                ) : null;
                              })()}
                              {/* Root Cause Indicator Badge - Only show if not all approved */}
                              {(() => {
                                const rcStatus = rootCauseStatusMap[finding.findingId];
                                const totalCount = rcStatus?.totalCount || 0;
                                const allApproved = rcStatus?.allApproved || false;
                                const hasPendingRC = rcStatus?.hasPending || false;
                                const hasRejectedRC = rcStatus?.hasRejected || false;
                                
                                // Only show badge if there are root causes AND not all are approved
                                if (totalCount > 0 && !allApproved) {
                                  return (
                                    <div className="relative group">
                                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap flex items-center gap-1 ${
                                        hasPendingRC
                                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                                          : hasRejectedRC
                                          ? 'bg-red-100 text-red-700 border-red-300'
                                          : 'bg-blue-100 text-blue-700 border-blue-300'
                                      }`}>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <span>{totalCount} RC</span>
                                      </span>
                                      <div className="absolute left-0 bottom-full mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                                        <p className="font-semibold mb-1">Root Causes Status:</p>
                                        <p className="text-gray-300">
                                          Total: {totalCount} root cause{totalCount > 1 ? 's' : ''}
                                        </p>
                                        {hasPendingRC && (
                                          <p className="text-yellow-300 mt-1">⏳ {rcStatus.pendingCount} pending review</p>
                                        )}
                                        {hasRejectedRC && (
                                          <p className="text-red-300 mt-1">✗ Has rejected root cause{hasRejectedRC && totalCount > 1 ? 's' : ''}</p>
                                        )}
                                        <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          

                            <div className="flex items-center gap-6 mt-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${finding.severity?.toLowerCase() === 'high' || finding.severity?.toLowerCase() === 'major'
                                  ? 'bg-red-100 text-red-700'
                                  : finding.severity?.toLowerCase() === 'medium' || finding.severity?.toLowerCase() === 'normal'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                {finding.severity || 'N/A'}
                              </span>
                              <p className={`text-xs  sm:text-sm line-clamp-2 font-medium ${getStatusBadgeColor(getDisplayStatus(finding))}`}>
                                {getDisplayStatus(finding) || 'No status'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFindingId(finding.findingId);
                                setShowDetailModal(true);
                              }}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                            >
                              Detail Finding
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewFindingActions(finding);
                              }}
                              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
                            >
                              View Actions
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions Modal */}
      {showActionsModal && selectedFindingForActions && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              setShowActionsModal(false);
              setSelectedFindingForActions(null);
              setFindingActions([]);
            }}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-blue-600 px-6 py-5 flex items-center justify-between z-10 shadow-lg border-b-4 border-blue-700">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Actions for Finding</h2>
                    <p className="text-sm text-blue-100 mt-1 truncate">{selectedFindingForActions.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowActionsModal(false);
                    setSelectedFindingForActions(null);
                    setFindingActions([]);
                  }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-all duration-200 flex-shrink-0 group"
                >
                  <svg className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {loadingActions ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading actions...</span>
                  </div>
                ) : findingActions.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-3 text-gray-500 font-medium">No actions found for this finding</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {findingActions.map((action) => (
                      <div
                        key={action.actionId}
                        className="bg-white border-2 border-blue-200 rounded-xl p-5 hover:shadow-xl hover:border-blue-400 transition-all duration-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <h3 className="text-base font-semibold text-gray-900 flex-1 mr-3">{action.title}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${action.status?.toLowerCase() === 'verified'
                              ? 'bg-green-100 text-green-700'
                              : action.status?.toLowerCase() === 'completed'
                                ? 'bg-blue-100 text-blue-700'
                                : action.status?.toLowerCase() === 'approved'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                            {action.status || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span className="font-medium">Progress: {action.progressPercent || 0}%</span>
                          </div>
                          {action.dueDate && (
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Due: {new Date(action.dueDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                        {action.progressPercent !== undefined && (
                          <div className="mb-4">
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                              <div
                                className="bg-blue-600 h-3 rounded-full transition-all duration-500 shadow-md relative overflow-hidden"
                                style={{ width: `${action.progressPercent}%` }}
                              >
                                <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-blue-100">
                          <button
                            onClick={() => {
                              setSelectedActionId(action.actionId);
                              setSelectedActionFindingId(action.findingId);
                              
                              // If status is Verified, open review modal with approve/reject buttons
                              // Otherwise, open read-only details modal
                              if (action.status?.toLowerCase() === 'verified') {
                                setShowActionDetailModal(true); // Review modal (with approve/reject)
                              } else {
                                setShowActionDetailsModal(true); // Read-only modal
                              }
                            }}
                            className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all duration-200 shadow-md hover:shadow-xl hover:scale-105 flex items-center gap-2 group"
                          >
                            <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            {action.status?.toLowerCase() === 'verified' ? 'Review Action' : 'View Details'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Finding Modal */}
      {selectedItem && deptId && (
        <CreateFindingModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedItem(null);
          }}
          onSuccess={() => {
            // Reload findings to update the map
            const reloadFindings = async () => {
              try {
                const findingsResponse = await getFindings();
                const findingsArray = unwrap(findingsResponse);
                const map: Record<string, string> = {};
                findingsArray.forEach((finding: any) => {
                  if (finding.auditItemId && finding.findingId) {
                    map[finding.auditItemId] = finding.findingId;
                  }
                });
                setFindingsMap(map);
              } catch (err) {
                console.error('Error reloading findings:', err);
                toast.warning('Error reloading findings');
              }
            };
            reloadFindings();

            // Reload checklist items to update status
            const reloadChecklistItems = async () => {
              if (!deptId) return;
              try {
                const deptIdNum = parseInt(deptId, 10);
                const allItems = await getChecklistItemsByDepartment(deptIdNum);
                
                // Filter by auditId if available
                let itemsByAudit = allItems;
                if (auditId) {
                  itemsByAudit = allItems.filter((item: ChecklistItem | any) => {
                    const itemAuditId = item.auditId || 
                                       item.auditPlanId || 
                                       item.AuditId ||
                                       item.audit?.auditId ||
                                       item.audit?.id;
                    return String(itemAuditId) === String(auditId);
                  });
                }
                
                // Filter out items with status "Archived"
                const filteredItems = itemsByAudit.filter((item: ChecklistItem) => {
                  const statusLower = (item.status || '').toLowerCase().trim();
                  return statusLower !== 'archived';
                });
                
                // Sort by order
                const sortedItems = filteredItems.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
                
                // Fetch all compliant records to update status and build compliantIdMap
                try {
                  const compliantRes = await apiClient.get(`/ChecklistItemNoFinding`);
                  const allCompliantRecords = unwrapArray(compliantRes.data);
                  
                  // Build compliantIdMap: auditChecklistItemId -> compliant record id
                  const compliantMap: Record<string, string | number> = {};
                  allCompliantRecords.forEach((record: any) => {
                    if (record.auditChecklistItemId && record.id) {
                      compliantMap[record.auditChecklistItemId] = record.id;
                    }
                  });
                  
                  // Update compliantIdMap state
                  setCompliantIdMap(compliantMap);
                  
                  // Update checklist items status: if item has compliant record, set status to "Compliant"
                  const itemsWithCompliantStatus = sortedItems.map((item: ChecklistItem) => {
                    if (compliantMap[item.auditItemId] && !isCompliant(item.status)) {
                      return { ...item, status: 'Compliant' };
                    }
                    return item;
                  });
                  
                  setChecklistItems(itemsWithCompliantStatus);
                } catch (compliantErr: any) {
                  console.error('Error loading compliant records in reloadChecklistItems:', compliantErr);
                  // Continue without compliant status update if fetch fails
                  setChecklistItems(sortedItems);
                }
                toast.success('Finding created successfully');
              } catch (err) {
                console.error('Error reloading checklist items:', err);
                toast.warning('Error reloading checklist items');
              }
            };
            reloadChecklistItems();
          }}
          checklistItem={{
            auditItemId: selectedItem.auditItemId,
            auditId: auditId || selectedItem.auditId,
            questionTextSnapshot: selectedItem.questionTextSnapshot,
          }}
          deptId={parseInt(deptId, 10)}
          departmentName={departmentName}
        />
      )}

      {/* Finding Detail Modal */}
      {selectedFindingId && (
        <FindingDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedFindingId(null);
          }}
          findingId={selectedFindingId}
        />
      )}

      {/* Compliant Modal */}
      {itemToMarkCompliant && deptId && (
        <CompliantModal
          isOpen={showCompliantModal}
          onClose={() => {
            setShowCompliantModal(false);
            setItemToMarkCompliant(null);
          }}
          onSuccess={handleConfirmMarkCompliant}
          departmentName={departmentName}
          deptId={parseInt(deptId, 10)}
          checklistItem={{
            auditItemId: itemToMarkCompliant.auditItemId,
            auditId: auditId || itemToMarkCompliant.auditId,
            questionTextSnapshot: itemToMarkCompliant.questionTextSnapshot,
          }}
        />
      )}

      {/* Compliant Details Viewer - Fetches from API */}
      <CompliantDetailsViewer
        isOpen={showCompliantDetailsViewer}
        onClose={() => {
          setShowCompliantDetailsViewer(false);
          setSelectedCompliantId(null);
        }}
        compliantId={selectedCompliantId}
      />

      {/* Action Detail Modal */}
      {selectedActionId && (
        <AuditorActionReviewModal
          isOpen={showActionDetailModal}
          onClose={() => {
            setShowActionDetailModal(false);
            setSelectedActionFindingId(null);
            setSelectedActionId(null);
          }}
          actionId={selectedActionId}
          findingId={selectedActionFindingId || undefined}
          onDataReload={async () => {
            // Reload findings
            await loadMyFindings();
            
            // Reload actions
            if (selectedFindingForActions) {
              const actions = await getActionsByFinding(selectedFindingForActions.findingId);
              setFindingActions(Array.isArray(actions) ? actions : []);
              // Update actions map
              setFindingActionsMap(prev => ({
                ...prev,
                [selectedFindingForActions.findingId]: actions || []
              }));
              // Reload verified count
              await loadMyFindings();
            }
          }}
        />
      )}

      {/* Action Details Modal - New Component */}
      {selectedActionId && (
        <ActionDetailsModal
          isOpen={showActionDetailsModal}
          onClose={() => {
            setShowActionDetailsModal(false);
            setSelectedActionId(null);
          }}
          actionId={selectedActionId}
        />
      )}

      {/* Add Checklist Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowAddItemModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold text-gray-900">Add Checklist Item</h2>
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newItemForm.questionTextSnapshot}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, questionTextSnapshot: e.target.value }))}
                    placeholder="Enter the question text for this checklist item"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section
                  </label>
                  <input
                    type="text"
                    value={departmentName || newItemForm.section}
                    onChange={(e) => setNewItemForm(prev => ({ ...prev, section: e.target.value }))}
                    placeholder="Enter section name (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-gray-50"
                    disabled
                    title="Section is automatically set to department name"
                  />
                  <p className="mt-1 text-xs text-gray-500">Section is automatically set to department name</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order
                  </label>
                  <input
                    type="number"
                    value={checklistItems.length > 0
                      ? Math.max(...checklistItems.map(item => item.order || 0)) + 1
                      : 1}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                    title="Order is automatically calculated"
                  />
                  <p className="mt-1 text-xs text-gray-500">Order is automatically set to the next available number</p>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowAddItemModal(false)}
                  disabled={submittingItem}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!newItemForm.questionTextSnapshot.trim()) {
                      toast.warning('Please enter question text');
                      return;
                    }

                    if (!auditId) {
                      toast.error('Audit ID is required');
                      return;
                    }

                    setSubmittingItem(true);
                    try {
                      // Calculate order: get max order from current checklist items and add 1
                      const maxOrder = checklistItems.length > 0
                        ? Math.max(...checklistItems.map(item => item.order || 0))
                        : 0;
                      const nextOrder = maxOrder + 1;

                      const payload: CreateAuditChecklistItemDto = {
                        auditId: auditId,
                        questionTextSnapshot: newItemForm.questionTextSnapshot.trim(),
                        section: departmentName || newItemForm.section || undefined,
                        order: nextOrder,
                        status: 'Open',
                        comment: '',
                      };

                      await createAuditChecklistItem(payload);
                      toast.success('Checklist item created successfully');
                      setShowAddItemModal(false);
                      setNewItemForm({ questionTextSnapshot: '', section: '' });

                      // Reload checklist items
                      if (deptId) {
                        const deptIdNum = parseInt(deptId, 10);
                        const allItems = await getChecklistItemsByDepartment(deptIdNum);
                        
                        // Filter by auditId if available
                        let itemsByAudit = allItems;
                        if (auditId) {
                          itemsByAudit = allItems.filter((item: ChecklistItem | any) => {
                            const itemAuditId = item.auditId || 
                                               item.auditPlanId || 
                                               item.AuditId ||
                                               item.audit?.auditId ||
                                               item.audit?.id;
                            return String(itemAuditId) === String(auditId);
                          });
                        }
                        
                        const filteredItems = itemsByAudit.filter((item: ChecklistItem) => {
                          const statusLower = (item.status || '').toLowerCase().trim();
                          return statusLower !== 'archived';
                        });
                        const sortedItems = filteredItems.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
                        setChecklistItems(sortedItems);
                      }
                    } catch (err: any) {
                      console.error('Error creating checklist item:', err);
                      toast.error(err?.message || 'Failed to create checklist item');
                    } finally {
                      setSubmittingItem(false);
                    }
                  }}
                  disabled={submittingItem || !newItemForm.questionTextSnapshot.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingItem ? 'Creating...' : 'Create Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Finding Modal */}
      {showEditFindingModal && editingFinding && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              setShowEditFindingModal(false);
              setEditingFinding(null);
            }}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-orange-600 px-6 py-4 flex items-center justify-between z-10 rounded-t-xl">
                <h2 className="text-xl font-semibold text-white">Edit Finding</h2>
                <button
                  onClick={() => {
                    setShowEditFindingModal(false);
                    setEditingFinding(null);
                  }}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Enter finding title"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
                    placeholder="Enter finding description"
                  />
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Severity <span className="text-red-500">*</span>
                  </label>
                  {loadingSeverities ? (
                    <div className="flex items-center gap-2 py-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600"></div>
                      <span className="text-sm text-gray-500">Loading severities...</span>
                    </div>
                  ) : (
                    <select
                      value={editFormData.severity}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, severity: e.target.value }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    >
                      <option value="">-- Select Severity --</option>
                      {severities.map((sev, index) => (
                        <option key={index} value={sev.severity}>
                          {sev.severity}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Deadline */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Deadline <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editFormData.deadline}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 rounded-b-xl border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowEditFindingModal(false);
                    setEditingFinding(null);
                  }}
                  disabled={submittingEdit}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditFindingSubmit}
                  disabled={submittingEdit || !editFormData.title.trim() || !editFormData.description.trim() || !editFormData.severity || !editFormData.deadline}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submittingEdit ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Updating...
                    </>
                  ) : (
                    'Update Finding'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Checklist Item Modal */}
      {showEditItemModal && editingItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowEditItemModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-semibold text-gray-900">Edit Checklist Item</h2>
                <button
                  onClick={() => setShowEditItemModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Text <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editItemForm.questionTextSnapshot}
                    onChange={(e) => setEditItemForm(prev => ({ ...prev, questionTextSnapshot: e.target.value }))}
                    placeholder="Enter the question text for this checklist item"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                    rows={4}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Section
                  </label>
                  <input
                    type="text"
                    value={editItemForm.section}
                    onChange={(e) => setEditItemForm(prev => ({ ...prev, section: e.target.value }))}
                    placeholder="Enter section name (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order
                  </label>
                  <input
                    type="number"
                    value={editItemForm.order}
                    onChange={(e) => setEditItemForm(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  <select
                    value={editItemForm.status}
                    onChange={(e) => setEditItemForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="Open">Open</option>
                    <option value="Compliant">Compliant</option>
                    <option value="NonCompliant">Non-Compliant</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>

               
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowEditItemModal(false)}
                  disabled={submittingEditItem}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditItemSubmit}
                  disabled={submittingEditItem || !editItemForm.questionTextSnapshot.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingEditItem ? 'Updating...' : 'Update Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Checklist Item Modal */}
      {showDeleteItemModal && itemToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowDeleteItemModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 text-center mb-2">
                  Delete Checklist Item
                </h3>
                <p className="text-sm text-gray-600 text-center mb-6">
                  Are you sure you want to delete this checklist item? This action cannot be undone.
                </p>
                <div className="bg-gray-50 rounded-lg p-3 mb-6">
                  <p className="text-sm text-gray-700 font-medium">{itemToDelete.questionTextSnapshot}</p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowDeleteItemModal(false)}
                    disabled={deletingItem}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDeleteItem}
                    disabled={deletingItem}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {deletingItem ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Deleting...
                      </>
                    ) : (
                      'Delete Item'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </MainLayout>
  );
};

export default DepartmentChecklist;

