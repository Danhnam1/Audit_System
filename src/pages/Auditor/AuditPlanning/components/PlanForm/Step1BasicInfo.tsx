import React from 'react';

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
}) => {
  // Calculate min date for Period - To
  // Must be: 1) not in the past, 2) greater than Period - From
  const today = new Date().toISOString().split('T')[0];
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
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
              min={new Date().toISOString().split('T')[0]}
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
