import React from 'react';
import MultiSelect from '../../../../../components/MultiSelect';

interface Step4TeamProps {
  level: string;
  selectedDeptIds: string[];
  selectedLeadId: string;
  selectedAuditorIds: string[];
  auditorOptions: any[];
  ownerOptions: any[];
  departments: Array<{ deptId: number | string; name: string }>;
  onLeadChange: (value: string) => void;
  onAuditorsChange: (value: string[]) => void;
}

export const Step4Team: React.FC<Step4TeamProps> = ({
  level,
  selectedDeptIds,
  selectedLeadId,
  selectedAuditorIds,
  auditorOptions,
  ownerOptions,
  departments,
  onLeadChange,
  onAuditorsChange,
}) => {
  return (
    <div>
      <h3 className="text-md font-semibold text-gray-700 mb-4">Step 4/5: Team & Responsibilities</h3>
      <div className="space-y-4">
        {/* Lead Auditor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lead (choose one from Auditors)
          </label>
          <select
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            value={selectedLeadId}
            onChange={(e) => onLeadChange(e.target.value)}
          >
            <option value="">Select Lead Auditor</option>
            {auditorOptions.map((u: any) => (
              <option key={u.userId} value={u.userId}>
                {u.fullName} ({u.email})
              </option>
            ))}
          </select>
        </div>

        {/* Auditors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Auditors</label>
          <MultiSelect
            options={auditorOptions
              .filter((u: any) => String(u.userId) !== selectedLeadId)
              .map((u: any) => ({
                value: String(u.userId),
                label: `${u.fullName} (${u.email})`,
              }))}
            value={selectedAuditorIds}
            onChange={onAuditorsChange}
            placeholder="Select auditor(s)"
          />
          <p className="mt-1 text-xs text-gray-500">Bạn có thể chọn 1 hoặc nhiều auditor.</p>
        </div>

        {/* Auditee Owners */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Auditee Owners (Department Heads)
          </label>
          {level === 'academy' ? (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 text-sm">
              All Auditee Owners will be auto-assigned for Academy scope ({ownerOptions?.length || 0}{' '}
              owners).
            </div>
          ) : (
            <>
              {selectedDeptIds.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-sm text-gray-500">
                    Vui lòng chọn phòng ban ở Step 2 để xem Department Heads.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const filtered = ownerOptions.filter((owner: any) =>
                      selectedDeptIds.includes(String(owner.deptId ?? ''))
                    );

                    if (filtered.length === 0) {
                      return (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                          <p className="text-sm text-yellow-700">
                            ⚠️ No auditee owners found for selected departments.
                          </p>
                        </div>
                      );
                    }

                    return filtered.map((owner: any) => {
                      const deptInfo = departments.find(
                        (d: any) => String(d.deptId) === String(owner.deptId)
                      );

                      return (
                        <div
                          key={owner.userId || owner.$id}
                          className="flex items-center justify-between bg-white border border-primary-200 rounded-lg px-4 py-3 hover:bg-primary-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-semibold">
                              {(owner.fullName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {owner.fullName || 'Unknown User'}
                              </p>
                              <p className="text-xs text-gray-500">{owner.email || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-3 py-1 text-xs font-medium text-primary-700 bg-primary-100 rounded-full">
                              {deptInfo?.name || `Dept ${owner.deptId}`}
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={2}
            placeholder="Additional team notes..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
    </div>
  );
};
