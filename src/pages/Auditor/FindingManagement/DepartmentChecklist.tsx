import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { getChecklistItemsByDepartment } from '../../../api/checklists';
import { getDepartmentById } from '../../../api/departments';
import CreateFindingModal from './CreateFindingModal';

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

  // Get auditId from location state (passed from parent component)
  const auditId = (location.state as any)?.auditId || '';

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

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
        setError(err?.message || 'Failed to load checklist items');
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
                    className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        {/* Order Number */}
                        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-primary-100 text-primary-700 rounded-lg font-semibold text-sm sm:text-base">
                          {item.order || index + 1}
                        </div>
                        <p className="text-sm sm:text-base text-gray-900 flex-1 min-w-0">
                          {item.questionTextSnapshot}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        {/* Green Checkmark */}
                        <button
                          className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-green-100 hover:bg-green-200 text-green-600 transition-colors active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle check action
                            console.log('Check clicked for item:', item.auditItemId);
                          }}
                        >
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        
                        {/* Red X */}
                        <button
                          className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                            setShowCreateModal(true);
                          }}
                        >
                          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
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
            // Optionally refresh checklist items or show success message
            console.log('Finding created successfully');
          }}
          checklistItem={{
            auditItemId: selectedItem.auditItemId,
            auditId: auditId || selectedItem.auditId,
            questionTextSnapshot: selectedItem.questionTextSnapshot,
          }}
          deptId={parseInt(deptId, 10)}
        />
      )}
    </MainLayout>
  );
};

export default DepartmentChecklist;

