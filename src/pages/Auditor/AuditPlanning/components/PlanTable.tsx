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
              Period
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Domain
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Schedule
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {filteredPlans.length === 0 && (
            <tr>
              <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
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
                  <p className="text-xs text-gray-600">From:</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(plan.startDate)}</p>
                  <p className="text-xs text-gray-600 mt-1">To:</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(plan.endDate)}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{plan.scope || 'N/A'}</p>
                  {/* <p className="text-xs text-gray-500">{plan.isPublished ? 'Published' : 'Draft'}</p> */}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-xs text-gray-500">
                    <p>View details for schedule</p>
                  </div>
                </td>
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
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onViewDetails(plan.auditId)}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium text-left"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => onEditPlan(plan.auditId)}
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium text-left"
                    >
                      Edit
                    </button>
                    {/* Hide Delete button when status is Inactive */}
                    {!isInactive && (
                      <button
                        onClick={() => onDeletePlan(plan.auditId || plan.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium text-left"
                      >
                        Delete
                      </button>
                    )}
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
