import React from 'react';

// Badge variant type matching the constants definition
type BadgeVariant = 'primary-light' | 'primary-medium' | 'primary-dark' | 'primary-solid' | 'gray-light' | 'gray-medium';

interface PlanTableProps {
  filteredPlans: any[];
  existingPlans: any[];
  loadingPlans: boolean;
  onViewDetails: (auditId: string) => void;
  onEditPlan: (auditId: string) => void;
  onDeletePlan: (auditId: string) => void;
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              No.
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Start Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              End Date
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Scope
            </th>
            {/* <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Schedule
            </th> */}
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredPlans.length === 0 && (
            <tr>
              <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                {loadingPlans
                  ? 'Loading plans...'
                  : existingPlans.length > 0
                  ? 'No plans match the current filters.'
                  : 'No audit plans found. Click "Create New Plan" to get started.'}
              </td>
            </tr>
          )}
          {filteredPlans.map((plan, index) => {
            // Check if plan is inactive
            const isInactive = plan.status?.toLowerCase() === 'inactive';

            return (
              <tr
                key={plan.auditId || index}
                className={`transition-colors ${
                  isInactive ? 'bg-gray-100 opacity-60' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  {/* Display sequential row number instead of GUID for readability */}
                  <span className="text-sm font-semibold text-primary-700">{startIndex + index + 1}</span>
                </td>
                <td className="px-6 py-4" style={{ maxWidth: '250px' }}>
                  <p className="text-sm font-semibold text-gray-900">{plan.title || 'Untitled'}</p>
                  {/* <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {plan.objective || 'No objective specified'}
                  </p> */}
                  <div className="flex gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs rounded ${getBadgeVariant('primary-light')}`}>
                      {plan.type || 'General'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-sm  text-gray-900">{formatDate(plan.startDate)}</p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <p className="text-sm  text-gray-900">{formatDate(plan.endDate)}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{plan.scope || 'N/A'}</p>
                  {/* <p className="text-xs text-gray-500">{plan.isPublished ? 'Published' : 'Draft'}</p> */}
                </td>
                {/* <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-xs text-gray-500">
                    <p>View details for schedule</p>
                  </div>
                </td> */}
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      plan.status || 'Draft'
                    )}`}
                  >
                    {plan.status || 'Draft'}
                  </span>
                  {/* <p className="text-xs text-gray-500 mt-2">Created:</p>
                  <p className="text-xs text-gray-700">{formatDate(plan.createdAt)}</p>
                  <p className="text-xs text-gray-500">By: {plan.createdBy || 'Unknown'}</p> */}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => onViewDetails(plan.auditId)}
                      className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => onEditPlan(plan.auditId)}
                      className="p-2 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {/* Always show Delete button, but validation happens in handler */}
                    <button
                      onClick={() => onDeletePlan(plan.auditId || plan.id)}
                      className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
