import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getMyLeadAuditorAudits, getAuditorsByAuditId } from '../../../api/auditTeam';
import { getAuditScopeDepartmentsByAuditId } from '../../../api/audits';
import { createAuditAssignment, getAuditAssignments } from '../../../api/auditAssignments';
import { unwrap } from '../../../utils/normalize';

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

export default function AuditAssignment() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  
  // Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loadingAuditors, setLoadingAuditors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load assignments and departments in parallel
        const [leadAuditorData, assignmentsData] = await Promise.all([
          getMyLeadAuditorAudits(),
          getAuditAssignments().catch(() => []), // Don't fail if assignments API fails
        ]);
        
        if (!leadAuditorData?.isLeadAuditor) {
          setError('You are not a lead auditor for any audits.');
          setLoading(false);
          return;
        }

        const auditIds = unwrap<string>(leadAuditorData?.auditIds);
        
        if (!auditIds || auditIds.length === 0) {
          setError('No audits found.');
          setLoading(false);
          return;
        }

        // Set assignments
        setAssignments(assignmentsData || []);

        // Fetch departments for all audits
        const departmentPromises = auditIds.map(async (auditId: string) => {
          try {
            const deptData = await getAuditScopeDepartmentsByAuditId(auditId);
            return unwrap<Department>(deptData);
          } catch (err) {
            console.error(`Failed to load departments for audit ${auditId}:`, err);
            return [];
          }
        });

        const departmentsArrays = await Promise.all(departmentPromises);
        
        // Flatten and group by deptId, keeping track of auditIds
        const allDepartments = departmentsArrays.flat();
        const deptMap = new Map<number, { dept: Department; auditIds: Set<string> }>();
        
        auditIds.forEach((auditId: string, index: number) => {
          const depts = departmentsArrays[index] || [];
          depts.forEach((dept: Department) => {
            if (!deptMap.has(dept.deptId)) {
              deptMap.set(dept.deptId, { dept, auditIds: new Set() });
            }
            deptMap.get(dept.deptId)!.auditIds.add(auditId);
          });
        });

        const uniqueDepartments: Department[] = Array.from(deptMap.values()).map(({ dept, auditIds }) => ({
          ...dept,
          auditIds: Array.from(auditIds),
        }));

        setDepartments(uniqueDepartments);
      } catch (err: any) {
        console.error('[AuditAssignment] Load failed:', err);
        setError(err?.message || 'Failed to load departments');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleOpenAssignModal = (dept: Department) => {
    setSelectedDepartment(dept);
    // Use first auditId by default
    const firstAuditId = dept.auditIds[0] || '';
    setSelectedAuditId(firstAuditId);
    setSelectedAuditorId('');
    setNotes('');
    setIsAssignModalOpen(true);
    loadAuditors(firstAuditId);
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

  const handleAuditIdChange = (auditId: string) => {
    setSelectedAuditId(auditId);
    setSelectedAuditorId('');
    loadAuditors(auditId);
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
      await createAuditAssignment({
        auditId: selectedAuditId,
        deptId: selectedDepartment.deptId,
        auditorId: selectedAuditorId,
        notes: notes || '',
        status: 'Assigned',
      });
      
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

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-semibold text-gray-900">Audit Assignment</h1>
            <p className="text-gray-600 text-sm mt-1">Departments assigned to your audits</p>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8">
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
              <p className="text-yellow-800">No departments found for your audits.</p>
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
                            Đã assign
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

                {/* Audit Selection (if multiple audits) */}
                {selectedDepartment.auditIds.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Audit
                    </label>
                    <select
                      value={selectedAuditId}
                      onChange={(e) => handleAuditIdChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      {selectedDepartment.auditIds.map((auditId) => (
                        <option key={auditId} value={auditId}>
                          Audit {auditId.substring(0, 8)}...
                        </option>
                      ))}
                    </select>
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

