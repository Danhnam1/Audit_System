import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAuditAssignmentsByAudit } from '../../../api/auditAssignments';
import { getDepartmentById } from '../../../api/departments';
import { getAuditPlanById, getSensitiveDepartments } from '../../../api/audits';
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
  isSensitive?: boolean;
}

const AuditDepartments = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [departments, setDepartments] = useState<DepartmentCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditInfo, setAuditInfo] = useState<{ title: string; type: string } | null>(null);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  // Load audit info first
  useEffect(() => {
    const loadAuditInfo = async () => {
      if (!auditId) return;

      try {
        const auditData = await getAuditPlanById(auditId);
        const auditType = auditData.type || auditData.Type || auditData.auditType || 
                         auditData.audit?.type || auditData.audit?.Type || auditData.audit?.auditType || '';
        const auditTitle = auditData.title || auditData.name || 'Department Audit' ;
        setAuditInfo({ title: auditTitle, type: auditType });
      } catch (err) {
        console.warn('Failed to load audit info:', err);
        // Set fallback info
        setAuditInfo({ title: 'Department Audit', type: '' });
      }
    };

    loadAuditInfo();
  }, [auditId]);

  // Load departments after audit info is loaded
  useEffect(() => {
    const loadData = async () => {
      if (!auditId) {
        setError('Audit ID is required');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Load assignments for this audit
        console.log('🔍 Fetching assignments for audit:', auditId);
        const assignmentsResponse: any = await getAuditAssignmentsByAudit(auditId);
        console.log('📦 Raw assignments response:', assignmentsResponse);

        let assignments: any[] = [];
        if (Array.isArray(assignmentsResponse)) {
          assignments = assignmentsResponse;
        } else if (assignmentsResponse?.$values && Array.isArray(assignmentsResponse.$values)) {
          assignments = assignmentsResponse.$values;
        } else if (assignmentsResponse?.values && Array.isArray(assignmentsResponse.values)) {
          assignments = assignmentsResponse.values;
        } else if (assignmentsResponse?.data && Array.isArray(assignmentsResponse.data)) {
          assignments = assignmentsResponse.data;
        } else {
          assignments = unwrap(assignmentsResponse);
        }

        console.log('✅ Final assignments array:', assignments);
        console.log('✅ Assignments count:', assignments.length);

        if (!assignments || assignments.length === 0) {
          console.log('⚠️ No assignments found for this audit');
          setDepartments([]);
          setLoading(false);
          return;
        }

        // Filter active assignments
        const activeAssignments = assignments.filter((a: any) => {
          const status = (a.status || '').toLowerCase().trim();
          return status !== 'archived';
        });

        if (activeAssignments.length === 0) {
          console.log('⚠️ No active assignments found');
          setDepartments([]);
          setLoading(false);
          return;
        }

        // Get unique department IDs
        const uniqueDeptIds = Array.from(new Set(activeAssignments.map((a: any) => a.deptId)));
        console.log('🏢 Unique department IDs:', uniqueDeptIds);

        // Load sensitive departments for this audit to highlight sensitive areas
        let sensitiveDeptIds = new Set<number>();
        try {
          const sensitiveRaw: any = await getSensitiveDepartments(String(auditId));
          const sensitiveArr: any[] = Array.isArray(sensitiveRaw)
            ? sensitiveRaw
            : (sensitiveRaw?.$values as any[]) || [];

          sensitiveArr.forEach((item: any) => {
            const id = Number(
              item.deptId ?? item.DeptId ?? item.departmentId ?? item.DepartmentId ?? NaN
            );
            if (!Number.isNaN(id)) {
              sensitiveDeptIds.add(id);
            }
          });
        } catch (sensErr) {
          console.warn(
            '[AuditDepartments] Failed to load sensitive departments for highlighting:',
            sensErr
          );
        }

        // Load department info for each unique deptId
        const departmentPromises = uniqueDeptIds.map(async (deptId: number) => {
          try {
            console.log(`📥 Fetching department ${deptId}...`);
            const deptData = await getDepartmentById(deptId);
            console.log(`✅ Department ${deptId} data:`, deptData);

            const deptAssignments = activeAssignments.filter((a: any) => a.deptId === deptId);
            const firstAssignment = deptAssignments[0];

            const normalizedDeptId = deptData.deptId || deptId;

            const cardData: DepartmentCard = {
              deptId: normalizedDeptId,
              name: deptData.name || 'Unknown Department',
              code: deptData.code || '',
              description: deptData.description || '',
              assignmentId: firstAssignment.assignmentId,
              auditId: auditId,
              auditTitle: auditInfo?.title || firstAssignment.auditTitle || 'Untitled Audit',
              status: firstAssignment.status || 'Unknown',
              auditType: auditInfo?.type || '',
              isSensitive: sensitiveDeptIds.has(normalizedDeptId),
            };
            console.log(`✅ Created card for department ${deptId}:`, cardData);
            return cardData;
          } catch (err) {
            console.error(`❌ Error loading department ${deptId}:`, err);
            return null;
          }
        });

        const departmentResults = await Promise.all(departmentPromises);
        const validDepartments: DepartmentCard[] = departmentResults.filter(
          (dept): dept is DepartmentCard => dept !== null
        );
        console.log('🎯 Final departments to display:', validDepartments);

        setDepartments(validDepartments);
      } catch (err: any) {
        console.error('❌ Error loading data:', err);
        setError(err?.message || 'Failed to load departments');
      } finally {
        setLoading(false);
      }
    };

    // Only load departments if we have auditId
    if (auditId) {
      loadData();
    }
  }, [auditId, auditInfo]);

  const handleDepartmentClick = (dept: DepartmentCard) => {
    navigate(`/auditor/findings/department/${dept.deptId}`, {
      state: { auditId: dept.auditId, department: dept, auditType: auditInfo?.type }
    });
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate('/auditor/findings')}
              className="p-2 hover:bg-primary-400 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white">Task Management</h1>
              <p className="text-primary-100 text-sm sm:text-base mt-1">
                {auditInfo?.title || 'Select a department to manage audit findings'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-6 sm:pb-8 space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading departments...</p>
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
                <p className="text-red-800 font-semibold">Error loading departments</p>
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

        {/* Available Departments - Card List View */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
            {departments.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-gray-500 font-semibold text-lg">No departments available</p>
                <p className="text-sm text-gray-400 mt-2">Departments will appear here when assigned to this audit</p>
              </div>
            ) : (
              <>
                {/* Legend for sensitive departments */}
                {departments.some((d) => d.isSensitive) && (
                  <div className="px-4 sm:px-6 py-3 border-b border-amber-200 bg-amber-50 flex items-start gap-2">
                    <svg
                      className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="text-xs sm:text-sm text-amber-900">
                      <p className="font-semibold">Sensitive Areas</p>
                      <p>
                        Departments with the <span className="font-semibold">"Sensitive Area"</span>{' '}
                        label contain sensitive areas. QR access is required before working on
                        their checklist.
                      </p>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-200">
                  {departments.map((dept) => (
                    <div
                      key={dept.deptId}
                      onClick={() => handleDepartmentClick(dept)}
                      className="px-4 sm:px-6 py-4 hover:bg-primary-50 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700">
                            {dept.name}
                          </h3>
                          {dept.isSensitive && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wide">
                              Sensitive Area
                            </span>
                          )}
                        </div>
                        <svg
                          className="w-5 h-5 text-gray-400 group-hover:text-primary-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AuditDepartments;

