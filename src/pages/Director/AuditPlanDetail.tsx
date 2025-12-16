import { useState } from 'react';
import { MainLayout } from '../../layouts';
import { useNavigate, useParams } from 'react-router-dom';
import { getStatusColor } from '../../constants';

const AuditPlanDetail = () => {
  const navigate = useNavigate();
  const { planId } = useParams();
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Mock data
  const plan = {
    id: Number(planId),
    planId: 'AP-2024-001',
    title: 'ISO 9001:2015 Quality Management System Audit',
    department: 'IT Department',
    scope: 'Document Control, Training Records, Internal Audit Process',
    startDate: '2024-11-20',
    endDate: '2024-11-25',
  submittedBy: 'Nguyen Van A (Lead Auditor)',
    submittedDate: '2024-11-01',
    status: 'Pending Review',
    objectives: [
      'Verify compliance with ISO 9001:2015 standards',
      'Assess effectiveness of quality management processes',
      'Identify areas for improvement',
      'Review documentation and record-keeping practices',
    ],
    auditTeam: ['Tran Thi B', 'Le Van C', 'Pham Thi D'],
    methodology: 'Document review, interviews, process observation, and sampling techniques',
    expectedOutcomes: [
      'Compliance assessment report',
      'List of non-conformities (if any)',
      'Recommendations for improvement',
      'Updated risk assessment',
    ],
    resources: 'Audit team of 3 members, 5 working days, access to all department documents',
    risks: [
      'Limited availability of key personnel',
      'Incomplete documentation',
      'Resistance to audit process',
    ],
  };

  const handleApprove = () => {
    // API call to approve
    alert('Audit plan approved successfully!');
    setShowApproveModal(false);
    navigate('/director/review-plans');
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    // API call to reject
    alert('Audit plan rejected');
    setShowRejectModal(false);
    navigate('/director/review-plans');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Audit Plan Details</h1>
            <p className="text-gray-600 mt-1">Plan ID: {plan.planId}</p>
          </div>
          <button
            onClick={() => navigate('/director/review-plans')}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Back to List
          </button>
        </div>

        {/* Main Info Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-800 mb-2">{plan.title}</h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  {plan.status}
                </span>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-500 mb-1">Department</p>
              <p className="font-semibold text-gray-800">{plan.department}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Submitted By</p>
              <p className="font-semibold text-gray-800">{plan.submittedBy}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Audit Period</p>
              <p className="font-semibold text-gray-800">
                {new Date(plan.startDate).toLocaleDateString()} - {new Date(plan.endDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Submission Date</p>
              <p className="font-semibold text-gray-800">{new Date(plan.submittedDate).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Scope */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Scope</h3>
            <p className="text-gray-700 p-4 bg-blue-50 rounded-lg">{plan.scope}</p>
          </div>

          {/* Objectives */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Audit Objectives</h3>
            <ul className="space-y-2">
              {plan.objectives.map((obj, index) => (
                <li key={index} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-700">{obj}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Audit Team */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Audit Team</h3>
            <div className="flex flex-wrap gap-2">
              {plan.auditTeam.map((member, index) => (
                <span key={index} className="px-4 py-2 bg-purple-100 text-purple-800 rounded-lg font-medium">
                  {member}
                </span>
              ))}
            </div>
          </div>

          {/* Methodology */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Methodology</h3>
            <p className="text-gray-700 p-4 bg-gray-50 rounded-lg">{plan.methodology}</p>
          </div>

          {/* Expected Outcomes */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Expected Outcomes</h3>
            <ul className="space-y-2">
              {plan.expectedOutcomes.map((outcome, index) => (
                <li key={index} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-700">{outcome}</span>
                </li>
              ))}
            </ul>
          </div>

        {/* Departments & Standards (aligned with Auditor/Lead Auditor) */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Departments & Standards</h3>
          <div className="space-y-4">
            {(plan as any).departments?.length ? (
              (plan as any).departments.map((dept: any, idx: number) => {
                const deptName = dept.name || dept.deptName || `Department ${idx + 1}`;
                const standards = dept.standards || dept.criteria || [];
                return (
                  <div
                    key={idx}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-primary-300 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-base font-bold text-gray-900">{deptName}</h4>
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 mb-2">Standards</h5>
                      {Array.isArray(standards) && standards.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {standards.map((std: any, sIdx: number) => {
                            const label =
                              std.name ||
                              std.title ||
                              std.referenceCode ||
                              std.code ||
                              `Standard ${sIdx + 1}`;
                            return (
                              <div
                                key={sIdx}
                                className="flex items-center gap-2 bg-white rounded-md px-3 py-2 border border-gray-200"
                              >
                                <div className="bg-primary-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-semibold">
                                  ✓
                                </div>
                                <span className="text-sm text-gray-800">{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No standards available.</p>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-bold text-gray-900">
                    {plan.department || 'Department'}
                  </h4>
                </div>
                <div>
                  <h5 className="text-sm font-semibold text-gray-700 mb-2">Standards</h5>
                  <p className="text-sm text-gray-500 italic">No standards available.</p>
                </div>
              </div>
            )}
          </div>
        </div>

          {/* Resources */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Resources Required</h3>
            <p className="text-gray-700 p-4 bg-green-50 rounded-lg">{plan.resources}</p>
          </div>

          {/* Risks */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Potential Risks</h3>
            <ul className="space-y-2">
              {plan.risks.map((risk, index) => (
                <li key={index} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span className="text-gray-700">{risk}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          {plan.status === 'Pending Review' && (
            <div className="flex gap-3 pt-6 border-t border-gray-200">
              <button
                onClick={() => setShowApproveModal(true)}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Approve Plan
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Reject Plan
              </button>
            </div>
          )}
        </div>

        {/* Approve Modal */}
        {showApproveModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Approve Audit Plan</h3>
              <p className="text-gray-600 mb-6">
                Are you sure you want to approve this audit plan? The audit team will be notified and can proceed with the audit.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApprove}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${getStatusColor('Approved')}`}
                >
                  Confirm Approval
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Reject Audit Plan</h3>
              <p className="text-gray-600 mb-4">
                Please provide a reason for rejecting this audit plan:
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4"
                placeholder="Enter rejection reason..."
              />
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowRejectModal(false)}
                  className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md ${getStatusColor('Rejected')}`}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AuditPlanDetail;
