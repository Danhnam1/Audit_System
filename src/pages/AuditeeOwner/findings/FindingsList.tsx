import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { getFindings, type Finding } from '../../../api/findings';
import { getSeverityColor } from '../../../constants/statusColors';
import { Pagination } from '../../../components';

const FindingsList = () => {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Get user's department ID from token
  const getUserDeptId = (): number | null => {
    const token = localStorage.getItem('auth-storage');
    if (!token) return null;
    
    try {
      const authData = JSON.parse(token);
      const jwtToken = authData?.state?.token;
      if (jwtToken) {
        const base64Url = jwtToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        const deptId = payload['DeptId'];
        return deptId ? parseInt(deptId) : null;
      }
    } catch (err) {
      console.error('Error parsing token:', err);
    }
    return null;
  };

  useEffect(() => {
    const fetchFindings = async () => {
      try {
        setLoading(true);
        const userDeptId = getUserDeptId();

        // Fetch all findings
        const allFindings = await getFindings();

        // Filter findings by user's department
        const deptFindings = userDeptId 
          ? allFindings.filter(f => f.deptId === userDeptId)
          : allFindings;
        setFindings(deptFindings);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching findings:', err);
        setError(err?.message || 'Failed to load findings');
      } finally {
        setLoading(false);
      }
    };

    fetchFindings();
  }, []);

  const calculateDaysRemaining = (deadline: string): number => {
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diff = deadlineDate.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  };

  // Apply filters
  const filteredFindings = findings.filter(finding => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        finding.title?.toLowerCase().includes(searchLower) ||
        finding.description?.toLowerCase().includes(searchLower) ||
        finding.findingId?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    // Status filter
    if (statusFilter && finding.status !== statusFilter) {
      return false;
    }
    
    // Severity filter
    if (severityFilter && finding.severity !== severityFilter) {
      return false;
    }
    
    // Date range filter (filter by deadline)
    if (dateFrom && finding.deadline) {
      const findingDate = new Date(finding.deadline);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      findingDate.setHours(0, 0, 0, 0);
      if (findingDate < fromDate) return false;
    }
    
    if (dateTo && finding.deadline) {
      const findingDate = new Date(finding.deadline);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (findingDate > toDate) return false;
    }
    
    return true;
  });

  // Calculate pagination
  const totalPages = Math.ceil(filteredFindings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedFindings = filteredFindings.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFrom, dateTo, statusFilter, severityFilter]);

  const handleAssign = (findingId: string) => {
    navigate(`/auditee-owner/assign-tasks/${findingId}/assign`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/auditee-owner/assign-tasks')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Department Findings List</h1>
          <p className="text-gray-600">View and assign findings for staff to handle.</p>
        </div>

        {/* Search and Filter Bar */}
        {!loading && !error && findings.length > 0 && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input */}
                <div className="flex-1">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by title, description, or ID..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
                
                {/* Status Filter */}
                <div className="w-full sm:w-40">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">All Status</option>
                    <option value="Open">Open</option>
                    <option value="Received">Received</option>
                    <option value="Closed">Closed</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>
                
                {/* Severity Filter */}
                <div className="w-full sm:w-40">
                  <select
                    value={severityFilter}
                    onChange={(e) => setSeverityFilter(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  >
                    <option value="">All Severity</option>
                    <option value="Major">Major</option>
                    <option value="Medium">Medium</option>
                    <option value="Minor">Minor</option>
                  </select>
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
                {(searchTerm || dateFrom || dateTo || statusFilter || severityFilter) && (
                  <button
                    onClick={() => {
                      setSearchTerm('');
                      setDateFrom(new Date().toISOString().split('T')[0]);
                      setDateTo('');
                      setStatusFilter('');
                      setSeverityFilter('');
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              {/* Results Count */}
              <div className="text-sm text-gray-600">
                Showing {paginatedFindings.length} of {filteredFindings.length} findings
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading findings...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">❌ {error}</p>
          </div>
        ) : filteredFindings.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">
              {findings.length === 0 
                ? 'There are no findings for your department yet.'
                : 'No findings match your filters.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                All Findings ({filteredFindings.length} of {findings.length})
              </h2>
              <span className="text-sm text-gray-600">
                Department ID: {getUserDeptId()}
              </span>
            </div>
            <div className="divide-y divide-gray-200">
              {paginatedFindings.map((finding) => {
                const daysRemaining = finding.deadline ? calculateDaysRemaining(finding.deadline) : null;
                return (
                  <div key={finding.findingId} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <span className="text-sm font-mono text-gray-500">
                            #{finding.findingId.slice(0, 8)}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(finding.severity)}`}>
                            {finding.severity}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            finding.status === 'Open' 
                              ? 'bg-blue-100 text-blue-700'
                              : finding.status === 'In Progress'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {finding.status}
                          </span>
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">{finding.title}</h3>
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{finding.description}</p>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {finding.deadline && (
                            <>
                              <span className="flex items-center gap-1">
                                📅 Deadline: {new Date(finding.deadline).toLocaleDateString('vi-VN')}
                              </span>
                              {daysRemaining !== null && (
                                <span className={`font-medium ${
                                  daysRemaining < 0 
                                    ? 'text-red-600' 
                                    : daysRemaining <= 3 
                                    ? 'text-orange-600' 
                                    : 'text-green-600'
                                }`}>
                                  {daysRemaining < 0 ? `Overdue by ${Math.abs(daysRemaining)} day(s)` : `${daysRemaining} day(s) remaining`}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAssign(finding.findingId)}
                        className="ml-4 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 font-medium transition-all shadow-md hover:shadow-lg shrink-0"
                      >
                        👤 Assign Staff
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Pagination */}
            {filteredFindings.length > 0 && totalPages > 1 && (
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

export default FindingsList;

