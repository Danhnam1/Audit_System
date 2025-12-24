import { MainLayout } from '../../layouts';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyAssignedActions } from '../../api/actions';
import { getFindingById } from '../../api/findings';
import { getAuditPlanById } from '../../api/audits';
import { Pagination } from '../../components/Pagination';

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
  
  // Search and filter states - default dateFrom to today
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState<string>('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const loadAudits = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const actions = await getMyAssignedActions();
        
        if (!actions || actions.length === 0) {
          setAudits([]);
          setLoading(false);
          return;
        }

        // Get unique findingIds from actions
        const uniqueFindingIds = Array.from(new Set(actions.map((a: any) => a.findingId).filter(Boolean)));

        // Fetch findings to get auditIds
        const findingPromises = uniqueFindingIds.map(async (findingId: string) => {
          try {
            const finding = await getFindingById(findingId);
            return finding;
          } catch (err) {
            return null;
          }
        });

        const findings = await Promise.all(findingPromises);
        const validFindings = findings.filter((f): f is any => f !== null);

        // Group actions by auditId (from findings)
        const auditMap = new Map<string, any[]>();
        validFindings.forEach((finding: any) => {
          // Handle nested audit structure (finding.audit.auditId)
          const auditId = finding.auditId || 
                         finding.AuditId || 
                         finding.auditPlanId ||
                         finding.audit?.auditId ||
                         finding.audit?.AuditId;
          
          
          if (auditId) {
            // Find all actions for this finding
            const relatedActions = actions.filter((a: any) => a.findingId === finding.findingId);
            if (!auditMap.has(auditId)) {
              auditMap.set(auditId, []);
            }
            auditMap.get(auditId)!.push(...relatedActions);
          } else {
          }
        });


        // Load audit info and create audit cards
        const auditPromises = Array.from(auditMap.entries()).map(async ([auditId, auditActions]) => {
          try {
            const auditData = await getAuditPlanById(auditId);
            
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
              // Last resort: use partial auditId
              auditTitle = `Audit ${auditId.substring(0, 8)}...`;
            } else {
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
            return auditCard;
          } catch (err) {
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
          }
          
          return !isArchived;
        });
        
      
        
        setAudits(nonArchivedAudits);
      } catch (err: any) {
        setError(err?.message || 'Failed to load audits');
      } finally {
        setLoading(false);
      }
    };

    loadAudits();
  }, []);

  // Apply search and date filters
  const filteredAudits = audits.filter(audit => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        audit.auditTitle?.toLowerCase().includes(searchLower) ||
        audit.auditType?.toLowerCase().includes(searchLower) ||
        audit.status?.toLowerCase().includes(searchLower) ||
        audit.auditId?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    // Date range filter (filter by startDate) - only apply if dates are provided
    if (dateFrom && audit.startDate) {
      const auditDate = new Date(audit.startDate);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      auditDate.setHours(0, 0, 0, 0);
      if (auditDate < fromDate) return false;
    }
    
    if (dateTo && audit.startDate) {
      const auditDate = new Date(audit.startDate);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (auditDate > toDate) return false;
    }
    
    return true;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredAudits.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAudits = filteredAudits.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFrom, dateTo]);

  const handleAuditClick = (audit: AuditCard) => {
    navigate(`/capa-owner/tasks/audit/${audit.auditId}`, {
      state: { auditId: audit.auditId, auditTitle: audit.auditTitle }
    });
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
      return 'N/A';
    }
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
        
        {/* Available Audits - Table View */}
        {!loading && !error && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {/* Search and Filter Bar */}
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search Input */}
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by title, type, status, or ID..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Date From */}
                  <div className="w-full sm:w-48">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="From Date"
                    />
                  </div>
                  
                  {/* Date To */}
                  <div className="w-full sm:w-48">
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="To Date"
                    />
                  </div>
                  
                  {/* Clear Filters */}
                  {(searchTerm || dateFrom || dateTo) && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                {/* Results Count */}
                <div className="text-sm text-gray-600">
                  Showing {filteredAudits.length} of {audits.length} audits
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              {filteredAudits.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-20 h-20 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-500 font-semibold text-lg">No audits found</p>
                  <p className="text-sm text-gray-400 mt-2">{audits.length === 0 ? 'Audits will appear here when you have assigned tasks' : 'Try adjusting your filters'}</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Audit Title
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Start Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        End Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Tasks
                      </th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedAudits.map((audit) => (
                      <tr key={audit.auditId} className="hover:bg-gray-50 transition-colors">
                        {/* Audit Title */}
                        <td className="px-6 py-4">
                          <div className="text-sm font-semibold text-gray-900">{audit.auditTitle}</div>
                          {/* <div className="text-xs text-gray-500 mt-1">ID: {audit.auditId.substring(0, 8)}...</div> */}
                        </td>
                        
                        {/* Type */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getAuditTypeBadgeColor(audit.auditType)}`}>
                            {audit.auditType || 'N/A'}
                          </span>
                        </td>
                        
                        {/* Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(audit.status)}`}>
                            {audit.status || 'Unknown'}
                          </span>
                        </td>
                        
                        {/* Start Date */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(audit.startDate)}</div>
                        </td>
                        
                        {/* End Date */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(audit.endDate)}</div>
                        </td>
                        
                        {/* Task Count */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {audit.taskCount}
                          </span>
                        </td>
                        
                        {/* Action */}
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleAuditClick(audit)}
                            className="inline-flex items-center px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs font-medium"
                          >
                            View Tasks
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination */}
            {filteredAudits.length > 0 && totalPages > 1 && (
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
      </div>
    </MainLayout>
  );
};

export default CAPAOwnerAuditList;

