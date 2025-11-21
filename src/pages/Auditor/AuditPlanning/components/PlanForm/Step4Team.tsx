import React, { useEffect, useMemo } from 'react';
import MultiSelect from '../../../../../components/MultiSelect';
import { useAuth } from '../../../../../contexts';

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
  const { user } = useAuth();
  
  // Find current user's userId from auditorOptions by matching email
  const currentUserId = useMemo(() => {
    if (!user?.email || !auditorOptions || auditorOptions.length === 0) return null;
    const found = auditorOptions.find((u: any) => {
      const uEmail = String(u?.email || '').toLowerCase().trim();
      const userEmail = String(user.email).toLowerCase().trim();
      return uEmail === userEmail;
    });
    return found?.userId ? String(found.userId) : null;
  }, [user?.email, auditorOptions]);

  // Ensure current user is always in auditors and always disabled
  useEffect(() => {
    if (!currentUserId) return;
    // Always ensure current user is in the list
    const normalizedCurrentUserId = String(currentUserId).trim();
    const hasCurrentUser = selectedAuditorIds.some(id => String(id).trim() === normalizedCurrentUserId);
    if (!hasCurrentUser) {
      onAuditorsChange([currentUserId, ...selectedAuditorIds]);
    }
  }, [currentUserId, selectedAuditorIds, onAuditorsChange]);
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
            {auditorOptions
              .filter((u: any) => {
                // Exclude current user from Lead Auditor options
                if (!currentUserId) return true;
                return String(u.userId) !== String(currentUserId);
              })
              .map((u: any) => (
                <option key={u.userId} value={u.userId}>
                  {u.fullName} ({u.email})
                </option>
              ))}
          </select>
        </div>

        {/* Auditors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Auditors *
          </label>
          {(() => {
            // Đảm bảo user hiện tại luôn nằm đầu danh sách, luôn disabled
            const filteredOptions = auditorOptions.filter((u: any) => String(u.userId) !== selectedLeadId);
            const currentUserOption = auditorOptions.find((u: any) => String(u.userId) === currentUserId);
            const optionsRaw = [
              currentUserOption
                ? {
                    value: String(currentUserOption.userId),
                    label: `${currentUserOption.fullName} (${currentUserOption.email})`,
                    disabled: true,
                  }
                : undefined,
              ...filteredOptions
                .filter((u: any) => String(u.userId) !== currentUserId)
                .map((u: any) => ({
                  value: String(u.userId),
                  label: `${u.fullName} (${u.email})`,
                  disabled: false,
                })),
            ];
            const options = optionsRaw.filter((opt) => !!opt) as {
              value: string;
              label: string;
              disabled: boolean;
            }[];

            // Đảm bảo value luôn chứa user hiện tại (luôn ở đầu danh sách)
            const valueWithCurrent = currentUserId
              ? Array.from(new Set([currentUserId, ...selectedAuditorIds.filter(id => String(id) !== String(currentUserId))]))
              : selectedAuditorIds;

            // Tính số auditors thực tế
            const actualAuditorCount = valueWithCurrent.length;

            return (
              <>
                <MultiSelect
                  options={options}
                  value={valueWithCurrent}
                  onChange={(next) => {
                    if (!currentUserId) {
                      onAuditorsChange(next);
                      return;
                    }
                    // Filter out current user from next array (in case someone tries to remove it)
                    const withoutCurrent = next.filter(id => String(id) !== String(currentUserId));
                    // Always add current user back at the beginning
                    const withCurrent = [currentUserId, ...withoutCurrent];
                    onAuditorsChange(withCurrent);
                  }}
                  placeholder="Select auditor(s)"
                />
                {actualAuditorCount < 2 && (
                  <p className="mt-1 text-xs text-red-600">
                     At least 2 auditors are required.
                  </p>
                )}
              </>
            );
          })()}
          
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
        {/* <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={2}
            placeholder="Additional team notes..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div> */}
      </div>
    </div>
  );
};
