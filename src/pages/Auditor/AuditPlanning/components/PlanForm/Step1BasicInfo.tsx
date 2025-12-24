import React, { useEffect, useState } from 'react';
import { getAuditsByPeriod } from '../../../../../api/audits';
import { unwrap } from '../../../../../utils/normalize';

interface Step1BasicInfoProps {
  title: string;
  auditType: string;
  goal: string;
  periodFrom: string;
  periodTo: string;
  onTitleChange: (value: string) => void;
  onAuditTypeChange: (value: string) => void;
  onGoalChange: (value: string) => void;
  onPeriodFromChange: (value: string) => void;
  onPeriodToChange: (value: string) => void;
  editingAuditId?: string | null;
}

export const Step1BasicInfo: React.FC<Step1BasicInfoProps> = ({
  title,
  auditType,
  goal,
  periodFrom,
  periodTo,
  onTitleChange,
  onAuditTypeChange,
  onGoalChange,
  onPeriodFromChange,
  onPeriodToChange,
  editingAuditId,
}) => {
  const [hasTimeConflict, setHasTimeConflict] = useState(false);
  const [conflictingAuditsCount, setConflictingAuditsCount] = useState(0);

  useEffect(() => {
    const checkTimeConflict = async () => {
      if (!periodFrom || !periodTo) {
        setHasTimeConflict(false);
        setConflictingAuditsCount(0);
        return;
      }

      try {
        const auditsInPeriod = await getAuditsByPeriod(periodFrom, periodTo);
        
        // Unwrap response to handle different formats ($values, values, data, or direct array)
        const auditsArray = unwrap(auditsInPeriod);
        
        // Filter out inactive and deleted audits
        const activeAudits = auditsArray.filter((a: any) => {
          const status = String(a.status || '').toLowerCase().replace(/\s+/g, '');
          const isActive = status !== 'inactive' && status !== 'deleted';
          if (!isActive) {
          }
          return isActive;
        });
        
        
        // Filter out current audit if editing
        const otherAudits = editingAuditId
          ? activeAudits.filter((a: any) => {
              const auditId = String(a.auditId || a.id);
              const isNotCurrent = auditId !== String(editingAuditId);
              if (!isNotCurrent) {
              }
              return isNotCurrent;
            })
          : activeAudits;

        // Check for actual time overlap (not just same period)
        const newStart = new Date(periodFrom);
        const newEnd = new Date(periodTo);
        
        const overlappingAudits = otherAudits.filter((a: any) => {
          const auditStart = new Date(a.startDate || a.periodFrom || a.startDate);
          const auditEnd = new Date(a.endDate || a.periodTo || a.endDate);
          
          // Check if dates are valid
          if (isNaN(auditStart.getTime()) || isNaN(auditEnd.getTime())) {
            return false;
          }
          
          // Check overlap: newStart <= auditEnd && newEnd >= auditStart
          const overlaps = auditStart <= newEnd && auditEnd >= newStart;
          return overlaps;
        });

       

        if (overlappingAudits.length > 0) {
          setHasTimeConflict(true);
          setConflictingAuditsCount(overlappingAudits.length);
        } else {
          setHasTimeConflict(false);
          setConflictingAuditsCount(0);
        }
      } catch (error) {
        console.error('[Step1BasicInfo] Error checking time conflict:', error);
        setHasTimeConflict(false);
        setConflictingAuditsCount(0);
      }
    };

    checkTimeConflict();
  }, [periodFrom, periodTo, editingAuditId]);
  // Calculate min/max dates for Period fields
  // - Period From: today → today + 6 months (~180 days)
  // - Period To:   at least the day after Period From (and not in the past)
  const todayObj = new Date();
  const today = todayObj.toISOString().split('T')[0];

  const sixMonthsFromToday = new Date(todayObj);
  sixMonthsFromToday.setDate(sixMonthsFromToday.getDate() + 180);
  const maxStartDate = sixMonthsFromToday.toISOString().split('T')[0];
  const getPeriodToMin = () => {
    if (!periodFrom) {
      // If Period - From is not set, min is today
      return today;
    }
    // If Period - From is set, min is the day after Period - From
    const fromDate = new Date(periodFrom);
    fromDate.setDate(fromDate.getDate() + 1);
    const nextDay = fromDate.toISOString().split('T')[0];
    // Return the later of: next day after Period - From, or today
    return nextDay > today ? nextDay : today;
  };

  const periodToMin = getPeriodToMin();

  return (
    <div>
      <h3 className="text-md font-semibold text-gray-700 mb-4">Step 1/5: Plan</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            type="text"
            placeholder="Enter audit plan title"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            value={auditType}
            onChange={(e) => onAuditTypeChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Select Type</option>
            <option value="External">External</option>
            <option value="Internal">Internal</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Objective *</label>
          <textarea
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            rows={3}
            placeholder="Describe the goal and context of this audit..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period - From</label>
            <input
              value={periodFrom}
              onChange={(e) => onPeriodFromChange(e.target.value)}
              type="date"
              placeholder="dd/mm/yyyy"
            min={today}
            max={maxStartDate}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period - To</label>
            <input
              value={periodTo}
              onChange={(e) => onPeriodToChange(e.target.value)}
              type="date"
              placeholder="dd/mm/yyyy"
              min={periodToMin}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {hasTimeConflict && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ <strong>Warning:</strong> There are {conflictingAuditsCount} audit plans running simultaneously.
            </p>
          </div>
        )}
        
        {/* <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            rows={2}
            placeholder="Additional notes..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div> */}
      </div>
    </div>
  );
};
