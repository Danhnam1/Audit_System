import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
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
  auditType: string;
}

const getStatusBadgeColor = (status: string) => {
  const statusLower = status?. toLowerCase() || '';
  switch (statusLower) {
    case 'assigned':
      return 'bg-blue-100 text-blue-800 border border-blue-300';
    case 'in progress':
      return 'bg-yellow-100 text-yellow-800 border border-yellow-300';
    case 'completed':
      return 'bg-green-100 text-green-800';
    case 'archived':
      return 'bg-gray-100 text-gray-800 border border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-300';
  }
};

const getAuditTypeBadgeColor = (auditType: string) => {
  const typeLower = auditType?.toLowerCase() || '';
  switch (typeLower) {
    case 'internal':
      return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'external':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'compliance':
      return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
    default:
      return 'bg-gray-50 text-gray-700 border border-gray-200';
  }
};

const SQAStaffFindingManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentCard[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [errorDepartments, setErrorDepartments] = useState<string | null>(null);

  const layoutUser = user ?  { name: user.fullName, avatar: undefined } : undefined;

  const {
    loading: loadingAudits,
    error: auditsError,
    fetchAuditPlans,
    auditPlans: _auditPlans,
  } = useAuditFindings();

  useEffect(() => {
    fetchAuditPlans();
  }, [fetchAuditPlans]);

  useEffect(() => {
    const loadDepartments = async () => {
      setLoadingDepartments(true);
      setErrorDepartments(null);
      
      try {
        console.log('🔍 Fetching my assignments...');
        const assignmentsResponse: any = await getMyAssignments();
        console.log('📦 Raw assignments response:', assignmentsResponse);
        
        let responseData = assignmentsResponse;
        if (assignmentsResponse?.status && assignmentsResponse?.data) {
          responseData = assignmentsResponse.data;
          console.log('📦 Extracted data from axios response:', responseData);
        }
        
        console.log('📦 Processed responseData:', responseData);
        
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
        } else if (responseData?.data && Array. isArray(responseData.data)) {
          assignments = responseData. data;
          console.log('✅ Found data array');
        } else {
          assignments = unwrap(responseData);
          console.log('✅ Used unwrap fallback, got', assignments.length, 'items');
        }
        
        console.log('✅ Final assignments array:', assignments);
        console.log('✅ Assignments count:', assignments.length);
        
        if (! assignments || assignments.length === 0) {
          console.log('⚠️ No assignments found');
          setDepartments([]);
          setLoadingDepartments(false);
          return;
        }

        const activeAssignments = assignments.filter((a: any) => {
          const status = (a. status || '').toLowerCase(). trim();
          return status !== 'archived';
        });
        console.log('✅ Active assignments (excluding archived):', activeAssignments. length);

        if (activeAssignments.length === 0) {
          console. log('⚠️ No active assignments found (all are archived)');
          setDepartments([]);
          setLoadingDepartments(false);
          return;
        }

        const uniqueDeptIds = Array.from(new Set(activeAssignments.map((a: any) => a. deptId)));
        console.log('🏢 Unique department IDs:', uniqueDeptIds);
        
        const departmentPromises = uniqueDeptIds.map(async (deptId: number) => {
          try {
            console.log(`📥 Fetching department ${deptId}...`);
            const deptData = await getDepartmentById(deptId);
            console.log(`✅ Department ${deptId} data:`, deptData);
            
            const deptAssignments = activeAssignments.filter((a: any) => a. deptId === deptId);
            
            const firstAssignment = deptAssignments[0];
            let auditType = '';
            
            if (firstAssignment. auditId) {
              try {
                const auditData = await getAuditPlanById(firstAssignment.auditId);
                auditType = auditData.type || auditData.Type || auditData.auditType || 
                           auditData.audit?.type || auditData.audit?.Type || auditData.audit?.auditType || '';
              } catch (err) {
                console.warn(`Failed to load audit type for ${firstAssignment.auditId}:`, err);
              }
            }
            
            const cardData: DepartmentCard = {
              deptId: deptData. deptId || deptId,
              name: deptData.name || 'Unknown Department',
              code: deptData.code || '',
              description: deptData. description || '',
              assignmentId: firstAssignment.assignmentId,
              auditId: firstAssignment.auditId,
              auditTitle: firstAssignment. auditTitle || 'Untitled Audit',
              status: firstAssignment.status || 'Unknown',
              auditType: auditType || '',
            };
            console.log(`✅ Created card for department ${deptId}:`, cardData);
            return cardData;
          } catch (err) {
            console.error(`❌ Error loading department ${deptId}:`, err);
            return null;
          }
        });

        const departmentResults = await Promise.all(departmentPromises);
        const validDepartments: DepartmentCard[] = departmentResults.filter((dept): dept is DepartmentCard => dept !== null);
        console.log('🎯 Final departments to display:', validDepartments);
        
        setDepartments(validDepartments);
      } catch (err: any) {
        console.error('❌ Error loading departments:', err);
        console.error('Error details:', {
          message: err?. message,
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
    navigate(`/auditor/findings/department/${dept.deptId}`, {
      state: { auditId: dept.auditId, department: dept }
    });
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Finding Management</h1>
          <p className="text-primary-100 text-sm sm:text-base mt-2">Select a department to manage audit findings</p>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-6 sm:pb-8 space-y-6">
        {/* Loading State */}
        {loadingAudits && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading audit plans...</p>
          </div>
        )}
        
        {/* Error State */}
        {auditsError && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101. 414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1. 414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8. 586 8.707 7. 293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-red-800 font-semibold">Error loading audits</p>
                <p className="text-red-700 text-sm mt-1">{auditsError}</p>
              </div>
              <button
                onClick={() => fetchAuditPlans()}
                className="px-3 py-1. 5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        
        {/* Available Audit Plans - Table View */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-md overflow-hidden">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Available Departments</h2>
            <p className="text-sm text-gray-600 mt-1">Click on any department to start managing audit findings</p>
          </div>

          {/* Loading State */}
          {loadingDepartments && (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600 font-medium">Loading departments...</p>
            </div>
          )}

          {/* Error State */}
          {errorDepartments && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mx-4 my-4">
              <p className="text-red-700 font-semibold text-sm">Error: {errorDepartments}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Content */}
          {! loadingDepartments && !errorDepartments && (
            <>
              {departments.length === 0 ? (
                <div className="text-center py-16 px-4">
                  <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-gray-500 font-semibold text-lg">No departments available</p>
                  <p className="text-sm text-gray-400 mt-2">Departments will appear here when assigned</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">STT</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Department</th>
                        <th className="hidden sm:table-cell px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Code</th>
                        <th className="hidden md:table-cell px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit Type</th>
                        <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="hidden lg:table-cell px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Description</th>
                        <th className="hidden lg:table-cell px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>

                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {departments.map((dept, index) => (
                        <tr
                          key={dept. deptId}
                          // onClick={() => handleDepartmentClick(dept)}
                          className="bg-white hover:bg-primary-50 transition-colors duration-200 cursor-pointer border-b border-gray-100 last:border-b-0"
                        >
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-700 rounded-lg font-semibold text-sm">
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0">
                                <span className="text-white font-semibold text-sm">
                                  {dept.name. charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-semibold text-gray-900 truncate text-sm sm:text-base">
                                  {dept.name}
                                </p>
                                <p className="text-xs text-gray-500 truncate">
                                  {dept.auditTitle}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="hidden sm:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                            <code className="bg-gray-100 text-gray-800 px-2. 5 py-1. 5 rounded font-mono text-xs font-semibold">
                              {dept.code}
                            </code>
                          </td>
                          <td className="hidden md:table-cell px-4 sm:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getAuditTypeBadgeColor(dept.auditType)}`}>
                              {dept.auditType || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                            <span className={`inline-block px-3 py-1. 5 rounded-full text-xs font-semibold ${getStatusBadgeColor(dept.status)}`}>
                              {dept.status}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell px-4 sm:px-6 py-4">
                            <p className="text-gray-600 text-sm truncate max-w-xs">
                              {dept.description}
                            </p>
                          </td>
                          <td className="hidden lg:table-cell px-4 sm:px-6 py-4">
                             <button
                                                         onClick={() => handleDepartmentClick(dept)}
                                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full bg-blue-100 hover:bg-blue-200 text-blue-600 transition-colors active:scale-95"
                                title="View "
                              >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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