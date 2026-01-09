interface OverdueActionsTableProps {
  overdueActions: any[];
  findingsByIdMap: Map<string, any>;
  getDeptName: (deptId: string | number | null | undefined) => string;
}

export const OverdueActionsTable = ({
  overdueActions,
  findingsByIdMap,
  getDeptName,
}: OverdueActionsTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-200 rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Title</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Department</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Due Date</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Progress</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Finding</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {overdueActions.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                No overdue actions found
              </td>
            </tr>
          ) : (
            overdueActions.map((a: any) => {
              const relatedFinding = findingsByIdMap.get(String(a.findingId || ''));
              return (
                <tr key={a.actionId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.title || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      {a.status || "Overdue"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{getDeptName(a.assignedDeptId)}</td>
                  <td className="px-4 py-3 text-sm text-red-700 font-semibold">
                    {a.dueDate ? new Date(a.dueDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {typeof a.progressPercent === 'number' ? `${a.progressPercent}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {relatedFinding?.title || "—"}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
