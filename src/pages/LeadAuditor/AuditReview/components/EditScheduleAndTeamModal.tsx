import { useState, useEffect } from 'react';
import { getAdminUsers } from '../../../../api/adminUsers';

interface Schedule {
  scheduleId?: string;
  id?: string;
  milestoneName?: string;
  dueDate?: string;
  notes?: string;
  status?: string;
}

interface TeamMember {
  teamId?: string;
  id?: string;
  userId?: string;
  user?: {
    userId?: string;
    fullName?: string;
    email?: string;
  };
  roleInTeam?: string;
  isLead?: boolean;
}

interface EditScheduleAndTeamModalProps {
  showModal: boolean;
  auditId: string;
  onClose: () => void;
  onSave: (changes: {
    schedules: Array<{ scheduleId?: string; action: 'add' | 'update' | 'delete'; data?: any }>;
    teamMembers: Array<{ teamId?: string; action: 'add' | 'delete'; data?: any }>;
  }) => Promise<void>;
  originalSchedules: Schedule[];
  originalTeamMembers: TeamMember[];
}

export const EditScheduleAndTeamModal: React.FC<EditScheduleAndTeamModalProps> = ({
  showModal,
  auditId: _auditId,
  onClose,
  onSave,
  originalSchedules,
  originalTeamMembers,
}) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'schedules' | 'team'>('schedules');

  useEffect(() => {
    if (showModal) {
      // Initialize with original data
      setSchedules([...originalSchedules]);
      setTeamMembers([...originalTeamMembers]);
      
      // Load auditor options
      loadAuditorOptions();
    }
  }, [showModal, originalSchedules, originalTeamMembers]);

  const loadAuditorOptions = async () => {
    try {
      const users = await getAdminUsers();
      const auditors = Array.isArray(users) 
        ? users.filter((u: any) => u.role === 'Auditor' || u.roleName === 'Auditor')
        : [];
      setAuditorOptions(auditors);
    } catch (error) {
      console.error('Failed to load auditor options:', error);
    }
  };

  const handleAddSchedule = () => {
    setSchedules([
      ...schedules,
      {
        milestoneName: '',
        dueDate: '',
        notes: '',
        status: 'Pending',
      },
    ]);
  };

  const handleUpdateSchedule = (index: number, field: string, value: string) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    setSchedules(updated);
  };

  const handleDeleteSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const handleAddTeamMember = () => {
    setTeamMembers([
      ...teamMembers,
      {
        userId: '',
        roleInTeam: 'Auditor',
        isLead: false,
      },
    ]);
  };

  const handleUpdateTeamMember = (index: number, field: string, value: any) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    setTeamMembers(updated);
  };

  const handleDeleteTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const scheduleChanges: Array<{ scheduleId?: string; action: 'add' | 'update' | 'delete'; data?: any }> = [];
      const teamChanges: Array<{ teamId?: string; action: 'add' | 'delete'; data?: any }> = [];

      // Compare schedules
      const originalScheduleMap = new Map(
        originalSchedules.map((s) => [s.scheduleId || s.id || '', s])
      );
      const currentScheduleMap = new Map(
        schedules.map((s, idx) => [s.scheduleId || s.id || `new-${idx}`, s])
      );

      // Find deleted schedules
      originalScheduleMap.forEach((_schedule, id) => {
        if (!currentScheduleMap.has(id)) {
          scheduleChanges.push({
            scheduleId: id,
            action: 'delete',
          });
        }
      });

      // Find added/updated schedules
      currentScheduleMap.forEach((schedule, id) => {
        const original = originalScheduleMap.get(id);
        if (!original) {
          // New schedule
          scheduleChanges.push({
            action: 'add',
            data: {
              milestoneName: schedule.milestoneName || '',
              dueDate: schedule.dueDate || '',
              notes: schedule.notes || '',
              status: schedule.status || 'Pending',
            },
          });
        } else {
          // Check if updated
          if (
            schedule.milestoneName !== original.milestoneName ||
            schedule.dueDate !== original.dueDate ||
            schedule.notes !== original.notes ||
            schedule.status !== original.status
          ) {
            scheduleChanges.push({
              scheduleId: id,
              action: 'update',
              data: {
                milestoneName: schedule.milestoneName || '',
                dueDate: schedule.dueDate || '',
                notes: schedule.notes || '',
                status: schedule.status || 'Pending',
              },
            });
          }
        }
      });

      // Compare team members
      const originalTeamMap = new Map(
        originalTeamMembers.map((t) => [t.teamId || t.id || '', t])
      );
      const currentTeamMap = new Map(
        teamMembers.map((t, idx) => [t.teamId || t.id || `new-${idx}`, t])
      );

      // Find deleted team members
      originalTeamMap.forEach((_member, id) => {
        if (!currentTeamMap.has(id)) {
          teamChanges.push({
            teamId: id,
            action: 'delete',
          });
        }
      });

      // Find added team members
      currentTeamMap.forEach((member, id) => {
        if (!originalTeamMap.has(id)) {
          teamChanges.push({
            action: 'add',
            data: {
              userId: member.userId || '',
              roleInTeam: member.roleInTeam || 'Auditor',
              isLead: member.isLead || false,
            },
          });
        }
      });

      await onSave({
        schedules: scheduleChanges,
        teamMembers: teamChanges,
      });

      onClose();
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Edit Schedule & Team</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={saving}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('schedules')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'schedules'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Schedules
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'team'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Team Members
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'schedules' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Audit Schedules</h3>
                <button
                  onClick={handleAddSchedule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Add Schedule
                </button>
              </div>

              {schedules.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No schedules added</p>
              ) : (
                <div className="space-y-4">
                  {schedules.map((schedule, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Milestone Name
                          </label>
                          <input
                            type="text"
                            value={schedule.milestoneName || ''}
                            onChange={(e) => handleUpdateSchedule(index, 'milestoneName', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Enter milestone name"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Due Date
                          </label>
                          <input
                            type="date"
                            value={schedule.dueDate ? schedule.dueDate.split('T')[0] : ''}
                            onChange={(e) => handleUpdateSchedule(index, 'dueDate', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                          </label>
                          <select
                            value={schedule.status || 'Pending'}
                            onChange={(e) => handleUpdateSchedule(index, 'status', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="Pending">Pending</option>
                            <option value="InProgress">In Progress</option>
                            <option value="Completed">Completed</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            onClick={() => handleDeleteSchedule(index)}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={schedule.notes || ''}
                          onChange={(e) => handleUpdateSchedule(index, 'notes', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          rows={2}
                          placeholder="Enter notes"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
                <button
                  onClick={handleAddTeamMember}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Add Member
                </button>
              </div>

              {teamMembers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No team members added</p>
              ) : (
                <div className="space-y-4">
                  {teamMembers.map((member, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Auditor
                          </label>
                          <select
                            value={member.userId || member.user?.userId || ''}
                            onChange={(e) => handleUpdateTeamMember(index, 'userId', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select auditor</option>
                            {auditorOptions.map((auditor) => (
                              <option key={auditor.userId || auditor.id} value={auditor.userId || auditor.id}>
                                {auditor.fullName || auditor.name} ({auditor.email})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Role
                          </label>
                          <select
                            value={member.roleInTeam || 'Auditor'}
                            onChange={(e) => handleUpdateTeamMember(index, 'roleInTeam', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="Auditor">Auditor</option>
                            <option value="LeadAuditor">Lead Auditor</option>
                            <option value="AuditeeOwner">Auditee Owner</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={member.isLead || false}
                            onChange={(e) => handleUpdateTeamMember(index, 'isLead', e.target.checked)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">Is Lead Auditor</span>
                        </label>
                        <button
                          onClick={() => handleDeleteTeamMember(index)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

