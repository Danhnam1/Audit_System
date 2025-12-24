import { useEffect, useState, useMemo } from "react";
import { MainLayout } from "../../layouts";
import { useAuth } from "../../contexts";
import { getAuditPlans } from "../../api/audits";
import { getAuditResultByAuditId } from "../../api/auditResult";
import { unwrap } from "../../utils/normalize";
import { PageHeader, Pagination } from "../../components";

interface AuditResultData {
  auditId: string;
  title: string;
  result?: string;
  percentage?: number;
  comment?: string | null;
  effectivenessScore?: number;
  complianceRate?: number;
  startDate?: string;
  endDate?: string;
}

export default function ResultHistoryPage() {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [auditResults, setAuditResults] = useState<Map<string, AuditResultData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const loadAuditsAndResults = async () => {
      setLoading(true);
      try {
        const plansRes = await getAuditPlans();
        const plans = unwrap(plansRes);
        
        const auditsList = (Array.isArray(plans) ? plans : [])
          .map((a: any) => ({
            auditId: a.auditId || a.id || "",
            title: a.title || a.auditTitle || "Untitled audit",
            startDate: a.startDate || a.auditStartDate || "",
            endDate: a.endDate || a.auditEndDate || "",
          }))
          .filter((x: any) => x.auditId);

        // Load results for all audits
        const resultsMap = new Map<string, AuditResultData>();
        for (const audit of auditsList) {
          try {
            const result = await getAuditResultByAuditId(audit.auditId);
            if (result) {
              resultsMap.set(audit.auditId, {
                auditId: audit.auditId,
                title: audit.title,
                result: result.result,
                percentage: result.percentage,
                comment: result.comment,
                effectivenessScore: (result as any).effectivenessScore,
                complianceRate: (result as any).complianceRate,
                startDate: audit.startDate,
                endDate: audit.endDate,
              });
            }
          } catch (error) {
            // Skip audits without results
            console.error(`Failed to load result for audit ${audit.auditId}:`, error);
          }
        }
        setAuditResults(resultsMap);
      } catch (error) {
        console.error('[Director] Failed to load audits and results:', error);
      } finally {
        setLoading(false);
      }
    };
    loadAuditsAndResults();
  }, []);

  const filteredResults = useMemo(() => {
    let results = Array.from(auditResults.values());

    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      results = results.filter(
        (ar) =>
          ar.title.toLowerCase().includes(term) ||
          ar.result?.toLowerCase().includes(term) ||
          ar.comment?.toLowerCase().includes(term)
      );
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      results = results.filter((ar) => {
        if (!ar.startDate) return false;
        const auditStart = new Date(ar.startDate);
        auditStart.setHours(0, 0, 0, 0);
        return auditStart >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      results = results.filter((ar) => {
        if (!ar.endDate) return false;
        const auditEnd = new Date(ar.endDate);
        auditEnd.setHours(23, 59, 59, 999);
        return auditEnd <= end;
      });
    }

    return results;
  }, [auditResults, searchTerm, startDate, endDate]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResults = filteredResults.slice(startIndex, endIndex);

  return (
    <MainLayout user={layoutUser}>
      <div className="px-4 sm:px-6 lg:px-8 pb-8 space-y-6">
        <PageHeader
          title="Result History"
          subtitle="View audit effectiveness results and comments history"
          rightContent={
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Start Date"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-slate-900"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="End Date"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-slate-900"
              />
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="px-3 py-2 text-xs text-gray-600 hover:text-gray-800 underline"
                >
                  Clear dates
                </button>
              )}
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title, result, or comment..."
                className="px-3 py-2 border border-gray-300 rounded-md text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-white text-slate-900 min-w-[300px]"
              />
            </div>
          }
        />

        {loading ? (
          <div className="bg-white border border-primary-200 rounded-lg p-8 flex items-center justify-center gap-3 text-sm text-primary-700">
            <div className="h-5 w-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading audit results...</span>
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-sm text-gray-500">
            {searchTerm
              ? "No results found matching your search."
              : "No audit results available yet."}
          </div>
        ) : (
          <div className="bg-white border border-primary-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-primary-300 bg-gradient-primary">
              <h2 className="text-m font-semibold text-white uppercase">
                Audit Results ({filteredResults.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Audit Title
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Result
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Effectiveness
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Comment
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date Range
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedResults.map((ar: AuditResultData) => (
                    <tr key={ar.auditId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {ar.title}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {ar.result ? (
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            ar.result.toLowerCase() === 'pass'
                              ? 'bg-green-100 text-green-800 border border-green-300'
                              : ar.result.toLowerCase() === 'fail'
                              ? 'bg-red-100 text-red-800 border border-red-300'
                              : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                          }`}>
                            {ar.result}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {(ar.percentage != null || ar.effectivenessScore != null) ? (
                          <span className="text-sm font-semibold text-gray-900">
                            {(ar.effectivenessScore ?? ar.percentage)?.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {ar.comment ? (
                          <div className="max-w-md">
                            <p className="text-xs text-gray-800 whitespace-pre-wrap line-clamp-3">
                              {ar.comment}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {ar.startDate || ar.endDate ? (
                          <div className="text-[13px] text-gray-600">
                            {ar.startDate ? new Date(ar.startDate).toLocaleDateString() : "—"} —{" "}
                            {ar.endDate ? new Date(ar.endDate).toLocaleDateString() : "—"}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {filteredResults.length > 0 && totalPages > 1 && (
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
}

