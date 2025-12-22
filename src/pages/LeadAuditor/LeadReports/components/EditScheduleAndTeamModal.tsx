import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-toastify';
import { getAuditSchedules } from '../../../../api/auditSchedule';
import { getAuditorsByAuditId, getAvailableTeamMembers } from '../../../../api/auditTeam';
import { getAdminUsers } from '../../../../api/adminUsers';
import { unwrap } from '../../../../utils/normalize';
import MultiSelect from '../../../../components/MultiSelect';

interface ScheduleItem {
  scheduleId?: string;
  milestoneName: string;
  dueDate: string;
  status?: string;
  notes?: string;
}

interface TeamMember {
  auditTeamId?: string;
  userId: string;
  fullName: string;
  roleInTeam?: string;
  isLead?: boolean;
}

interface EditScheduleAndTeamModalProps {
  show: boolean;
  auditId: string;
  onClose: () => void;
  onSave: (scheduleChanges: ScheduleItem[], teamChanges: TeamMember[]) => void;
  periodFrom?: string; // Period From date for validation
  periodTo?: string; // Period To date for validation
}

const EditScheduleAndTeamModal: React.FC<EditScheduleAndTeamModalProps> = ({
  show,
  auditId,
  onClose,
  onSave,
  periodFrom,
  periodTo,
}) => {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [selectedAuditorIds, setSelectedAuditorIds] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // editMode controls which sections are active: schedule, team, both, or none
  const [editMode, setEditMode] = useState<'schedule' | 'team' | 'both' | 'none'>('both');
  const [scheduleErrors, setScheduleErrors] = useState<Record<number, string>>({});
  const [periodFromLocal, setPeriodFromLocal] = useState<string | undefined>(periodFrom);
  const [periodToLocal, setPeriodToLocal] = useState<string | undefined>(periodTo);
  const [availableAuditorIds, setAvailableAuditorIds] = useState<Set<string>>(new Set());
  const [initialAuditorIds, setInitialAuditorIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (show && auditId) {
      loadData();
      setEditMode('both'); // Reset to both when modal opens
      setScheduleErrors({}); // Clear errors when modal opens
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, auditId]);

  // Log period dates when they change
  useEffect(() => {
    if (show) {
      console.log('📅 EditScheduleAndTeamModal: Period dates', {
        periodFrom,
        periodTo,
        hasPeriodFrom: !!periodFrom,
        hasPeriodTo: !!periodTo
      });
      setPeriodFromLocal(periodFrom);
      setPeriodToLocal(periodTo);
    }
  }, [show, periodFrom, periodTo]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [schedulesRes, teamRes, usersRes] = await Promise.all([
        getAuditSchedules(auditId),
        getAuditorsByAuditId(auditId),
        getAdminUsers(),
      ]);

      const schedulesData = unwrap(schedulesRes);
      const schedulesList = Array.isArray(schedulesData) ? schedulesData : [];
      setSchedules(
        schedulesList.map((s: any, idx: number) => {
          const scheduleId = s.scheduleId || s.id || s.$id;
          return {
            scheduleId: scheduleId ? String(scheduleId) : undefined, // Ensure it's a string or undefined
            milestoneName: s.milestoneName || s.milestone || `Schedule ${idx + 1}`,
              dueDate: s.dueDate ? new Date(s.dueDate).toISOString().split('T')[0] : '',
              status: s.status || 'Active',
            notes: s.notes || '', // Backend requires Notes field
          };
        })
      );

      const teamData = unwrap(teamRes);
      const users = Array.isArray(usersRes) ? usersRes : [];
      setAllUsers(users);

      const teamDataArray = Array.isArray(teamData) ? teamData : [];
      // Extract auditor IDs from team members (filter out AuditeeOwner)
      const auditorIds = teamDataArray
        .filter((m: any) => {
          const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
          return role !== 'auditeeowner';
        })
        .map((m: any) => String(m.userId || m.id || m.$id || ''))
        .filter((id: string) => id);

      setSelectedAuditorIds(auditorIds);
      setInitialAuditorIds(new Set(auditorIds));

      // Load available team members for this audit & period (to prevent conflicts)
      try {
        const available = await getAvailableTeamMembers({
          auditId,
          excludePreviousPeriod: true,
          startDate: periodFrom || undefined,
          endDate: periodTo || undefined,
        });
        const availableIds = new Set<string>();
        (Array.isArray(available) ? available : []).forEach((m: any) => {
          const uid = String(m.userId || m.id || m.$id || '').trim();
          if (uid) availableIds.add(uid);
        });
        setAvailableAuditorIds(availableIds);
      } catch (err) {
        console.error('Failed to load available team members', err);
        setAvailableAuditorIds(new Set());
      }
    } catch (err) {
      console.error('Failed to load data', err);
      toast.error('Failed to load schedule and team data');
    } finally {
      setLoading(false);
    }
  };

  // Note: Add/Remove schedule functionality removed - schedules are managed by backend

  // Build validation errors similar to Auditor create/edit rules
  const computedScheduleErrors = useMemo(() => {
    const errs: Record<number, string> = {};

    // 1) Basic: required + within period
    schedules.forEach((s, index) => {
      if (!s.dueDate) {
        errs[index] = 'Due date is required';
        return;
      }

      if (periodFromLocal && periodToLocal) {
        const scheduleDate = new Date(s.dueDate);
        const periodFromDate = new Date(periodFromLocal);
        const periodToDate = new Date(periodToLocal);

        scheduleDate.setHours(0, 0, 0, 0);
        periodFromDate.setHours(0, 0, 0, 0);
        periodToDate.setHours(0, 0, 0, 0);

        if (scheduleDate < periodFromDate) {
          errs[index] = `Date must be on or after Period From (${new Date(periodFromLocal).toLocaleDateString()}).`;
        } else if (scheduleDate > periodToDate) {
          errs[index] = `Date must be on or before Period To (${new Date(periodToLocal).toLocaleDateString()}).`;
        }
      }
    });

    // 2) Duplicate dates check (any milestones sharing same date)
    const seen = new Map<string, number[]>();
    schedules.forEach((s, idx) => {
      if (!s.dueDate) return;
      const key = s.dueDate;
      const list = seen.get(key) ?? [];
      list.push(idx);
      seen.set(key, list);
    });
    seen.forEach((idxs) => {
      if (idxs.length > 1) {
        idxs.forEach((i) => {
          if (!errs[i]) {
            errs[i] = 'Dates must be unique (no duplicates).';
          }
        });
      }
    });

    // Helper to get schedule index by milestone label (case-insensitive contains)
    const findIndexByMilestone = (label: string) => {
      const normLabel = label.toLowerCase().replace(/\s+/g, '');
      return schedules.findIndex((s) => {
        const name = String(s.milestoneName || '').toLowerCase().replace(/\s+/g, '');
        return name === normLabel || name.includes(normLabel) || normLabel.includes(name);
      });
    };

    const kickoffIdx = findIndexByMilestone('Kickoff Meeting');
    const fieldworkIdx = findIndexByMilestone('Fieldwork Start');
    const evidenceIdx = findIndexByMilestone('Evidence Due');
    const capaIdx = findIndexByMilestone('CAPA Due');
    const draftIdx = findIndexByMilestone('Draft Report Due');

    const toDate = (d?: string) => (d ? new Date(d) : null);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;

    // 3) Strict order: KICKOFF < FIELDWORK < EVIDENCE < CAPA < DRAFT
    const orderedIdx = [kickoffIdx, fieldworkIdx, evidenceIdx, capaIdx, draftIdx].filter(
      (i) => i != null && i >= 0 && schedules[i].dueDate
    ) as number[];

    for (let i = 1; i < orderedIdx.length; i++) {
      const prevIdx = orderedIdx[i - 1];
      const currIdx = orderedIdx[i];
      const prev = toDate(schedules[prevIdx].dueDate);
      const curr = toDate(schedules[currIdx].dueDate);
      if (prev && curr && curr.getTime() <= prev.getTime()) {
        if (!errs[currIdx]) {
          errs[currIdx] = `${schedules[currIdx].milestoneName} must be after ${schedules[prevIdx].milestoneName}.`;
        }
      }
    }

    // 4) Minimum gaps: giống Auditor
    const addGapError = (
      laterIdx: number | null,
      laterLabelFallback: string,
      earlierIdx: number | null,
      minDays: number
    ) => {
      if (laterIdx == null || earlierIdx == null) return;
      if (laterIdx < 0 || earlierIdx < 0) return;
      const laterDate = toDate(schedules[laterIdx].dueDate);
      const earlierDate = toDate(schedules[earlierIdx].dueDate);
      if (!laterDate || !earlierDate) return;

      const diffDays = Math.floor((laterDate.getTime() - earlierDate.getTime()) / MS_PER_DAY);
      if (diffDays < minDays && !errs[laterIdx]) {
        const laterLabel = schedules[laterIdx].milestoneName || laterLabelFallback;
        const earlierLabel = schedules[earlierIdx].milestoneName || '';
        errs[laterIdx] = `${laterLabel} must be at least ${minDays} day(s) after ${earlierLabel}.`;
      }
    };

    // Fieldwork ≥ Kickoff + 1 day
    addGapError(fieldworkIdx, 'Fieldwork Start', kickoffIdx, 1);
    // Evidence ≥ Fieldwork + 5 days
    addGapError(evidenceIdx, 'Evidence Due', fieldworkIdx, 5);
    // CAPA ≥ Evidence + 5 days
    addGapError(capaIdx, 'CAPA Due', evidenceIdx, 5);
    // Draft Report Due ≥ CAPA + 3 days
    addGapError(draftIdx, 'Draft Report Due', capaIdx, 3);

    return errs;
  }, [schedules, periodFromLocal, periodToLocal]);

  const handleScheduleChange = (index: number, field: keyof ScheduleItem, value: any) => {
    // Không cho phép sửa 2 mốc đầu: Kickoff Meeting & Fieldwork Start
    if (
      field === 'dueDate' &&
      index >= 0 &&
      index < schedules.length &&
      ['kickoff', 'kickoffmeeting', 'kickoff-meeting', 'fieldwork', 'fieldworkstart', 'fieldwork-start'].some((k) =>
        String(schedules[index].milestoneName || '')
          .toLowerCase()
          .replace(/\s+/g, '')
          .includes(k)
      )
    ) {
      toast.warning('Kickoff Meeting and Fieldwork Start cannot be edited here. Please update them in the original plan.');
      return;
    }

    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);

    // Re-sync errors from computedScheduleErrors
    setScheduleErrors(computedScheduleErrors);
  };

  // Get auditor options for MultiSelect
  const auditorOptions = React.useMemo(() => {
    const auditors = allUsers.filter(
      (u: any) => String(u.roleName || '').toLowerCase().includes('auditor')
    );
    return auditors.map((u: any) => {
      const uid = String(u.userId || u.id || '').trim();
      const isSelected = selectedAuditorIds.includes(uid);
      const isInitial = initialAuditorIds.has(uid);
      const inAvailable =
        !availableAuditorIds || availableAuditorIds.size === 0 || availableAuditorIds.has(uid);

      return {
        value: uid,
        label: `${u.fullName || 'Unknown'} (${u.email || 'N/A'})`,
        // Cho phép luôn giữ/chọn lại các auditor ban đầu; chỉ khóa những người không có trong available list
        disabled: !isSelected && !isInitial && !inAvailable,
      };
    });
  }, [allUsers, selectedAuditorIds, initialAuditorIds, availableAuditorIds]);

  const handleSave = async () => {
    if (!auditId) return;

    // Validate based on edit mode
    if (editMode === 'schedule' || editMode === 'both') {
      if (Object.keys(computedScheduleErrors).length > 0) {
        setScheduleErrors(computedScheduleErrors);
        toast.error('Please fix validation errors before saving');
        return;
      }
    }

    if (editMode === 'team' || editMode === 'both') {
      if (selectedAuditorIds.length === 0) {
        toast.error('At least one auditor is required');
      return;
    }
    }

    setSaving(true);
    try {
      // Save only selected parts
      const schedulesToSave = (editMode === 'schedule' || editMode === 'both') 
        ? schedules.map(s => {
            const result: any = {
              milestoneName: s.milestoneName || '',
              dueDate: s.dueDate || '',
              notes: s.notes || '', // Ensure notes field is always present (backend requires it)
              status: s.status || 'Active',
            };
            // Only include scheduleId if it exists and is valid
            if (s.scheduleId) {
              result.scheduleId = String(s.scheduleId);
            }
            return result;
          })
        : [];
      
      // Convert selectedAuditorIds to TeamMember format for onSave
      const teamToSave = (editMode === 'team' || editMode === 'both') 
        ? selectedAuditorIds.map(userId => {
            const user = allUsers.find((u: any) => String(u.userId || u.id) === userId);
            return {
              userId: userId,
              fullName: user?.fullName || 'Unknown',
              roleInTeam: 'Auditor', // Default role
              isLead: false, // Default isLead
            };
          })
        : [];
      
      await onSave(schedulesToSave, teamToSave);
      toast.success('Changes saved successfully');
      onClose();
    } catch (err: any) {
      console.error('Save failed', err);
      toast.error('Failed to save changes: ' + (err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (!show) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 transform transition-all">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-primary-600 to-primary-700 p-6 border-b border-primary-500/20">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-white">
            Edit Schedule & Team
          </h3>
              <p className="text-sm text-primary-100 mt-0.5">
            Update audit schedule and team members
          </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors flex items-center justify-center"
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-4"></div>
              <p className="text-sm font-medium text-gray-600">Loading schedule and team data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Edit Mode Selection (simple check/uncheck) */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <label className="block text-xs font-semibold text-gray-700 mb-3">
                  Select what to edit:
                </label>
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    const scheduleChecked = editMode === 'schedule' || editMode === 'both';
                    const teamChecked = editMode === 'team' || editMode === 'both';
                    return (
                      <>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={scheduleChecked}
                            onChange={(e) => {
                              const next = e.target.checked;
                              if (next) {
                                setEditMode(teamChecked ? 'both' : 'schedule');
                              } else {
                                setEditMode(teamChecked ? 'team' : 'none');
                              }
                            }}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Schedule
                          </span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={teamChecked}
                            onChange={(e) => {
                              const next = e.target.checked;
                              if (next) {
                                setEditMode(scheduleChecked ? 'both' : 'team');
                              } else {
                                setEditMode(scheduleChecked ? 'schedule' : 'none');
                              }
                            }}
                            className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Team
                          </span>
                        </label>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Schedules Section */}
              {(editMode === 'schedule' || editMode === 'both') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-primary-700 rounded-full"></div>
                    <h4 className="text-base font-bold text-gray-800">Schedules</h4>
                  </div>
                  
                </div>
                
                {/* Period From/To editable range */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-900 mb-1">Valid Date Range</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-blue-700">
                        <div className="flex flex-col">
                          <label className="mb-0.5 text-[11px] font-semibold text-blue-900">
                            Period From
                          </label>
                          <input
                            type="date"
                            value={periodFromLocal || ''}
                            readOnly
                            disabled
                            className="px-2.5 py-1 rounded border border-blue-200 font-mono text-blue-500 bg-gray-100 cursor-not-allowed"
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="mb-0.5 text-[11px] font-semibold text-blue-900">
                            Period To
                          </label>
                          <input
                            type="date"
                            value={periodToLocal || ''}
                            onChange={(e) => setPeriodToLocal(e.target.value || undefined)}
                            className="px-2.5 py-1 bg-white rounded border border-blue-200 font-mono text-blue-800 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </div>
                      </div>
                      
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                   {schedules.map((schedule, index) => {
                     const scheduleKey = schedule.scheduleId || `schedule-${index}`;
                     const isLockedMilestone = ['kickoff', 'kickoffmeeting', 'kickoff-meeting', 'fieldwork', 'fieldworkstart', 'fieldwork-start'].some(
                       (k) =>
                         String(schedule.milestoneName || '')
                           .toLowerCase()
                           .replace(/\s+/g, '')
                           .includes(k)
                     );
                     return (
                    <div
                       key={scheduleKey}
                       className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 space-y-4 group"
                    >
                       <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                         <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-sm">
                             <span className="text-white font-bold text-sm">{index + 1}</span>
                           </div>
                        <div>
                             <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Milestone</p>
                             <p className="text-base font-bold text-gray-900">
                               {schedule.milestoneName || `Schedule ${index + 1}`}
                             </p>
                             {isLockedMilestone && (
                               <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                                 This milestone can only be edited in the original audit plan.
                               </p>
                             )}
                           </div>
                         </div>
                        </div>
                        <div>
                         <label className="block text-xs font-semibold text-gray-700 mb-2">
                           Due Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={schedule.dueDate}
                            onChange={(e) =>
                              handleScheduleChange(index, 'dueDate', e.target.value)
                            }
                            min={periodFrom}
                            max={periodTo}
                            disabled={isLockedMilestone}
                            className={`w-full px-4 py-2.5 border rounded-lg text-sm transition-all duration-200 ${
                              isLockedMilestone
                                ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed'
                                : 'bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ' +
                                  (scheduleErrors[index] ? 'border-red-500' : 'border-gray-300')
                            }`}
                          />
                         {scheduleErrors[index] && (
                           <p className="text-xs text-red-600 mt-1">{scheduleErrors[index]}</p>
                         )}
                        </div>
                      
                      </div>
                   );
                   })}
                  {schedules.length === 0 && (
                    <div className="text-center py-12 bg-white border-2 border-dashed border-gray-200 rounded-xl">
                      <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm font-medium text-gray-500">No schedules added yet</p>
                     
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Team Members Section */}
              {(editMode === 'team' || editMode === 'both') && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-gradient-to-b from-primary-600 to-primary-700 rounded-full"></div>
                    <h4 className="text-base font-bold text-gray-800">Team Members</h4>
                        </div>
                      </div>
                
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                  <label className="block text-xs font-semibold text-gray-700 mb-2">
                    Auditors <span className="text-red-500">*</span>
                        </label>
                  {auditorOptions.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-700">
                        ⚠️ No auditor options available. Please ensure auditors are loaded.
                      </p>
                      </div>
                  ) : (
                    <MultiSelect
                      options={auditorOptions}
                      value={selectedAuditorIds}
                      onChange={(next) => setSelectedAuditorIds(next)}
                      placeholder="Select auditor(s)"
                      className="w-full"
                    />
                  )}
                  {selectedAuditorIds.length === 0 && (
                    <p className="mt-1 text-xs text-red-600">
                      At least one auditor is required.
                    </p>
                  )}
                  {selectedAuditorIds.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      {selectedAuditorIds.length} auditor(s) selected
                    </p>
                  )}
                </div>
              </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 active:scale-95"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditScheduleAndTeamModal;

