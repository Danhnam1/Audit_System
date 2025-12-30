import { MainLayout } from '../../../layouts';
import { PageHeader } from '../../../components';
import { useAuth } from '../../../contexts';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuditFindings } from '../../../hooks/useAuditFindings';
import { getMyAssignments } from '../../../api/auditAssignments';
import { getAuditPlanById, getSensitiveDepartments } from '../../../api/audits';
import { getCurrentTime } from '../../../api/time';
import { unwrap } from '../../../utils/normalize';
import { getAuditSchedules } from '../../../api/auditSchedule';
import { getDepartments } from '../../../api/departments';
import { getAdminUsers } from '../../../api/adminUsers';
import { getAuditorsByAuditId } from '../../../api/auditTeam';
import { getAuditChecklistTemplateMapsByAudit } from '../../../api/auditChecklistTemplateMaps';
import { normalizePlanDetails } from '../../../utils/normalize';
import { getStatusColor, getBadgeVariant } from '../../../constants';
import { PlanDetailsModal } from '../AuditPlanning/components/PlanDetailsModal';

interface AuditCard {
  auditId: string;
  auditTitle: string;
  auditType: string;
  status: string;
  departmentCount: number;
  startDate?: string;
  endDate?: string;
  scope?: string;
  objective?: string;
}

const SQAStaffFindingManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [audits, setAudits] = useState<AuditCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('all');
  
  // Modal state
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState<any>(null);
  const [templatesForSelectedPlan, setTemplatesForSelectedPlan] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [auditTeams, setAuditTeams] = useState<any[]>([]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const {
    fetchAuditPlans,
    auditPlans: _auditPlans,
  } = useAuditFindings();

  useEffect(() => {
    fetchAuditPlans();
  }, [fetchAuditPlans]);

  // Load current time from API
  useEffect(() => {
    const loadCurrentTime = async () => {
      try {
        const timeResponse = await getCurrentTime();
        // Parse currentTime string "2025-12-24 18:26:47" to Date
        const parsedTime = new Date(timeResponse.currentTime);
        setCurrentTime(parsedTime);
      } catch (err) {
        console.error('Failed to load current time from API, using local time:', err);
        // Fallback to local time if API fails
        setCurrentTime(new Date());
      }
    };
    
    loadCurrentTime();
  }, []);

  useEffect(() => {
    const loadAudits = async () => {
      // Wait for currentTime to be loaded
      if (!currentTime) {
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const assignmentsResponse: any = await getMyAssignments();
        
        let responseData = assignmentsResponse;
        if (assignmentsResponse?.status && assignmentsResponse?.data) {
          responseData = assignmentsResponse.data;
        }
        let assignments: any[] = [];
        if (Array.isArray(responseData)) {
          assignments = responseData;
        } else if (responseData?.$values && Array.isArray(responseData.$values)) {
          assignments = responseData.$values;
        } else if (responseData?.values && Array.isArray(responseData.values)) {
          assignments = responseData.values;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          assignments = responseData.data;
        } else {
          assignments = unwrap(responseData);
        }
        
        
        if (!assignments || assignments.length === 0) {
          setAudits([]);
          setLoading(false);
          return;
        }

        // Filter active assignments
        const activeAssignments = assignments.filter((a: any) => {
          const status = (a.status || '').toLowerCase().trim();
          return status !== 'archived';
        });

        if (activeAssignments.length === 0) {
          setAudits([]);
          setLoading(false);
          return;
        }

        // Group assignments by auditId
        const auditMap = new Map<string, any[]>();
        activeAssignments.forEach((assignment: any) => {
          const auditId = assignment.auditId;
          if (auditId) {
            if (!auditMap.has(auditId)) {
              auditMap.set(auditId, []);
            }
            auditMap.get(auditId)!.push(assignment);
          }
        });


        // Load audit info and create audit cards
        const auditPromises = Array.from(auditMap.entries()).map(async ([auditId, auditAssignments]) => {
          try {
            const auditData = await getAuditPlanById(auditId);
            
            // Data is nested in audit object
            const audit = auditData.audit || auditData;
            
            const auditType = audit.type || audit.Type || auditData.type || auditData.Type || '';
            const auditTitle = audit.title || audit.name || auditData.title || auditData.name || auditAssignments[0]?.auditTitle || 'Department Audit';
            const status = audit.status || audit.Status || auditData.status || auditData.Status || auditAssignments[0]?.status || 'Unknown';
            const scope = audit.scope || audit.Scope || auditData.scope || auditData.Scope || '';
            
            // Get Fieldwork Start date from schedules
            let fieldworkStartDate = '';
            try {
              const schedulesData = auditData.schedules || audit.schedules;
              if (schedulesData) {
                // Unwrap schedules array
                const schedulesArray = unwrap(schedulesData);
                if (Array.isArray(schedulesArray) && schedulesArray.length > 0) {
                  // Find schedule with milestoneName === "Fieldwork Start"
                  const fieldworkSchedule = schedulesArray.find((s: any) => 
                    (s.milestoneName || s.name || s.milestone || '').toLowerCase() === 'fieldwork start'
                  );
                  if (fieldworkSchedule && fieldworkSchedule.dueDate) {
                    fieldworkStartDate = fieldworkSchedule.dueDate;
                  } else {
                  }
                }
              }
            } catch (scheduleErr) {
            }
            
            // Fallback to startDate if Fieldwork Start not found
            let startDate = fieldworkStartDate || audit.startDate || audit.StartDate || auditData.startDate || auditData.StartDate || '';
            if (!startDate && auditAssignments.length > 0) {
              startDate = auditAssignments[0]?.plannedStartDate || '';
            }
            const endDate = audit.endDate || audit.EndDate || auditData.endDate || auditData.EndDate || '';
            const objective = audit.objective || audit.Objective || auditData.objective || auditData.Objective || '';
            
            // Get unique department count
            const uniqueDeptIds = new Set(auditAssignments.map((a: any) => a.deptId));
            
            const auditCard: AuditCard = {
              auditId: auditId,
              auditTitle: auditTitle,
              auditType: auditType,
              status: status,
              departmentCount: uniqueDeptIds.size,
              startDate: startDate,
              endDate: endDate,
              scope: scope,
              objective: objective,
            };
            return auditCard;
          } catch (err) {
            // Fallback: use assignment data
            const firstAssignment = auditAssignments[0];
            const uniqueDeptIds = new Set(auditAssignments.map((a: any) => a.deptId));
            return {
              auditId: auditId,
              auditTitle: firstAssignment?.auditTitle || 'Department Audit',
              auditType: '',
              status: firstAssignment?.status || 'Unknown',
              departmentCount: uniqueDeptIds.size,
              startDate: firstAssignment?.plannedStartDate || '',
            };
          }
        });

        const auditResults = await Promise.all(auditPromises);
        const validAudits: AuditCard[] = auditResults.filter((audit): audit is AuditCard => audit !== null);
        
        // Use currentTime from API for comparison (already loaded in state)
        const apiCurrentTime = currentTime || new Date();
        
        // Filter out audits with status "Archived" or "Inactive" (case-insensitive)
        const activeAudits = validAudits.filter((audit) => {
          const status = audit.status || '';
          const statusLower = String(status).toLowerCase().trim();
          
          // Check for various forms of "archived"
          const isArchived = statusLower === 'archived' || 
                           statusLower === 'archive' ||
                           statusLower.includes('archived');

          // Also treat "Inactive" audits as closed and hide them from Task Management
          const isInactive = statusLower === 'inactive';
          
          if (isArchived || isInactive) {
            return false;
          }
          
          // Approved audits should always be shown (for Pending tab)
          const isApproved = statusLower === 'approved';
          if (isApproved) {
            return true;
          }
          
          // Filter out future audits - only show audits where Fieldwork Start date <= currentTime from API
          // Note: startDate now contains Fieldwork Start date (or fallback to audit startDate)
          // This filter only applies to non-Approved audits
          if (audit.startDate) {
            try {
              const fieldworkStartDate = new Date(audit.startDate);
              // Compare with currentTime from API (includes time, not just date)
              // Only show if Fieldwork Start date <= currentTime from API
              if (fieldworkStartDate > apiCurrentTime) {
                return false;
              }
            } catch (err) {
              console.error('Error parsing fieldwork start date:', err);
            }
          }
          
          return true;
        });
        
     
        
        setAudits(activeAudits);
      } catch (err: any) {
      
        setError(err?.message || 'Failed to load audits');
      } finally {
        setLoading(false);
      }
    };

    loadAudits();
  }, [currentTime]);

  // Check if audit is pending (audits with status "Approved")
  const isPendingAudit = (audit: AuditCard): boolean => {
    // Pending = audits with status "Approved" (case-insensitive)
    const status = (audit.status || '').toLowerCase().trim();
    return status === 'approved';
  };

  // Check if audit is InProgress
  const isInProgressAudit = (audit: AuditCard): boolean => {
    const status = (audit.status || '').toLowerCase().trim();
    return status === 'inprogress' || status === 'in progress';
  };

  // Get filtered audits based on active tab
  const getFilteredAudits = (): AuditCard[] => {
    if (activeTab === 'pending') {
      // Pending tab: only show Approved audits
      return audits.filter(audit => isPendingAudit(audit));
    }
    // All tab: only show InProgress audits
    return audits.filter(audit => isInProgressAudit(audit));
  };

  const handleAuditClick = (audit: AuditCard) => {
    // Don't navigate if in pending tab
    if (activeTab === 'pending') {
      return;
    }
    navigate(`/auditor/findings/audit/${audit.auditId}`);
  };

  // Load departments and users for PlanDetailsModal
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load departments
        const deptRes: any = await getDepartments();
        const deptList = (deptRes || []).map((d: any) => ({
          deptId: d.deptId ?? d.$id ?? d.id,
          name: d.name || d.code || "—",
        }));
        setDepartments(deptList);

        // Load users
        const usersRes: any = await getAdminUsers();
        const users = unwrap(usersRes) || [];
        setAuditorOptions(users);
        setOwnerOptions(users);
      } catch (err) {
        console.error('Failed to load departments/users:', err);
      }
    };
    loadData();
  }, []);

  // Handler: View full details
  const handleViewDetails = async (auditId: string) => {
    try {
      const rawDetails = await getAuditPlanById(auditId);

      // Fetch schedules separately if not included in main response
      let schedulesData = rawDetails?.schedules;
      if (
        !schedulesData ||
        (!schedulesData.values &&
          !schedulesData.$values &&
          !Array.isArray(schedulesData))
      ) {
        try {
          const schedulesResponse = await getAuditSchedules(auditId);
          const schedulesArray = unwrap(schedulesResponse);
          schedulesData = { values: schedulesArray };
        } catch (scheduleErr) {
          schedulesData = { values: [] };
        }
      }

      // Merge schedules into rawDetails
      const detailsWithSchedules = {
        ...rawDetails,
        schedules: schedulesData,
      };

      // Load sensitive areas
      let sensitiveAreasByDept: Record<number, string[]> = {};
      try {
        const sensitiveDepts = await getSensitiveDepartments(auditId);
        if (sensitiveDepts && sensitiveDepts.length > 0) {
          sensitiveDepts.forEach((sd: any) => {
            const deptId = Number(sd.deptId);
            let areasArray: string[] = [];
            
            if (Array.isArray(sd.Areas)) {
              areasArray = sd.Areas;
            } else if (sd.Areas && typeof sd.Areas === "string") {
              try {
                const parsed = JSON.parse(sd.Areas);
                areasArray = Array.isArray(parsed) ? parsed : [sd.Areas];
              } catch {
                areasArray = [sd.Areas];
              }
            } else if (Array.isArray(sd.areas)) {
              areasArray = sd.areas;
            }
            
            if (deptId && areasArray.length > 0) {
              sensitiveAreasByDept[deptId] = areasArray
                .filter((area: string) => area && typeof area === "string" && area.trim())
                .map((a: string) => a.trim());
            }
          });
        }
      } catch (sensitiveErr) {
        console.error("Failed to load sensitive areas:", sensitiveErr);
      }

      // Load templates
      let templates: any[] = [];
      try {
        const templatesRes = await getAuditChecklistTemplateMapsByAudit(auditId);
        const templatesList = unwrap(templatesRes) || [];
        templates = Array.isArray(templatesList) ? templatesList : [];
      } catch (templateErr) {
        console.error("Failed to load templates:", templateErr);
      }

      // Load audit teams
      let teams: any[] = [];
      try {
        const teamsRes = await getAuditorsByAuditId(auditId);
        const teamsList = unwrap(teamsRes) || [];
        teams = Array.isArray(teamsList) ? teamsList : [];
        setAuditTeams(teams);
      } catch (teamErr) {
        console.error("Failed to load audit teams:", teamErr);
      }

      // Normalize details
      const normalizedDetails = normalizePlanDetails(detailsWithSchedules, {
        departments: departments,
        criteriaList: [],
        users: [],
      });

      const detailsWithSensitive = {
        ...normalizedDetails,
        sensitiveAreasByDept,
      };

      setSelectedPlanDetails(detailsWithSensitive);
      setTemplatesForSelectedPlan(templates);
      setShowDetailsModal(true);
    } catch (err: any) {
      console.error('Failed to load audit details:', err);
      alert('Failed to load audit details: ' + (err?.message || 'Unknown error'));
    }
  };

  // Get current user's userId for PlanDetailsModal
  const currentUserId = useMemo(() => {
    if (!user) return null;
    const fallbackId =
      (user as any)?.userId ?? (user as any)?.id ?? (user as any)?.$id ?? null;
    return fallbackId ? String(fallbackId).trim() : null;
  }, [user]);

  // Helper functions for PlanDetailsModal
  const getCriterionName = (id: string) => {
    return `Criterion ${id}`;
  };

  const getDepartmentName = (id: string | number) => {
    const dept = departments.find((d) => String(d.deptId) === String(id));
    return dept?.name || `Department ${id}`;
  };

  const getTemplateName = (tid: string | number | null | undefined) => {
    return `Template ${String(tid ?? "")}`;
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6">
        <PageHeader
          title="Task Management"
          subtitle="Select a department to manage audit findings"
        />
      </div>

      {/* Tabs - Always visible */}
      <div className="px-4 sm:px-6 mb-6" style={{ display: 'block', visibility: 'visible' }}>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2">
          <nav className="flex space-x-2" aria-label="Tabs" style={{ display: 'flex' }}>
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
              style={{ display: 'inline-flex', visibility: 'visible' }}
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
              style={{ display: 'inline-flex', visibility: 'visible' }}
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

      <div className="px-4 sm:px-6 pb-6 sm:pb-8 space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading audits...</p>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-red-800 font-semibold">Error loading audits</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        {/* Available Audits - Table View */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {getFilteredAudits().length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 font-semibold text-lg">
                  {activeTab === 'pending' ? 'No pending audits found' : 'No audits available'}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {activeTab === 'pending' 
                    ? 'No time-constrained audits at the moment' 
                    : 'Audits will appear here when you are assigned'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gradient-to-r from-primary-50 to-primary-100">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-primary-800 uppercase tracking-wider">
                        Audit Title
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-primary-800 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-primary-800 uppercase tracking-wider">
                        Scope
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-primary-800 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-primary-800 uppercase tracking-wider">
                        Start Date
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-primary-800 uppercase tracking-wider">
                        End Date
                      </th>
                      <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-primary-800 uppercase tracking-wider">
                        Objective
                      </th>
                     
                      <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-primary-800 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getFilteredAudits().map((audit) => {
                      const isPending = isPendingAudit(audit);
                      const canClick = activeTab !== 'pending';
                      return (
                      <tr
                        key={audit.auditId}
                        className={`transition-colors ${
                          canClick 
                            ? 'hover:bg-primary-50 cursor-pointer' 
                            : 'cursor-not-allowed opacity-75'
                        }`}
                        onClick={() => canClick && handleAuditClick(audit)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-lg flex items-center justify-center">
                              <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-bold text-gray-900">{audit.auditTitle}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            audit.auditType?.toLowerCase() === 'internal' 
                              ? 'bg-blue-100 text-blue-800'
                              : audit.auditType?.toLowerCase() === 'external'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {audit.auditType || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className=
                             'bg-gray-100 text-gray-800 px-2.5 py-1 rounded-full text-xs font-semibold' 
                          >
                            {audit.scope || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            audit.status?.toLowerCase() === 'inprogress' || audit.status?.toLowerCase() === 'in progress'
                              ? 'bg-yellow-100 text-yellow-800'
                              : audit.status?.toLowerCase() === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : audit.status?.toLowerCase() === 'pending'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {audit.status?.replace(/([A-Z])/g, ' $1').trim() || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {audit.startDate ? new Date(audit.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {audit.endDate ? new Date(audit.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate" title={audit.objective}>
                            {audit.objective || 'N/A'}
                          </div>
                        </td>
                     
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center gap-2">
                            {!isPending && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAuditClick(audit);
                                }}
                                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
                              >
                                Action
                                <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(audit.auditId);
                              }}
                              className="inline-flex items-center px-3 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
                              title="View Details"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Plan Details Modal */}
      {showDetailsModal && selectedPlanDetails && (
        <PlanDetailsModal
          showModal={showDetailsModal}
          selectedPlanDetails={selectedPlanDetails}
          templatesForPlan={templatesForSelectedPlan}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedPlanDetails(null);
            setTemplatesForSelectedPlan([]);
          }}
          currentUserId={currentUserId}
          auditTeamsForPlan={auditTeams.filter((m: any) => {
            const currentAuditId = selectedPlanDetails.auditId || selectedPlanDetails.id;
            if (!currentAuditId) return false;
            const teamAuditId = String(m?.auditId || "").trim();
            return (
              teamAuditId === String(currentAuditId).trim() ||
              teamAuditId.toLowerCase() === String(currentAuditId).toLowerCase()
            );
          })}
          getCriterionName={getCriterionName}
          getDepartmentName={getDepartmentName}
          getStatusColor={getStatusColor}
          getBadgeVariant={getBadgeVariant}
          ownerOptions={ownerOptions}
          auditorOptions={auditorOptions}
          getTemplateName={getTemplateName}
          hideSections={['auditTeam']}
        />
      )}
    </MainLayout>
  );
};

export default SQAStaffFindingManagement;