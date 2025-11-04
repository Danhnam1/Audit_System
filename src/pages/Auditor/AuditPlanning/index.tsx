import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { useState } from 'react';
import { getStatusColor, getBadgeVariant } from '../../../constants';

const SQAStaffAuditPlanning = () => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  interface AuditPlan {
    id: string;
    title: string;
    goal: string;
    periodFrom: string;
    periodTo: string;
    organizationLevel: string;
    domain: string;
    deliveryMode: string[];
    standards: string[];
    checklist: string;
    version: string;
    auditLead: string;
    auditors: string[];
    departmentOwners: string[];
    kickoffMeeting: string;
    fieldworkStart: string;
    evidenceDue: string;
    draftReportDue: string;
    capaDue: string;
    status: string;
    createdDate: string;
    createdBy: string;
    contactEmails?: string;
  }

  const [selectedPlan, setSelectedPlan] = useState<AuditPlan | null>(null);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [level, setLevel] = useState<string>('faculty');
  const [faculty, setFaculty] = useState<string>('cabin-crew');
  const [courseQuery, setCourseQuery] = useState<string>('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'CC-REC-1025',
    'CC-DGR-1125',
    'CC-REC-1125',
  ]);

  const addScope = (code: string) => {
    const v = (code || '').trim().toUpperCase();
    if (!v) return;
    setSelectedScopes((prev) => (prev.includes(v) ? prev : [...prev, v]));
  };

  const removeScope = (code: string) => {
    setSelectedScopes((prev) => prev.filter((c) => c !== code));
  };

  // menuItems are now provided centrally by MainLayout (role-based). Remove per-page menu definitions.

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const existingPlans = [
    { 
      id: 'AUD-2025-001', 
      title: 'Annual Safety Audit',
      goal: 'Comprehensive review of safety protocols and equipment maintenance',
      periodFrom: '2025-11-01',
      periodTo: '2025-11-15',
      organizationLevel: 'Department',
      domain: 'Safety',
      deliveryMode: ['Classroom', 'OJT'],
      standards: ['CAAV', 'EASA'],
      checklist: 'Safety Audit Checklist v2.0',
      version: 'v2.0',
  auditLead: 'Sarah Johnson (Lead Auditor)',
      auditors: ['John Smith', 'David Martinez'],
      departmentOwners: ['Safety - Robert Wilson'],
      kickoffMeeting: '2025-10-28',
      fieldworkStart: '2025-11-01',
      evidenceDue: '2025-11-10',
      draftReportDue: '2025-11-12',
      capaDue: '2025-11-15',
      status: 'Draft',
      createdDate: '2025-10-20',
      createdBy: 'John Smith'
    },
    { 
      id: 'AUD-2025-002', 
      title: 'Maintenance Quality Check',
      goal: 'Verify compliance with maintenance procedures and tool calibration standards',
      periodFrom: '2025-10-28',
      periodTo: '2025-11-10',
      organizationLevel: 'Department',
      domain: 'Maintenance',
      deliveryMode: ['Simulator', 'OJT'],
      standards: ['AS9100D', 'Internal SOP'],
      checklist: 'Maintenance Quality Checklist v1.5',
      version: 'v1.5',
  auditLead: 'Sarah Johnson (Lead Auditor)',
      auditors: ['John Smith', 'Emily Davis'],
      departmentOwners: ['Maintenance - David Martinez'],
      kickoffMeeting: '2025-10-26',
      fieldworkStart: '2025-10-28',
      evidenceDue: '2025-11-05',
      draftReportDue: '2025-11-08',
      capaDue: '2025-11-10',
      status: 'Submitted',
      createdDate: '2025-10-18',
      createdBy: 'David Martinez'
    },
    { 
      id: 'AUD-2025-003', 
      title: 'Training Compliance Review',
      goal: 'Ensure all training records and certifications meet regulatory requirements',
      periodFrom: '2025-10-25',
      periodTo: '2025-11-05',
      organizationLevel: 'Division',
      domain: 'Training',
      deliveryMode: ['Classroom', 'Simulator'],
      standards: ['CAAV', 'EASA', 'Internal SOP'],
      checklist: 'Training Compliance Checklist v3.0',
      version: 'v3.0',
  auditLead: 'Mike Chen (Lead Auditor)',
      auditors: ['John Smith'],
      departmentOwners: ['Training - Emily Davis'],
      kickoffMeeting: '2025-10-23',
      fieldworkStart: '2025-10-25',
      evidenceDue: '2025-11-01',
      draftReportDue: '2025-11-03',
      capaDue: '2025-11-05',
      status: 'Approved',
      createdDate: '2025-10-15',
      createdBy: 'Emily Davis'
    },
  ];

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">Audit Planning</h1>
            <p className="text-gray-600 text-sm mt-1">Create and manage audit plans</p>
          </div>
          <button 
            onClick={() => setShowForm(!showForm)}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
          >
            + Create New Plan
          </button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        {showForm && (
          <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6">
            <h2 className="text-lg font-semibold text-primary-600 mb-4">New Audit Plan</h2>
            <div className="mb-6">
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4, 5].map((step) => (
                  <div key={step} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                        currentStep === step 
                          ? 'bg-primary-600 text-white' 
                          : currentStep > step 
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-200 text-gray-600'
                      }`}>
                        {currentStep > step ? '✓' : step}
                      </div>
                      <span className={`text-xs mt-1 ${currentStep === step ? 'text-primary-600 font-semibold' : 'text-gray-500'}`}>
                        {step === 1 && 'Plan'}
                        {step === 2 && 'Scope'}
                        {step === 3 && 'Checklist'}
                        {step === 4 && 'Team'}
                        {step === 5 && 'Schedule'}
                      </span>
                    </div>
                    {step < 5 && (
                      <div className={`h-1 flex-1 mx-2 ${currentStep > step ? 'bg-primary-500' : 'bg-gray-200'}`}></div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {currentStep === 1 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 1/5: Plan</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                      <input type="text" placeholder="Enter audit plan title" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Goal (context)</label>
                      <textarea rows={3} placeholder="Describe the goal and context of this audit..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Period - From</label>
                        <input type="date" placeholder="dd/mm/yyyy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Period - To</label>
                        <input type="date" placeholder="dd/mm/yyyy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea rows={2} placeholder="Additional notes..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 2/5: Scope</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Level *</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" value={level} onChange={(e) => setLevel(e.target.value)}>
                        <option value="academy">Academy</option>
                        <option value="faculty">Faculty</option>
                        <option value="department">Department</option>
                        <option value="course">Course</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Faculty/Unit *</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" value={faculty} onChange={(e) => setFaculty(e.target.value)}>
                        <option value="cabin-crew">Cabin Crew</option>
                        <option value="pilot">Pilot</option>
                        <option value="maintenance">Maintenance</option>
                        <option value="ground-operations">Ground Operations</option>
                        <option value="others">Others</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Delivery: </label>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" defaultChecked />
                          <span className="text-sm text-gray-700">Classroom</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">Elearning</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">Simulator</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">OJT</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Standards:</label>
                      <div className="flex flex-wrap gap-3">
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" defaultChecked />
                          <span className="text-sm text-gray-700">CAAV</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">EASA</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">ICAO</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">IATA DGR</span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                          <span className="text-sm text-gray-700">SOP</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Course filter: type code and press Enter to add</label>
                      <input
                        type="text"
                        placeholder="e.g. CC-REC-1025, CC-DGR-1125"
                        value={courseQuery}
                        onChange={(e) => setCourseQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addScope(courseQuery);
                            setCourseQuery('');
                          }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Avoid duplicates; entries are auto uppercased.</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Selected Scope chips ({selectedScopes.length})</label>
                      <div className="flex flex-wrap gap-2">
                        {selectedScopes.map((code) => (
                          <span key={code} className="px-3 py-1.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium border border-primary-200 flex items-center gap-2">
                            {code}
                            <button type="button" onClick={() => removeScope(code)} className="hover:text-primary-900" aria-label={`Remove ${code}`}>
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Out-of-scope (optional):</label>
                      <textarea rows={3} placeholder="Reasons for out-of-scope items..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 3/5: Checklist</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select Checklist Set</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        <option>Published Checklist </option>
                        <option>Safety Audit Checklist v2.0</option>
                        <option>Maintenance Quality Checklist v1.5</option>
                        <option>Training Compliance Checklist v3.0</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea rows={3} placeholder="Additional notes about checklist..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 4/5: Team & Responsibilities</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Audit Lead (Lead Auditor)</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        <option>Select user </option>
                        <option>Sarah Johnson (Lead Auditor)</option>
                        <option>Mike Chen (Lead Auditor)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Auditors (Auditor)</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        <option>Multi-select </option>
                        <option>John Smith (Auditor)</option>
                        <option>David Martinez (Auditor)</option>
                        <option>Emily Davis (Auditor)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Auditee Owner(s)</label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                        <option>Select Auditee Owner </option>
                        <option>Flight Operations - Mike Chen</option>
                        <option>Maintenance - David Martinez</option>
                        <option>Training - Emily Davis</option>
                        <option>Safety - Robert Wilson</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Contact Emails</label>
                      <input type="text" placeholder="email1@aviation.edu, email2@aviation.edu" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                      <textarea rows={2} placeholder="Additional team notes..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"></textarea>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 5 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-4">Step 5/5: Schedule & Deadlines</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kickoff Meeting</label>
                      <input type="date" placeholder="dd/mm/yyyy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fieldwork Start</label>
                      <input type="date" placeholder="dd/mm/yyyy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Evidence Due</label>
                      <input type="date" placeholder="dd/mm/yyyy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Draft Report Due</label>
                      <input type="date" placeholder="dd/mm/yyyy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CAPA Due</label>
                      <input type="date" placeholder="dd/mm/yyyy" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                    </div>
                    <div className="border-t pt-4 mt-4">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                        <span className="text-sm text-gray-700">Checklist Published ≥2 days before fieldwork: [Yes/No]</span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between gap-3 pt-6 border-t">
                <button 
                  onClick={() => {
                    if (currentStep > 1) {
                      setCurrentStep(currentStep - 1);
                    } else {
                      setShowForm(false);
                      setCurrentStep(1);
                    }
                  }}
                  className="border-2 border-gray-400 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150"
                >
                  {currentStep === 1 ? 'Cancel' : '← Back'}
                </button>
                
                <div className="flex gap-3">
                  {currentStep < 5 && (
                    <button 
                      onClick={() => setCurrentStep(currentStep + 1)}
                      className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md"
                    >
                      Continue →
                    </button>
                  )}
                  {currentStep === 5 && (
                    <>
                      <button className="border-2 border-gray-400 text-gray-700 hover:bg-gray-50 px-6 py-2.5 rounded-lg font-medium transition-all duration-150">
                        Save Draft
                      </button>
                      <button className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-lg font-medium transition-all duration-150 shadow-sm hover:shadow-md">
                        Submit Plan →
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Existing Audit Plans</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit ID</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Title & Goal</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Domain</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Schedule</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {existingPlans.map((plan, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-primary-600">{plan.id}</span>
                    </td>
                    <td className="px-6 py-4" style={{ maxWidth: '250px' }}>
                      <p className="text-sm font-semibold text-gray-900">{plan.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{plan.goal}</p>
                      <div className="flex gap-2 mt-1">
                        {plan.standards.map((std, i) => (
                          <span key={i} className={`px-2 py-0.5 text-xs rounded ${getBadgeVariant('primary-light')}`}>
                            {std}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="text-xs text-gray-600">From:</p>
                      <p className="text-sm font-medium text-gray-900">{plan.periodFrom}</p>
                      <p className="text-xs text-gray-600 mt-1">To:</p>
                      <p className="text-sm font-medium text-gray-900">{plan.periodTo}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{plan.domain}</p>
                      <p className="text-xs text-gray-500">{plan.organizationLevel}</p>
                      <div className="flex gap-1 mt-1">
                        {plan.deliveryMode.map((mode, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                            {mode}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs space-y-1">
                        <p><span className="text-gray-600">Kickoff:</span> <span className="font-medium text-gray-900">{plan.kickoffMeeting}</span></p>
                        <p><span className="text-gray-600">Fieldwork:</span> <span className="font-medium text-gray-900">{plan.fieldworkStart}</span></p>
                        <p><span className="text-gray-600">Evidence:</span> <span className="font-medium text-gray-900">{plan.evidenceDue}</span></p>
                        <p><span className="text-gray-600">Draft:</span> <span className="font-medium text-gray-900">{plan.draftReportDue}</span></p>
                        <p><span className="text-gray-600">CAPA:</span> <span className="font-medium text-gray-900">{plan.capaDue}</span></p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(plan.status)}`}>
                        {plan.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-2">Created:</p>
                      <p className="text-xs text-gray-700">{plan.createdDate}</p>
                      <p className="text-xs text-gray-500">By: {plan.createdBy}</p>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-2">
                        <button onClick={() => { setSelectedPlan(plan); setShowTeamModal(true); }} className="text-primary-600 hover:text-primary-700 text-sm font-medium text-left">View Details</button>
                        <button className="text-primary-600 hover:text-primary-700 text-sm font-medium text-left">Edit</button>
                        <button className="text-red-600 hover:text-red-700 text-sm font-medium text-left">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showTeamModal && selectedPlan && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-gradient-primary px-6 py-4 border-b border-primary-100">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-white">Audit Plan Details</h3>
                    <p className="text-sm text-primary-100 mt-1">{selectedPlan.id} - {selectedPlan.title}</p>
                  </div>
                  <button onClick={() => setShowTeamModal(false)} className="text-white hover:text-primary-100 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Basic Information
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Title</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.title}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Status</p>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedPlan.status)}`}>{selectedPlan.status}</span>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs text-gray-600 mb-1">Goal</p>
                      <p className="text-sm text-gray-900">{selectedPlan.goal}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Period From</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.periodFrom}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Period To</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.periodTo}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Scope & Domain
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Organization Level</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.organizationLevel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Domain/Area</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.domain}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Delivery Mode</p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedPlan.deliveryMode.map((mode: string, i: number) => (
                          <span key={i} className={`px-3 py-1 text-xs rounded-full font-medium ${getBadgeVariant('primary-medium')}`}>{mode}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-2">Standards</p>
                      <div className="flex gap-2 flex-wrap">
                        {selectedPlan.standards.map((std: string, i: number) => (
                          <span key={i} className={`px-3 py-1 text-xs rounded-full font-medium ${getBadgeVariant('primary-dark')}`}>{std}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Checklist Set</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.checklist}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Version</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.version}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-primary-50 rounded-lg p-4 border border-primary-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Audit Team
                  </h4>
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-2 font-semibold">Audit Lead</p>
                    <div className="bg-white border border-primary-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.auditLead}</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-2 font-semibold">Auditors ({selectedPlan.auditors.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedPlan.auditors.map((auditor: string, i: number) => (
                        <div key={i} className="bg-white border border-primary-200 rounded-lg px-3 py-2">
                          <p className="text-sm text-gray-900">{auditor}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <p className="text-xs text-gray-600 mb-2 font-semibold">Department Owners ({selectedPlan.departmentOwners.length})</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {selectedPlan.departmentOwners.map((owner: string, i: number) => (
                        <div key={i} className="bg-white border border-primary-200 rounded-lg px-3 py-2">
                          <p className="text-sm text-gray-900">{owner}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selectedPlan.contactEmails && (
                    <div>
                      <p className="text-xs text-gray-600 mb-2 font-semibold">Contact Emails</p>
                      <div className="bg-white border border-primary-200 rounded-lg p-3">
                        <p className="text-sm text-gray-700">{selectedPlan.contactEmails}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Schedule & Milestones
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Kickoff Meeting</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.kickoffMeeting}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Fieldwork Start</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.fieldworkStart}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Evidence Due</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.evidenceDue}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Draft Report Due</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.draftReportDue}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">CAPA Due</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.capaDue}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <h4 className="text-base font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Metadata
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Created Date</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.createdDate}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Created By</p>
                      <p className="text-sm font-medium text-gray-900">{selectedPlan.createdBy}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t border-gray-200 flex gap-3">
                <button onClick={() => setShowTeamModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors">Close</button>
                <button className="flex-1 btn-primary">Edit Plan</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default SQAStaffAuditPlanning;
