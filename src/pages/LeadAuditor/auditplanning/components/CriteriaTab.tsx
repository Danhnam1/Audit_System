import React, { useMemo } from 'react';
import { DataTable, type TableColumn } from '../../../../components/DataTable';
import { getStatusColor } from '../../../../constants';

interface Criteria {
  criteriaId: string;
  name?: string;
  description?: string;
  referenceCode?: string;
  status?: string;
}

interface CriteriaTabProps {
  criteria: Criteria[];
  loading: boolean;
  departments?: any[];
}

const CriteriaTab: React.FC<CriteriaTabProps> = ({ criteria, loading, departments = [] }) => {
  const normalizeStatus = (status?: string): string => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'active') {
      return 'Active';
    }
    if (statusLower === 'inactive') {
      return 'Inactive';
    }
    return status || '';
  };

  const criteriaColumns: TableColumn<Criteria>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Name',
      render: (criterion) => (
        <div className="max-w-[300px]">
          <p className="text-sm font-semibold text-gray-900">{criterion.name || 'N/A'}</p>
        </div>
      ),
    },
    {
      key: 'referenceCode',
      header: 'Reference Code',
      cellClassName: 'whitespace-nowrap',
      render: (criterion) => (
        <p className="text-sm text-gray-700">{criterion.referenceCode || 'N/A'}</p>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (criterion) => (
        <div className="max-w-[400px]">
          <p className="text-sm text-gray-700 line-clamp-2">
            {criterion.description || 'No description'}
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cellClassName: 'whitespace-nowrap',
      render: (criterion) => (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(normalizeStatus(criterion.status))}`}>
          {criterion.status || 'N/A'}
        </span>
      ),
    },
  ], []);

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading criteria...</p>
          </div>
        </div>
      ) : criteria.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-600 text-lg font-medium">No criteria found</p>
          <p className="text-gray-500 text-sm mt-2">No criteria are assigned to this audit.</p>
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Total criteria: 
              <span className="font-semibold text-gray-900 ml-1">{criteria.length}</span>
            </p>
          </div>
          <DataTable
            columns={criteriaColumns}
            data={criteria}
            loading={false}
            loadingMessage="Loading criteria..."
            emptyState="No criteria found."
            rowKey={(criterion, index) => criterion.criteriaId || index}
            getRowClassName={() => 'transition-colors hover:bg-gray-50'}
          />

          {/* Departments & Standards (shared view) */}
          {departments.length > 0 && criteria.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm mt-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-primary-700">Departments & Standards</h3>
              </div>
              <div className="p-6 space-y-4">
                {departments.map((dept: any, idx: number) => {
                  const deptName = dept.deptName || dept.name || `Department ${idx + 1}`;
                  return (
                    <div
                      key={`${dept.deptId || dept.id || idx}`}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-base font-bold text-gray-900">{deptName}</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {criteria.map((crit: any, cIdx: number) => {
                          const displayName =
                            crit.name ||
                            crit.criterionName ||
                            crit.referenceCode ||
                            `Criterion ${cIdx + 1}`;
                          return (
                            <div
                              key={`${dept.deptId || dept.id || idx}-crit-${cIdx}`}
                              className="flex items-center gap-2 bg-white rounded-md px-3 py-2 border border-gray-200"
                            >
                              <div className="bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold">
                                ✓
                              </div>
                              <span className="text-sm text-gray-800">{displayName}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default CriteriaTab;

