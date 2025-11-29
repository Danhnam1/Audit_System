import React, { useState, useMemo } from 'react';
import { DataTable, type TableColumn } from '../../../../components/DataTable';

interface Department {
  deptId: number;
  name: string;
  code?: string;
  description?: string;
  createdAt?: string;
}

interface DepartmentTabProps {
  departments: Department[];
  loading: boolean;
  onViewAuditDetail: () => void;
}

const DepartmentTab: React.FC<DepartmentTabProps> = ({ departments, loading, onViewAuditDetail }) => {
  const departmentColumns: TableColumn<Department>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Department Name',
      render: (dept) => (
        <div className="max-w-[300px]">
          <p className="text-sm font-semibold text-gray-900">{dept.name || 'N/A'}</p>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      cellClassName: 'whitespace-nowrap',
      render: (dept) => (
        <p className="text-sm text-gray-900">{dept.code || 'N/A'}</p>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (dept) => (
        <div className="max-w-[400px]">
          <p className="text-sm text-gray-700 line-clamp-2">
            {dept.description || 'No description'}
          </p>
        </div>
      ),
    },
   
  ], [onViewAuditDetail]);

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading departments...</p>
          </div>
        </div>
      ) : departments.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-gray-600 text-lg font-medium">No departments found</p>
          <p className="text-gray-500 text-sm mt-2">No departments are associated with this audit.</p>
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Total departments: 
              <span className="font-semibold text-gray-900 ml-1">{departments.length}</span>
            </p>
          </div>
          <DataTable
            columns={departmentColumns}
            data={departments}
            loading={false}
            loadingMessage="Loading departments..."
            emptyState="No departments found."
            rowKey={(dept, index) => dept.deptId || index}
            getRowClassName={() => 'transition-colors hover:bg-gray-50'}
          />
        </div>
      )}
    </>
  );
};

export default DepartmentTab;

