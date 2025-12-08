import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuditFindings } from '../../../hooks/useAuditFindings';
import { getMyAssignments } from '../../../api/auditAssignments';
import { getAuditPlanById } from '../../../api/audits';
import { unwrap } from '../../../utils/normalize';

interface AuditCard {
  auditId: string;
  auditTitle: string;
  auditType: string;
  status: string;
  departmentCount: number;
  startDate?: string;
  endDate?: string;
}

const SQAStaffFindingManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [audits, setAudits] = useState<AuditCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const {
    fetchAuditPlans,
    auditPlans: _auditPlans,
  } = useAuditFindings();

  useEffect(() => {
    fetchAuditPlans();
  }, [fetchAuditPlans]);

  useEffect(() => {
    const loadAudits = async () => {
      setLoading(true);
      setError(null);
      
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
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          assignments = responseData.data;
          console.log('✅ Found data array');
        } else {
          assignments = unwrap(responseData);
          console.log('✅ Used unwrap fallback, got', assignments.length, 'items');
        }
        
        console.log('✅ Final assignments array:', assignments);
        console.log('✅ Assignments count:', assignments.length);
        
        if (!assignments || assignments.length === 0) {
          console.log('⚠️ No assignments found');
          setAudits([]);
          setLoading(false);
          return;
        }

        // Filter active assignments
        const activeAssignments = assignments.filter((a: any) => {
          const status = (a.status || '').toLowerCase().trim();
          return status !== 'archived';
        });
        console.log('✅ Active assignments (excluding archived):', activeAssignments.length);

        if (activeAssignments.length === 0) {
          console.log('⚠️ No active assignments found (all are archived)');
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

        console.log('📊 Grouped audits:', Array.from(auditMap.keys()));

        // Load audit info and create audit cards
        const auditPromises = Array.from(auditMap.entries()).map(async ([auditId, auditAssignments]) => {
          try {
            console.log(`📥 Fetching audit info for ${auditId}...`);
            const auditData = await getAuditPlanById(auditId);
            const auditType = auditData.type || auditData.Type || auditData.auditType || 
                             auditData.audit?.type || auditData.audit?.Type || auditData.audit?.auditType || '';
            const auditTitle = auditData.title || auditData.name || auditAssignments[0]?.auditTitle || 'Untitled Audit';
            // Try multiple possible field names for status
            const status = auditData.status || 
                          auditData.Status || 
                          auditData.auditStatus ||
                          auditData.auditStatus ||
                          auditData.audit?.status ||
                          auditData.audit?.Status ||
                          auditAssignments[0]?.status || 
                          'Unknown';
            
            console.log(`📋 Audit ${auditId} status check:`, {
              auditTitle,
              finalStatus: status,
              statusFromData: auditData.status,
              statusFromAssignment: auditAssignments[0]?.status,
              allStatusFields: {
                status: auditData.status,
                Status: auditData.Status,
                auditStatus: auditData.auditStatus
              }
            });
            
            // Get unique department count
            const uniqueDeptIds = new Set(auditAssignments.map((a: any) => a.deptId));
            
            const auditCard: AuditCard = {
              auditId: auditId,
              auditTitle: auditTitle,
              auditType: auditType,
              status: status,
              departmentCount: uniqueDeptIds.size,
              startDate: auditData.startDate,
              endDate: auditData.endDate,
            };
            console.log(`✅ Created card for audit ${auditId}:`, auditCard);
            return auditCard;
          } catch (err) {
            console.error(`❌ Error loading audit ${auditId}:`, err);
            // Fallback: use assignment data
            const firstAssignment = auditAssignments[0];
            const uniqueDeptIds = new Set(auditAssignments.map((a: any) => a.deptId));
            return {
              auditId: auditId,
              auditTitle: firstAssignment?.auditTitle || 'Untitled Audit',
              auditType: '',
              status: firstAssignment?.status || 'Unknown',
              departmentCount: uniqueDeptIds.size,
            };
          }
        });

        const auditResults = await Promise.all(auditPromises);
        const validAudits: AuditCard[] = auditResults.filter((audit): audit is AuditCard => audit !== null);
        
        // Filter out audits with status "Archived" (case-insensitive)
        const nonArchivedAudits = validAudits.filter((audit) => {
          const status = audit.status || '';
          const statusLower = String(status).toLowerCase().trim();
          
          // Check for various forms of "archived"
          const isArchived = statusLower === 'archived' || 
                           statusLower === 'archive' ||
                           statusLower.includes('archived');
          
          if (isArchived) {
            console.log(`🚫 Filtering out archived audit: ${audit.auditTitle} (status: "${status}")`);
          }
          
          return !isArchived;
        });
        
        console.log('🎯 Final audits to display (excluding archived):', {
          total: validAudits.length,
          nonArchived: nonArchivedAudits.length,
          removed: validAudits.length - nonArchivedAudits.length,
          audits: nonArchivedAudits.map(a => ({ title: a.auditTitle, status: a.status }))
        });
        
        // Debug: Log all statuses to see what we're getting
        console.log('📊 All audit statuses:', validAudits.map(a => ({
          title: a.auditTitle,
          status: a.status,
          statusType: typeof a.status
        })));
        
        setAudits(nonArchivedAudits);
      } catch (err: any) {
        console.error('❌ Error loading audits:', err);
        console.error('Error details:', {
          message: err?.message,
          response: err?.response,
          stack: err?.stack
        });
        setError(err?.message || 'Failed to load audits');
      } finally {
        setLoading(false);
      }
    };

    loadAudits();
  }, []);

  const handleAuditClick = (audit: AuditCard) => {
    navigate(`/auditor/findings/audit/${audit.auditId}`);
  };

  return (
    <MainLayout user={layoutUser}>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Task Management</h1>
          <p className="text-primary-100 text-sm sm:text-base mt-2">Select a department to manage audit findings</p>
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
        
        {/* Available Audits - Card List View */}
        {!loading && !error && (
          <div className="bg-white rounded-xl border border-primary-100 overflow-hidden">
            {audits.length === 0 ? (
              <div className="p-8 text-center">
                <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500 font-semibold text-lg">No audits available</p>
                <p className="text-sm text-gray-400 mt-2">Audits will appear here when you are assigned</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {audits.map((audit) => (
                  <div
                    key={audit.auditId}
                    onClick={() => handleAuditClick(audit)}
                    className="px-4 sm:px-6 py-4 hover:bg-primary-50 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700">
                        {audit.auditTitle}
                      </h3>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default SQAStaffFindingManagement;