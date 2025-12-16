import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';

import { getFindingsByAudit } from '../../../api/findings';
import {
  getAuditPlanById,
  getAuditScopeDepartmentsByAuditId,
  approveForwardDirector,
  rejectPlanContent,
  getAuditApprovals,
  getSensitiveDepartments,
} from '../../../api/audits';
import { getAuditSchedules } from '../../../api/auditSchedule';



import { getUserById } from '../../../api/adminUsers';
import { getAuditorsByAuditId } from '../../../api/auditTeam';
import { getCriteriaForAudit, getCriteriaForAuditByDepartment } from '../../../api/auditCriteriaMap';
import { getAuditCriterionById } from '../../../api/auditCriteria';
import { getChecklistTemplateById, type ChecklistTemplateDto } from '../../../api/checklists';
import { getAuditChecklistTemplateMapsByAudit } from '../../../api/auditChecklistTemplateMaps';

import { toast } from 'react-toastify';
import { unwrap } from '../../../utils/normalize';
import DepartmentTab from './components/DepartmentTab';
import AuditTeamTab from './components/AuditTeamTab';
import CriteriaTab from './components/CriteriaTab';
import FindingsTab from './components/FindingsTab';

const AuditDetail = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'department' | 'auditteam' | 'criteria' | 'template' | 'findings' | 'schedule'>('department');
  const [auditDetails, setAuditDetails] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [auditors, setAuditors] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplateDto[]>([]);
  const [_template, setTemplate] = useState<ChecklistTemplateDto | null>(null);
  const [_templateCreatedByFullName, setTemplateCreatedByFullName] = useState<string>('');
  const [findings, setFindings] = useState<any[]>([]);
  const [createdByFullName, setCreatedByFullName] = useState<string>('');
  const [showAuditDetailModal, setShowAuditDetailModal] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingAuditors, setLoadingAuditors] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [sensitiveAreasByDept, setSensitiveAreasByDept] = useState<Record<number, string[]>>({});
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  // Map: deptId -> criteria array for that department
  const [criteriaByDept, setCriteriaByDept] = useState<Map<number, any[]>>(new Map());

  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [_error, _setError] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [loadingFindings, setLoadingFindings] = useState(false);
  const [latestRejectionComment, setLatestRejectionComment] = useState<string | null>(null);
  const [showRejectionReasonModal, setShowRejectionReasonModal] = useState(false);


  useEffect(() => {
    if (auditId) {
      loadAuditDetails(); // This already loads schedules internally
      loadDepartments();
      loadAuditors();
      loadCriteria();
      // loadSchedules() removed - schedules are loaded in loadAuditDetails()
      loadSensitiveAreas();
    }
  }, [auditId]);

  // Load criteria by department when departments are loaded
  useEffect(() => {
    const loadCriteriaByDepartment = async () => {
      if (!auditId || departments.length === 0) {
        setCriteriaByDept(new Map());
        return;
      }

      const criteriaMap = new Map<number, any[]>();

      await Promise.all(
        departments.map(async (dept: any) => {
          const deptId = Number(dept.deptId ?? dept.departmentId ?? dept.id ?? dept.$id ?? 0);
          if (!deptId || isNaN(deptId)) return;

          try {
            const deptCriteria = await getCriteriaForAuditByDepartment(auditId, deptId);
            console.log(`[AuditDetail] Criteria for dept ${deptId}:`, deptCriteria);
            
            // API already unwraps, so deptCriteria is already the unwrapped value
            let criteriaArray: any[] = [];
            if (Array.isArray(deptCriteria)) {
              criteriaArray = deptCriteria;
            } else {
              // If it's not an array, try to unwrap again (in case API response format changed)
              const unwrapped = unwrap(deptCriteria);
              if (Array.isArray(unwrapped)) {
                criteriaArray = unwrapped;
              } else {
                console.warn(`[AuditDetail] Criteria for department ${deptId} is not an array:`, deptCriteria);
                criteriaArray = [];
              }
            }
            
            if (criteriaArray.length > 0) {
              // Fetch detailed information for each criterion
              const criteriaDetails = await Promise.allSettled(
                criteriaArray.map(async (item: any) => {
                  try {
                    const criteriaId = item.criteriaId || item.id || item;
                    const response = await getAuditCriterionById(criteriaId);
                    const detail = response || {};
                    return {
                      criteriaId: detail.criteriaId || criteriaId,
                      name: detail.name || 'N/A',
                      description: detail.description || 'No description',
                      referenceCode: detail.referenceCode || 'N/A',
                      status: item.status || detail.status || 'Active',
                    };
                  } catch (err: any) {
                    console.error(`[AuditDetail] Failed to load criterion detail:`, err);
                    return {
                      criteriaId: item.criteriaId || item.id || item,
                      name: item.name || 'N/A',
                      description: item.description || 'No description',
                      referenceCode: item.referenceCode || 'N/A',
                      status: item.status || 'Active',
                    };
                  }
                })
              );
              const validCriteria = criteriaDetails
                .filter((result) => result.status === 'fulfilled')
                .map((result) => (result as PromiseFulfilledResult<any>).value);
              console.log(`[AuditDetail] Valid criteria for dept ${deptId}:`, validCriteria.length);
              criteriaMap.set(deptId, validCriteria);
            } else {
              console.log(`[AuditDetail] No criteria found for department ${deptId}`);
              criteriaMap.set(deptId, []);
            }
          } catch (error) {
            console.error(`[AuditDetail] Failed to load criteria for department ${deptId}:`, error);
            criteriaMap.set(deptId, []);
          }
        })
      );

      setCriteriaByDept(criteriaMap);
    };

    loadCriteriaByDepartment();
  }, [auditId, departments]);

  // Load templates when audit details are loaded
  useEffect(() => {
    if (!auditId || !auditDetails || loadingTemplate) return;
    loadTemplatesForAudit();
  }, [auditId, auditDetails]);

  // Load templates lazily when Template tab is clicked (if not loaded yet)
  useEffect(() => {
    if (activeTab === 'template' && auditId && !loadingTemplate && templates.length === 0) {
      loadTemplatesForAudit();
    }
  }, [activeTab, auditId, templates.length, loadingTemplate]);

  // Load findings when audit is approved and findings tab is active
  useEffect(() => {
    const auditStatus = auditDetails?.audit?.status || auditDetails?.status;
    if (activeTab === 'findings' && auditStatus === 'Approved' && auditId && findings.length === 0 && !loadingFindings) {
      loadFindings();
    }
  }, [activeTab, auditDetails?.audit?.status, auditDetails?.status, auditId]);

  // Schedules are now loaded in loadAuditDetails, so this useEffect is not needed
  // But keep it for lazy loading if schedules tab is clicked before auditDetails is loaded
  useEffect(() => {
    if (activeTab === 'schedule' && auditId && schedules.length === 0 && !loadingSchedules && auditDetails) {
      // Only load if auditDetails exists but schedules are empty
      const schedulesFromDetails = auditDetails?.schedules;
      if (!schedulesFromDetails || (!schedulesFromDetails.values && !schedulesFromDetails.$values && !Array.isArray(schedulesFromDetails))) {
        loadSchedules();
      }
    }
  }, [activeTab, auditId, schedules.length, loadingSchedules, auditDetails]);

  const loadAuditDetails = async () => {
    if (!auditId) return;
    
    console.log('[loadAuditDetails] Starting to load audit details for auditId:', auditId);
    setLoadingDetails(true);
    try {
      const data = await getAuditPlanById(auditId);
      console.log('[loadAuditDetails] Audit data:', data);
      console.log('[loadAuditDetails] TemplateId:', data?.templateId);
      console.log('[loadAuditDetails] Data keys:', data ? Object.keys(data) : 'null');
      
      // Fetch schedules separately if not included in main response (same as Auditor)
      let schedulesData = (data as any)?.schedules;
      if (
        !schedulesData ||
        (!schedulesData.values && !schedulesData.$values && !Array.isArray(schedulesData))
      ) {
        try {
          console.log('[loadAuditDetails] Fetching schedules from API for auditId:', auditId);
          const schedulesResponse = await getAuditSchedules(auditId);
          console.log('[loadAuditDetails] Schedules API response:', schedulesResponse);
          const schedulesArray = unwrap(schedulesResponse);
          console.log('[loadAuditDetails] Unwrapped schedules array:', schedulesArray);
          schedulesData = { values: Array.isArray(schedulesArray) ? schedulesArray : [] };
          console.log('[loadAuditDetails] Final schedulesData:', schedulesData);
        } catch (scheduleErr: any) {
          // Handle 404 gracefully - schedules might not exist yet
          if (scheduleErr?.response?.status === 404) {
            console.log('[loadAuditDetails] No schedules found (404) for auditId:', auditId);
            schedulesData = { values: [] };
          } else {
            console.error('[loadAuditDetails] Failed to load schedules separately:', scheduleErr);
            schedulesData = { values: [] };
          }
        }
      } else {
        console.log('[loadAuditDetails] Schedules found in main response:', schedulesData);
      }
      
      // Merge schedules into data
      const dataWithSchedules = {
        ...data,
        schedules: schedulesData,
      };
      
      setAuditDetails(dataWithSchedules);
      
      // Extract schedules list for state (same format as Auditor)
      const schedulesList = Array.isArray(schedulesData.values) 
        ? schedulesData.values 
        : Array.isArray(schedulesData.$values)
        ? schedulesData.$values
        : Array.isArray(schedulesData)
        ? schedulesData
        : [];
      console.log('[loadAuditDetails] Setting schedules state with', schedulesList.length, 'items');
      setSchedules(schedulesList);
      
      // Template will be loaded by useEffect when auditDetails is set
      if (data?.templateId) {
        console.log('[loadAuditDetails] TemplateId found:', data.templateId);
      } else {
        console.log('[loadAuditDetails] No templateId in audit data');
      }
      
      // Load createdBy user info to get fullName
      if (data?.createdBy) {
        try {
          const user = await getUserById(data.createdBy);
          setCreatedByFullName(user?.fullName || 'N/A');
        } catch (err) {
          console.error('Failed to load user info', err);
          setCreatedByFullName('N/A');
        }
      }

      // Load rejection comment if plan is rejected
      const planStatus = String(data?.status || data?.audit?.status || '').toLowerCase();
      const isRejected = planStatus.includes('rejected');
      
      if (isRejected) {
        // First, check if comment is stored directly in the audit/auditPlan record
        let rejectionComment: string | null = null;
        const dataAny = data as any;
        rejectionComment = dataAny.comment || 
                          
                          dataAny.note || 
                          dataAny.audit?.comment ||
                  
                          dataAny.audit?.rejectionReason ||
                          dataAny.audit?.note ||
                          null;
        
        // If not found in audit record, try to get from AuditApproval table
        if (!rejectionComment && auditId) {
          try {
            const approvalsResponse = await getAuditApprovals();
            const approvals = unwrap(approvalsResponse) || [];
            const currentAuditId = String(auditId).trim().toLowerCase();
            
            // More robust filtering: case-insensitive comparison and handle different ID field names
            const related = approvals.filter((a: any) => {
              const approvalAuditId = String(a.auditId || a.audit?.auditId || a.audit?.id || '').trim().toLowerCase();
              return approvalAuditId === currentAuditId && approvalAuditId !== '';
            });
            
            if (related.length > 0) {
              const rejected = related
                .filter((a: any) => {
                  const approvalStatus = String(a.status || '').toLowerCase();
                  return approvalStatus.includes('rejected') || approvalStatus === 'rejected';
                })
                .sort((a: any, b: any) => {
                  const aTime = new Date(a.approvedAt || a.createdAt || 0).getTime();
                  const bTime = new Date(b.approvedAt || b.createdAt || 0).getTime();
                  return bTime - aTime;
                });
              
              if (rejected.length > 0) {
                // Try multiple possible field names for comment
                rejectionComment = rejected[0].comment || 
                                  rejected[0].rejectionComment || 
                                  rejected[0].note || 
                                  rejected[0].reason || 
                                  null;
              }
            }
          } catch (approvalErr) {
            console.error('Failed to load audit approvals for rejection comment', approvalErr);
          }
        }
        
        setLatestRejectionComment(rejectionComment);
      } else {
        setLatestRejectionComment(null);
      }
    } catch (err: any) {
      console.error('Failed to load audit details', err);
      toast.error('Failed to load audit details: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadDepartments = async () => {
    if (!auditId) return;
    
    setLoadingDepartments(true);
    try {
      const data = await getAuditScopeDepartmentsByAuditId(auditId);
      const deptList = unwrap(data);
      setDepartments(Array.isArray(deptList) ? deptList : []);
    } catch (err: any) {
      console.error('Failed to load departments', err);
      toast.error('Failed to load departments: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingDepartments(false);
    }
  };

  const loadAuditors = async () => {
    if (!auditId) return;
    
    setLoadingAuditors(true);
    try {
      const data = await getAuditorsByAuditId(auditId);
      const auditorList = unwrap(data);
      setAuditors(Array.isArray(auditorList) ? auditorList : []);
    } catch (err: any) {
      console.error('Failed to load auditors', err);
      toast.error('Failed to load audit team: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingAuditors(false);
    }
  };

  const loadCriteria = async () => {
    if (!auditId) return;
    
    setLoadingCriteria(true);
    try {
      // Get criteria mapping for this audit
      const criteriaMap = await getCriteriaForAudit(auditId);
      const criteriaList = unwrap(criteriaMap);
      
      if (!Array.isArray(criteriaList) || criteriaList.length === 0) {
        setCriteria([]);
        return;
      }

      // Fetch detailed information for each criterion using getAuditCriterionById
      const criteriaDetails = await Promise.allSettled(
        criteriaList.map(async (item: any) => {
          try {
            const response = await getAuditCriterionById(item.criteriaId);
            console.log('Criterion detail response for', item.criteriaId, ':', response);
            
            // hooks/axios interceptor already returns response.data, so response is the actual data
            const detail = response || {};
            
            console.log('Processed criterion detail:', detail);
            
            return {
              criteriaId: detail.criteriaId || item.criteriaId,
              name: detail.name || 'N/A',
              description: detail.description || 'No description',
              referenceCode: detail.referenceCode || 'N/A',
              status: item.status || detail.status || 'Active',
            };
          } catch (err: any) {
            console.error(`Failed to load criterion ${item.criteriaId}:`, err);
            console.error('Error details:', err?.response?.data || err?.message);
            // Return basic info if detail fetch fails
            return {
              criteriaId: item.criteriaId,
              name: 'N/A',
              description: 'No description',
              referenceCode: 'N/A',
              status: item.status || 'Active',
            };
          }
        })
      );

      const validCriteria = criteriaDetails
        .filter((result) => result.status === 'fulfilled')
        .map((result) => (result as PromiseFulfilledResult<any>).value);

      setCriteria(validCriteria);
    } catch (err: any) {
      console.error('Failed to load criteria', err);
      toast.error('Failed to load criteria: ' + (err?.message || 'Unknown error'));
      setCriteria([]);
    } finally {
      setLoadingCriteria(false);
    }
  };

  const loadTemplatesForAudit = async () => {
    if (!auditId) return;

    console.log('[loadTemplatesForAudit] Starting for auditId:', auditId);
    setLoadingTemplate(true);
    try {
      // 1) Get mappings audit -> templateIds
      const maps = await getAuditChecklistTemplateMapsByAudit(String(auditId));
      const mapValues = Array.isArray(maps) ? maps : [];
      const templateIds = Array.from(
        new Set(
          mapValues
            .map(
              (m: any) =>
                m.templateId ??
                m.checklistTemplateId ??
                m.template?.templateId ??
                m.template?.id
            )
            .filter((id: any) => id != null)
            .map((id: any) => String(id))
        )
      );

      console.log('[loadTemplatesForAudit] TemplateIds from maps:', templateIds);

      // 2) If no mappings, fall back to the single templateId on audit
      if (!templateIds.length) {
        const fallbackId = auditDetails?.audit?.templateId || auditDetails?.templateId;
        if (!fallbackId) {
          console.log('[loadTemplatesForAudit] No template mappings and no fallback templateId');
          setTemplates([]);
          setTemplate(null);
          return;
        }
        templateIds.push(String(fallbackId));
      }

      // 3) Load all templates' details
      const results = await Promise.allSettled(
        templateIds.map(async (id) => {
          try {
            const data = await getChecklistTemplateById(id);
            return data as ChecklistTemplateDto;
          } catch (err) {
            console.error('[loadTemplatesForAudit] Failed to load template', id, err);
            return null;
          }
        })
      );

      const loadedTemplates = results
        .filter((r): r is PromiseFulfilledResult<ChecklistTemplateDto | null> => r.status === 'fulfilled')
        .map((r) => r.value)
        .filter((tpl): tpl is ChecklistTemplateDto => !!tpl);

      console.log('[loadTemplatesForAudit] Loaded templates:', loadedTemplates);

      setTemplates(loadedTemplates);

      // Keep primary template state for backwards compatibility (first one)
      if (loadedTemplates.length > 0) {
        setTemplate(loadedTemplates[0]);
        const primary = loadedTemplates[0];
        if (primary.createdBy) {
          try {
            const user = await getUserById(primary.createdBy);
            setTemplateCreatedByFullName(user?.fullName || 'N/A');
          } catch (err) {
            console.error('Failed to load template creator info', err);
            setTemplateCreatedByFullName('N/A');
          }
        }
      } else {
        setTemplate(null);
      }
    } catch (err: any) {
      console.error('[loadTemplatesForAudit] Failed:', err);
      toast.error(
        'Failed to load templates: ' +
          (err?.response?.data?.message || err?.message || 'Unknown error')
      );
      setTemplates([]);
      setTemplate(null);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const loadFindings = async () => {
    if (!auditId) return;
    
    setLoadingFindings(true);
    try {
      const data = await getFindingsByAudit(auditId);
      const findingsList = Array.isArray(data) ? data : [];
      setFindings(findingsList);
    } catch (err: any) {
      console.error('Failed to load findings', err);
      toast.error('Failed to load findings: ' + (err?.message || 'Unknown error'));
      setFindings([]);
    } finally {
      setLoadingFindings(false);
    }
  };

  const loadSchedules = async () => {
    if (!auditId) return;
    
    setLoadingSchedules(true);
    try {
      // First, try to get schedules from auditDetails if available
      let schedulesData = auditDetails?.schedules;
      
      // If not found in auditDetails or invalid format, fetch separately
      if (
        !schedulesData ||
        (!schedulesData.values && !schedulesData.$values && !Array.isArray(schedulesData))
      ) {
        try {
          const schedulesResponse = await getAuditSchedules(auditId);
          const schedulesArray = unwrap(schedulesResponse);
          schedulesData = { values: schedulesArray };
        } catch (scheduleErr: any) {
          // Handle 404 gracefully - schedules might not exist yet
          if (scheduleErr?.response?.status === 404) {
            schedulesData = { values: [] };
          } else {
            throw scheduleErr;
          }
        }
      }
      
      const schedulesList = Array.isArray(schedulesData.values) 
        ? schedulesData.values 
        : Array.isArray(schedulesData.$values)
        ? schedulesData.$values
        : Array.isArray(schedulesData)
        ? schedulesData
        : [];
      
      setSchedules(schedulesList);
    } catch (err: any) {
      console.error('Failed to load schedules', err);
      // Only show error if it's not a 404 (schedules might not exist)
      if (err?.response?.status !== 404) {
        toast.error('Failed to load schedules: ' + (err?.message || 'Unknown error'));
      }
      setSchedules([]);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const loadSensitiveAreas = async () => {
    if (!auditId) return;
    
    try {
      const sensitiveDepts = await getSensitiveDepartments(auditId);
      if (sensitiveDepts && sensitiveDepts.length > 0) {
        const areasByDept: Record<number, string[]> = {};
        
        sensitiveDepts.forEach((sd: any) => {
          const deptId = Number(sd.deptId);
          let areasArray: string[] = [];

          // Try 'Areas' first (C# convention - backend returns List<string> as Areas)
          if (Array.isArray(sd.Areas)) {
            areasArray = sd.Areas;
          } else if (sd.Areas && typeof sd.Areas === 'string') {
            try {
              const parsed = JSON.parse(sd.Areas);
              areasArray = Array.isArray(parsed) ? parsed : [sd.Areas];
            } catch {
              areasArray = [sd.Areas];
            }
          } else if (sd.Areas && typeof sd.Areas === 'object' && sd.Areas.$values) {
            areasArray = Array.isArray(sd.Areas.$values) ? sd.Areas.$values : [];
          } else if (Array.isArray(sd.areas)) {
            areasArray = sd.areas;
          } else if (sd.areas && typeof sd.areas === 'string') {
            try {
              const parsed = JSON.parse(sd.areas);
              areasArray = Array.isArray(parsed) ? parsed : [sd.areas];
            } catch {
              areasArray = [sd.areas];
            }
          } else if (sd.areas && typeof sd.areas === 'object' && sd.areas.$values) {
            areasArray = Array.isArray(sd.areas.$values) ? sd.areas.$values : [];
          }

          // Store areas by deptId
          if (deptId && areasArray.length > 0) {
            areasByDept[deptId] = areasArray
              .filter((area: string) => area && typeof area === 'string' && area.trim())
              .map((a: string) => a.trim());
          }
        });

        setSensitiveAreasByDept(areasByDept);
      } else {
        setSensitiveAreasByDept({});
      }
    } catch (err: any) {
      console.error('Failed to load sensitive areas', err);
      setSensitiveAreasByDept({});
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Only show Approve/Reject when any status field (on plan or nested audit) is PendingReview
  const canReviewPlan = (plan: any) => {
    if (!plan) return false;

    const normalize = (s: any) =>
      String(s || '')
        .toLowerCase()
        .replace(/\s+/g, '');

    const nested = plan.audit || {};

    const candidates = [
      plan.status,
      plan.state,
      plan.approvalStatus,
      plan.statusName,
      nested.status,
      nested.state,
      nested.approvalStatus,
      nested.statusName,
    ];

    // Match any value that contains "pendingreview"
    return candidates.some((s) => normalize(s).includes('pendingreview'));
  };

  const handleApprove = async () => {
    if (!auditId) return;
    try {
      setActionLoading(true);
      await approveForwardDirector(auditId);
      toast.success('Plan approved and forwarded to Director.');
      // Reload details to reflect new status
      await loadAuditDetails();
    } catch (err: any) {
      console.error('Approve & forward failed', err);
      toast.error('Failed to approve and forward plan: ' + (err?.message || 'Unknown error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!auditId) return;
    const reason = rejectComment.trim();
    if (!reason) {
      toast.warning('Please enter a reason for rejection.');
      return;
    }
    try {
      setActionLoading(true);
      await rejectPlanContent(auditId, { comment: reason });
      toast.success('Plan has been rejected.');
      await loadAuditDetails();
      setShowRejectModal(false);
    } catch (err: any) {
      console.error('Reject plan failed', err);
      const errorMessage = err?.response?.data?.message || err?.message || 'Unknown error';
      toast.error('Failed to reject plan: ' + errorMessage);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/lead-auditor/auditplanning')}
              className="text-primary-600 hover:text-primary-700 mb-2 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Audit Planning
            </button>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              {loadingDetails ? 'Loading...' : auditDetails?.title || 'Audit Detail'}
            </h1>
          </div>

          {/* Actions for plans that haven't been reviewed yet */}
          {auditDetails && canReviewPlan(auditDetails) && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  setRejectComment('');
                  setShowRejectModal(true);
                }}
                disabled={actionLoading}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 shadow-sm disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Approve & Forward'}
              </button>
            </div>
          )}
          
          {/* Show rejection reason button if plan is rejected */}
          {auditDetails && (() => {
            const planStatus = String(auditDetails?.status || auditDetails?.audit?.status || '').toLowerCase();
            const isRejected = planStatus.includes('rejected');
            return isRejected && latestRejectionComment ? (
              <button
                onClick={() => setShowRejectionReasonModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-red-300 text-red-700 bg-white hover:bg-red-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                View Rejection Reason
              </button>
            ) : null;
          })()}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('department')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'department'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Department
              </button>
              <button
                onClick={() => setActiveTab('auditteam')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'auditteam'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Audit Team
              </button>
              <button
                onClick={() => setActiveTab('criteria')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'criteria'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Criteria
              </button>
              <button
                onClick={() => setActiveTab('template')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'template'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Template
              </button>
              <button
                onClick={() => setActiveTab('schedule')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'schedule'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Schedule
              </button>
              {/* Only show Findings tab when audit status is Approved */}
              {((auditDetails?.audit?.status || auditDetails?.status) === 'Approved') && (
                <button
                  onClick={() => setActiveTab('findings')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'findings'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Findings
                </button>
              )}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'department' && (
              <DepartmentTab 
                departments={departments} 
                loading={loadingDepartments}
                onViewAuditDetail={() => setShowAuditDetailModal(true)}
                sensitiveAreasByDept={sensitiveAreasByDept}
              />
            )}
            {activeTab === 'auditteam' && (
              <AuditTeamTab 
                auditors={auditors} 
                loading={loadingAuditors}
              />
            )}
            {activeTab === 'criteria' && (
              <CriteriaTab 
                criteria={criteria} 
                loading={loadingCriteria}
              />
            )}
            {activeTab === 'findings' && (
              <FindingsTab 
                findings={findings} 
                loading={loadingFindings}
              />
            )}
            {activeTab === 'schedule' && (
              <div>
                {loadingSchedules ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-gray-600">Loading schedule...</span>
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No schedule found for this audit</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-primary-100 shadow-sm p-6">
                      <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-200">
                        <h3 className="text-lg font-bold ">Schedule & Milestones</h3>
                      </div>
                      
                      {/* Schedule List - Vertical Layout */}
                      <div className="space-y-3">
                        {(() => {
                          // Sort schedules by dueDate ascending
                          const scheduleValues = [...schedules].sort((a: any, b: any) => {
                            const ta = a?.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
                            const tb = b?.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
                            return ta - tb;
                          });

                          return scheduleValues.map((schedule: any, idx: number) => {
                            const hasDate = !!schedule.dueDate;
                            const milestoneName = schedule.milestoneName || schedule.name || `Milestone ${idx + 1}`;
                            
                            return (
                              <div
                                key={schedule.scheduleId || schedule.id || idx}
                                className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all"
                              >
                                {/* Marker dot */}
                                <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
                                  hasDate 
                                    ? 'bg-primary-600 border-white shadow-md' 
                                    : 'bg-gray-300 border-gray-400'
                                }`}></div>
                                
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className={`text-sm font-medium ${
                                    hasDate ? 'text-gray-900' : 'text-gray-400'
                                  }`}>
                                    {milestoneName}
                                  </div>
                                  {hasDate && (
                                    <div className="mt-1 text-xs text-gray-500">
                                      {new Date(schedule.dueDate).toLocaleDateString('en-US', { 
                                        year: 'numeric',
                                        month: 'long', 
                                        day: 'numeric' 
                                      })}
                                    </div>
                                  )}
                                  {!hasDate && (
                                    <div className="mt-1 text-xs text-gray-400 italic">
                                      Not set
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'template' && (
              <div>
                {loadingTemplate ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    <span className="ml-3 text-gray-600">Loading template...</span>
                  </div>
                ) : templates.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No template found for this audit</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Template ID: {auditDetails?.templateId || auditDetails?.audit?.templateId || 'N/A'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-6">Checklist Templates</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.map((tpl, index) => (
                          <div
                            key={tpl.templateId || tpl.name || index}
                            className="border border-gray-200 rounded-xl p-4 shadow-sm bg-gray-50 hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <h4 className="text-sm font-semibold text-gray-900 flex-1 line-clamp-2">
                                {tpl.name || `Template ${index + 1}`}
                              </h4>
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-semibold">
                                {index + 1}
                              </span>
                            </div>
                            <div className="space-y-1 mb-2">
                              {tpl.version && (
                                <div className="text-xs text-gray-600">
                                  <span className="font-semibold">Version:</span>{' '}
                                  <span>{tpl.version}</span>
                                </div>
                              )}
                            </div>
                            {tpl.description && (
                              <p className="text-xs text-gray-600 line-clamp-3">{tpl.description}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {showAuditDetailModal && auditDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] overflow-hidden flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-8 py-6 shadow-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold text-white">Audit Details</h3>
                  <p className="text-sm text-white/90 mt-1">Complete audit information</p>
                </div>
                <button
                  onClick={() => setShowAuditDetailModal(false)}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-all duration-200"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white p-8">
              <div className="space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Audit ID</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.auditId || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Title</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.title || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Type</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.type || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Scope</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.scope || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.status || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Template ID</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.templateId || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Start Date</span>
                      <p className="text-sm text-gray-900 mt-1">{formatDate(auditDetails.startDate)}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">End Date</span>
                      <p className="text-sm text-gray-900 mt-1">{formatDate(auditDetails.endDate)}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Created By</span>
                      <p className="text-sm text-gray-900 mt-1">{createdByFullName || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Created At</span>
                      <p className="text-sm text-gray-900 mt-1">{formatDateTime(auditDetails.createdAt)}</p>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase">Published</span>
                      <p className="text-sm text-gray-900 mt-1">{auditDetails.isPublished ? 'Yes' : 'No'}</p>
                    </div>
                  </div>
                  {auditDetails.objective && (
                    <div className="mt-4">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Objective</span>
                      <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{auditDetails.objective}</p>
                    </div>
                  )}
                </div>

                  {/* Departments & Standards (combined view, similar to Auditor modal) */}
                  {departments.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
                      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-200">
                        <h4 className="text-lg font-semibold text-primary-700">Departments & Standards</h4>
                      </div>
                      <div className="space-y-4">
                        {departments.map((dept: any, idx: number) => {
                          const deptId =
                            Number(dept.deptId ?? dept.departmentId ?? dept.id ?? dept.$id ?? 0);
                          const deptName =
                            dept.deptName || dept.departmentName || dept.name || `Department ${idx + 1}`;
                          const deptSensitiveAreas =
                            (sensitiveAreasByDept[deptId] as string[] | undefined) || [];
                          const hasSensitiveAreas = deptSensitiveAreas.length > 0;

                          // Get criteria specific to this department
                          const deptCriteria = criteriaByDept.get(deptId) || [];

                          return (
                            <div
                              key={`${deptId}-${idx}`}
                              className={`bg-gray-50 rounded-lg p-5 border-2 transition-all duration-300 ${
                                hasSensitiveAreas
                                  ? 'border-amber-300 hover:border-amber-400 hover:shadow-lg'
                                  : 'border-gray-200 hover:border-primary-300 hover:shadow-lg'
                              }`}
                            >
                              {/* Department header */}
                              <div className="mb-3 pb-2 border-b border-gray-200">
                                <div className="flex items-center justify-between">
                                  <h5 className="text-base font-bold text-gray-900">{deptName}</h5>
                                </div>

                                {/* Sensitive Areas */}
                                {hasSensitiveAreas && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {deptSensitiveAreas.map((area: string, areaIdx: number) => (
                                      <span
                                        key={areaIdx}
                                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200"
                                      >
                                        🔒 {area}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Standards list */}
                              <div>
                                <h6 className="text-sm font-semibold text-gray-700 mb-2">Standards</h6>
                                {deptCriteria.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {deptCriteria.map((criterion: any, critIdx: number) => {
                                      const displayName =
                                        criterion.name ||
                                        criterion.criterionName ||
                                        criterion.referenceCode ||
                                        `Criterion ${critIdx + 1}`;
                                      return (
                                        <div
                                          key={`${deptId}-criterion-${critIdx}`}
                                          className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-200 hover:bg-gray-50 transition-colors"
                                        >
                                          <div className="bg-primary-600 rounded-full p-1">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                              <path
                                                fillRule="evenodd"
                                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                          </div>
                                          <span className="text-sm text-black font-normal">{displayName}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 italic">No standards assigned.</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-white px-8 py-5 border-t border-gray-200 shadow-lg">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAuditDetailModal(false)}
                  className="px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject confirmation modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/50">
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Confirm Rejection</h3>
              <p className="text-sm text-gray-600">
                Please provide a reason for rejecting this audit plan. The Auditor will see this reason.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection reason
                </label>
                <textarea
                  className="w-full min-h-[100px] rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter rejection reason..."
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Reject Plan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal (shows rejection comment when clicking on "View Details") */}
      {showRejectionReasonModal && latestRejectionComment && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowRejectionReasonModal(false)}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl mx-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Rejection Reason
                </h3>
                <button
                  type="button"
                  onClick={() => setShowRejectionReasonModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  title="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-3">
                
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason
                  </label>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800 leading-relaxed whitespace-pre-line">
                      {latestRejectionComment || 'No rejection reason provided.'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-gray-500 pt-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>This plan was rejected. Please review the reason above and make necessary corrections.</span>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowRejectionReasonModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
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
};

export default AuditDetail;

