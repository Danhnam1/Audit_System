import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getChecklistItemsByDepartment, createAuditChecklistItem, type CreateAuditChecklistItemDto, getCompliantIdByAuditItemId } from '../../../api/checklists';
import { getDepartmentById } from '../../../api/departments';
import { getFindings, getMyFindings, type Finding, approveFindingAction, returnFindingAction } from '../../../api/findings';
import { unwrap } from '../../../utils/normalize';
import CreateFindingModal from './CreateFindingModal';
import CompliantModal from './CompliantModal';
import CompliantDetailsViewer from './CompliantDetailsViewer';
import FindingDetailModal from './FindingDetailModal';
import { toast } from 'react-toastify';
import { getActionsByFinding, type Action } from '../../../api/actions';
import ActionDetailModal from '../../CAPAOwner/ActionDetailModal';
import { getAuditPlanById } from '../../../api/audits';
import { getAccessGrants, verifyCode, type VerifyCodeRequest } from '../../../api/accessGrant';
import useAuthStore, { useUserId } from '../../../store/useAuthStore';


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

  // Audit info state
  const [auditType, setAuditType] = useState<string>('');

  // Add checklist item modal state
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemForm, setNewItemForm] = useState({
    questionTextSnapshot: '',
    section: '',
  });
  const [submittingItem, setSubmittingItem] = useState(false);


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
  const [processingActionId, setProcessingActionId] = useState<string | null>(null);
  const [findingActionsMap, setFindingActionsMap] = useState<Record<string, Action[]>>({}); // findingId -> actions

  // Action detail modal state
  const [showActionDetailModal, setShowActionDetailModal] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);

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

  // Check QR scan status on mount
  useEffect(() => {
    const checkQrScanStatus = async () => {
      if (!deptId || !auditId || !scannerUserId) return;

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
  }, [deptId, auditId, scannerUserId]);

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
        console.log('Findings map created:', map);
      } catch (err: any) {
        console.error('Error loading findings:', err);
        toast.warning('Failed to load findings');
      }
    };
    loadFindings();
  }, []);

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

  // Handle mark item as compliant - show modal first
  const handleMarkCompliant = (item: ChecklistItem) => {
    setItemToMarkCompliant(item);
    setShowCompliantModal(true);
  };

  // Confirm and actually mark item as compliant (called from CompliantModal)
  // CompliantModal handles the API call, we just need to update local state
  const handleConfirmMarkCompliant = (compliantData?: any) => {
    console.log('🟡 [handleConfirmMarkCompliant] CALLED');
    console.log('🟡 [handleConfirmMarkCompliant] compliantData:', compliantData);
    console.log('🟡 [handleConfirmMarkCompliant] compliantData.id:', compliantData?.id);
    console.log('🟡 [handleConfirmMarkCompliant] itemToMarkCompliant.auditItemId:', itemToMarkCompliant?.auditItemId);

    if (!itemToMarkCompliant || updatingItemId) {
      console.warn('🔴 [handleConfirmMarkCompliant] Guard check failed');
      return;
    }

    setUpdatingItemId(itemToMarkCompliant.auditItemId);

    try {
      // CompliantModal already called markChecklistItemCompliant API
      // We just update the local UI state here

      // Update local state to reflect the change
      setChecklistItems(prevItems =>
        prevItems.map(prevItem =>
          prevItem.auditItemId === itemToMarkCompliant.auditItemId
            ? { ...prevItem, status: 'Compliant' }
            : prevItem
        )
      );

      // Save the compliant record ID for later viewing
      if (compliantData?.id) {
        console.log('🟢 [handleConfirmMarkCompliant] Saving to sessionStorage map:');
        console.log('  - auditItemId:', itemToMarkCompliant.auditItemId);
        console.log('  - compliant id:', compliantData.id);

        setCompliantIdMap(prev => {
          const newMap = {
            ...prev,
            [itemToMarkCompliant.auditItemId]: compliantData.id
          };
          console.log('🟢 [handleConfirmMarkCompliant] Updated compliantIdMap:', newMap);
          return newMap;
        });
      } else {
        console.warn('⚠️ [handleConfirmMarkCompliant] No id field in compliantData');
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
        console.log(`📋 Loading checklist items for department ${deptIdNum}${auditId ? ` and audit ${auditId}` : ''}`);
        const allItems = await getChecklistItemsByDepartment(deptIdNum);
        console.log(`📦 Received ${allItems.length} total checklist items from API`);
        
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
            
            if (!matches && itemAuditId) {
              console.debug(`⚠️ Item ${item.auditItemId} has auditId ${itemAuditId}, expected ${auditId}`);
            }
            
            return matches;
          });
          
          console.log(`🔍 Filtered checklist items by auditId ${auditId}:`, {
            total: allItems.length,
            filtered: itemsByAudit.length,
            removed: allItems.length - itemsByAudit.length
          });
          
          if (itemsByAudit.length === 0 && allItems.length > 0) {
            console.warn(`⚠️ No items found for auditId ${auditId}. Sample item structure:`, allItems[0]);
          }
        } else {
          console.warn('⚠️ No auditId provided, showing all checklist items for this department');
        }
        
        // Filter out items with status "Archived"
        const filteredItems = itemsByAudit.filter((item: ChecklistItem) => {
          const statusLower = (item.status || '').toLowerCase().trim();
          return statusLower !== 'archived';
        });
        
        // Sort by order
        const sortedItems = filteredItems.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
        console.log(`✅ Final checklist items to display: ${sortedItems.length}`);
        setChecklistItems(sortedItems);
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

  // Load my findings when action tab is active
  useEffect(() => {
    if (activeTab === 'action') {
      loadMyFindings();
    }
  }, [activeTab]);

  const loadMyFindings = async () => {
    setLoadingFindings(true);
    try {
      const findings = await getMyFindings();
      setMyFindings(findings);

      // Load actions for each finding and count verified actions
      const actionsMap: Record<string, Action[]> = {};
      let verifiedCount = 0;

      for (const finding of findings) {
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
    } catch (err: any) {
      console.error('Error loading my findings:', err);
      toast.error('Failed to load findings');
    } finally {
      setLoadingFindings(false);
    }
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
                    {checklistItems.map((item, index) => (
                      <div
                        key={item.auditItemId}
                        className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 transition-colors ${getStatusColor(item.status)} focus:outline-none focus:ring-0`}
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
                            {isCompliant(item.status) ? (
                              /* View button for Compliant items */
                              <div className="flex items-center gap-2">
                                <div className="px-2 sm:px-4 py-1 sm:py-2 rounded-full text-[10px] sm:text-xs font-bold whitespace-nowrap border shadow-sm flex items-center gap-1.5">
                                  <span className="hidden sm:inline">Meets Requirements</span>
                                  <span className="sm:hidden">Meets</span>
                                </div>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();

                                    console.log('=== STEP 1: VIEW BUTTON CLICKED ===');
                                    console.log('auditItemId:', item.auditItemId);
                                    console.log('compliantIdMap:', compliantIdMap);

                                    // First try to get compliant ID from sessionStorage map
                                    const cachedCompliantId = compliantIdMap[item.auditItemId];
                                    console.log('=== STEP 2: CHECK sessionStorage ===');
                                    console.log('cachedCompliantId from map:', cachedCompliantId);

                                    if (cachedCompliantId) {
                                      console.log('✅ STEP 3a: Found in sessionStorage, using cached ID:', cachedCompliantId);
                                      setSelectedCompliantId(cachedCompliantId);
                                      setShowCompliantDetailsViewer(true);
                                      return;
                                    }

                                    // If not in cache, fetch from API
                                    console.log('❌ STEP 3b: Not in cache, calling API getCompliantIdByAuditItemId...');
                                    setLoadingCompliantId(true);
                                    try {
                                      console.log('=== STEP 4: CALLING API ===');
                                      console.log('Passing auditItemId (GUID) to getCompliantIdByAuditItemId:', item.auditItemId);

                                      const compliantId = await getCompliantIdByAuditItemId(item.auditItemId);
                                      console.log('=== STEP 5: API RESPONSE ===');
                                      console.log('compliantId returned from API:', compliantId);

                                      if (compliantId) {
                                        console.log('✅ STEP 6: Valid ID, saving to map and showing viewer');
                                        // Save to sessionStorage map for future use
                                        setCompliantIdMap(prev => ({
                                          ...prev,
                                          [item.auditItemId]: compliantId
                                        }));

                                        setSelectedCompliantId(compliantId);
                                        setShowCompliantDetailsViewer(true);
                                      } else {
                                        console.warn('❌ STEP 6: API returned null or empty ID');
                                        toast.warning('Compliant record not found');
                                      }
                                    } catch (err: any) {
                                      console.error('❌ STEP 5: API ERROR:', err?.message);
                                      console.error('Full error:', err);
                                      console.error('Error response:', err?.response?.data);
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
                              /* Eye icon for Non-compliant items (no badge) */
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
                    ))}
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
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 line-clamp-2">
                              {finding.description || 'No description'}
                            </p>

                            <div className="flex items-center gap-6 mt-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${finding.severity?.toLowerCase() === 'high' || finding.severity?.toLowerCase() === 'major'
                                  ? 'bg-red-100 text-red-700'
                                  : finding.severity?.toLowerCase() === 'medium' || finding.severity?.toLowerCase() === 'normal'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                {finding.severity || 'N/A'}
                              </span>
                              <p className={`text-xs  sm:text-sm line-clamp-2 font-medium ${getStatusBadgeColor(finding.status)}`}>
                                {finding.status || 'No status'}
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
              className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Actions for Finding</h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedFindingForActions.title}</p>
                </div>
                <button
                  onClick={() => {
                    setShowActionsModal(false);
                    setSelectedFindingForActions(null);
                    setFindingActions([]);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {loadingActions ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-gray-600">Loading actions...</span>
                  </div>
                ) : findingActions.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No actions found for this finding</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {findingActions.map((action) => (
                      <div
                        key={action.actionId}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-base font-medium text-gray-900">{action.title}</h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${action.status?.toLowerCase() === 'verified'
                              ? 'bg-green-100 text-green-700'
                              : action.status?.toLowerCase() === 'completed'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                            {action.status || 'N/A'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{action.description || 'No description'}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Progress: {action.progressPercent || 0}%</span>
                          {action.dueDate && (
                            <span>Due: {new Date(action.dueDate).toLocaleDateString()}</span>
                          )}
                        </div>
                        {action.progressPercent && action.progressPercent > 0 && (
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary-600 h-2 rounded-full transition-all"
                              style={{ width: `${action.progressPercent}%` }}
                            />
                          </div>
                        )}
                        <div className="mt-4 flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
                          <button
                            onClick={() => {
                              setSelectedActionId(action.actionId);
                              setShowActionDetailModal(true);
                            }}
                            className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
                          >
                            View Details
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
                const sortedItems = filteredItems.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
                setChecklistItems(sortedItems);
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
      {selectedActionId && (() => {
        const action = findingActions.find(a => a.actionId === selectedActionId);
        const isVerified = action?.status?.toLowerCase() === 'verified';

        return (
          <ActionDetailModal
            isOpen={showActionDetailModal}
            onClose={() => {
              setShowActionDetailModal(false);
              setSelectedActionId(null);
            }}
            actionId={selectedActionId}
            showReviewButtons={isVerified}
            onApprove={async (_feedback: string) => {
              if (!action) return;
              setProcessingActionId(action.actionId);
              try {
                await approveFindingAction(action.actionId);
                toast.success('Action approved successfully');
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
                setShowActionDetailModal(false);
                setSelectedActionId(null);
              } catch (err: any) {
                console.error('Error approving action:', err);
                toast.error(err?.message || 'Failed to approve action');
              } finally {
                setProcessingActionId(null);
              }
            }}
            onReject={async (feedback: string) => {
              if (!action) return;
              if (!feedback.trim()) {
                toast.error('Please enter feedback when rejecting an action');
                return;
              }
              setProcessingActionId(action.actionId);
              try {
                await returnFindingAction(action.actionId, feedback.trim());
                toast.success('Action rejected successfully');
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
                setShowActionDetailModal(false);
                setSelectedActionId(null);
              } catch (err: any) {
                console.error('Error rejecting action:', err);
                toast.error(err?.message || 'Failed to reject action');
              } finally {
                setProcessingActionId(null);
              }
            }}
            isProcessing={processingActionId === selectedActionId}
          />
        );
      })()}

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

    </MainLayout>
  );
};

export default DepartmentChecklist;

