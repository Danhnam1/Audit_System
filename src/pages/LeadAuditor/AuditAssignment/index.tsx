import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getMyLeadAuditorAudits } from '../../../api/auditTeam';
import { getAuditScopeDepartmentsByAuditId } from '../../../api/audits';
import { unwrap } from '../../../utils/normalize';

interface Department {
  deptId: number;
  name: string;
}

export default function AuditAssignment() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDepartments = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get lead auditor audits
        const leadAuditorData = await getMyLeadAuditorAudits();
        
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
        
        // Flatten and deduplicate by deptId
        const allDepartments = departmentsArrays.flat();
        const uniqueDepartments = Array.from(
          new Map(allDepartments.map((dept) => [dept.deptId, dept])).values()
        );

        setDepartments(uniqueDepartments);
      } catch (err: any) {
        console.error('[AuditAssignment] Load failed:', err);
        setError(err?.message || 'Failed to load departments');
      } finally {
        setLoading(false);
      }
    };

    loadDepartments();
  }, []);

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
                      <div>
                        <h3 className="text-base font-medium text-gray-900">{dept.name}</h3>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

