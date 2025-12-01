import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getChecklistItemsByDepartment, markChecklistItemCompliant } from '../../../api/checklists';
import { getDepartmentById } from '../../../api/departments';
import { getFindings } from '../../../api/findings';
import { unwrap } from '../../../utils/normalize';
import CreateFindingModal from './CreateFindingModal';
import FindingDetailModal from './FindingDetailModal';
import { Toast } from '../AuditPlanning/components/Toast';

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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [findingsMap, setFindingsMap] = useState<Record<string, string>>({}); // auditItemId -> findingId
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [showCompliantConfirmModal, setShowCompliantConfirmModal] = useState(false);
  const [itemToMarkCompliant, setItemToMarkCompliant] = useState<ChecklistItem | null>(null);
  
  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    type: 'error' | 'success' | 'info' | 'warning';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  // Get auditId from location state (passed from parent component)
  const auditId = (location.state as any)?.auditId || '';

  // Helper function to show toast
  const showToast = (message: string, type: 'error' | 'success' | 'info' | 'warning' = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const hideToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Helper function to get background color based on status
  const getStatusColor = (status: string) => {
    const statusLower = (status || '').toLowerCase().trim();
    
    // Check for NonCompliant first (must check this before Compliant)
    // Handle both "NonCompliant" and "Non-Compliant" formats
    if (statusLower.startsWith('non') || (statusLower.includes('non') && statusLower.includes('compliant'))) {
      // Non-compliant - red background rõ ràng hơn với border đậm
      return 'bg-red-50 border-l-4 border-red-200 hover:bg-red-200 shadow-sm';
    }
    
    // Check for Compliant (only if not NonCompliant)
    if (statusLower === 'compliant' || statusLower.includes('compliant')) {
      // Compliant - green background with hover
      return 'bg-green-50 border-l-4 border-green-500 hover:bg-green-100';
    }
    
    // Default - no special color
    return 'bg-white border-l-4 border-transparent hover:bg-gray-50';
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
        showToast('Failed to load findings', 'warning');
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
      showToast('Finding not found for this item', 'warning');
    }
  };

  // Handle mark item as compliant - show confirmation modal first
  const handleMarkCompliant = (item: ChecklistItem) => {
    setItemToMarkCompliant(item);
    setShowCompliantConfirmModal(true);
  };

  // Confirm and actually mark item as compliant
  const handleConfirmMarkCompliant = async () => {
    if (!itemToMarkCompliant || updatingItemId) return; // Prevent multiple clicks
    
    setUpdatingItemId(itemToMarkCompliant.auditItemId);
    setShowCompliantConfirmModal(false);
    
    try {
      await markChecklistItemCompliant(itemToMarkCompliant.auditItemId);
      
      // Update local state to reflect the change
      setChecklistItems(prevItems =>
        prevItems.map(prevItem =>
          prevItem.auditItemId === itemToMarkCompliant.auditItemId
            ? { ...prevItem, status: 'Compliant' }
            : prevItem
        )
      );
      
      console.log('Item marked as compliant:', itemToMarkCompliant.auditItemId);
      showToast('Item marked as compliant successfully', 'success');
    } catch (err: any) {
      console.error('Error marking item as compliant:', err);
      showToast(err?.message || 'Failed to mark item as compliant', 'error');
    } finally {
      setUpdatingItemId(null);
      setItemToMarkCompliant(null);
    }
  };

  // Cancel marking as compliant
  const handleCancelMarkCompliant = () => {
    setShowCompliantConfirmModal(false);
    setItemToMarkCompliant(null);
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
        const items = await getChecklistItemsByDepartment(deptIdNum);
        // Sort by order
        const sortedItems = items.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
        setChecklistItems(sortedItems);
      } catch (err: any) {
        console.error('Error loading checklist items:', err);
        const errorMessage = err?.message || 'Failed to load checklist items';
        setError(errorMessage);
        showToast(errorMessage, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [deptId]);

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
                {checklistItems.map((item, index) => (
                  <div
                    key={item.auditItemId}
                    className={`px-3 sm:px-4 md:px-6 py-3 sm:py-4 transition-colors ${getStatusColor(item.status)}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
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
                          /* Text for Compliant items */
                          <div className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-green-100 text-green-700 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold whitespace-nowrap">
                            <span className="hidden sm:inline">Meets Requirements</span>
                            <span className="sm:hidden">Meets</span>
                          </div>
                        ) : isNonCompliant(item.status) ? (
                          /* Badge and Eye icon for Non-compliant items */
                          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 flex-wrap sm:flex-nowrap">
                            <div className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 bg-red-100 text-red-700 rounded-lg text-[10px] sm:text-xs md:text-sm font-semibold border border-red-300 whitespace-nowrap">
                              <span className="hidden md:inline">Does Not Meet Requirements</span>
                              <span className="hidden sm:inline md:hidden">Does Not Meet</span>
                              <span className="sm:hidden">Not Met</span>
                            </div>
                            <button
                              className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors active:scale-95 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewFinding(item);
                              }}
                              title="View Finding Details"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Green Checkmark */}
                            <button
                              className={`w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-green-100 hover:bg-green-200 text-green-600 transition-colors active:scale-95 flex-shrink-0 ${
                                updatingItemId === item.auditItemId ? 'opacity-50 cursor-not-allowed' : ''
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkCompliant(item);
                              }}
                              disabled={updatingItemId === item.auditItemId}
                              title="Mark as Compliant"
                            >
                              {updatingItemId === item.auditItemId ? (
                                <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 md:h-5 md:w-5 border-b-2 border-green-600"></div>
                              ) : (
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            
                            {/* Red X */}
                            <button
                              className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 flex items-center justify-center rounded-full bg-red-500 hover:bg-red-600 text-white border-2 border-red-600 shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                                setShowCreateModal(true);
                              }}
                              title="Mark as Non-Compliant"
                            >
                              <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
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
      </div>

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
                showToast('Error reloading findings', 'warning');
              }
            };
            reloadFindings();
            
            // Reload checklist items to update status
            const reloadChecklistItems = async () => {
              if (!deptId) return;
              try {
                const deptIdNum = parseInt(deptId, 10);
                const items = await getChecklistItemsByDepartment(deptIdNum);
                const sortedItems = items.sort((a: ChecklistItem, b: ChecklistItem) => (a.order || 0) - (b.order || 0));
                setChecklistItems(sortedItems);
                showToast('Finding created successfully', 'success');
              } catch (err) {
                console.error('Error reloading checklist items:', err);
                showToast('Error reloading checklist items', 'warning');
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

      {/* Confirmation Modal for Marking as Compliant */}
      {showCompliantConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCancelMarkCompliant}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
                Confirm Compliance
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
                Are you sure that this item meets all requirements and standards?
              </p>
              
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handleCancelMarkCompliant}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMarkCompliant}
                  disabled={updatingItemId !== null}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                >
                  {updatingItemId ? 'Marking...' : 'Yes, Mark as Compliant'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={3000}
      />
    </MainLayout>
  );
};

export default DepartmentChecklist;

