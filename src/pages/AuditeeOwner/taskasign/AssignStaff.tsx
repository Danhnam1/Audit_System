import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { getFindingById, type Finding } from '../../../api/findings';
import { createAuditAssignment } from '../../../api/auditAssignments';
import { getDepartmentUsers } from '../../../api/departmentHeads';

interface StaffMember {
  userId: string;
  fullName: string;
  email: string;
  role?: string;
}

const AssignStaff = () => {
  const { id: findingId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [finding, setFinding] = useState<Finding | null>(null);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [internalDeadline, setInternalDeadline] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [setReminder, setSetReminder] = useState(false);
  const [notes, _setNotes] = useState('');
  const [_loading, setLoading] = useState(true);
  const [_submitting, setSubmitting] = useState(false);
  const [_error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!findingId) {
        setError('Finding ID not found');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch finding details
        const findingData = await getFindingById(findingId);
        setFinding(findingData);

        // Fetch staff members from the same department
        if (findingData.deptId) {
          try {
            const staff = await getDepartmentUsers(findingData.deptId);
            setStaffMembers(staff);
          } catch (staffErr) {
            console.warn('Could not load staff members:', staffErr);
            // Continue even if staff loading fails
          }
        }

        setError(null);
      } catch (err: any) {
        console.error('Error loading data:', err);
        setError(err?.message || 'Failed to load finding');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [findingId]);

  const handleAssign = async () => {
    if (!selectedStaff) {
      alert('⚠️ Please select a staff member');
      return;
    }

    if (!finding) {
      alert('❌ Finding data not loaded');
      return;
    }

    try {
      setSubmitting(true);
      
      // Create audit assignment
      await createAuditAssignment({
        auditId: finding.auditId,
        deptId: finding.deptId || 0,
        auditorId: selectedStaff,
        notes: notes || '',
        status: 'Assigned',
      });

      alert('✅ Assignment created successfully!');
      navigate('/auditee-owner/findings');
    } catch (err: any) {
      console.error('Error creating assignment:', err);
      alert(`❌ Error: ${err?.message || 'Failed to assign'}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/auditee-owner/assign-tasks')}
            className="text-gray-600 hover:text-gray-900 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Assign Finding for CAPA</h1>
          <p className="mt-2 text-gray-600">Assign the finding to staff and set a deadline.</p>
        </div>

        {/* Finding Info */}
        {finding && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Finding: {finding.title}
              </h2>
              <p className="text-sm text-gray-600">SQA deadline: {finding.deadline ? new Date(finding.deadline).toLocaleDateString() : 'N/A'}</p>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">📝 Finding description (from Audit)</h3>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{finding.description || 'N/A'}</p>
            </div>
          </div>
        )}

        {/* Assignment Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Assignment</h2>

          <div className="space-y-4">
            {/* Select Staff */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                👤 Assign to
              </label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select staff...</option>
                {staffMembers.map((staff) => (
                  <option key={staff.userId} value={staff.userId}>
                    {staff.fullName} {staff.role ? `(${staff.role})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Internal Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📅 Internal deadline
              </label>
              <input
                type="date"
                value={internalDeadline}
                onChange={(e) => setInternalDeadline(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="2025-10-27 (1 day before SQA deadline)"
              />
              <p className="mt-1 text-xs text-gray-500">It is recommended to set it 1 day before the SQA deadline.</p>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💬 Instructions for staff
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Contact the following instructors: John Smith, Nguyen Van G, Tran Thi H. Medical certificate must be valid for at least 6 months."
              />
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sendEmail}
                  onChange={(e) => setSendEmail(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Send email notification to staff</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={setReminder}
                  onChange={(e) => setSetReminder(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Set a reminder 1 day before the deadline</span>
              </label>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/auditee-owner/assign-tasks')}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedStaff || !internalDeadline}
            className={`px-6 py-2 rounded-lg font-medium ${
              selectedStaff && internalDeadline
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Assign task
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default AssignStaff;

