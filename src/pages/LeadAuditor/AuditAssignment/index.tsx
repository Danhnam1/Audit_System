import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditorsByAuditId } from '../../../api/auditTeam';
import { getAuditScopeDepartmentsByAuditId, getAuditPlans } from '../../../api/audits';
import { createAuditAssignment, getAuditAssignments } from '../../../api/auditAssignments';
import { createAuditChecklistItemsFromTemplate } from '../../../api/checklists';
import { getDepartmentById } from '../../../api/departments';
import { getUserById } from '../../../api/adminUsers';
import { unwrap } from '../../../utils/normalize';
import { toast } from 'react-toastify';
import { DataTable } from '../../../components/DataTable';
import type { TableColumn } from '../../../components/DataTable';

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
  assignedAt?: string;
  auditTitle?: string;
  departmentName?: string;
  auditorName?: string;
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
  createdAt?: string;
  createdBy?: string;
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
  const [userNamesCache, setUserNamesCache] = useState<Record<string, string>>({});
  
  // Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [selectedAuditorId, setSelectedAuditorId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loadingAuditors, setLoadingAuditors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Detail modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [departmentDetail, setDepartmentDetail] = useState<any>(null);
  const [loadingDepartmentDetail, setLoadingDepartmentDetail] = useState(false);
  const [selectedDepartmentForDetail, setSelectedDepartmentForDetail] = useState<Department | null>(null);

  // Load audits first
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      setError(null);
      try {
        const auditsData = await getAuditPlans();
        const auditsList = unwrap<Audit>(auditsData);
        // Only show audits with status "InProgress"
        const filteredAudits = (Array.isArray(auditsList) ? auditsList : []).filter((audit: Audit) => {
          const statusLower = (audit.status || '').toLowerCase().trim();
          return statusLower === 'inprogress';
        });
        setAudits(filteredAudits);
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
        try {
          const deptData = await getAuditScopeDepartmentsByAuditId(selectedAuditId);
          
          // Check if response is an error message
          if (deptData && typeof deptData === 'object' && 'message' in deptData && !Array.isArray(deptData)) {
            setDepartments([]);
            return;
          }
          
          const deptList = unwrap<Department>(deptData);
          const deptArray = Array.isArray(deptList) ? deptList : [];
          
          // Map departments with auditIds
          const mappedDepartments: Department[] = deptArray.map((dept: Department) => ({
            ...dept,
            auditIds: [selectedAuditId],
          }));

          setDepartments(mappedDepartments);
        } catch (apiErr: any) {
          // If 404 or "no departments" message, just set empty array
          const errorData = apiErr?.response?.data || apiErr?.data;
          if (apiErr?.response?.status === 404 || 
              (errorData?.message && errorData.message.includes('No departments'))) {
            setDepartments([]);
          } else {
            throw apiErr;
          }
        }
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
      
      // Success - show toast and close modals
      toast.success('Assign successful');
      handleCloseModal();
      
      // Reload assignments to update UI
      const updatedAssignments = await getAuditAssignments();
      setAssignments(updatedAssignments || []);
      
      // If viewing department detail, reload it
      if (selectedDepartmentForDetail) {
        const newAssignment = updatedAssignments?.find(
          (a) => a.deptId === selectedDepartmentForDetail.deptId && a.auditId === selectedAuditId
        );
        if (newAssignment) {
          setSelectedAssignment(newAssignment);
          // Reload department detail
          try {
            const deptDetail = await getDepartmentById(selectedDepartmentForDetail.deptId);
            setDepartmentDetail(deptDetail);
          } catch (err) {
            console.error('Failed to reload department details:', err);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to assign auditor:', err);
      toast.error(err?.message || 'Failed to assign auditor. Please try again.');
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

  // Removed unused handleOpenDetailModal function

  const handleViewDepartmentAssignments = async (dept: Department) => {
    setSelectedDepartmentForDetail(dept);
    setIsDetailModalOpen(true);
    
    // Find assignment for this department
    const assignment = assignments.find(
      (a) => a.deptId === dept.deptId && a.auditId === selectedAuditId
    );
    
    if (assignment) {
      setSelectedAssignment(assignment);
      // Fetch department details
      setLoadingDepartmentDetail(true);
      try {
        const deptDetail = await getDepartmentById(dept.deptId);
        setDepartmentDetail(deptDetail);
      } catch (err: any) {
        console.error('Failed to load department details:', err);
        setDepartmentDetail(null);
      } finally {
        setLoadingDepartmentDetail(false);
      }
    } else {
      setSelectedAssignment(null);
      setDepartmentDetail(null);
    }
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedAssignment(null);
    setDepartmentDetail(null);
    setSelectedDepartmentForDetail(null);
  };

  // Removed unused getAssignmentsForSelectedAudit function
  // const getAssignmentsForSelectedAudit = (): Assignment[] => {
  //   if (!selectedAuditId) return [];
  //   return assignments.filter(assignment => assignment.auditId === selectedAuditId);
  // };

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
            // Show audit table
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
                  <DataTable
                    columns={[
                      {
                        key: 'no',
                        header: 'No.',
                        cellClassName: 'whitespace-nowrap',
                        render: (_, index) => (
                          <span className="text-sm text-gray-700">{index + 1}</span>
                        ),
                      },
                      {
                        key: 'title',
                        header: 'Title',
                        render: (audit) => (
                          <div className="max-w-[200px]">
                            <p className="text-sm font-semibold text-gray-900 truncate">{audit.title || 'Untitled'}</p>
                          </div>
                        ),
                      },
                      {
                        key: 'type',
                        header: 'Type',
                        cellClassName: 'whitespace-nowrap',
                        render: (audit) => (
                          <span className="text-sm text-gray-700">
                            {audit.type || 'General'}
                          </span>
                        ),
                      },
                      {
                        key: 'scope',
                        header: 'Scope',
                        cellClassName: 'whitespace-nowrap',
                        render: (audit) => (
                          <span className="text-sm text-gray-700">{audit.scope || 'N/A'}</span>
                        ),
                      },
                      {
                        key: 'period',
                        header: 'Period',
                        cellClassName: 'whitespace-nowrap',
                        render: (audit) => {
                          const formatDate = (dateStr: string) => {
                            if (!dateStr) return 'N/A';
                            try {
                              return new Date(dateStr).toLocaleDateString();
                            } catch {
                              return dateStr;
                            }
                          };
                          return (
                            <div className="text-sm text-gray-600">
                              {formatDate(audit.startDate)} - {formatDate(audit.endDate)}
                            </div>
                          );
                        },
                      },
                      {
                        key: 'status',
                        header: 'Status',
                        cellClassName: 'whitespace-nowrap',
                        render: (audit) => {
                          const getStatusColor = (status: string) => {
                            const statusLower = status.toLowerCase();
                            if (statusLower === 'inprogress') return 'bg-blue-100 text-blue-800';
                            if (statusLower === 'draft') return 'bg-gray-100 text-gray-800';
                            if (statusLower === 'approved') return 'bg-green-100 text-green-800';
                            return 'bg-gray-100 text-gray-800';
                          };
                          return (
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(audit.status || 'Draft')}`}
                            >
                              {audit.status || 'Draft'}
                            </span>
                          );
                        },
                      },
                      {
                        key: 'createdAt',
                        header: 'Created At',
                        cellClassName: 'whitespace-nowrap',
                        render: (audit) => {
                          if (!audit.createdAt) return <span className="text-sm text-gray-500">N/A</span>;
                          try {
                            const date = new Date(audit.createdAt);
                            const hours = date.getHours().toString().padStart(2, '0');
                            const minutes = date.getMinutes().toString().padStart(2, '0');
                            const day = date.getDate().toString().padStart(2, '0');
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const year = date.getFullYear();
                            return (
                              <span className="text-sm text-gray-600">
                                {hours}:{minutes} {day}/{month}/{year}
                              </span>
                            );
                          } catch {
                            return <span className="text-sm text-gray-500">{audit.createdAt}</span>;
                          }
                        },
                      },
                      {
                        key: 'createdBy',
                        header: 'Created By',
                        cellClassName: 'whitespace-nowrap',
                        render: (audit) => {
                          if (!audit.createdBy) return <span className="text-sm text-gray-500">Unknown</span>;
                          
                          const creatorName = userNamesCache[audit.createdBy] || 'Loading...';
                          
                          // Fetch user name if not in cache
                          if (!userNamesCache[audit.createdBy]) {
                            getUserById(audit.createdBy)
                              .then((response) => {
                                const userData = response?.data?.$values?.[0] || response?.data;
                                const fullName = userData?.fullName || userData?.username || 'Unknown';
                                setUserNamesCache((prev) => ({ ...prev, [audit.createdBy!]: fullName }));
                              })
                              .catch(() => {
                                setUserNamesCache((prev) => ({ ...prev, [audit.createdBy!]: 'Unknown' }));
                              });
                          }
                          
                          return (
                            <span className="text-sm text-gray-600">{creatorName}</span>
                          );
                        },
                      },
                      {
                        key: 'actions',
                        header: 'Actions',
                        align: 'center' as const,
                        cellClassName: 'whitespace-nowrap text-center',
                        render: (audit) => (
                          <button
                            onClick={() => handleAuditSelect(audit.auditId)}
                            className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            Select
                          </button>
                        ),
                      },
                    ]}
                    data={audits}
                    emptyMessage="No audits found."
                  />
                </div>
              )}
            </>
          ) : (
            // Show departments and assignments for selected audit
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <span className="ml-3 text-gray-600">Loading...</span>
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800">{error}</p>
                </div>
              ) : (
                <>
                  {/* Departments List */}
                  {departments.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                      <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-medium text-gray-900">
                          Departments ({departments.length})
                        </h2>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {departments.map((dept) => {
                          const departmentAssignment = assignments.find(
                            (a) => a.deptId === dept.deptId && a.auditId === selectedAuditId
                          );
                          const isAssigned = isDepartmentAssigned(dept.deptId);
                          
                          return (
                            <div
                              key={dept.deptId}
                              className="px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                              onClick={() => handleViewDepartmentAssignments(dept)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h3 className="text-base font-medium text-gray-900">{dept.name}</h3>
                                  {isAssigned && departmentAssignment && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      Auditor: {departmentAssignment.auditorName || 'N/A'}
                                    </p>
                                  )}
                                </div>
                                <div className="ml-4 flex items-center gap-2">
                                  {isAssigned ? (
                                    <span className="px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded-lg">
                                      Assigned
                                    </span>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAssignModal(dept);
                                      }}
                                      className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                                    >
                                      Assign
                                    </button>
                                  )}
                                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {departments.length === 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800">No departments found for this audit.</p>
                    </div>
                  )}
                </>
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

      {/* Detail Modal */}
      {isDetailModalOpen && (selectedAssignment || selectedDepartmentForDetail) && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={handleCloseDetailModal}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Assignment Details
                </h3>
                <button
                  onClick={handleCloseDetailModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Audit Information */}
                {selectedAuditId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Audit Title
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                        {audits.find(a => a.auditId === selectedAuditId)?.title || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Department Information */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-base font-semibold text-gray-900 mb-3">Department Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department Name
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                        {selectedDepartmentForDetail?.name || selectedAssignment?.departmentName || 'N/A'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Department Details from API */}
                  {loadingDepartmentDetail ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                      Loading department details...
                    </div>
                  ) : departmentDetail ? (
                    <div className="mt-3 space-y-2">
                      {departmentDetail.code && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Department Code
                          </label>
                          <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                            {departmentDetail.code}
                          </p>
                        </div>
                      )}
                      {departmentDetail.description && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description
                          </label>
                          <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                            {departmentDetail.description}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Auditor Information - Only show if assigned */}
                {selectedAssignment && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-base font-semibold text-gray-900 mb-3">Auditor Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Auditor Name
                        </label>
                        <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                          {selectedAssignment.auditorName || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Status and Dates - Only show if assigned */}
                {selectedAssignment && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-base font-semibold text-gray-900 mb-3">Status & Timeline</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <span
                          className={`inline-block px-3 py-2 text-sm font-medium rounded-lg ${
                            selectedAssignment.status === 'Assigned'
                              ? 'bg-green-100 text-green-800'
                              : selectedAssignment.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : selectedAssignment.status === 'Completed'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {selectedAssignment.status}
                        </span>
                      </div>
                      {selectedAssignment.assignedAt && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Assigned At
                          </label>
                          <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                            {new Date(selectedAssignment.assignedAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Notes - Only show if assigned */}
                {selectedAssignment?.notes && (
                  <div className="border-t border-gray-200 pt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-sm text-gray-900 whitespace-pre-wrap">
                        {selectedAssignment.notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Show message if not assigned */}
                {!selectedAssignment && selectedDepartmentForDetail && (
                  <div className="border-t border-gray-200 pt-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        This department has not been assigned to an auditor yet.
                      </p>
                      <button
                        onClick={() => {
                          handleCloseDetailModal();
                          handleOpenAssignModal(selectedDepartmentForDetail);
                        }}
                        className="mt-3 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Assign Auditor
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseDetailModal}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

