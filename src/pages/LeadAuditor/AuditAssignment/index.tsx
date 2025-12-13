import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditorsByAuditId } from '../../../api/auditTeam';
import { getAuditScopeDepartmentsByAuditId, getAuditPlans, getSensitiveDepartments } from '../../../api/audits';
import { createAuditAssignment, getAuditAssignments, bulkCreateAuditAssignments } from '../../../api/auditAssignments';
import { getDepartmentById } from '../../../api/departments';
import { issueAccessGrant } from '../../../api/accessGrant';
import { unwrap } from '../../../utils/normalize';
import { toast } from 'react-toastify';

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
  const [selectedAuditorIds, setSelectedAuditorIds] = useState<string[]>([]);
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
  
  // QR Grant state
  const [showQrGrantModal, setShowQrGrantModal] = useState(false);
  const [issuingQr, setIssuingQr] = useState(false);
  const [qrGrantResults, setQrGrantResults] = useState<Array<{ auditorId: string; auditorName: string; success: boolean; qrUrl?: string; error?: string }>>([]);

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
    setSelectedAuditorIds([]);
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
    setSelectedAuditorIds([]);
    setNotes('');
    setAuditors([]);
    setShowConfirmModal(false);
  };

  const handleCloseQrGrantModal = () => {
    setShowQrGrantModal(false);
    setQrGrantResults([]);
    handleCloseModal();
    
    // Refresh assignments and departments
    if (selectedAuditId) {
      getAuditAssignments().then(data => setAssignments(data || [])).catch(() => {});
      getAuditScopeDepartmentsByAuditId(selectedAuditId).then(deptData => {
        const deptList = Array.isArray(deptData) ? deptData : (deptData?.$values || []);
        setDepartments(deptList);
      }).catch(() => {});
    }
  };

  const handleIssueQrGrants = async () => {
    if (!selectedAuditId || !selectedDepartment || selectedAuditorIds.length === 0) {
      toast.error('Missing information for QR grant');
      return;
    }

    const audit = audits.find(a => a.auditId === selectedAuditId);
    if (!audit || !audit.startDate || !audit.endDate) {
      toast.error('Audit dates are required for QR grant');
      return;
    }

    setIssuingQr(true);
    setQrGrantResults([]);

    const results: Array<{ auditorId: string; auditorName: string; success: boolean; qrUrl?: string; error?: string }> = [];

    try {
      // Issue QR for each auditor
      for (const auditorId of selectedAuditorIds) {
        const auditor = auditors.find(a => String(a.userId) === auditorId);
        const auditorName = auditor?.fullName || 'Unknown';

        try {
          const qrGrant = await issueAccessGrant({
            auditId: selectedAuditId,
            auditorId: auditorId,
            deptId: selectedDepartment.deptId,
            validFrom: new Date(audit.startDate).toISOString(),
            validTo: new Date(audit.endDate).toISOString(),
            verifyCode: undefined, // Optional
            ttlMinutes: undefined, // Optional
          });

          results.push({
            auditorId,
            auditorName,
            success: true,
            qrUrl: qrGrant.qrUrl,
          });
        } catch (qrError: any) {
          console.error(`Failed to issue QR for auditor ${auditorId}:`, qrError);
          results.push({
            auditorId,
            auditorName,
            success: false,
            error: qrError?.response?.data?.message || qrError?.message || 'Unknown error',
          });
        }
      }

      setQrGrantResults(results);

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      if (successCount > 0) {
        toast.success(`QR codes issued successfully for ${successCount} auditor(s).`);
      }
      if (failCount > 0) {
        toast.warning(`${failCount} QR code(s) failed to issue. Check details below.`);
      }
    } catch (error: any) {
      console.error('Failed to issue QR grants:', error);
      toast.error('Failed to issue QR grants. Please try again.');
    } finally {
      setIssuingQr(false);
    }
  };

  const handleAssignClick = async () => {
    if (selectedAuditorIds.length === 0) return;
    if (!selectedDepartment || !selectedAuditId) {
      toast.error('Missing department or audit information');
      return;
    }
    
    setSubmitting(true);
    try {
      // Use bulk API if multiple auditors, otherwise single API
      if (selectedAuditorIds.length > 1) {
        const result = await bulkCreateAuditAssignments({
          auditId: selectedAuditId,
          deptId: selectedDepartment.deptId,
          auditorIds: selectedAuditorIds,
          notes: notes || '',
        });
        toast.success(`Successfully assigned ${result.length} auditor(s) to department.`);
      } else {
        // Single auditor - use existing API
        await createAuditAssignment({
          auditId: selectedAuditId,
          deptId: selectedDepartment.deptId,
          auditorId: selectedAuditorIds[0],
          notes: notes || '',
          status: 'Assigned',
        });
        toast.success('Auditor assigned successfully!');
      }
      
      // Check if this department has sensitive flag
      try {
        const sensitiveDepts = await getSensitiveDepartments(selectedAuditId);
        const hasSensitiveFlag = sensitiveDepts.some((sd: any) => 
          sd.deptId === selectedDepartment.deptId && sd.sensitiveFlag === true
        );
        
        if (hasSensitiveFlag) {
          // Get audit details for dates
          const audit = audits.find(a => a.auditId === selectedAuditId);
          if (audit && audit.startDate && audit.endDate) {
            // Show QR grant modal
            setShowQrGrantModal(true);
            setQrGrantResults([]);
            // Don't close assign modal yet, will close after QR grant
            return;
          }
        }
      } catch (sensitiveErr) {
        console.warn('Failed to check sensitive flag:', sensitiveErr);
      }
      
      handleCloseModal();
      
      // Refresh assignments and departments
      const assignmentsData = await getAuditAssignments().catch(() => []);
      setAssignments(assignmentsData || []);
      
      if (selectedAuditId) {
        const deptData = await getAuditScopeDepartmentsByAuditId(selectedAuditId);
        const deptList = Array.isArray(deptData) ? deptData : (deptData?.$values || []);
        setDepartments(deptList);
      }
    } catch (error: any) {
      console.error('Failed to assign auditors:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to assign auditors. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAssign = async () => {
    // Demo-only; confirm modal unused in this fake flow
    setShowConfirmModal(false);
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

                {/* Sensitive flag check - will be updated after assignment */}

                {/* Auditor Selection (multi-select, demo) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Auditor(s)
                  </label>
                  {loadingAuditors ? (
                    <div className="flex items-center justify-center py-4">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                      <span className="ml-2 text-sm text-gray-600">Loading auditors...</span>
                    </div>
                  ) : auditors.length === 0 ? (
                    <p className="text-sm text-gray-500 py-2">No auditors available</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-200 rounded-lg p-3">
                      {auditors.map((auditor) => {
                        const id = String(auditor.userId);
                        const checked = selectedAuditorIds.includes(id);
                        return (
                          <label
                            key={id}
                            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-primary-50 transition"
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? Array.from(new Set([...selectedAuditorIds, id]))
                                    : selectedAuditorIds.filter((x) => x !== id);
                                  setSelectedAuditorIds(next);
                                }}
                              />
                              <div className="text-sm">
                                <p className="font-semibold text-gray-900">{auditor.fullName || 'Unknown'}</p>
                                <p className="text-gray-600">{auditor.email || 'N/A'}</p>
                              </div>
                            </div>
                            {checked && (
                              <span className="text-xs text-primary-700 bg-primary-50 px-2 py-1 rounded-full border border-primary-100">
                                Selected
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">You can select multiple auditors (demo UI).</p>
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
                  disabled={selectedAuditorIds.length === 0 || loadingAuditors || submitting}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    'Assign'
                  )}
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
                  disabled={false}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Yes, Assign
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

      {/* QR Grant Modal */}
      {showQrGrantModal && selectedDepartment && selectedAuditId && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              if (!issuingQr) {
                handleCloseQrGrantModal();
              }
            }}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Issue QR Codes / Permissions
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Sensitive area detected. Issue QR codes for assigned auditors.
                  </p>
                </div>
                <button
                  onClick={handleCloseQrGrantModal}
                  disabled={issuingQr}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Info Banner */}
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900">
                        Sensitive Area Detected
                      </p>
                      <p className="text-xs text-amber-800 mt-1">
                        Department: <strong>{selectedDepartment.name}</strong> has sensitive areas. 
                        QR codes will be issued for the assigned auditors to access these areas during the audit period.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Audit Info */}
                {(() => {
                  const audit = audits.find(a => a.auditId === selectedAuditId);
                  return audit ? (
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Audit Title</label>
                        <p className="text-sm text-gray-900">{audit.title}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Valid Period</label>
                        <p className="text-sm text-gray-900">
                          {audit.startDate ? new Date(audit.startDate).toLocaleDateString() : 'N/A'} - {' '}
                          {audit.endDate ? new Date(audit.endDate).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>
                  ) : null;
                })()}

                {/* Selected Auditors */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Auditors to Issue QR Codes
                  </label>
                  <div className="space-y-2 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {selectedAuditorIds.map((auditorId) => {
                      const auditor = auditors.find(a => String(a.userId) === auditorId);
                      const result = qrGrantResults.find(r => r.auditorId === auditorId);
                      return (
                        <div
                          key={auditorId}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg bg-gray-50"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                              <span className="text-xs font-semibold text-primary-700">
                                {(auditor?.fullName || 'Unknown').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {auditor?.fullName || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-600">{auditor?.email || 'N/A'}</p>
                            </div>
                          </div>
                          {result && (
                            <div className="flex items-center gap-2">
                              {result.success ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Issued
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                  </svg>
                                  Failed
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* QR Grant Results */}
                {qrGrantResults.length > 0 && (
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Results</h4>
                    <div className="space-y-2">
                      {qrGrantResults.map((result) => (
                        <div
                          key={result.auditorId}
                          className={`p-3 rounded-lg ${
                            result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{result.auditorName}</p>
                              {result.success && result.qrUrl ? (
                                <div className="mt-2">
                                  <p className="text-xs text-gray-600 mb-1">QR Code URL:</p>
                                  <a
                                    href={result.qrUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary-600 hover:text-primary-700 underline break-all"
                                  >
                                    {result.qrUrl}
                                  </a>
                                </div>
                              ) : result.error ? (
                                <p className="text-xs text-red-600 mt-1">Error: {result.error}</p>
                              ) : null}
                            </div>
                            {result.success ? (
                              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCloseQrGrantModal}
                  disabled={issuingQr}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {qrGrantResults.length > 0 ? 'Close' : 'Skip'}
                </button>
                {qrGrantResults.length === 0 && (
                  <button
                    type="button"
                    onClick={handleIssueQrGrants}
                    disabled={issuingQr || selectedAuditorIds.length === 0}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {issuingQr ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Issuing QR Codes...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                        </svg>
                        Issue QR Codes
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

