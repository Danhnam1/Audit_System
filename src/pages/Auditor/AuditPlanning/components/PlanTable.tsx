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
  onEditPlan?: (auditId: string) => void;
  onDeletePlan?: (auditId: string) => void;
  getStatusColor: (status: string) => string;
  getBadgeVariant: (variant: BadgeVariant) => string;
  // Optional start index to compute global row numbers (useful for pagination)
  startIndex?: number;
  // User info for checking if user is creator
  currentUserId?: string | null;
  currentUserEmail?: string | null;
}

export const PlanTable: React.FC<PlanTableProps> = ({
  filteredPlans,
  existingPlans,
  loadingPlans,
  onViewDetails,
  onEditPlan,
  onDeletePlan,
  getStatusColor,
  getBadgeVariant,
  startIndex = 0,
  currentUserId,
  currentUserEmail,
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
        render: (plan) => {
          // Normalize status for comparison (remove spaces, convert to lowercase)
          const normalizedStatus = String(plan.status || "draft")
            .toLowerCase()
            .replace(/\s+/g, "");
          const isDraft = normalizedStatus === "draft";
          
          // Check if current user is the plan creator
          // Use same logic as in index.tsx for consistency
          let isCreator = false;
          if (plan && (currentUserId || currentUserEmail)) {
            // Try multiple possible field names for createdBy (matching index.tsx logic)
            const planCreatedBy =
              plan.createdBy ||
              plan.createdByUserId ||
              plan.auditorId ||
              plan.userId ||
              plan.createdByUser?.userId ||
              (plan as any).audit?.createdBy ||
              (plan as any).audit?.createdByUserId ||
              (plan as any).audit?.auditorId ||
              (plan as any).audit?.userId ||
              null;
            
            const planCreatedByEmail = plan.createdByUser?.email;
            
            if (planCreatedBy || planCreatedByEmail) {
              // Priority 1: Match by userId
              if (currentUserId && planCreatedBy) {
                const normalizedCurrentUserId = String(currentUserId).toLowerCase().trim();
                const normalizedCreatedBy = String(planCreatedBy).toLowerCase().trim();
                if (normalizedCurrentUserId === normalizedCreatedBy) {
                  isCreator = true;
                }
              }
              
              // Priority 2: Match by email (if createdBy is email string)
              if (!isCreator && currentUserEmail && planCreatedBy) {
                const normalizedCurrentEmail = String(currentUserEmail).toLowerCase().trim();
                const normalizedCreatedBy = String(planCreatedBy).toLowerCase().trim();
                if (normalizedCurrentEmail && normalizedCreatedBy && normalizedCurrentEmail === normalizedCreatedBy) {
                  isCreator = true;
                }
              }
              
              // Priority 3: Match by email from createdByUser object
              if (!isCreator && currentUserEmail && planCreatedByEmail) {
                const normalizedCurrentEmail = String(currentUserEmail).toLowerCase().trim();
                const normalizedCreatedByEmail = String(planCreatedByEmail).toLowerCase().trim();
                if (normalizedCurrentEmail && normalizedCreatedByEmail && normalizedCurrentEmail === normalizedCreatedByEmail) {
                  isCreator = true;
                }
              }
            }
          }
          
          // For now, show edit/delete for all draft plans
          // TODO: Re-enable creator check once we verify the data structure
          const canEditDelete = isDraft; // && isCreator;
          
          
          return (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => onViewDetails(plan.auditId)}
                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                title="View Details"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              {canEditDelete && onEditPlan && (
                <button
                  onClick={() => onEditPlan(plan.auditId)}
                  className="p-1.5 text-orange-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
              )}
              {canEditDelete && onDeletePlan && (
                <button
                  onClick={() => onDeletePlan(plan.auditId || plan.id)}
                  className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [getBadgeVariant, getStatusColor, onViewDetails, onEditPlan, onDeletePlan, currentUserId, currentUserEmail, startIndex],
  );

  const emptyStateMessage = loadingPlans
    ? 'Loading plans...'
    : existingPlans.length > 0
    ? 'No plans match the current filters.'
    : 'No audit plans found. ';

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
