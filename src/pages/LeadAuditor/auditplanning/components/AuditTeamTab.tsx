import React, { useMemo } from 'react';
import { DataTable, type TableColumn } from '../../../../components/DataTable';

interface Auditor {
  userId: string;
  fullName: string;
  email: string;
}

interface AuditTeamTabProps {
  auditors: Auditor[];
  loading: boolean;
}

const AuditTeamTab: React.FC<AuditTeamTabProps> = ({ auditors, loading }) => {
  const auditorColumns: TableColumn<Auditor>[] = useMemo(() => [
    {
      key: 'fullName',
      header: 'Full Name',
      render: (auditor) => (
        <div className="max-w-[300px]">
          <p className="text-sm font-semibold text-gray-900">{auditor.fullName || 'N/A'}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (auditor) => (
        <div className="max-w-[350px]">
          <p className="text-sm text-gray-700">{auditor.email || 'N/A'}</p>
        </div>
      ),
    },
  ], []);

  return (
    <>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <p className="mt-4 text-gray-600">Loading audit team...</p>
          </div>
        </div>
      ) : auditors.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-600 text-lg font-medium">No team members found</p>
          <p className="text-gray-500 text-sm mt-2">No auditors are assigned to this audit.</p>
        </div>
      ) : (
        <div>
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              Total team members: 
              <span className="font-semibold text-gray-900 ml-1">{auditors.length}</span>
            </p>
          </div>
          <DataTable
            columns={auditorColumns}
            data={auditors}
            loading={false}
            loadingMessage="Loading audit team..."
            emptyState="No team members found."
            rowKey={(auditor, index) => auditor.userId || index}
            getRowClassName={() => 'transition-colors hover:bg-gray-50'}
          />
        </div>
      )}
    </>
  );
};

export default AuditTeamTab;

