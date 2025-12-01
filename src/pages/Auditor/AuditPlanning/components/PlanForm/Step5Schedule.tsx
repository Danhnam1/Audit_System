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
  periodFrom?: string; // Period From date for validation
  periodTo?: string; // Period To date for validation
}

const InfoHint: React.FC<{ text: string }> = ({ text }) => (
  <span className="relative inline-flex items-center group align-middle">
    <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border border-primary-300 bg-primary-50 text-[10px] font-semibold text-primary-600 cursor-pointer hover:bg-primary-100 hover:border-primary-400 transition-colors">
      !
    </span>
    <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 -translate-y-1/2 w-64 whitespace-pre-line rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs text-gray-700 opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100">
      {/* Arrow pointer pointing left */}
      <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-[1px]">
        <div className="h-0 w-0 border-t-[6px] border-b-[6px] border-r-[6px] border-t-transparent border-b-transparent border-r-primary-200"></div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0 w-0 border-t-[5px] border-b-[5px] border-r-[5px] border-t-transparent border-b-transparent border-r-white"></div>
      </div>
      <div className="relative leading-relaxed">{text}</div>
    </div>
  </span>
);

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
  periodFrom,
  periodTo,
}) => {
  // Helper to get min/max date attributes
  const getDateAttributes = () => {
    const attrs: { min?: string; max?: string } = {};
    if (periodFrom) attrs.min = periodFrom;
    if (periodTo) attrs.max = periodTo;
    return attrs;
  };

  const dateAttrs = getDateAttributes();
  return (
    <div>
      <h3 className="text-md font-semibold text-gray-700 mb-4">Step 5/5: Schedule & Deadlines</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Kickoff Meeting
            <InfoHint text="Kickoff meeting to align objectives, scope, and audit schedule with all stakeholders." />
          </label>
          <input
            type="date"
            value={kickoffMeeting}
            onChange={(e) => onKickoffChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            {...dateAttrs}
            className={`w-full border rounded-lg px-3 py-2 text-sm placeholder:font-normal focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.kickoffMeeting ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.kickoffMeeting && <p className="text-xs text-red-600 mt-1">{errors.kickoffMeeting}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Fieldwork Start
            <InfoHint text="The date when auditors start fieldwork activities (interviews, reviews, evidence collection)." />
          </label>
          <input
            type="date"
            value={fieldworkStart}
            onChange={(e) => onFieldworkChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            {...dateAttrs}
            className={`w-full border rounded-lg px-3 py-2 text-sm placeholder:font-normal focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.fieldworkStart ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.fieldworkStart && <p className="text-xs text-red-600 mt-1">{errors.fieldworkStart}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Evidence Due
            <InfoHint text="Deadline for auditees to provide all required evidence to the audit team." />
          </label>
          <input
            type="date"
            value={evidenceDue}
            onChange={(e) => onEvidenceChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            {...dateAttrs}
            className={`w-full border rounded-lg px-3 py-2 text-sm placeholder:font-normal focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.evidenceDue ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.evidenceDue && <p className="text-xs text-red-600 mt-1">{errors.evidenceDue}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Draft Report Due
            <InfoHint text="Deadline for auditors to complete the draft report and submit it to the Lead Auditor for review. This milestone is used to track reporting progress." />
          </label>
          <input
            type="date"
            value={draftReportDue}
            onChange={(e) => onDraftReportChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            {...dateAttrs}
            className={`w-full border rounded-lg px-3 py-2 text-sm placeholder:font-normal focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.draftReportDue ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.draftReportDue && <p className="text-xs text-red-600 mt-1">{errors.draftReportDue}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CAPA Due
            <InfoHint text="Deadline to complete corrective and preventive actions (CAPA) for the audit findings." />
          </label>
          <input
            type="date"
            value={capaDue}
            onChange={(e) => onCapaChange(e.target.value)}
            placeholder="dd/mm/yyyy"
            {...dateAttrs}
            className={`w-full border rounded-lg px-3 py-2 text-sm placeholder:font-normal focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${errors.capaDue ? 'border-red-500' : 'border-gray-300'}`}
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
