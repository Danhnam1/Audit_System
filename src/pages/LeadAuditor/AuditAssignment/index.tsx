import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditorsByAuditId } from '../../../api/auditTeam';
import { getAuditScopeDepartmentsByAuditId, getAuditPlans, getSensitiveDepartments } from '../../../api/audits';
import { getAuditScheduleByAudit } from '../../../api/auditSchedule';
import { createAuditAssignment, getAuditAssignments, bulkCreateAuditAssignments, getAllAuditAssignmentRequests, approveAuditAssignmentRequest, rejectAuditAssignmentRequest } from '../../../api/auditAssignments';
import { getDepartmentById } from '../../../api/departments';
import { createAuditChecklistItemsFromTemplate, getChecklistItemsByDepartment } from '../../../api/checklists';
import { issueAccessGrant, getAccessGrants } from '../../../api/accessGrant';

import { getUserById } from '../../../api/adminUsers';

import { unwrap } from '../../../utils/normalize';
import { toast } from 'react-toastify';
import { DataTable } from '../../../components/DataTable';
import { Pagination } from '../../../components/Pagination';
import { QRCodeSVG } from 'qrcode.react';
import { getStatusColor } from '../../../constants';

interface Department {
  deptId: number;
  name: string;
  auditIds: string[];
  sensitiveFlag?: boolean;
  sensitiveAreas?: string[];
  hasSensitiveAreas?: boolean; // optional server flag indicating sensitive areas exist
}

interface Auditor {
  userId: string;
  fullName: string;
  email: string;
  roleInTeam?: string;
  role?: string;
  roleName?: string;
  isLead?: boolean;
  isLeadAuditor?: boolean;
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
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [userNamesCache, setUserNamesCache] = useState<Record<string, string>>({});
  const [qrValidityFrom, setQrValidityFrom] = useState<Date | null>(null);
  const [qrValidityTo, setQrValidityTo] = useState<Date | null>(null);
  
