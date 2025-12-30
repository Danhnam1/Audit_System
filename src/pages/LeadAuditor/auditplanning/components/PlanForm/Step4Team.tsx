import React, { useEffect, useMemo, useState } from 'react';
import MultiSelect from '../../../../../components/MultiSelect';
import { useAuth } from '../../../../../contexts';
import { getAvailableAuditors } from '../../../../../api/auditTeam';
import { unwrap } from '../../../../../utils/normalize';

interface Step4TeamProps {
  level: string;
  selectedDeptIds: string[];
  selectedAuditorIds: string[];
  selectedLeadId?: string;
  auditorOptions: any[];
  ownerOptions: any[];
  departments: Array<{ deptId: number | string; name: string }>;
  onAuditorsChange: (value: string[]) => void;
  onLeadChange?: (value: string) => void;
  sensitiveFlag?: boolean;
  periodFrom?: string;
  periodTo?: string;
  editingAuditId?: string | null;
}

export const Step4Team: React.FC<Step4TeamProps> = ({
  level = 'academy',
  selectedDeptIds = [],
  selectedAuditorIds = [],
  selectedLeadId,
  auditorOptions = [],
  ownerOptions = [],
  departments = [],
  onAuditorsChange,
  onLeadChange,
  // @ts-expect-error - unused parameter
  sensitiveFlag = false,
  periodFrom,
  periodTo,
  editingAuditId,
}) => {
  const { user } = useAuth();
  const [availableAuditorIds, setAvailableAuditorIds] = useState<Set<string>>(new Set());
  const [loadingAvailableAuditors, setLoadingAvailableAuditors] = useState(false);
  
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

  // Load available auditors (filter out those already assigned to other audits in the same period)
  useEffect(() => {
    const loadAvailableAuditors = async () => {
      if (!periodFrom || !periodTo) {
        // If no period, show all auditors
        setAvailableAuditorIds(new Set());
        return;
      }

      setLoadingAvailableAuditors(true);
      try {
        const availableAuditors = await getAvailableAuditors({
          auditId: editingAuditId || undefined,
          periodFrom,
          periodTo,
          excludePreviousPeriod: true,
        });

        const availableArray = unwrap(availableAuditors);
        const availableIds = new Set(
          (Array.isArray(availableArray) ? availableArray : [])
            .map((a: any) => String(a.userId || a.id || a.$id))
            .filter(Boolean)
        );

        setAvailableAuditorIds(availableIds);
      } catch (error) {
        console.error('[Step4Team] Error loading available auditors:', error);
        // On error, show all auditors (don't block user)
        setAvailableAuditorIds(new Set());
      } finally {
        setLoadingAvailableAuditors(false);
      }
    };

    loadAvailableAuditors();
  }, [periodFrom, periodTo, editingAuditId]);

  // For Lead Auditor: ensure current user (Lead Auditor) is always in auditors and always disabled
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
        {/* Lead Auditor selection - only for Lead Auditor role */}
        {onLeadChange && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lead Auditor *
            </label>
            <select
              value={selectedLeadId || ''}
              onChange={(e) => onLeadChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Select Lead Auditor</option>
              {safeAuditorOptions
                .filter((_u: any) => {
                  // Filter to show only Lead Auditors (you can add role check here if needed)
                  return true; // For now, show all auditors
                })
                .map((u: any) => (
                  <option key={String(u.userId)} value={String(u.userId)}>
                    {u.fullName || 'Unknown'} ({u.email || 'N/A'})
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Auditors */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Auditors *
          </label>
          {(() => {
            try {
              // Filter auditors based on available auditors (if period is set)
              // If availableAuditorIds is empty (no period or error), show all auditors
              const shouldFilter = periodFrom && periodTo && availableAuditorIds.size > 0;
              const filteredAuditors = shouldFilter
                ? safeAuditorOptions.filter((u: any) => {
                    const userId = String(u?.userId || '');
                    // Always include current user (Lead Auditor) even if not available
                    if (currentUserId && userId === String(currentUserId)) return true;
                    // Include if available or if already selected (to avoid removing selected ones)
                    return availableAuditorIds.has(userId) || safeSelectedAuditorIds.includes(userId);
                  })
                : safeAuditorOptions;

              // Ensure current user is always at the top of the list and always disabled
              const currentUserOption = filteredAuditors.find((u: any) => String(u?.userId || '') === String(currentUserId || ''));
              const optionsRaw = [
                currentUserOption
                  ? {
                      value: String(currentUserOption.userId),
                      label: `${currentUserOption.fullName || 'Unknown'} (${currentUserOption.email || 'N/A'})`,
                      disabled: true,
                    }
                  : undefined,
                ...filteredAuditors
                  .filter((u: any) => String(u?.userId || '') !== String(currentUserId || ''))
                  .map((u: any) => {
                    const userId = String(u?.userId || '');
                    const isAvailable = !shouldFilter || availableAuditorIds.has(userId) || safeSelectedAuditorIds.includes(userId);
                    return {
                      value: userId,
                      label: `${u?.fullName || 'Unknown'} (${u?.email || 'N/A'})${!isAvailable ? ' - Already assigned to another audit' : ''}`,
                      disabled: !isAvailable,
                    };
                  }),
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
              

              return (
                <>
                  {loadingAvailableAuditors && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                      <p className="text-sm text-blue-700">
                        🔄 Loading available auditors...
                      </p>
                    </div>
                  )}
                  {shouldFilter && availableAuditorIds.size > 0 && !loadingAvailableAuditors && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-2">
                      <p className="text-sm text-yellow-700">
                        Only showing auditors available for the selected period. Auditors already assigned to other audits in this period are excluded.
                      </p>
                    </div>
                  )}
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
      </div>
    </div>
  );
};
