import React, { useMemo } from 'react';
import { DataTable } from '../../../../components/DataTable';
import type { TableColumn } from '../../../../components/DataTable';

// Badge variant type matching the constants definition
type BadgeVariant = 'primary-light' | 'primary-medium' | 'primary-dark' | 'primary-solid' | 'gray-light' | 'gray-medium';

interface PlanTableProps {
  filteredPlans: any[];
  existingPlans: any[];
  loadingPlans: boolean;
  onViewDetails: (auditId: string) => void;
  onEditPlan: (auditId: string) => void;
  onDeletePlan: (auditId: string) => void;
  onUpload?: (auditId: string) => void;
  getStatusColor: (status: string) => string;
  getBadgeVariant: (variant: BadgeVariant) => string;
  // Optional start index to compute global row numbers (useful for pagination)
  startIndex?: number;
}

export const PlanTable: React.FC<PlanTableProps> = ({
  filteredPlans,
  existingPlans,
  loadingPlans,
  onViewDetails,
  onEditPlan,
  onDeletePlan,
  onUpload,
  getStatusColor,
  getBadgeVariant,
  startIndex = 0,
}) => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const columns: TableColumn<any>[] = useMemo(
    () => [
      {
        key: 'no',
        header: 'No.',
        cellClassName: 'whitespace-nowrap',
        render: (_, index) => (
          <span className="text-sm text-gray-700">{startIndex + index + 1}</span>
        ),
      },
      {
        key: 'title',
        header: 'Title',
        render: (plan) => (
          <div className="max-w-[250px]">
            <p className="text-ms font-bold text-black">{plan.title || 'Untitled'}</p>
          </div>
        ),
      },
      {
        key: 'type',
        header: 'Type',
        cellClassName: 'whitespace-nowrap',
        render: (plan) => (
          <span className="text-ms text-[#5b6166]">
            {plan.type || 'General'}
          </span>
        ),
      },
      {
        key: 'startDate',
        header: 'Start Date',
        cellClassName: 'whitespace-nowrap',
        render: (plan) => <p className="text-ms text-[#5b6166]">{formatDate(plan.startDate)}</p>,
      },
      {
        key: 'endDate',
        header: 'End Date',
        cellClassName: 'whitespace-nowrap',
        render: (plan) => <p className="text-ms text-[#5b6166]">{formatDate(plan.endDate)}</p>,
      },
      {
        key: 'scope',
        header: 'Scope',
        render: (plan) => <p className="text-ms text-[#5b6166]">{plan.scope || 'N/A'}</p>,
      },
      {
        key: 'status',
        header: 'Status',
        cellClassName: 'whitespace-nowrap',
        render: (plan) => (
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status || 'Draft')}`}
          >
            {plan.status || 'Draft'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        align: 'center',
        cellClassName: 'whitespace-nowrap text-center',
        render: (plan) => (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => onViewDetails(plan.auditId)}
              className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              title="View Findings"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            {onUpload && (
              <button
                onClick={() => onUpload(plan.auditId)}
                className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors"
                title="Upload Documents"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </button>
            )}
          </div>
        ),
      },
    ],
    [getBadgeVariant, getStatusColor, onDeletePlan, onEditPlan, onViewDetails, onUpload, startIndex],
  );

  const emptyStateMessage = loadingPlans
    ? 'Loading plans...'
    : existingPlans.length > 0
    ? 'No plans match the current filters.'
    : 'No audit plans found. Click "Create New Plan" to get started.';

  return (
    <DataTable
      columns={columns}
      data={filteredPlans}
      loading={loadingPlans}
      loadingMessage="Loading plans..."
      emptyState={emptyStateMessage}
      rowKey={(plan, index) => plan.auditId || plan.id || index}
      getRowClassName={(plan) =>
        plan.status?.toLowerCase() === 'inactive' ? 'bg-gray-100 opacity-60' : 'transition-colors hover:bg-gray-50'
      }
    />
  );
};

