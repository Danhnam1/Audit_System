import type { AuditPlanAssignment } from '../../../../api/auditPlanAssignment';
import type { AdminUserDto } from '../../../../api/adminUsers';

interface AssignedAuditorsListProps {
  assignedAuditors: Array<AuditPlanAssignment & { auditor: AdminUserDto }>;
  onRemove: (assignmentId: string, auditorName: string) => void;
}

export const AssignedAuditorsList = ({
  assignedAuditors,
  onRemove,
}: AssignedAuditorsListProps) => {
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Name
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Email
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Assigned Date
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Remarks
            </th>
            <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {assignedAuditors.map((item) => (
            <tr key={item.assignmentId} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-900">
                {item.auditor.fullName || '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.auditor.email || '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.assignedDate ? formatDate(item.assignedDate) : '—'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {item.remarks || '—'}
              </td>
              <td className="px-4 py-3 text-center">
                <button
                  onClick={() =>
                    onRemove(
                      item.assignmentId || '',
                      item.auditor.fullName || 'Unknown'
                    )
                  }
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

