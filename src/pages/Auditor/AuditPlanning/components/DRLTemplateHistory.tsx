import React, { useState, useEffect } from 'react';
import { getAuditPlanAssignmentsByAuditor } from '../../../../api/auditPlanAssignment';
import { DRLTemplateViewer } from './PlanForm/DRLTemplateViewer';
import { toast } from 'react-toastify';

interface DRLTemplateHistoryProps {
  userId: string | null;
}

export const DRLTemplateHistory: React.FC<DRLTemplateHistoryProps> = ({ userId }) => {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
  const [selectedAssignment, setSelectedAssignment] = useState<string | null>(null);

  // Load assignments when userId changes
  useEffect(() => {
    const loadAssignments = async () => {
      if (!userId) {
        setAssignments([]);
        return;
      }

      setLoading(true);
      try {
        const allAssignments = await getAuditPlanAssignmentsByAuditor(userId);
        
        // Filter by date range if provided
        let filtered = allAssignments;
        if (filterStartDate || filterEndDate) {
          filtered = allAssignments.filter((assignment: any) => {
            const assignedDate = new Date(assignment.assignedDate || '');
            if (!assignedDate || isNaN(assignedDate.getTime())) return false;
            
            if (filterStartDate) {
              const startDate = new Date(filterStartDate);
              startDate.setHours(0, 0, 0, 0);
              if (assignedDate < startDate) return false;
            }
            
            if (filterEndDate) {
              const endDate = new Date(filterEndDate);
              endDate.setHours(23, 59, 59, 999);
              if (assignedDate > endDate) return false;
            }
            
            return true;
          });
        }
        
        // Sort by assignedDate descending (newest first)
        filtered.sort((a: any, b: any) => {
          const dateA = new Date(a.assignedDate || '').getTime();
          const dateB = new Date(b.assignedDate || '').getTime();
          return dateB - dateA;
        });
        
        setAssignments(filtered);
      } catch (error: any) {
        console.error('[DRLTemplateHistory] Failed to load assignments:', error);
        toast.error('Failed to load DRL template history');
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, [userId, filterStartDate, filterEndDate]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const clearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
  };

  return (
    <div className="space-y-4">
      {/* Filter Section */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Filter by Assignment Date</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-2 text-sm text-gray-600">Loading DRL template history...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && assignments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No DRL Templates Found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filterStartDate || filterEndDate
              ? 'No assignments found for the selected date range.'
              : 'No DRL templates have been assigned to you yet.'}
          </p>
        </div>
      )}

      {/* Assignments List */}
      {!loading && assignments.length > 0 && (
        <div className="space-y-4">
          {assignments.map((assignment: any) => {
            // Parse filePaths from API response (JSON string array)
            let files: Array<{ fileName: string; fileUrl: string; fileId?: string }> = [];
            
            // First, try to parse filePaths (from API response)
            if (assignment.filePaths) {
              try {
                const filePathsArray = JSON.parse(assignment.filePaths);
                if (Array.isArray(filePathsArray)) {
                  files = filePathsArray.map((filePath: string) => {
                    // Extract fileName from URL
                    let fileName = 'DRL Template';
                    try {
                      const url = new URL(filePath);
                      const pathParts = url.pathname.split('/');
                      const lastPart = pathParts[pathParts.length - 1];
                      // Decode URL-encoded filename
                      fileName = decodeURIComponent(lastPart.split('?')[0]);
                      // Remove any prefixes like assignment IDs
                      const fileNameParts = fileName.split('_');
                      if (fileNameParts.length > 1) {
                        // Skip first parts (assignment IDs) and take the actual filename
                        fileName = fileNameParts.slice(-1)[0];
                      }
                    } catch (e) {
                      console.warn('[DRLTemplateHistory] Failed to parse fileName from URL:', filePath);
                    }
                    
                    return {
                      fileName: fileName || 'DRL Template',
                      fileUrl: filePath,
                      fileId: undefined,
                    };
                  });
                }
              } catch (e) {
                console.warn('[DRLTemplateHistory] Failed to parse filePaths:', assignment.filePaths, e);
              }
            }
            
            // Fallback to files or attachments if filePaths is not available
            if (files.length === 0) {
              const fallbackFiles = assignment.files || assignment.attachments || [];
              files = fallbackFiles.map((f: any) => ({
                fileName: f.fileName || 'DRL Template',
                fileUrl: f.fileUrl,
                fileId: f.fileId || f.attachmentId,
              }));
            }
            
            const hasFiles = files.length > 0;
            const assignmentId = assignment.assignmentId || assignment.id || `assignment-${assignment.assignedDate}`;
            const isExpanded = selectedAssignment === assignmentId;

            return (
              <div
                key={assignmentId}
                className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Assignment Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setSelectedAssignment(isExpanded ? null : assignmentId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-semibold text-gray-900">
                          Assignment Date: {formatDate(assignment.assignedDate)}
                        </span>
                      </div>
                      {assignment.remarks && (
                        <p className="text-xs text-gray-600 mt-1 ml-7">
                          Remarks: {assignment.remarks}
                        </p>
                      )}
                      <div className="mt-2 ml-7 flex items-center gap-4">
                        <span className="text-xs text-gray-500">
                          Status: <span className={`font-medium ${assignment.status === 'Active' ? 'text-green-600' : 'text-gray-600'}`}>
                            {assignment.status || 'Active'}
                          </span>
                        </span>
                        {hasFiles && (
                          <span className="text-xs text-gray-500">
                            Files: <span className="font-medium text-primary-600">{files.length}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasFiles && (
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {files.length} file{files.length > 1 ? 's' : ''}
                        </span>
                      )}
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Expanded Content - DRL Files */}
                {isExpanded && hasFiles && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <DRLTemplateViewer
                      drlFiles={files}
                      assignmentId={assignmentId}
                    />
                  </div>
                )}

                {/* No Files Message */}
                {isExpanded && !hasFiles && (
                  <div className="border-t border-gray-200 p-4 bg-gray-50">
                    <p className="text-sm text-gray-500 text-center py-2">
                      No DRL template files attached to this assignment.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {!loading && assignments.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Total Assignments:</span> {assignments.length}
            {filterStartDate || filterEndDate ? ' (filtered)' : ''}
          </p>
        </div>
      )}
    </div>
  );
};

