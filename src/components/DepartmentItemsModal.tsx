import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { getFindingsByAudit } from '../api/findings';
import { getAuditChecklistItems } from '../api/checklists';
import { getAdminUsers } from '../api/adminUsers';
import { getStatusColor, getSeverityColor } from '../constants/statusColors';
import AuditLogHistoryModal from './AuditLogHistoryModal';

interface DepartmentItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  departmentId: number;
  departmentName: string;
  auditId: string;
}

export const DepartmentItemsModal: React.FC<DepartmentItemsModalProps> = ({
  isOpen,
  onClose,
  departmentId,
  departmentName,
  auditId,
}) => {
  const [activeTab, setActiveTab] = useState<'findings' | 'nofindings' | 'items'>('findings');
  const [findings, setFindings] = useState<any[]>([]);
  const [noFindings, setNoFindings] = useState<any[]>([]);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [userMap, setUserMap] = useState<Map<string, any>>(new Map());
  
  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyEntityType, setHistoryEntityType] = useState<'Finding' | 'ChecklistItem' | 'ChecklistItemNoFinding'>('Finding');
  const [historyEntityId, setHistoryEntityId] = useState<string>('');
  const [historyTitle, setHistoryTitle] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !auditId) {
      setFindings([]);
      setNoFindings([]);
      setChecklistItems([]);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        // Load users first
        const users = await getAdminUsers();
        const usersById = new Map();
        users.forEach((u: any) => {
          usersById.set(u.userId, u);
        });
        setUserMap(usersById);

        // Load all findings for audit
        const allFindings = await getFindingsByAudit(auditId);
        const deptFindings = allFindings.filter((f: any) => Number(f.deptId) === departmentId);
        setFindings(deptFindings);

        // Load all checklist items for audit
        const allItems = await getAuditChecklistItems(auditId);
        
        // Filter items for this department
        const deptItems = allItems.filter((item: any) => {
          // Get deptId from item (could be nested in different structures)
          const itemDeptId = item.deptId ?? item.department?.deptId ?? item.department?.id;
          return Number(itemDeptId) === departmentId;
        });
        
        // Separate into findings (non-compliant) and no findings (compliant)
        const compliantItems = deptItems.filter((item: any) => {
          const status = String(item.status || '').toLowerCase();
          return status === 'compliant' || status === 'nofinding';
        });
        
        const allChecklistItems = deptItems.filter((item: any) => {
          const status = String(item.status || '').toLowerCase();
          return status !== 'compliant' && status !== 'nofinding';
        });

        setNoFindings(compliantItems);
        setChecklistItems(allChecklistItems);
      } catch (err: any) {
        console.error('Failed to load department items:', err);
        toast.error('Failed to load items for department');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, auditId, departmentId]);

  if (!isOpen) return null;

  const handleShowHistory = (entityType: 'Finding' | 'ChecklistItem' | 'ChecklistItemNoFinding', entityId: string, title: string) => {
    setHistoryEntityType(entityType);
    setHistoryEntityId(entityId);
    setHistoryTitle(title);
    setShowHistoryModal(true);
  };

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-primary-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{departmentName}</h2>
                <p className="text-sm text-gray-500">Findings, No Findings, and Checklist Items</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-6 bg-gray-50">
            <button
              onClick={() => setActiveTab('findings')}
              className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'findings'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Findings ({findings.length})
            </button>
            <button
              onClick={() => setActiveTab('nofindings')}
              className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'nofindings'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              No Findings ({noFindings.length})
            </button>
            <button
              onClick={() => setActiveTab('items')}
              className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                activeTab === 'items'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Checklist Items ({checklistItems.length})
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-200 border-t-primary-600"></div>
                <span className="ml-3 text-gray-600">Loading...</span>
              </div>
            )}

            {!loading && activeTab === 'findings' && (
              <div className="space-y-4">
                {findings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500">No findings for this department.</p>
                  </div>
                ) : (
                  findings.map((finding, index) => (
                    <div
                      key={finding.findingId || index}
                      className="border border-gray-200 rounded-lg p-5 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-base font-bold text-gray-900 mb-2">{finding.title}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{finding.description}</p>
                        </div>
                        <button
                          onClick={() => handleShowHistory('Finding', finding.findingId, finding.title)}
                          className="ml-3 flex-shrink-0 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center gap-2"
                          title="View history"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          History
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(finding.status)}`}>
                          {finding.status}
                        </span>
                        {finding.severity && (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(finding.severity)}`}>
                            {finding.severity}
                          </span>
                        )}
                        {finding.createdBy && (
                          <span className="text-xs text-gray-500">
                            Created by: {userMap.get(finding.createdBy)?.fullName || userMap.get(finding.createdBy)?.email || finding.createdBy}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!loading && activeTab === 'nofindings' && (
              <div className="space-y-4">
                {noFindings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500">No compliant items for this department.</p>
                  </div>
                ) : (
                  noFindings.map((item, index) => (
                    <div
                      key={item.auditChecklistItemId || item.id || index}
                      className="border border-emerald-200 rounded-lg p-5 bg-gradient-to-r from-emerald-50 to-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-base font-bold text-gray-900 mb-2">
                            {item.questionTextSnapshot || item.title || 'Compliant Item'}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {item.comment || item.reason || 'No additional details'}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleShowHistory(
                              'ChecklistItemNoFinding',
                              item.auditChecklistItemId || item.id,
                              item.questionTextSnapshot || item.title || 'Compliant Item'
                            )
                          }
                          className="ml-3 flex-shrink-0 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center gap-2"
                          title="View history"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          History
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                        {item.createdBy && (
                          <span className="text-xs text-gray-500">
                            Created by: {userMap.get(item.createdBy)?.fullName || userMap.get(item.createdBy)?.email || item.createdBy}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!loading && activeTab === 'items' && (
              <div className="space-y-4">
                {checklistItems.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500">No checklist items for this department.</p>
                  </div>
                ) : (
                  checklistItems.map((item, index) => (
                    <div
                      key={item.auditChecklistItemId || item.id || index}
                      className="border border-gray-200 rounded-lg p-5 bg-gradient-to-r from-gray-50 to-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="text-base font-bold text-gray-900 mb-2">
                            {item.questionTextSnapshot || item.title || 'Checklist Item'}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {item.comment || item.section || 'No additional details'}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            handleShowHistory(
                              'ChecklistItem',
                              item.auditChecklistItemId || item.id,
                              item.questionTextSnapshot || item.title || 'Checklist Item'
                            )
                          }
                          className="ml-3 flex-shrink-0 px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium flex items-center gap-2"
                          title="View history"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          History
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                        {item.createdBy && (
                          <span className="text-xs text-gray-500">
                            Created by: {userMap.get(item.createdBy)?.fullName || userMap.get(item.createdBy)?.email || item.createdBy}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* History Modal */}
      <AuditLogHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
        entityType={historyEntityType}
        entityId={historyEntityId}
        title={historyTitle}
      />
    </>,
    document.body
  );
};

export default DepartmentItemsModal;
