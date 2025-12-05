import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { StatCard } from '../../../components';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuditFindings } from '../../../hooks/useAuditFindings';
import { getMyAssignments } from '../../../api/auditAssignments';
import { getDepartmentById } from '../../../api/departments';
import { getAuditPlanById } from '../../../api/audits';
import { unwrap } from '../../../utils/normalize';

interface DepartmentCard {
  deptId: number;
  name: string;
  code: string;
  description: string;
  assignmentId: string;
  auditId: string;
  auditTitle: string;
  status: string;
  auditType?: string;
}


const SQAStaffFindingManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentCard[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [errorDepartments, setErrorDepartments] = useState<string | null>(null);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Use the audit findings hook to get audit plans
  const {
    loading: loadingAudits,
    error: auditsError,
    fetchAuditPlans,
    auditPlans: _auditPlans,
  } = useAuditFindings();

  // Load audit plans on mount
  useEffect(() => {
    fetchAuditPlans();
  }, [fetchAuditPlans]);

  // Load my assignments and departments
  useEffect(() => {
    const loadDepartments = async () => {
      setLoadingDepartments(true);
      setErrorDepartments(null);
      
      try {
        // Get my assignments
        console.log('🔍 Fetching my assignments...');
        const assignmentsResponse: any = await getMyAssignments();
        console.log('📦 Raw assignments response:', assignmentsResponse);
        console.log('📦 Response.data:', assignmentsResponse?.data);
        console.log('📦 Response.data.$values:', assignmentsResponse?.data?.$values);
        
        // Handle response - check if it's full axios response or just data
        let responseData = assignmentsResponse;
        if (assignmentsResponse?.status && assignmentsResponse?.data) {
          // This is full axios response object, extract data
          responseData = assignmentsResponse.data;
          console.log('📦 Extracted data from axios response:', responseData);
        }
        
        console.log('📦 Processed responseData:', responseData);
        console.log('📦 responseData keys:', Object.keys(responseData || {}));
        console.log('📦 responseData.$values:', responseData?.$values);
        console.log('📦 responseData.$values type:', typeof responseData?.$values);
        console.log('📦 responseData.$values is array?', Array.isArray(responseData?.$values));
        
        // Expand responseData to see nested structure
        if (responseData) {
          console.log('📦 Full responseData structure:', JSON.stringify(responseData, null, 2));
        }
        
        // Handle response - could be direct array, or wrapped in $values
        let assignments: any[] = [];
        if (Array.isArray(responseData)) {
          assignments = responseData;
          console.log('✅ Response is direct array');
        } else if (responseData?.$values && Array.isArray(responseData.$values)) {
          assignments = responseData.$values;
          console.log('✅ Found $values array with', assignments.length, 'items');
        } else if (responseData?.values && Array.isArray(responseData.values)) {
          assignments = responseData.values;
          console.log('✅ Found values array');
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          assignments = responseData.data;
          console.log('✅ Found data array');
        } else {
          // Try unwrap as fallback
          assignments = unwrap(responseData);
          console.log('✅ Used unwrap fallback, got', assignments.length, 'items');
        }
        
        console.log('✅ Final assignments array:', assignments);
        console.log('✅ Assignments count:', assignments.length);
        
        if (!assignments || assignments.length === 0) {
          console.log('⚠️ No assignments found');
          setDepartments([]);
          setLoadingDepartments(false);
          return;
        }

        // Filter out assignments with status "archived"
        const activeAssignments = assignments.filter((a: any) => {
          const status = (a.status || '').toLowerCase().trim();
          return status !== 'archived';
        });
        console.log('✅ Active assignments (excluding archived):', activeAssignments.length);

        if (activeAssignments.length === 0) {
          console.log('⚠️ No active assignments found (all are archived)');
          setDepartments([]);
          setLoadingDepartments(false);
          return;
        }

        // Get unique deptIds from active assignments only
        const uniqueDeptIds = Array.from(new Set(activeAssignments.map((a: any) => a.deptId)));
        console.log('🏢 Unique department IDs:', uniqueDeptIds);
        
        // Fetch department details for each unique deptId
        const departmentPromises = uniqueDeptIds.map(async (deptId: number) => {
          try {
            console.log(`📥 Fetching department ${deptId}...`);
            const deptData = await getDepartmentById(deptId);
            console.log(`✅ Department ${deptId} data:`, deptData);
            
            // Find all active assignments for this department
            const deptAssignments = activeAssignments.filter((a: any) => a.deptId === deptId);
            
            // Return department card data (using first assignment for audit info)
            const firstAssignment = deptAssignments[0];
            let auditType = '';
            
            // Get audit type by calling getAuditPlanById with auditId from assignment
            if (firstAssignment.auditId) {
              try {
                const auditData = await getAuditPlanById(firstAssignment.auditId);
                // Try both root level and nested audit object
                auditType = auditData.type || auditData.Type || auditData.auditType || 
                           auditData.audit?.type || auditData.audit?.Type || auditData.audit?.auditType || '';
              } catch (err) {
                console.warn(`Failed to load audit type for ${firstAssignment.auditId}:`, err);
              }
            }
            
            const cardData = {
              deptId: deptData.deptId || deptId,
              name: deptData.name || 'Unknown Department',
              code: deptData.code || '',
              description: deptData.description || '',
              assignmentId: firstAssignment.assignmentId,
              auditId: firstAssignment.auditId,
              auditTitle: firstAssignment.auditTitle || 'Untitled Audit',
              status: firstAssignment.status || 'Unknown',
              auditType: auditType,
            };
            console.log(`✅ Created card for department ${deptId}:`, cardData);
            return cardData;
          } catch (err) {
            console.error(`❌ Error loading department ${deptId}:`, err);
            return null;
          }
        });

        const departmentResults = await Promise.all(departmentPromises);
        const validDepartments = departmentResults.filter((dept): dept is DepartmentCard => dept !== null);
        console.log('🎯 Final departments to display:', validDepartments);
        
        setDepartments(validDepartments);
      } catch (err: any) {
        console.error('❌ Error loading departments:', err);
        console.error('Error details:', {
          message: err?.message,
          response: err?.response,
          stack: err?.stack
        });
        setErrorDepartments(err?.message || 'Failed to load departments');
      } finally {
        setLoadingDepartments(false);
      }
    };

    loadDepartments();
  }, []);

  const handleDepartmentClick = (dept: DepartmentCard) => {
    // Navigate to checklist items page for this department with auditId in state
    navigate(`/auditor/findings/department/${dept.deptId}`, {
      state: { auditId: dept.auditId, department: dept }
    });
  };


  const stats = {
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-white border-b border-primary-100 shadow-sm mb-4 sm:mb-6">
        <div className="px-4 sm:px-6 py-3 sm:py-4">
          <h1 className="text-xl sm:text-2xl font-semibold text-primary-600">Finding Management</h1>
          <p className="text-gray-600 text-xs sm:text-sm mt-1">Execute checklists and manage audit findings</p>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 sm:space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            title="Total Findings"
            value={stats.total}
            icon={
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            variant="primary"
          />
          <StatCard
            title="Open"
            value={stats.open}
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="In Progress"
            value={stats.inProgress}
            icon={
              <svg className="w-8 h-8 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-light"
          />
          <StatCard
            title="Resolved"
            value={stats.resolved}
            icon={
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            variant="primary-dark"
          />
        </div>

        {/* Loading State */}
        {loadingAudits && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit plans...</p>
          </div>
        )}
        
        {/* Error State */}
        {auditsError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700">Error loading audits: {auditsError}</p>
            <button
              onClick={() => fetchAuditPlans()}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Available Audit Plans - Departments */}
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold text-primary-600">Available Audit Plans</h2>
            <p className="text-sm text-gray-600 mt-1">Select a department to start audit</p>
          </div>

          {/* Loading State */}
          {loadingDepartments && (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-sm">Loading departments...</p>
            </div>
          )}

          {/* Error State */}
          {errorDepartments && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mx-4 my-4">
              <p className="text-red-700 text-sm">Error: {errorDepartments}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Retry
              </button>
            </div>
          )}

          {/* Departments Grid - Mobile First, Responsive */}
          {!loadingDepartments && !errorDepartments && (
            <>
              {departments.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-gray-500 font-medium">No departments available</p>
                  <p className="text-sm text-gray-400 mt-1">Departments will appear here when assigned</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {departments.map((dept, index) => (
                    <div
                      key={dept.deptId}
                      className="bg-white hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                      onClick={() => handleDepartmentClick(dept)}
                    >
                      <div className="px-4 sm:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          {/* Order Number */}
                          <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center bg-primary-100 text-primary-700 rounded-lg font-semibold text-sm sm:text-base">
                            {index + 1}
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                              {dept.name}
                            </h3>
                            {dept.code && (
                              <span className="text-xs sm:text-sm text-gray-500 font-mono whitespace-nowrap">
                                ({dept.code})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default SQAStaffFindingManagement;
