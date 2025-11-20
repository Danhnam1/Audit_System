import React, { useState } from 'react';

interface PlanProps {
  plan: any;
  onBack: () => void;
  onForwardToDirector: (auditId: string, comment?: string) => Promise<void>;
  onReject: (auditId: string, comment?: string) => Promise<void>;
  onRequestRevision: (auditId: string, comment?: string) => Promise<void>;
}

export const PlanReviewPanel: React.FC<PlanProps> = ({ plan, onBack, onForwardToDirector, onReject, onRequestRevision }) => {
  const [comments, setComments] = useState('');
  if (!plan) return null;

  const id = plan.auditId || plan.id;
  // derive department names from scopeDepartments when available
  const deptList: string[] = (() => {
    const sd = plan.scopeDepartments;
    if (!sd) return [];
    if (Array.isArray(sd)) return sd.map((d:any) => d.deptName || String(d.deptId || '')).filter(Boolean);
    if (sd.values && Array.isArray(sd.values)) return sd.values.map((d:any) => d.deptName || String(d.deptId || '')).filter(Boolean);
    return [];
  })();

  const departmentDisplay = deptList.length ? deptList.join(', ') : (plan.department || plan.deptName || 'N/A');

  const submittedBy = plan.createdByUser?.fullName || plan.createdBy || plan.submittedBy || 'N/A';

  // derive schedule display
  const scheduleStart = plan.startDate || (plan.schedules?.values && plan.schedules.values[0]?.dueDate) || null;
  const scheduleEnd = plan.endDate || (plan.schedules?.values && plan.schedules.values[plan.schedules.values.length - 1]?.dueDate) || null;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-2">← Back to List</button>

      <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-primary-600">{plan.title}</h2>
            <p className="text-gray-600 text-sm mt-1">Audit ID: {id}</p>
          </div>
          <span className={`px-4 py-2 rounded-lg text-sm font-semibold border text-gray-700`}>{plan.priority || 'N/A'} Priority</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Department</h3>
            <p className="text-gray-900">{departmentDisplay}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Audit Scope</h3>
            <p className="text-gray-900">{plan.scope || 'N/A'}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Submitted By</h3>
            <p className="text-gray-900">{submittedBy}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Submitted Date</h3>
            <p className="text-gray-900">{plan.createdAt ? new Date(plan.createdAt).toLocaleDateString() : plan.submittedDate || 'N/A'}</p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Objective</h3>
          <p className="text-gray-700 leading-relaxed">{plan.objective || 'N/A'}</p>
        </div>

        <div className="border-t border-gray-200 pt-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Schedule</h3>
          <div className="flex gap-6">
            <div><span className="text-sm text-gray-600">Start Date:</span><span className="ml-2 text-gray-900 font-medium">{scheduleStart ? new Date(scheduleStart).toLocaleDateString() : 'N/A'}</span></div>
            <div><span className="text-sm text-gray-600">End Date:</span><span className="ml-2 text-gray-900 font-medium">{scheduleEnd ? new Date(scheduleEnd).toLocaleDateString() : 'N/A'}</span></div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Review Comments (Optional)</h3>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} rows={4} placeholder="Add any comments or feedback for the Auditor..." className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
        </div>

        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button onClick={async () => await onForwardToDirector(String(id), comments)} className="bg-teal-500 hover:bg-teal-600 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">Forward to Director</button>
          <button onClick={async () => await onRequestRevision(String(id), comments)} className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">Request Revision</button>
          <button onClick={async () => {
            if (!comments) {
              if (!window.confirm('Reject without comment?')) return;
            }
            await onReject(String(id), comments);
          }} className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">Reject</button>
          <button onClick={onBack} className="border-2 border-gray-400 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150">Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default PlanReviewPanel;
