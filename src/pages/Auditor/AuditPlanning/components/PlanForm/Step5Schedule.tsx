import React from 'react';

interface Step5ScheduleProps {
  kickoffMeeting: string;
  fieldworkStart: string;
  evidenceDue: string;
  draftReportDue: string;
  capaDue: string;
  onKickoffChange: (value: string) => void;
  onFieldworkChange: (value: string) => void;
  onEvidenceChange: (value: string) => void;
  onDraftReportChange: (value: string) => void;
  onCapaChange: (value: string) => void;
  errors?: Record<string, string | undefined>; // field -> message
}

export const Step5Schedule: React.FC<Step5ScheduleProps> = ({
  kickoffMeeting,
  fieldworkStart,
  evidenceDue,
  draftReportDue,
  capaDue,
  onKickoffChange,
  onFieldworkChange,
  onEvidenceChange,
  onDraftReportChange,
  onCapaChange,
  errors = {},
}) => {
  return (
    <div>
      <h3 className="text-md font-semibold text-gray-700 mb-4">Step 5/5: Schedule & Deadlines</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kickoff Meeting</label>
          <input
            type="date"
            value={kickoffMeeting}
            onChange={(e) => onKickoffChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.kickoffMeeting ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.kickoffMeeting && <p className="text-xs text-red-600 mt-1">{errors.kickoffMeeting}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fieldwork Start</label>
          <input
            type="date"
            value={fieldworkStart}
            onChange={(e) => onFieldworkChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.fieldworkStart ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.fieldworkStart && <p className="text-xs text-red-600 mt-1">{errors.fieldworkStart}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Due</label>
          <input
            type="date"
            value={evidenceDue}
            onChange={(e) => onEvidenceChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.evidenceDue ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.evidenceDue && <p className="text-xs text-red-600 mt-1">{errors.evidenceDue}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Draft Report Due</label>
          <input
            type="date"
            value={draftReportDue}
            onChange={(e) => onDraftReportChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.draftReportDue ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.draftReportDue && <p className="text-xs text-red-600 mt-1">{errors.draftReportDue}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">CAPA Due</label>
          <input
            type="date"
            value={capaDue}
            onChange={(e) => onCapaChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.capaDue ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.capaDue && <p className="text-xs text-red-600 mt-1">{errors.capaDue}</p>}
        </div>
        {/* <div className="border-t pt-4 mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              Checklist Published ≥2 days before fieldwork: [Yes/No]
            </span>
          </label>
        </div> */}
      </div>
    </div>
  );
};
