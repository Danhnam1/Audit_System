import type { AuditPlanAssignment } from '../../../../api/auditPlanAssignment';
import type { AdminUserDto } from '../../../../api/adminUsers';

interface AssignedAuditorsListProps {
  assignedAuditors: Array<AuditPlanAssignment & { auditor: AdminUserDto; auditInfo?: { startDate?: string; endDate?: string } | null }>;
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

  const formatShortDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
      <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
          <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  
              Name
                </div>
            </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  
              Email
                </div>
            </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  
              Assigned Date
                </div>
            </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  
              Remarks
                </div>
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                <div className="flex items-center gap-2">
                  
                  Audit Period
                </div>
            </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {assignedAuditors.map((item) => (
              <tr 
                key={item.assignmentId} 
                className="hover:bg-primary-50 transition-colors duration-150"
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-primary-700 font-semibold text-sm">
                        {(item.auditor.fullName || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                {item.auditor.fullName || '—'}
                    </div>
                  </div>
              </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    
                {item.auditor.email || '—'}
                  </div>
              </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    
                {item.assignedDate ? formatDate(item.assignedDate) : '—'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-600 max-w-xs truncate" title={item.remarks || ''}>
                    {item.remarks || (
                      <span className="text-gray-400 italic">No remarks</span>
                    )}
                  </div>
              </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {item.auditInfo?.startDate && item.auditInfo?.endDate ? (
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        
                        <span>{formatShortDate(item.auditInfo.startDate)} - {formatShortDate(item.auditInfo.endDate)}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Not created yet</span>
                  )}
              </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                <button
                  onClick={() =>
                    onRemove(
                      item.assignmentId || '',
                      item.auditor.fullName || 'Unknown'
                    )
                  }
                    className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
};