  // Modal state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [auditors, setAuditors] = useState<Auditor[]>([]);
  const [selectedAuditorIds, setSelectedAuditorIds] = useState<string[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [plannedStartDate, setPlannedStartDate] = useState<string>('');
  const [plannedEndDate, setPlannedEndDate] = useState<string>('');
  const [estimatedDuration, setEstimatedDuration] = useState<number>(0);
  const [loadingAuditors, setLoadingAuditors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // Detail modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [departmentDetail, setDepartmentDetail] = useState<any>(null);
  const [loadingDepartmentDetail, setLoadingDepartmentDetail] = useState(false);
  const [selectedDepartmentForDetail, setSelectedDepartmentForDetail] = useState<Department | null>(null);
  const [qrGrantsForDetail, setQrGrantsForDetail] = useState<Array<{ grantId: string; auditorId: string; qrUrl: string; verifyCode?: string; validFrom: string; validTo: string; status: string }>>([]);
  const [loadingQrGrants, setLoadingQrGrants] = useState(false);
  const [expandedAuditorIds, setExpandedAuditorIds] = useState<Set<string>>(new Set());
  const [auditorNamesForDetail, setAuditorNamesForDetail] = useState<Record<string, string>>({});
  const [auditorEmailsForDetail, setAuditorEmailsForDetail] = useState<Record<string, string>>({});
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set());
  
  // QR Grant state
  const [showQrGrantModal, setShowQrGrantModal] = useState(false);
  const [issuingQr, setIssuingQr] = useState(false);
  const [qrGrantResults, setQrGrantResults] = useState<Array<{ auditorId: string; auditorName: string; success: boolean; qrUrl?: string; error?: string }>>([]);
  
  // Request state
  const [assignmentRequests, setAssignmentRequests] = useState<Array<{
    requestId: string;
    auditId: string;
    deptId: number;
    auditAssignmentId: string;
    reasonRequest: string;
    actualAuditDate: string;
    status: string;
    createdBy?: string;
    createdByName?: string;
  }>>([]);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<{
    requestId: string;
    auditId: string;
    deptId: number;
    auditAssignmentId: string;
    reasonRequest: string;
    actualAuditDate: string;
    status: string;
    createdBy?: string;
    createdByName?: string;
  } | null>(null);
  const [processingRequest, setProcessingRequest] = useState(false);

  // Load audits first
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      setError(null);
      try {
        const auditsData = await getAuditPlans();
        const auditsList = unwrap<Audit>(auditsData);
        // Show audits with status "InProgress" or "Approved"
        const filteredAudits = (Array.isArray(auditsList) ? auditsList : []).filter((audit: Audit) => {
          const statusLower = (audit.status || '').toLowerCase().trim();
          return statusLower === 'inprogress' || statusLower === 'approved';
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
      setQrValidityFrom(null);
      setQrValidityTo(null);
      return;
    }

    const loadDepartments = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load assignments
        const assignmentsData = await getAuditAssignments().catch(() => []);
        setAssignments(assignmentsData || []);
        
        // Load assignment requests
        try {
          const requestsData = await getAllAuditAssignmentRequests();
          
          // Handle different response formats
          let requestsArray: any[] = [];
          if (Array.isArray(requestsData)) {
            requestsArray = requestsData;
          } else if (requestsData?.$values && Array.isArray(requestsData.$values)) {
            requestsArray = requestsData.$values;
          } else if (requestsData?.data?.$values && Array.isArray(requestsData.data.$values)) {
            requestsArray = requestsData.data.$values;
          } else if (requestsData?.data && Array.isArray(requestsData.data)) {
            requestsArray = requestsData.data;
          } else {
            const requestsList = unwrap<any>(requestsData);
            requestsArray = Array.isArray(requestsList) ? requestsList : [];
          }
          
          setAssignmentRequests(requestsArray);
        } catch (reqErr: any) {
          console.error('[AuditAssignment] Failed to load assignment requests:', reqErr);
          setAssignmentRequests([]);
        }

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

          // Load sensitive flags for this audit and build a quick lookup by deptId
          let sensitiveByDept: Record<
            number,
            { sensitiveFlag: boolean; areas?: string[]; notes?: string }
          > = {};

          try {
            const sensitiveRaw: any = await getSensitiveDepartments(selectedAuditId);
            const sensitiveArr: any[] = Array.isArray(sensitiveRaw)
              ? (sensitiveRaw as any[])
              : (sensitiveRaw?.$values as any[]) || [];

            sensitiveByDept = sensitiveArr.reduce(
              (acc: typeof sensitiveByDept, item: any) => {
                const deptId: number =
                  Number(item.deptId ?? item.DeptId ?? NaN);
                if (!Number.isNaN(deptId)) {
                  acc[deptId] = {
                    sensitiveFlag: Boolean(
                      item.sensitiveFlag ?? item.SensitiveFlag ?? false
                    ),
                    areas:
                      item.areas ??
                      item.Areas ??
                      (Array.isArray(item.sensitiveAreas)
                        ? item.sensitiveAreas
                        : undefined),
                    notes: item.notes ?? item.Notes,
                  };
                }
                return acc;
              },
              {} as typeof sensitiveByDept
            );
          } catch (sensErr) {
            console.warn(
              '[AuditAssignment] Failed to load sensitive departments:',
              sensErr
            );
          }

          // Map departments with auditIds + merged sensitive info
          const mappedDepartments: Department[] = deptArray.map((dept: any) => {
            const backendSensitive = sensitiveByDept[dept.deptId];

            // Normalize sensitive areas from department or sensitive map
            const sensitiveAreas: string[] | undefined =
              backendSensitive?.areas ??
              (Array.isArray(dept?.sensitiveAreas)
                ? dept.sensitiveAreas
                : Array.isArray(dept?.areas)
                ? dept.areas
                : Array.isArray(dept?.SensitiveAreas)
                ? dept.SensitiveAreas
                : undefined);

            const sensitiveFlag =
              !!backendSensitive?.sensitiveFlag ||
              !!dept?.sensitiveFlag ||
              !!dept?.isSensitive ||
              !!dept?.sensitive ||
              !!dept?.sensitiveArea ||
              !!dept?.hasSensitiveAreas ||
              !!dept?.HasSensitiveAreas ||
              (!!sensitiveAreas && sensitiveAreas.length > 0);

            return {
              ...dept,
              auditIds: [selectedAuditId],
              sensitiveFlag,
              hasSensitiveAreas:
                sensitiveFlag || !!(sensitiveAreas && sensitiveAreas.length),
              sensitiveAreas,
            } as Department;
          });

          setDepartments(mappedDepartments);

          // Load audit schedule to determine QR validity window from backend configuration
          try {
            const scheduleResponse = await getAuditScheduleByAudit(selectedAuditId);
            const schedulesArray = unwrap<any>(scheduleResponse);

            const fieldworkStart = (schedulesArray || []).find((s: any) =>
              String(s.milestoneName || '').toLowerCase().includes('fieldwork start')
            );
            const evidenceDue = (schedulesArray || []).find((s: any) =>
              String(s.milestoneName || '').toLowerCase().includes('evidence due')
            );

            if (fieldworkStart?.dueDate) {
              setQrValidityFrom(new Date(fieldworkStart.dueDate));
            } else {
              setQrValidityFrom(null);
            }

            if (evidenceDue?.dueDate) {
              setQrValidityTo(new Date(evidenceDue.dueDate));
            } else {
              setQrValidityTo(null);
            }
          } catch (scheduleErr) {
            setQrValidityFrom(null);
            setQrValidityTo(null);
          }
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
    setPlannedStartDate('');
    setPlannedEndDate('');
    setEstimatedDuration(0);
    setIsAssignModalOpen(true);
    loadAuditors(auditId);
  };

  // Check if auditor has an Accepted request (busy)
  const isAuditorBusy = (auditorId: string): boolean => {
    return assignmentRequests.some((request) => {
      const requestUserId = String(request.createdBy || '').trim();
      const auditorIdStr = String(auditorId).trim();
      const status = (request.status || '').toLowerCase().trim();
      
      return requestUserId === auditorIdStr && status === 'accepted';
    });
  };

  const loadAuditors = async (auditId: string) => {
    if (!auditId) return;
    
    setLoadingAuditors(true);
    try {
      const auditorsData = await getAuditorsByAuditId(auditId);
      const auditorsList = Array.isArray(auditorsData) ? auditorsData : [];
      
      // Filter out LeadAuditor from the list
      const filteredAuditors = auditorsList.filter((auditor: any) => {
        // Check role fields (case-insensitive)
        const role = (auditor.roleInTeam || auditor.role || auditor.roleName || '').toLowerCase().trim();
        const normalizedRole = role.replace(/\s+/g, '');
        
        // Check if is LeadAuditor
        const isLead = auditor.isLead || auditor.isLeadAuditor || false;
        
        // Exclude if role is "leadauditor" or "lead auditor" or if isLead flag is true
        if (normalizedRole === 'leadauditor' || normalizedRole === 'lead auditor' || isLead) {
          return false;
        }
        
        return true;
      });
      
      setAuditors(filteredAuditors);
    } catch (err: any) {
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
    setPlannedStartDate('');
    setPlannedEndDate('');
    setEstimatedDuration(0);
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

  // Generate a random 6-digit verify code
  const generateVerifyCode = (): string => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleIssueQrGrants = async () => {
    if (!selectedAuditId || !selectedDepartment || selectedAuditorIds.length === 0) {
      toast.error('Missing information for QR grant');
      return;
    }

    const audit = audits.find(a => a.auditId === selectedAuditId);
    if (!audit) {
      toast.error('Audit data is required for QR grant');
      return;
    }

    // BE mới là nơi ràng buộc validity window (ValidFrom/ValidTo).
    // FE KHÔNG chặn cấp QR nếu thiếu lịch; chỉ cố gắng gửi giá trị hợp lý nếu có.
    const nowUtc = new Date();

    // Lấy cửa sổ validity từ schedule backend nếu có; fallback sang Audit Period
    let validFromDate: Date = qrValidityFrom || nowUtc;
    let validToDate: Date =
      qrValidityTo || new Date(nowUtc.getTime() + 7 * 24 * 60 * 60 * 1000); // fallback 7 ngày

    if (!qrValidityFrom && audit.startDate) {
      const d = new Date(audit.startDate);
      if (!isNaN(d.getTime())) {
        validFromDate = d;
      }
    }

    if (!qrValidityTo && audit.endDate) {
      const d = new Date(audit.endDate);
      if (!isNaN(d.getTime())) {
        validToDate = d;
      }
    }

    // Nếu validTo trước validFrom, kéo validTo về sau validFrom 1 ngày để tránh lỗi client.
    if (validToDate <= validFromDate) {
      validToDate = new Date(validFromDate.getTime() + 24 * 60 * 60 * 1000);
    }

    const validFrom = validFromDate.toISOString();
    const validTo = validToDate.toISOString();

    setIssuingQr(true);
    setQrGrantResults([]);

    const results: Array<{ auditorId: string; auditorName: string; success: boolean; qrUrl?: string; error?: string }> = [];

    try {
      // Issue QR for each auditor
      for (const auditorId of selectedAuditorIds) {
        const auditor = auditors.find(a => String(a.userId) === auditorId);
        const auditorName = auditor?.fullName || 'Unknown';

        try {
          // Build request payload - VerifyCode is required by backend
          // TEST MODE: Uncomment the lines below to test expired QR code
          // const testValidFrom = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
          // const testValidTo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
          
          const requestPayload: any = {
            auditId: selectedAuditId,
            auditorId: auditorId,
            deptId: selectedDepartment.deptId,
            validFrom,
            validTo,
            // TEST MODE: Use test dates instead
            // validFrom: testValidFrom.toISOString(),
            // validTo: testValidTo.toISOString(),
            verifyCode: generateVerifyCode(), // Required by backend - generate random 6-digit code
            // ttlMinutes is optional, so we don't include it if undefined
          };
          
        
          const qrGrant = await issueAccessGrant(requestPayload);

          results.push({
            auditorId,
            auditorName,
            success: true,
            qrUrl: qrGrant.qrUrl,
          });
        } catch (qrError: any) {
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
    
    // Validate required fields
    if (!plannedStartDate || !plannedEndDate) {
      toast.error('Planned start date and end date are required');
      return;
    }
    
    if (!estimatedDuration || estimatedDuration <= 0) {
      toast.error('Estimated duration is required and must be greater than 0');
      return;
    }
    
    // Validate dates
    const selectedAudit = audits.find(a => a.auditId === selectedAuditId);
    const startDate = new Date(plannedStartDate);
    const endDate = new Date(plannedEndDate);
    
    if (endDate < startDate) {
      toast.error('Planned end date must be after start date');
      return;
    }
    
    // Validate dates are within audit plan timeframe
    if (selectedAudit) {
      const auditStart = new Date(selectedAudit.startDate);
      const auditEnd = new Date(selectedAudit.endDate);
      
      if (startDate < auditStart || endDate > auditEnd) {
        toast.error(`Planned dates must be within audit timeframe: ${auditStart.toLocaleDateString()} - ${auditEnd.toLocaleDateString()}`);
        return;
      }
    }
    
    // Determine if current department has sensitive areas
    const isSensitiveDept = !!(
      selectedDepartment.sensitiveFlag ||
      selectedDepartment.hasSensitiveAreas ||
      (selectedDepartment.sensitiveAreas && selectedDepartment.sensitiveAreas.length > 0)
    );

    setSubmitting(true);
    try {
      // Convert date format to ISO string
      const formatDateForAPI = (dateString: string): string | undefined => {
        if (!dateString) return undefined;
        // date input returns "YYYY-MM-DD", convert to ISO string
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? undefined : date.toISOString();
      };

      // Use bulk API if multiple auditors, otherwise single API
      if (selectedAuditorIds.length > 1) {
        const result = await bulkCreateAuditAssignments({
          auditId: selectedAuditId,
          deptId: selectedDepartment.deptId,
          auditorIds: selectedAuditorIds,
          notes: notes || '',
          plannedStartDate: formatDateForAPI(plannedStartDate),
          plannedEndDate: formatDateForAPI(plannedEndDate),
          estimatedDuration: estimatedDuration > 0 ? estimatedDuration : undefined,
        });
        // For non-sensitive departments, show success immediately.
        // For sensitive departments, show success only after QR codes are issued.
        if (!isSensitiveDept) {
          toast.success(`Successfully assigned ${result.length} auditor(s) to department.`);
        }
      } else {
        // Single auditor - use existing API
        await createAuditAssignment({
          auditId: selectedAuditId,
          deptId: selectedDepartment.deptId,
          auditorId: selectedAuditorIds[0],
          notes: notes || '',
          status: 'Assigned',
          plannedStartDate: formatDateForAPI(plannedStartDate),
          plannedEndDate: formatDateForAPI(plannedEndDate),
          estimatedDuration: estimatedDuration > 0 ? estimatedDuration : undefined,
        });
        if (!isSensitiveDept) {
          toast.success('Auditor assigned successfully!');
        }
      }
      

      // Create checklist items from template for ALL departments (not just sensitive)
      // Check if checklist items already exist before creating (to avoid duplicates)
      // Do NOT return early; we still need to continue flow (e.g., QR modal for sensitive dept)
      try {
        // Validate auditId before calling API
        if (!selectedAuditId || selectedAuditId.trim() === '') {
          console.error('[AuditAssignment] Cannot create checklist items: invalid auditId', {
            selectedAuditId,
            type: typeof selectedAuditId,
            length: selectedAuditId?.length
          });
          throw new Error('Invalid audit ID');
        }
        
        const auditIdToUse = selectedAuditId.trim();
        const deptIdToUse = selectedDepartment.deptId;
        let shouldCreate = true;
        
        // Check if checklist items already exist for this audit and department
        try {
          const existingItems = await getChecklistItemsByDepartment(deptIdToUse);
          // Filter items that belong to this audit
          const itemsForThisAudit = existingItems.filter((item: any) => {
            const itemAuditId = item.auditId || item.AuditId || item.auditPlanId;
            return String(itemAuditId) === String(auditIdToUse);
          });
          
          if (itemsForThisAudit.length > 0) {
            console.log('ℹ️ [AuditAssignment] Checklist items already exist for this audit and department, skipping creation:', {
              auditId: auditIdToUse,
              deptId: deptIdToUse,
              existingItemsCount: itemsForThisAudit.length,
              note: 'Items were likely created during audit plan submission. Skipping to avoid duplicates.'
            });
            shouldCreate = false; // skip creation but continue flow
          }
        } catch (checkErr: any) {
          // If check fails, continue with creation (maybe items don't exist)
          console.warn('[AuditAssignment] Could not check existing checklist items, will attempt to create:', checkErr?.message);
        }
        
        if (shouldCreate) {
          // Log detailed information for debugging
          console.log('🔍 [AuditAssignment] Creating checklist items from template:', {
            auditId: auditIdToUse,
            auditIdType: typeof auditIdToUse,
            auditIdLength: auditIdToUse.length,
            auditIdIsValidUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auditIdToUse),
            deptId: deptIdToUse,
            deptIdType: typeof deptIdToUse,
            selectedDepartment: {
              deptId: selectedDepartment.deptId,
              name: selectedDepartment.name
            }
          });
          
          const result = await createAuditChecklistItemsFromTemplate(
            auditIdToUse,
            deptIdToUse
          );
          
          console.log('✅ [AuditAssignment] Checklist items created successfully:', result);
        }
      } catch (checklistError: any) {
        // Check if error is due to duplicate (items already exist)
        const errorMessage = checklistError?.response?.data?.message || checklistError?.message || '';
        const isDuplicateError = errorMessage.toLowerCase().includes('duplicate') || 
                                 errorMessage.toLowerCase().includes('already exist') ||
                                 errorMessage.toLowerCase().includes('trùng');
        
        if (isDuplicateError) {
          console.log('ℹ️ [AuditAssignment] Checklist items already exist (duplicate detected), skipping:', errorMessage);
          // Don't show warning for duplicate - it's expected if items were created earlier
        } else {
          // Do not block assignment if checklist creation fails, but log the error
          console.error('[AuditAssignment] Failed to create checklist items from template:', {
            error: checklistError,
            response: checklistError?.response,
            responseData: checklistError?.response?.data,
            message: checklistError?.message
          });
          toast.warning(`Checklist items creation failed: ${errorMessage || 'Unknown error'}. Assignment will continue.`);
        }
      }

      if (isSensitiveDept) {
        // Always show QR modal for sensitive departments.
        // Backend is responsible for calculating a valid QR validity window,
        // even if audit start / end dates are missing.
        setShowQrGrantModal(true);
        setQrGrantResults([]);
        // Don't close assign modal yet, will close after QR grant flow finishes.
        return;
      }
      
      // Non-sensitive or missing audit dates -> just close
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
    if (!selectedAuditId) return false;

    const normalizedStatus = (status: string) => status.toLowerCase().trim();
    const isAssignedStatus = (status: string) => {
      const normalized = normalizedStatus(status);
      // Check for "assigned" or "asiggned" (typo in database)
      return normalized === 'assigned' || normalized === 'asiggned' || normalized.includes('assign');
    };
    
    return assignments.some(
      (assignment) =>
        assignment.deptId === deptId &&
        String(assignment.auditId || '').trim() === String(selectedAuditId).trim() &&
        isAssignedStatus(assignment.status)
    );
  };

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Helper function to check if audit is time-constrained
  const isTimeConstrained = (audit: Audit): boolean => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // Check if endDate is within 30 days or has passed
    if (audit.endDate) {
      const endDate = new Date(audit.endDate);
      endDate.setHours(0, 0, 0, 0);
      const daysUntilEnd = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Time-constrained if end date is within 30 days or has passed
      if (daysUntilEnd <= 30) {
        return true;
      }
    }
    
    // Check if startDate is within 7 days
    if (audit.startDate) {
      const startDate = new Date(audit.startDate);
      startDate.setHours(0, 0, 0, 0);
      const daysUntilStart = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Time-constrained if start date is within 7 days
      if (daysUntilStart >= 0 && daysUntilStart <= 7) {
        return true;
      }
    }
    
    return false;
  };

  // Check if audit is pending (audits with status "Approved")
  const isPendingAudit = (audit: Audit): boolean => {
    // Pending = audits with status "Approved" (case-insensitive)
    const status = (audit.status || '').toLowerCase().trim();
    return status === 'approved';
  };

  // Check if audit is InProgress
  const isInProgressAudit = (audit: Audit): boolean => {
    const status = (audit.status || '').toLowerCase().trim();
    return status === 'inprogress';
  };

  // Get filtered audits based on active tab
  const getFilteredAudits = (): Audit[] => {
    if (activeTab === 'pending') {
      // Pending tab: only show Approved audits
      return audits.filter(audit => isPendingAudit(audit));
    }
    // All tab: only show InProgress audits
    return audits.filter(audit => isInProgressAudit(audit));
  };

  // Calculate pagination
  const filteredAudits = getFilteredAudits();
  const totalPages = Math.ceil(filteredAudits.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAudits = filteredAudits.slice(startIndex, endIndex);

  // Reset to page 1 when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

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
    
    // Find assignment for this department (first match) and full list for names
    const assignment = assignments.find(
      (a) => a.deptId === dept.deptId && a.auditId === selectedAuditId
    );
    const deptAssignments = assignments.filter(
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
        setDepartmentDetail(null);
      } finally {
        setLoadingDepartmentDetail(false);
      }
      
      // Fetch QR grants for this assignment
      setLoadingQrGrants(true);
      try {
        const grants = await getAccessGrants({
          auditId: selectedAuditId || undefined,
          deptId: dept.deptId,
          auditorId: assignment.auditorId || undefined,
        });
        setQrGrantsForDetail(grants || []);
        
        // Fetch auditor names for the grants and assignments (combine to avoid missing names)
        // Filter out assignments with "Rejected" status
        const activeAssignments = deptAssignments.filter(a => {
          const status = (a.status || '').toLowerCase().trim();
          return status !== 'rejected';
        });
        
        const uniqueAuditorIds = new Set<string>();
        (grants || []).forEach(g => g.auditorId && uniqueAuditorIds.add(g.auditorId));
        activeAssignments.forEach(a => a.auditorId && uniqueAuditorIds.add(a.auditorId));

        if (uniqueAuditorIds.size > 0) {
        Promise.all(
            Array.from(uniqueAuditorIds).map(async (auditorId) => {
            try {
              const user = await getUserById(auditorId);
              return { auditorId, name: user?.fullName || 'Unknown', email: user?.email || 'N/A' };
            } catch {
              return { auditorId, name: 'Unknown', email: 'N/A' };
            }
          })
        ).then((results) => {
          const namesMap: Record<string, string> = {};
          const emailsMap: Record<string, string> = {};
          results.forEach(({ auditorId, name, email }) => {
            namesMap[auditorId] = name;
            emailsMap[auditorId] = email;
          });
          setAuditorNamesForDetail(namesMap);
          setAuditorEmailsForDetail(emailsMap);
        });
        } else {
          setAuditorNamesForDetail({});
          setAuditorEmailsForDetail({});
        }
      } catch (err: any) {
        setQrGrantsForDetail([]);
      } finally {
        setLoadingQrGrants(false);
      }
    } else {
      setSelectedAssignment(null);
      setDepartmentDetail(null);
      setQrGrantsForDetail([]);
    }
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedAssignment(null);
    setDepartmentDetail(null);
    setSelectedDepartmentForDetail(null);
    setQrGrantsForDetail([]);
    setExpandedAuditorIds(new Set());
    setAuditorNamesForDetail({});
    setAuditorEmailsForDetail({});
    setExpandedUserIds(new Set());
  };

  const toggleAuditorExpand = (auditorId: string) => {
    setExpandedAuditorIds((prev) => {
      const next = new Set(prev);
      if (next.has(auditorId)) {
        next.delete(auditorId);
      } else {
        next.add(auditorId);
      }
      return next;
    });
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

        {/* Tabs - Show when not viewing a specific audit */}
        {!selectedAuditId && (
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-2">
              <nav className="flex space-x-2" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('all')}
                  type="button"
                  className={`
                    px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2
                    ${
                      activeTab === 'all'
                        ? 'bg-primary-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 bg-white'
                    }
                  `}
                >
                  All Audits
                  {(() => {
                    const inProgressCount = audits.filter(audit => isInProgressAudit(audit)).length;
                    return inProgressCount > 0 ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        activeTab === 'all' 
                          ? 'bg-white bg-opacity-20 text-white' 
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {inProgressCount}
                      </span>
                    ) : null;
                  })()}
                </button>
                <button
                  onClick={() => setActiveTab('pending')}
                  type="button"
                  className={`
                    px-6 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center gap-2
                    ${
                      activeTab === 'pending'
                        ? 'bg-orange-600 text-white shadow-md'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 bg-white'
                    }
                  `}
                >
                  Pending
                  {(() => {
                    const pendingCount = audits.filter(audit => isPendingAudit(audit)).length;
                    return (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        activeTab === 'pending'
                          ? 'bg-white bg-opacity-20 text-white'
                          : pendingCount > 0
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {pendingCount}
                      </span>
                    );
                  })()}
                </button>
              </nav>
            </div>
          </div>
        )}

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
              ) : getFilteredAudits().length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800">
                    {activeTab === 'pending' 
                      ? 'No pending audits found.' 
                      : 'No audits found.'}
                  </p>
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
                          <span className="text-sm text-gray-700">{startIndex + index + 1}</span>
                        ),
                      },
                      {
                        key: 'title',
                        header: 'Title',
                        render: (audit) => {
                          const isConstrained = isTimeConstrained(audit);
                          return (
                            <div className="max-w-[200px] flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">{audit.title || 'Untitled'}</p>
                              {isConstrained && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200" title="Time-constrained audit">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Urgent
                                </span>
                              )}
                            </div>
                          );
                        },
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
                              .then((userData) => {
                                const fullName = userData?.fullName || 'Unknown';
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
                    data={paginatedAudits}
                    emptyState={activeTab === 'pending' ? 'No pending audits found.' : 'No audits found.'}
                  />
                  {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-gray-200">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
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
                      <div className="px-4 sm:px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-medium text-gray-900">
                            Departments ({departments.length})
                          </h2>
                          <p className="mt-1 text-xs text-gray-500">
                            Departments with <span className="font-semibold text-amber-700">Sensitive areas</span> are
                            highlighted for your attention.
                          </p>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-200">
                        {departments.map((dept) => {
                          const deptAssignments = assignments.filter(
                            (a) => a.deptId === dept.deptId && a.auditId === selectedAuditId
                          );
                          
                          // Filter out rejected assignments
                          const activeAssignments = deptAssignments.filter(a => {
                            const status = (a.status || '').toLowerCase().trim();
                            return status !== 'rejected';
                          });
                          
                          const isAssigned = activeAssignments.length > 0 || isDepartmentAssigned(dept.deptId);
                          
                          // Check if any assignment has Rejected status AND no active assignments exist
                          const hasRejectedAssignment = deptAssignments.some(
                            (a) => a.status?.toLowerCase() === 'rejected'
                          ) && activeAssignments.length === 0;
                          
                          // Only show auditor names from active (non-rejected) assignments
                          const auditorNames = Array.from(
                            new Map(
                              activeAssignments
                                .filter((a) => a.auditorId)
                                .map((a) => [String(a.auditorId), a.auditorName || 'N/A'])
                            ).values()
                          );

                          // Check if there's a pending request matching this department and audit
                          // Match by: deptId, auditId, and optionally auditAssignmentId if assignment exists
                          const matchedRequest = assignmentRequests.find(req => {
                            // Check deptId match (handle both number and string)
                            const matchesDept = Number(req.deptId) === Number(dept.deptId);
                            // Check auditId match (case-insensitive)
                            const matchesAudit = String(req.auditId || '').toLowerCase().trim() === String(selectedAuditId || '').toLowerCase().trim();
                            // Check status is pending
                            const isPending = (req.status || '').toLowerCase().trim() === 'pending';
                            
                            // If there are active assignments, also check auditAssignmentId match
                            if (activeAssignments.length > 0) {
                              const matchesAssignment = activeAssignments.some(assignment => 
                                String(req.auditAssignmentId || '').toLowerCase().trim() === String(assignment.assignmentId || '').toLowerCase().trim()
                              );
                              if (matchesDept && matchesAudit && isPending && matchesAssignment) {
                                return true;
                              }
                              return false;
                            } else {
                              // If no active assignments, just check deptId and auditId
                              if (matchesDept && matchesAudit && isPending) {
                                return true;
                              }
                              return false;
                            }
                          });

                          // Determine if this department has sensitive areas
                          const isSensitiveDept = !!(
                            dept.sensitiveFlag ||
                            dept.hasSensitiveAreas ||
                            (dept.sensitiveAreas && dept.sensitiveAreas.length > 0)
                          );
                          
                          return (
                            <div
                              key={dept.deptId}
                              className={`px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                                isSensitiveDept ? 'border-l-4 border-l-amber-500 bg-amber-50/40' : ''
                              }`}
                              onClick={() => handleViewDepartmentAssignments(dept)}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-base font-medium text-gray-900">{dept.name}</h3>
                                    {isSensitiveDept && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                        <svg
                                          className="w-3.5 h-3.5"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 9v2m0 4h.01M5.07 19h13.86L12 5 5.07 19z"
                                          />
                                        </svg>
                                        Sensitive area
                                      </span>
                                    )}
                                  </div>
                                  {isAssigned && auditorNames.length > 0 && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      Auditor{auditorNames.length > 1 ? 's' : ''}: {auditorNames.join(', ')}
                                    </p>
                                  )}
                                </div>
                                <div className="ml-4 flex items-center gap-2">
                                  {matchedRequest ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedRequest(matchedRequest);
                                        setShowRequestModal(true);
                                      }}
                                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      Request
                                    </button>
                                  ) : hasRejectedAssignment ? (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAssignModal(dept);
                                      }}
                                      className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
                                    >
                                      Reassign
                                    </button>
                                  ) : isAssigned ? (
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
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-200 flex-shrink-0">
              <h3 className="text-xl font-semibold text-gray-900">
                Assign Auditor
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded-lg"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 px-6 py-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Main Content */}
                <div className="lg:col-span-2 space-y-5">
                  {/* Department & Audit Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Department
                      </label>
                      <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                        {selectedDepartment.name}
                      </p>
                    </div>

                    {/* Audit Info (read-only since we're viewing a specific audit) */}
                    {selectedAuditId && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Audit
                        </label>
                        <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                          {audits.find(a => a.auditId === selectedAuditId)?.title || `Audit ${selectedAuditId.substring(0, 8)}...`}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Auditor Selection (multi-select, demo) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Auditor(s)
                    </label>
                    {loadingAuditors ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
                        <span className="ml-2 text-sm text-gray-600">Loading auditors...</span>
                      </div>
                    ) : auditors.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4 text-center bg-gray-50 rounded-lg border border-gray-200">No auditors available</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                        {auditors.map((auditor) => {
                          const id = String(auditor.userId);
                          const checked = selectedAuditorIds.includes(id);
                          const isBusy = isAuditorBusy(id);
                          return (
                            <label
                              key={id}
                              className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition border border-transparent ${
                                isBusy
                                  ? 'bg-gray-100 cursor-not-allowed opacity-60'
                                  : 'hover:bg-white cursor-pointer hover:border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                  checked={checked}
                                  disabled={isBusy}
                                  onChange={(e) => {
                                    if (isBusy) return;
                                    const next = e.target.checked
                                      ? Array.from(new Set([...selectedAuditorIds, id]))
                                      : selectedAuditorIds.filter((x) => x !== id);
                                    setSelectedAuditorIds(next);
                                  }}
                                />
                                <div className="text-sm flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className={`font-medium ${isBusy ? 'text-gray-500' : 'text-gray-900'}`}>
                                      {auditor.fullName || 'Unknown'}
                                    </p>
                                    {isBusy && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Bận
                                      </span>
                                    )}
                                  </div>
                                  <p className={`text-xs ${isBusy ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {auditor.email || 'N/A'}
                                  </p>
                                </div>
                              </div>
                              {checked && !isBusy && (
                                <span className="text-xs font-medium text-primary-700 bg-primary-100 px-2.5 py-1 rounded-full border border-primary-200">
                                  Selected
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-2">You can select multiple auditors.</p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes <span className="text-gray-500 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Enter notes..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                {/* Right Column - Schedule Section */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-5 sticky top-0">
                    <h4 className="text-base font-semibold text-gray-900 mb-4">Schedule</h4>
                    
                    {/* Helper function to format Date to YYYY-MM-DD */}
                    {(() => {
                      const formatDateForInput = (date: Date | null): string => {
                        if (!date) return '';
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                      };

                      const minDate = qrValidityFrom ? formatDateForInput(qrValidityFrom) : '';
                      const maxDate = qrValidityTo ? formatDateForInput(qrValidityTo) : '';

                      return (
                        <>
                          {/* Planned Start Date */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Planned Start Date
                            </label>
                            <input
                              type="date"
                              value={plannedStartDate}
                              onChange={(e) => setPlannedStartDate(e.target.value)}
                              min={minDate}
                              max={maxDate}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                            />
                            {(minDate || maxDate) && (
                              <p className="text-xs text-gray-500 mt-1">
                                {minDate && maxDate 
                                  ? `Between ${minDate} and ${maxDate}`
                                  : minDate 
                                  ? `From ${minDate}`
                                  : `Until ${maxDate}`}
                              </p>
                            )}
                          </div>

                          {/* Planned End Date */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Planned End Date
                            </label>
                            <input
                              type="date"
                              value={plannedEndDate}
                              onChange={(e) => setPlannedEndDate(e.target.value)}
                              min={plannedStartDate || minDate}
                              max={maxDate}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                            />
                            {(minDate || maxDate || plannedStartDate) && (
                              <p className="text-xs text-gray-500 mt-1">
                                {plannedStartDate && maxDate
                                  ? `From ${plannedStartDate} to ${maxDate}`
                                  : plannedStartDate
                                  ? `From ${plannedStartDate}`
                                  : minDate && maxDate
                                  ? `Between ${minDate} and ${maxDate}`
                                  : minDate
                                  ? `From ${minDate}`
                                  : `Until ${maxDate}`}
                              </p>
                            )}
                          </div>
                        </>
                      );
                    })()}

                    {/* Estimated Duration */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Estimated Duration <span className="text-gray-500 font-normal">(days)</span>
                      </label>
                      {(() => {
                        // Calculate total days between Planned Start Date and Planned End Date
                        const calculateTotalDays = (): number | undefined => {
                          if (!plannedStartDate || !plannedEndDate) return undefined;
                          const start = new Date(plannedStartDate);
                          const end = new Date(plannedEndDate);
                          if (isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;
                          const diffTime = end.getTime() - start.getTime();
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          return diffDays >= 0 ? diffDays : undefined;
                        };

                        const totalDays = calculateTotalDays();
                        const currentValue = estimatedDuration || 0;
                        // Max value should be strictly less than totalDays
                        const maxValue = totalDays !== undefined ? totalDays - 1 : undefined;

                        return (
                          <>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              max={maxValue}
                              value={estimatedDuration || ''}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                // Only allow integers (no decimal points)
                                if (inputValue === '' || inputValue === '-') {
                                  setEstimatedDuration(0);
                                  return;
                                }
                                // Check if input contains decimal point
                                if (inputValue.includes('.')) {
                                  // Remove decimal part and keep only integer
                                  const intValue = Math.floor(Number(inputValue)) || 0;
                                  setEstimatedDuration(intValue);
                                  return;
                                }
                                const value = Math.floor(Number(inputValue)) || 0;
                                if (value < 0) {
                                  setEstimatedDuration(0);
                                } else if (totalDays !== undefined && value >= totalDays) {
                                  // Strictly less than totalDays
                                  setEstimatedDuration(Math.max(0, totalDays - 1));
                                } else {
                                  setEstimatedDuration(value);
                                }
                              }}
                              onKeyDown={(e) => {
                                // Prevent decimal point and minus sign (except for backspace, delete, arrow keys, etc.)
                                if (e.key === '.' || e.key === ',' || (e.key === '-' && e.currentTarget.value.length > 0)) {
                                  e.preventDefault();
                                }
                              }}
                              placeholder="Enter days"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                            />
                            {plannedStartDate && plannedEndDate && totalDays !== undefined && (
                              <p className="text-xs text-gray-500 mt-1">
                                Must be less than {totalDays} day(s) (between start and end date)
                              </p>
                            )}
                            {totalDays !== undefined && currentValue >= totalDays && (
                              <p className="text-xs text-red-500 mt-1">
                                Duration must be less than {totalDays} day(s)
                              </p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 p-6 pt-4 border-t border-gray-200 bg-gray-50 rounded-b-xl flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-100 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignClick}
                  disabled={
                    selectedAuditorIds.length === 0 || 
                    loadingAuditors || 
                    submitting ||
                    !plannedStartDate ||
                    !plannedEndDate ||
                    !estimatedDuration ||
                    estimatedDuration <= 0
                  }
                  className="px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium shadow-sm"
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
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
            onClick={handleCloseDetailModal}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white bg-opacity-20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Assignment Details
                  </h3>
                </div>
                <button
                  onClick={handleCloseDetailModal}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">

              <div className="space-y-6">
                {/* Audit Information */}
                {selectedAuditId && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h4 className="text-base font-semibold text-gray-900">Audit Information</h4>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Audit Title
                      </label>
                      <p className="text-base text-gray-900 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 font-medium">
                        {audits.find(a => a.auditId === selectedAuditId)?.title || 'N/A'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Department Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <h4 className="text-base font-semibold text-gray-900">Department Information</h4>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Department Name
                      </label>
                      <p className="text-base text-gray-900 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 font-medium">
                        {selectedDepartmentForDetail?.name || selectedAssignment?.departmentName || 'N/A'}
                      </p>
                    </div>
                    
                    {/* Department Details from API */}
                    {loadingDepartmentDetail ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600 py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary-600 border-t-transparent"></div>
                        <span>Loading department details...</span>
                      </div>
                    ) : departmentDetail ? (
                      <div className="space-y-4">
                        {departmentDetail.code && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                              Department Code
                            </label>
                            <p className="text-base text-gray-900 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 font-mono">
                              {departmentDetail.code}
                            </p>
                          </div>
                        )}
                        {departmentDetail.description && (
                          <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                              Description
                            </label>
                            <p className="text-sm text-gray-700 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200 leading-relaxed">
                              {departmentDetail.description}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Auditor Information - Show all assigned auditors */}
                {(() => {
                  // Get all assignments for this department to filter out rejected ones
                  const deptAssignments = assignments.filter(
                    (a) => a.deptId === (selectedDepartmentForDetail?.deptId || selectedAssignment?.deptId) && 
                           a.auditId === selectedAuditId
                  );
                  
                  // Filter out assignments with "Rejected" status
                  const activeAssignments = deptAssignments.filter(a => {
                    const status = (a.status || '').toLowerCase().trim();
                    return status !== 'rejected';
                  });
                  
                  // Get unique auditor IDs from active assignments and QR grants
                  const assignedAuditorIds = new Set<string>();
                  
                  // Add auditor IDs from active assignments
                  activeAssignments.forEach(a => {
                    if (a.auditorId) {
                      assignedAuditorIds.add(a.auditorId);
                    }
                  });
                  
                  // Also add from QR grants (but only if the assignment is not rejected)
                  qrGrantsForDetail.forEach(grant => {
                    if (grant.auditorId) {
                      // Check if this grant's auditor has an active assignment
                      const hasActiveAssignment = activeAssignments.some(a => a.auditorId === grant.auditorId);
                      if (hasActiveAssignment) {
                        assignedAuditorIds.add(grant.auditorId);
                      }
                    }
                  });
                  
                  // Fallback: if no active assignments or QR grants, use selectedAssignment (only if not rejected)
                  if (assignedAuditorIds.size === 0 && selectedAssignment?.auditorId) {
                    const selectedStatus = (selectedAssignment.status || '').toLowerCase().trim();
                    if (selectedStatus !== 'rejected') {
                      assignedAuditorIds.add(selectedAssignment.auditorId);
                    }
                  }

                  const assignedAuditors = Array.from(assignedAuditorIds).map(auditorId => ({
                    auditorId,
                    name: auditorNamesForDetail[auditorId] || 'Loading...',
                    email: auditorEmailsForDetail[auditorId] || 'N/A'
                  }));

                  if (assignedAuditors.length === 0 && !selectedAssignment) {
                    return null;
                  }

                  return (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <h4 className="text-base font-semibold text-gray-900">
                          Auditor Information {assignedAuditors.length > 1 && <span className="text-gray-500 font-normal">({assignedAuditors.length})</span>}
                        </h4>
                      </div>
                      {assignedAuditors.length > 0 ? (
                        <div className="space-y-3">
                          {assignedAuditors.map((auditor) => {
                            const isExpanded = expandedUserIds.has(auditor.auditorId);
                            return (
                              <div 
                                key={auditor.auditorId} 
                                className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg px-4 py-3 border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => {
                                  setExpandedUserIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(auditor.auditorId)) {
                                      next.delete(auditor.auditorId);
                                    } else {
                                      next.add(auditor.auditorId);
                                    }
                                    return next;
                                  });
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                                    <span className="text-sm font-bold text-white">
                                      {auditor.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900">{auditor.name}</p>
                                    {isExpanded && (
                                      <p className="text-xs text-gray-600 mt-0.5">{auditor.email}</p>
                                    )}
                                  </div>
                                  <svg 
                                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none" 
                                    stroke="currentColor" 
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : selectedAssignment?.auditorName ? (
                        <div 
                          className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg px-4 py-3 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                          onClick={async () => {
                            if (selectedAssignment.auditorId) {
                              const isExpanded = expandedUserIds.has(selectedAssignment.auditorId);
                              setExpandedUserIds((prev) => {
                                const next = new Set(prev);
                                if (isExpanded) {
                                  next.delete(selectedAssignment.auditorId!);
                                } else {
                                  next.add(selectedAssignment.auditorId!);
                                  // Fetch email if not already loaded
                                  if (!auditorEmailsForDetail[selectedAssignment.auditorId!]) {
                                    getUserById(selectedAssignment.auditorId!)
                                      .then((user) => {
                                        setAuditorEmailsForDetail((prev) => ({
                                          ...prev,
                                          [selectedAssignment.auditorId!]: user?.email || 'N/A'
                                        }));
                                      })
                                      .catch(() => {
                                        setAuditorEmailsForDetail((prev) => ({
                                          ...prev,
                                          [selectedAssignment.auditorId!]: 'N/A'
                                        }));
                                      });
                                  }
                                }
                                return next;
                              });
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900">
                                {selectedAssignment.auditorName}
                              </p>
                              {selectedAssignment.auditorId && expandedUserIds.has(selectedAssignment.auditorId) && (
                                <p className="text-xs text-gray-600 mt-0.5">
                                  {auditorEmailsForDetail[selectedAssignment.auditorId] || 'Loading...'}
                                </p>
                              )}
                            </div>
                            {selectedAssignment.auditorId && (
                              <svg 
                                className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${expandedUserIds.has(selectedAssignment.auditorId) ? 'rotate-180' : ''}`}
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* Status and Dates - Only show if assigned */}
                {selectedAssignment && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h4 className="text-base font-semibold text-gray-900">Status & Timeline</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Status
                        </label>
                        <span
                          className={`inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg shadow-sm ${
                            selectedAssignment.status === 'Assigned'
                              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                              : selectedAssignment.status === 'In Progress'
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                              : selectedAssignment.status === 'Completed'
                              ? 'bg-gradient-to-r from-gray-500 to-gray-600 text-white'
                              : selectedAssignment.status === 'Rejected'
                              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                              : 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white'
                          }`}
                        >
                          {selectedAssignment.status}
                        </span>
                      </div>
                      {selectedAssignment.assignedAt && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Assigned At
                          </label>
                          <div className="flex items-center gap-2 bg-gray-50 px-4 py-3 rounded-lg border border-gray-200">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm text-gray-900 font-medium">
                              {new Date(selectedAssignment.assignedAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Reassign button for Rejected status */}
                    {selectedAssignment.status === 'Rejected' && selectedDepartmentForDetail && (
                      <div className="mt-5 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => {
                            handleCloseDetailModal();
                            handleOpenAssignModal(selectedDepartmentForDetail);
                          }}
                          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 flex items-center gap-2 shadow-md hover:shadow-lg font-medium"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Reassign
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes - Only show if assigned */}
                {selectedAssignment?.notes && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </div>
                      <label className="text-base font-semibold text-gray-900">
                        Notes
                      </label>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {selectedAssignment.notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* QR Codes - Only show if assigned and QR grants exist */}
                {selectedAssignment && (() => {
                  // Group QR grants by auditorId
                  const grantsByAuditor = qrGrantsForDetail.reduce((acc, grant) => {
                    const auditorId = grant.auditorId;
                    if (!acc[auditorId]) {
                      acc[auditorId] = [];
                    }
                    acc[auditorId].push(grant);
                    return acc;
                  }, {} as Record<string, typeof qrGrantsForDetail>);

                  const auditorIds = Object.keys(grantsByAuditor);

                  return (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </div>
                        <h4 className="text-base font-semibold text-gray-900">QR Codes</h4>
                      </div>
                      {loadingQrGrants ? (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                          Loading QR codes...
                        </div>
                      ) : auditorIds.length > 0 ? (
                        <div className="space-y-3">
                          {auditorIds.map((auditorId) => {
                            const grants = grantsByAuditor[auditorId];
                            const auditorName = auditorNamesForDetail[auditorId] || 'Loading...';
                            const isExpanded = expandedAuditorIds.has(auditorId);
                            
                            return (
                              <div key={auditorId} className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                {/* Auditor Header - Clickable */}
                                <button
                                  onClick={() => toggleAuditorExpand(auditorId)}
                                  className="w-full flex items-center justify-between p-4 hover:bg-white hover:bg-opacity-50 transition-all duration-200"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center shadow-sm">
                                      <span className="text-sm font-bold text-white">
                                        {auditorName.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div className="text-left">
                                      <p className="text-sm font-semibold text-gray-900">{auditorName}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">{grants.length} QR code(s)</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {grants.some(g => g.status === 'Active') && (
                                      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm">
                                        Active
                                      </span>
                                    )}
                                    <svg
                                      className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </button>
                                
                                {/* QR Codes Content - Collapsible */}
                                {isExpanded && (
                                  <div className="px-4 pb-4 space-y-4 border-t border-gray-200 pt-4 bg-white">
                                    {grants.map((grant) => (
                                      <div key={grant.grantId} className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm">
                                        <div className="flex items-center justify-between mb-4">
                                          <span className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm ${
                                            grant.status === 'Active' 
                                              ? 'bg-gradient-to-r from-green-500 to-green-600 text-white' 
                                              : grant.status === 'Expired'
                                              ? 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                                              : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                                          }`}>
                                            {grant.status}
                                          </span>
                                          <div className="flex items-center gap-2 text-xs text-gray-600">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="font-medium">
                                              {new Date(grant.validFrom).toLocaleDateString()} - {new Date(grant.validTo).toLocaleDateString()}
                                            </span>
                                          </div>
                                        </div>
                                        
                                        {/* QR Code Display */}
                                        <div className="flex justify-center">
                                          <div className="bg-white p-4 rounded-xl border-2 border-gray-300 shadow-inner">
                                            <QRCodeSVG
                                              value={grant.qrUrl}
                                              size={160}
                                              level="M"
                                              includeMargin={true}
                                            />
                                          </div>
                                        </div>
                                        
                                        {/* QR URL and Verify Code removed - not needed for Lead Auditor */}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-sm text-yellow-800 font-medium">No QR codes have been issued for this assignment yet.</p>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Show message if not assigned */}
                {!selectedAssignment && selectedDepartmentForDetail && (
                  <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-yellow-800 font-medium mb-3">
                          This department has not been assigned to an auditor yet.
                        </p>
                        <button
                          onClick={() => {
                            handleCloseDetailModal();
                            handleOpenAssignModal(selectedDepartmentForDetail);
                          }}
                          className="px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-sm font-semibold rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Assign Auditor
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-gray-200 bg-white px-6 py-4 -mx-6 -mb-6">
                <button
                  type="button"
                  onClick={handleCloseDetailModal}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all duration-200 shadow-md hover:shadow-lg font-semibold flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
              // Không cho đóng khi chưa phát QR (bắt buộc)
              if (!issuingQr && qrGrantResults.length > 0) {
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
                  disabled={issuingQr || qrGrantResults.length === 0}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={qrGrantResults.length === 0 ? 'Please issue QR codes before closing' : 'Close'}
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
                  if (!audit) return null;
                  
                  const now = new Date();
                  const auditEndDate = audit.endDate ? new Date(audit.endDate) : null;
                  const auditHasEnded = auditEndDate && auditEndDate < now;

                  // Lấy QR validity window từ schedule backend nếu có (unused)
                  // const _validityFrom: Date | null = qrValidityFrom;
                  // const _validityTo: Date | null = qrValidityTo;
                  
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Audit Title</label>
                          <p className="text-sm text-gray-900">{audit.title}</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Audit Period</label>
                          <p className="text-sm text-gray-900">
                            {audit.startDate ? new Date(audit.startDate).toLocaleDateString() : 'N/A'} - {' '}
                            {audit.endDate ? new Date(audit.endDate).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      QR Code Validity Info
                      <div className={`rounded-lg p-4 ${auditHasEnded ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                        <div className="flex items-start gap-2">
                          {auditHasEnded ? (
                            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          )}
                          <div className="flex-1">
                            <p className={`text-xs font-semibold ${auditHasEnded ? 'text-amber-900' : 'text-blue-900'}`}>
                              QR Code Validity Period
                            </p>
                          <p className={`text-xs mt-1 ${auditHasEnded ? 'text-amber-800' : 'text-blue-800'}`}>
                              {qrValidityFrom && qrValidityTo ? (
                                <>
                                  QR codes will be valid from <strong>Evidence Due ({qrValidityFrom.toLocaleDateString()})</strong>.
                                </>
                              ) : (
                                <>
                                  QR validity period follows the audit schedule configured by the Lead Auditor.
                                </>
                              )}
                            </p> 
                          </div>
                        </div>
                      </div>
                    </div>
                  );
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
                                <div className="mt-3 space-y-2">
                                  {/* QR Code Display */}
                                  <div className="flex justify-center">
                                    <div className="bg-white p-3 rounded-lg border-2 border-gray-200">
                                      <QRCodeSVG
                                        value={result.qrUrl}
                                        size={120}
                                        level="M"
                                        includeMargin={true}
                                      />
                                    </div>
                                  </div>
                                  {/* QR URL removed - not needed */}
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
                  disabled={issuingQr || qrGrantResults.length === 0}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Close
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

      {/* Request Modal */}
      {showRequestModal && selectedRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm transition-opacity"
            onClick={() => !processingRequest && setShowRequestModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header with gradient */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white bg-opacity-20 flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">
                    Assignment Request
                  </h3>
                </div>
                <button
                  onClick={() => !processingRequest && setShowRequestModal(false)}
                  disabled={processingRequest}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="space-y-6">
                {/* Request Information */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shadow-sm">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">Request Information</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2.5">
                        Requested By
                      </label>
                      <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3.5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                          <span className="text-sm font-bold text-white">
                            {(selectedRequest.createdByName || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-base text-gray-900 font-semibold">
                          {selectedRequest.createdByName || 'N/A'}
                        </p>
                      </div>
                    </div>
                    {selectedRequest.actualAuditDate && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2.5">
                          Actual Audit Date
                        </label>
                        <div className="flex items-center gap-3 bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3.5 rounded-xl border border-gray-200 shadow-sm">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-base text-gray-900 font-semibold">
                            {new Date(selectedRequest.actualAuditDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reason Request */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center shadow-sm">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-bold text-gray-900">
                      Reason Request
                    </h4>
                  </div>
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border-2 border-gray-200 shadow-inner">
                    <p className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">
                      {selectedRequest.reasonRequest || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-6 pb-6 px-8 border-t-2 border-gray-200 bg-white">
              <button
                type="button"
                onClick={() => !processingRequest && setShowRequestModal(false)}
                disabled={processingRequest}
                className="px-6 py-2.5 border-2 border-gray-300 rounded-xl text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedRequest) return;
                  setProcessingRequest(true);
                  try {
                    await rejectAuditAssignmentRequest(selectedRequest.requestId);
                    toast.success('Request rejected successfully');
                    setShowRequestModal(false);
                    setSelectedRequest(null);
                    // Reload requests and assignments
                    try {
                      const requestsData = await getAllAuditAssignmentRequests();
                      const requestsList = unwrap<any>(requestsData);
                      const requestsArray = Array.isArray(requestsList) ? requestsList : [];
                      setAssignmentRequests(requestsArray);
                      
                      const assignmentsData = await getAuditAssignments().catch(() => []);
                      setAssignments(assignmentsData || []);
                    } catch (reloadErr) {
                      console.error('[AuditAssignment] Failed to reload after reject:', reloadErr);
                    }
                  } catch (err: any) {
                    console.error('Failed to reject request:', err);
                    toast.error(err?.response?.data?.message || err?.message || 'Failed to reject request');
                  } finally {
                    setProcessingRequest(false);
                  }
                }}
                disabled={processingRequest}
                className="px-6 py-2.5 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reject
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!selectedRequest) return;
                  setProcessingRequest(true);
                  try {
                    await approveAuditAssignmentRequest(selectedRequest.requestId);
                    toast.success('Request approved successfully');
                    setShowRequestModal(false);
                    setSelectedRequest(null);
                    // Reload requests and assignments
                    try {
                      const requestsData = await getAllAuditAssignmentRequests();
                      const requestsList = unwrap<any>(requestsData);
                      const requestsArray = Array.isArray(requestsList) ? requestsList : [];
                      setAssignmentRequests(requestsArray);
                      
                      const assignmentsData = await getAuditAssignments().catch(() => []);
                      setAssignments(assignmentsData || []);
                    } catch (reloadErr) {
                      console.error('[AuditAssignment] Failed to reload after approve:', reloadErr);
                    }
                  } catch (err: any) {
                    console.error('Failed to approve request:', err);
                    toast.error(err?.response?.data?.message || err?.message || 'Failed to approve request');
                  } finally {
                    setProcessingRequest(false);
                  }
                }}
                disabled={processingRequest}
                className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl font-bold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

