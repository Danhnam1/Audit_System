import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getMyLeadAuditorAudits, getAuditorsByAuditId } from '../../../api/auditTeam';
import { getAuditScopeDepartmentsByAuditId, getAuditPlans } from '../../../api/audits';
import { createAuditAssignment, getAuditAssignments } from '../../../api/auditAssignments';
import { createAuditChecklistItemsFromTemplate } from '../../../api/checklists';
import { unwrap } from '../../../utils/normalize';
import { getStatusColor } from '../../../constants';

interface Department {
  deptId: number;
  name: string;
  auditIds: string[];
}

interface Auditor {
  userId: string;
  fullName: string;
  email: string;
}

interface Assignment {
  assignmentId: string;
  auditId: string;
  deptId: number;
  auditorId: string;
  notes?: string;
  status: string;
}

interface Audit {
  auditId: string;
  title: string;
  type: string;
  scope: string;
  status: string;
  startDate: string;
  endDate: string;
  objective?: string;
  isPublished?: boolean;
}

export default function AuditAssignment() {
  const { user } = useAuth();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  // Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loadingAuditors, setLoadingAuditors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Load audits first
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      setError(null);
      try {
        const auditsData = await getAuditPlans();
        const auditsList = unwrap<Audit>(auditsData);
        setAudits(Array.isArray(auditsList) ? auditsList : []);
      } catch (err: any) {
        console.error('[AuditAssignment] Failed to load audits:', err);
        setError(err?.message || 'Failed to load audits');
      } finally {
        setLoadingAudits(false);
      }
    };

    loadAudits();
  }, []);

  // Load departments when an audit is selected
  useEffect(() => {
    if (!selectedAuditId) {
      setDepartments([]);
      return;
    }

    const loadDepartments = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load assignments
        const assignmentsData = await getAuditAssignments().catch(() => []);
        setAssignments(assignmentsData || []);

        // Fetch departments for selected audit
        const deptData = await getAuditScopeDepartmentsByAuditId(selectedAuditId);
        const deptList = unwrap<Department>(deptData);
        const deptArray = Array.isArray(deptList) ? deptList : [];
        
        // Map departments with auditIds
        const mappedDepartments: Department[] = deptArray.map((dept: Department) => ({
          ...dept,
          auditIds: [selectedAuditId],
        }));

        setDepartments(mappedDepartments);
      } catch (err: any) {
        console.error('[AuditAssignment] Load failed:', err);
        setError(err?.message || 'Failed to load departments');
      } finally {
        setLoading(false);
      }
    };

    loadDepartments();
  }, [selectedAuditId]);

  const handleOpenAssignModal = (dept: Department) => {
    setSelectedDepartment(dept);
    // Use selected auditId (should be the same as the one we're viewing)
    const auditId = selectedAuditId || dept.auditIds[0] || '';
    setSelectedAuditorId('');
    setNotes('');
    setIsAssignModalOpen(true);
    loadAuditors(auditId);
  };

  const loadAuditors = async (auditId: string) => {
    if (!auditId) return;
    
    setLoadingAuditors(true);
    try {
      const auditorsData = await getAuditorsByAuditId(auditId);
      setAuditors(auditorsData || []);
    } catch (err: any) {
      console.error('Failed to load auditors:', err);
      setAuditors([]);
    } finally {
      setLoadingAuditors(false);
    }
  };

  const handleCloseModal = () => {
    setIsAssignModalOpen(false);
    setSelectedDepartment(null);
    setSelectedAuditId('');
    setSelectedAuditorId('');
    setNotes('');
    setAuditors([]);
    setShowConfirmModal(false);
  };

  const handleAssignClick = () => {
    if (!selectedAuditorId) return;
    setShowConfirmModal(true);
  };

  const handleConfirmAssign = async () => {
    if (!selectedDepartment || !selectedAuditId || !selectedAuditorId) return;

    setSubmitting(true);
    try {
      // Log values for debugging
      console.log('=== Assign Button Clicked ===');
      console.log('selectedAuditId:', selectedAuditId);
      console.log('selectedDepartment:', selectedDepartment);
      console.log('selectedDepartment.deptId:', selectedDepartment.deptId);
      console.log('selectedAuditorId:', selectedAuditorId);
      
      // Create audit assignment - use selectedAuditId from state
      await createAuditAssignment({
        auditId: selectedAuditId,
        deptId: selectedDepartment.deptId,
        auditorId: selectedAuditorId,
        notes: notes || '',
        status: 'Assigned',
      });
      
      // Create audit checklist items from template
      try {
        console.log('=== Calling createAuditChecklistItemsFromTemplate ===');
        console.log('auditId:', selectedAuditId);
        console.log('deptId:', selectedDepartment.deptId);
        await createAuditChecklistItemsFromTemplate(selectedAuditId, selectedDepartment.deptId);
        console.log('Audit checklist items created from template successfully');
      } catch (checklistErr: any) {
        console.error('Failed to create checklist items from template:', checklistErr);
        // Don't fail the whole assignment if checklist creation fails
        // Just log the error
      }
      
      // Success - close modals and refresh assignments
      handleCloseModal();
      // Reload assignments to update UI
      const updatedAssignments = await getAuditAssignments();
      setAssignments(updatedAssignments || []);
    } catch (err: any) {
      console.error('Failed to assign auditor:', err);
      alert(err?.message || 'Failed to assign auditor. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Check if department is assigned
  const isDepartmentAssigned = (deptId: number): boolean => {
    const normalizedStatus = (status: string) => status.toLowerCase().trim();
    const isAssignedStatus = (status: string) => {
      const normalized = normalizedStatus(status);
      // Check for "assigned" or "asiggned" (typo in database)
      return normalized === 'assigned' || normalized === 'asiggned' || normalized.includes('assign');
    };
    
    return assignments.some(
      (assignment) => assignment.deptId === deptId && isAssignedStatus(assignment.status)
    );
  };

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const handleAuditSelect = (auditId: string) => {
    setSelectedAuditId(auditId);
  };

  const handleBackToAudits = () => {
    setSelectedAuditId(null);
    setDepartments([]);
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Audit Assignment</h1>
                <p className="text-gray-600 text-sm mt-1">
                  {selectedAuditId ? 'Select department to assign auditor' : 'Select an audit to assign departments'}
                </p>
              </div>
              {selectedAuditId && (
                <button
                  onClick={handleBackToAudits}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Audits
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8">
          {!selectedAuditId ? (
            // Show audit cards
            <>
              {loadingAudits ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <span className="ml-3 text-gray-600">Loading audits...</span>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              ) : audits.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">No audits found.</p>
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {audits.map((audit) => (
                      <div
                        key={audit.auditId}
                        onClick={() => handleAuditSelect(audit.auditId)}
                        className="px-6 py-5 hover:bg-primary-50 transition-all duration-200 cursor-pointer group border-l-4 border-transparent hover:border-primary-500"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 group-hover:bg-primary-200 flex items-center justify-center transition-colors duration-200">
                              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700 transition-colors duration-200">
                              {audit.title}
                            </h3>
                          </div>
                          <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors duration-200 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            // Show departments for selected audit
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <span className="ml-3 text-gray-600">Loading departments...</span>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              ) : departments.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">No departments found for this audit.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-medium text-gray-900">
                      Departments ({departments.length})
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {departments.map((dept) => (
                      <div
                        key={dept.deptId}
                        className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="text-base font-medium text-gray-900">{dept.name}</h3>
                          </div>
                          <div className="ml-4">
                            {isDepartmentAssigned(dept.deptId) ? (
                              <span className="px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded-lg">
                                Assigned
                              </span>
                            ) : (
                              <button
                                onClick={() => handleOpenAssignModal(dept)}
                                className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                              >
                                Assign
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Assign Modal */}
      {isAssignModalOpen && selectedDepartment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseModal}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign Auditor
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Department Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                    {selectedDepartment.name}
                  </p>
                </div>

                {/* Audit Info (read-only since we're viewing a specific audit) */}
                {selectedAuditId && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Audit
                    </label>
                    <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                      {audits.find(a => a.auditId === selectedAuditId)?.title || `Audit ${selectedAuditId.substring(0, 8)}...`}
                    </p>
                  </div>
                )}

                {/* Auditor Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Auditor
                  </label>
                  {loadingAuditors ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Loading auditors...</span>
                    </div>
                  ) : auditors.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No auditors available</p>
                  ) : (
                    <select
                      value={selectedAuditorId}
                      onChange={(e) => setSelectedAuditorId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">-- Select an auditor --</option>
                      {auditors.map((auditor) => (
                        <option key={auditor.userId} value={auditor.userId}>
                          {auditor.fullName} ({auditor.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                    placeholder="Enter notes (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignClick}
                  disabled={!selectedAuditorId || loadingAuditors}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowConfirmModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Confirm Assignment
              </h3>
              <p className="text-sm text-gray-600 mb-6">
                Are you sure you want to assign this auditor to the department?
              </p>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssign}
                  disabled={submitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Assigning...' : 'Yes, Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

