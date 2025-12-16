import React, { useEffect, useMemo } from 'react';
import MultiSelect from '../../../../../components/MultiSelect';
import { useAuth } from '../../../../../contexts';

interface Step4TeamProps {
  level: string;
  selectedDeptIds: string[];
  selectedAuditorIds: string[];
  auditorOptions: any[];
  ownerOptions: any[];
  departments: Array<{ deptId: number | string; name: string }>;
  onAuditorsChange: (value: string[]) => void;
  sensitiveFlag?: boolean;
}

export const Step4Team: React.FC<Step4TeamProps> = ({
  level = 'academy',
  selectedDeptIds = [],
  selectedAuditorIds = [],
  auditorOptions = [],
  ownerOptions = [],
  departments = [],
  onAuditorsChange,
  sensitiveFlag = false,
}) => {
  const { user } = useAuth();
  
  // Safety checks: ensure arrays are always arrays
  const safeAuditorOptions = Array.isArray(auditorOptions) ? auditorOptions : [];
  const safeOwnerOptions = Array.isArray(ownerOptions) ? ownerOptions : [];
  const safeDepartments = Array.isArray(departments) ? departments : [];
  const safeSelectedDeptIds = Array.isArray(selectedDeptIds) ? selectedDeptIds : [];
  const safeSelectedAuditorIds = Array.isArray(selectedAuditorIds) ? selectedAuditorIds : [];
  
  // Find current user's userId from auditorOptions by matching email
  const currentUserId = useMemo(() => {
    if (!user?.email || !safeAuditorOptions || safeAuditorOptions.length === 0) return null;
    try {
      const found = safeAuditorOptions.find((u: any) => {
        const uEmail = String(u?.email || '').toLowerCase().trim();
        const userEmail = String(user.email).toLowerCase().trim();
        return uEmail === userEmail;
      });
      return found?.userId ? String(found.userId) : null;
    } catch (error) {
      console.error('[Step4Team] Error finding current user:', error);
      return null;
    }
  }, [user?.email, safeAuditorOptions]);

  // Ensure current user is always in auditors and always disabled
  useEffect(() => {
    if (!currentUserId || !onAuditorsChange) return;
    try {
      // Always ensure current user is in the list
      const normalizedCurrentUserId = String(currentUserId).trim();
      const hasCurrentUser = safeSelectedAuditorIds.some(id => String(id).trim() === normalizedCurrentUserId);
      if (!hasCurrentUser) {
        onAuditorsChange([currentUserId, ...safeSelectedAuditorIds]);
      }
    } catch (error) {
      console.error('[Step4Team] Error in useEffect:', error);
    }
  }, [currentUserId, safeSelectedAuditorIds, onAuditorsChange]);
  return (
    <div>
      <h3 className="text-md font-semibold text-gray-700 mb-4">Step 4/5: Team & Responsibilities</h3>
      <div className="space-y-4">
        {/* Auditors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Auditors *
          </label>
          {(() => {
            try {
              // Ensure current user is always at the top of the list and always disabled
              const currentUserOption = safeAuditorOptions.find((u: any) => String(u?.userId || '') === String(currentUserId || ''));
              const optionsRaw = [
                currentUserOption
                  ? {
                      value: String(currentUserOption.userId),
                      label: `${currentUserOption.fullName || 'Unknown'} (${currentUserOption.email || 'N/A'})`,
                      disabled: true,
                    }
                  : undefined,
                ...safeAuditorOptions
                  .filter((u: any) => String(u?.userId || '') !== String(currentUserId || ''))
                  .map((u: any) => ({
                    value: String(u?.userId || ''),
                    label: `${u?.fullName || 'Unknown'} (${u?.email || 'N/A'})`,
                    disabled: false,
                  })),
              ];
              const options = optionsRaw.filter((opt) => !!opt) as {
                value: string;
                label: string;
                disabled: boolean;
              }[];

              // Ensure the value always contains the current user (always at the top of the list)
              const valueWithCurrent = currentUserId
                ? Array.from(new Set([currentUserId, ...safeSelectedAuditorIds.filter(id => String(id) !== String(currentUserId))]))
                : safeSelectedAuditorIds;

              // Calculate the actual number of auditors
              const actualAuditorCount = valueWithCurrent.length;
              
              // Debug: Log options and values
              console.log('[Step4Team] Auditor options:', options);
              console.log('[Step4Team] Selected auditor IDs:', valueWithCurrent);
              console.log('[Step4Team] Safe auditor options:', safeAuditorOptions);

              return (
                <>
                  {options.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-700">
                        ⚠️ No auditor options available. Please ensure auditors are loaded.
                      </p>
                      <p className="text-xs text-yellow-600 mt-1">
                        Selected IDs: {valueWithCurrent.join(', ')}
                      </p>
                    </div>
                  ) : (
                    <MultiSelect
                      options={options}
                      value={valueWithCurrent}
                      onChange={(next) => {
                      if (!onAuditorsChange) return;
                      if (!currentUserId) {
                        onAuditorsChange(next);
                        return;
                      }
                      try {
                        // Filter out current user from next array (in case someone tries to remove it)
                        const withoutCurrent = next.filter(id => String(id) !== String(currentUserId));
                        // Always add current user back at the beginning
                        const withCurrent = [currentUserId, ...withoutCurrent];
                        onAuditorsChange(withCurrent);
                      } catch (error) {
                        console.error('[Step4Team] Error in onChange:', error);
                      }
                    }}
                    placeholder="Select auditor(s)"
                  />
                  )}
                  {actualAuditorCount < 2 && (
                    <p className="mt-1 text-xs text-red-600">
                       At least 2 auditors are required.
                    </p>
                  )}
                </>
              );
            } catch (error) {
              console.error('[Step4Team] Error rendering auditors section:', error);
              return (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">Error loading auditors. Please refresh the page.</p>
                </div>
              );
            }
          })()}
          
        </div>

        {/* Permission preview */}
        <div>
          {sensitiveFlag ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              Sensitive flag is ON. After Director approval and Kickoff Minutes upload, permissions/QR must be issued for assigned auditors.
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              No sensitive flag. Auditors are assigned normally.
            </div>
          )}
        </div>

        {/* Auditee Owners */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Auditee Owners (Department Heads)
          </label>
          {level === 'academy' ? (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-3 py-2 text-sm">
              All Auditee Owners will be auto-assigned for Academy scope ({safeOwnerOptions?.length || 0}{' '}
              owners).
            </div>
          ) : (
            <>
              {safeSelectedDeptIds.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <p className="text-sm text-gray-500">
                    Please select departments in Step 2 to view Department Heads.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    try {
                      const filtered = safeOwnerOptions.filter((owner: any) =>
                        safeSelectedDeptIds.includes(String(owner?.deptId ?? ''))
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
                        const deptInfo = safeDepartments.find(
                          (d: any) => String(d?.deptId || '') === String(owner?.deptId || '')
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
                    } catch (error) {
                      console.error('[Step4Team] Error rendering owners:', error);
                      return (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-700">Error loading owners. Please refresh the page.</p>
                        </div>
                      );
                    }
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
