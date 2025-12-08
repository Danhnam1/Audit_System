import { MainLayout } from '../../layouts';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyAssignedActions } from '../../api/actions';
import { getFindingById } from '../../api/findings';
import { getAuditPlanById } from '../../api/audits';

interface AuditCard {
  auditId: string;
  auditTitle: string;
  auditType: string;
  status: string;
  taskCount: number;
  startDate?: string;
  endDate?: string;
}

const getStatusBadgeColor = (status: string) => {
  const statusLower = status?.toLowerCase() || '';
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

const CAPAOwnerAuditList = () => {
  const navigate = useNavigate();
  const [audits, setAudits] = useState<AuditCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAudits = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log('🔍 Fetching my assigned actions...');
        const actions = await getMyAssignedActions();
        console.log('📦 Actions from API:', actions);
        
        if (!actions || actions.length === 0) {
          console.log('⚠️ No actions found');
          setAudits([]);
          setLoading(false);
          return;
        }

        // Get unique findingIds from actions
        const uniqueFindingIds = Array.from(new Set(actions.map((a: any) => a.findingId).filter(Boolean)));
        console.log('📋 Unique findingIds:', uniqueFindingIds);

        // Fetch findings to get auditIds
        const findingPromises = uniqueFindingIds.map(async (findingId: string) => {
          try {
            const finding = await getFindingById(findingId);
            return finding;
          } catch (err) {
            console.error(`❌ Error loading finding ${findingId}:`, err);
            return null;
          }
        });

        const findings = await Promise.all(findingPromises);
        const validFindings = findings.filter((f): f is any => f !== null);
        console.log('✅ Valid findings:', validFindings.length);

        // Group actions by auditId (from findings)
        const auditMap = new Map<string, any[]>();
        validFindings.forEach((finding: any) => {
          const auditId = finding.auditId || finding.AuditId || finding.auditPlanId;
          if (auditId) {
            // Find all actions for this finding
            const relatedActions = actions.filter((a: any) => a.findingId === finding.findingId);
            if (!auditMap.has(auditId)) {
              auditMap.set(auditId, []);
            }
            auditMap.get(auditId)!.push(...relatedActions);
          }
        });

        console.log('📊 Grouped audits:', Array.from(auditMap.keys()));

        // Load audit info and create audit cards
        const auditPromises = Array.from(auditMap.entries()).map(async ([auditId, auditActions]) => {
          try {
            console.log(`📥 Fetching audit info for ${auditId}...`);
            const auditData = await getAuditPlanById(auditId);
            console.log(`📋 Raw audit data for ${auditId}:`, auditData);
            
            // Try multiple possible field names for title (same as Auditor component)
            let auditTitle = auditData.title || 
                            auditData.Title || 
                            auditData.name || 
                            auditData.Name ||
                            auditData.auditTitle ||
                            auditData.audit?.title ||
                            auditData.audit?.Title ||
                            auditData.audit?.name ||
                            auditData.audit?.Name ||
                            auditData.audit?.auditTitle ||
                            '';
            
            // If still no title, try to get from finding
            if (!auditTitle) {
              const firstFinding = validFindings.find((f: any) => {
                const findingAuditId = f.auditId || f.AuditId || f.auditPlanId;
                return String(findingAuditId) === String(auditId);
              });
              // Finding might have audit title in nested structure
              auditTitle = firstFinding?.audit?.title || 
                          firstFinding?.audit?.Title ||
                          firstFinding?.audit?.name ||
                          firstFinding?.auditPlan?.title ||
                          '';
            }
            
            if (!auditTitle) {
              console.warn(`⚠️ No title found for audit ${auditId}. Available fields:`, Object.keys(auditData));
              console.warn(`⚠️ Audit data structure:`, JSON.stringify(auditData, null, 2));
              // Last resort: use partial auditId
              auditTitle = `Audit ${auditId.substring(0, 8)}...`;
            } else {
              console.log(`✅ Found title for audit ${auditId}: "${auditTitle}"`);
            }
            
            const auditType = auditData.type || 
                             auditData.Type || 
                             auditData.auditType || 
                             auditData.audit?.type || 
                             auditData.audit?.Type || 
                             auditData.audit?.auditType || '';
            
            const status = auditData.status || 
                          auditData.Status || 
                          auditData.auditStatus ||
                          auditData.audit?.status ||
                          auditData.audit?.Status ||
                          'Unknown';
            
            const auditCard: AuditCard = {
              auditId: auditId,
              auditTitle: auditTitle,
              auditType: auditType,
              status: status,
              taskCount: auditActions.length,
              startDate: auditData.startDate || auditData.audit?.startDate,
              endDate: auditData.endDate || auditData.audit?.endDate,
            };
            console.log(`✅ Created card for audit ${auditId}:`, auditCard);
            return auditCard;
          } catch (err) {
            console.error(`❌ Error loading audit ${auditId}:`, err);
            // Even if API fails, create a card with basic info from finding
            const firstFinding = validFindings.find((f: any) => {
              const findingAuditId = f.auditId || f.AuditId || f.auditPlanId;
              return String(findingAuditId) === String(auditId);
            });
            
            // Try to get title from finding's nested audit data
            const fallbackTitle = firstFinding?.audit?.title || 
                                 firstFinding?.audit?.Title ||
                                 firstFinding?.audit?.name ||
                                 firstFinding?.auditPlan?.title ||
                                 firstFinding?.auditPlan?.Title ||
                                 `Audit ${auditId.substring(0, 8)}...`;
            
            return {
              auditId: auditId,
              auditTitle: fallbackTitle,
              auditType: '',
              status: 'Unknown',
              taskCount: auditActions.length,
            };
          }
        });

        const auditResults = await Promise.all(auditPromises);
        const validAudits: AuditCard[] = auditResults.filter((audit): audit is AuditCard => audit !== null);
        
        // Filter out audits with status "Archived" (case-insensitive)
        const nonArchivedAudits = validAudits.filter((audit) => {
          const status = audit.status || '';
          const statusLower = String(status).toLowerCase().trim();
          
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
          audits: nonArchivedAudits
        });
        
        setAudits(nonArchivedAudits);
      } catch (err: any) {
        console.error('❌ Error loading audits:', err);
        setError(err?.message || 'Failed to load audits');
      } finally {
        setLoading(false);
      }
    };

    loadAudits();
  }, []);

  const handleAuditClick = (audit: AuditCard) => {
    navigate(`/capa-owner/tasks/audit/${audit.auditId}`, {
      state: { auditId: audit.auditId, auditTitle: audit.auditTitle }
    });
  };

  return (
    <MainLayout>
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg mb-6">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">Tasks</h1>
          <p className="text-primary-100 text-sm sm:text-base mt-2">Select an audit to view assigned tasks</p>
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
                <p className="text-sm text-gray-400 mt-2">Audits will appear here when you have assigned tasks</p>
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
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-gray-900 group-hover:text-primary-700 mb-2">
                          {audit.auditTitle}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getAuditTypeBadgeColor(audit.auditType)}`}>
                            {audit.auditType || 'N/A'}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(audit.status)}`}>
                            {audit.status || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {audit.taskCount} {audit.taskCount === 1 ? 'task' : 'tasks'}
                          </span>
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 flex-shrink-0 ml-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

export default CAPAOwnerAuditList;

