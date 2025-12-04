import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditTeam } from '../../../api/auditTeam';
import { getAuditSchedules } from '../../../api/auditSchedule';
import { getAuditPlanById } from '../../../api/audits';
import { DataTable, type TableColumn } from '../../../components/DataTable';
import { getStatusColor } from '../../../constants';
import { unwrap } from '../../../utils/normalize';

interface ScheduleItem {
  scheduleId: string;
  auditId: string;
  auditTitle: string;
  milestoneName: string;
  dueDate: string;
  status: string;
  notes?: string;
}

const AuditorSchedule = () => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  // Get current user ID
  const currentUserId = useMemo(() => {
    if (!user) return null;
    return (user as any)?.userId ?? (user as any)?.id ?? (user as any)?.$id ?? null;
  }, [user]);

  // Load schedules for all audit plans where auditor is assigned
  useEffect(() => {
    const loadSchedules = async () => {
      if (!currentUserId) return;

      setLoading(true);
      try {
        // Get all audit teams to find audits where current user is assigned
        const teams = await getAuditTeam();
        const teamsArray = Array.isArray(teams) ? teams : unwrap(teams) || [];

        // Filter teams where current user is a member
        const normalizedCurrentUserId = String(currentUserId).toLowerCase().trim();
        const myAuditIds = new Set<string>();

        teamsArray.forEach((team: any) => {
          const memberUserId = team?.userId ?? team?.id ?? team?.$id;
          if (!memberUserId) return;

          const memberNorm = String(memberUserId).toLowerCase().trim();
          if (memberNorm !== normalizedCurrentUserId) return;

          // Collect audit IDs from various possible fields
          const candidates = [team.auditId, team.auditPlanId, team.planId]
            .filter((v: any) => v != null)
            .map((v: any) => String(v).trim())
            .filter(Boolean);

          candidates.forEach((id) => {
            myAuditIds.add(id);
            myAuditIds.add(id.toLowerCase());
          });
        });

        if (myAuditIds.size === 0) {
          setSchedules([]);
          setLoading(false);
          return;
        }

        // Load schedules for each audit
        const allSchedules: ScheduleItem[] = [];

        for (const auditId of Array.from(myAuditIds)) {
          try {
            // Get audit plan details to get title
            let auditTitle = auditId;
            try {
              const auditPlan = await getAuditPlanById(auditId);
              auditTitle = auditPlan?.title || auditPlan?.audit?.title || auditId;
            } catch (err) {
              console.warn(`Failed to load audit plan ${auditId}:`, err);
            }

            // Get schedules for this audit
            const schedulesResponse = await getAuditSchedules(auditId);
            const schedulesArray = unwrap(schedulesResponse) || [];

            schedulesArray.forEach((schedule: any) => {
              allSchedules.push({
                scheduleId: schedule?.scheduleId || schedule?.id || `schedule_${auditId}_${allSchedules.length}`,
                auditId: auditId,
                auditTitle: auditTitle,
                milestoneName: schedule?.milestoneName || schedule?.milestone || 'N/A',
                dueDate: schedule?.dueDate || '',
                status: schedule?.status || 'Planned',
                notes: schedule?.notes || '',
              });
            });
          } catch (err) {
            console.warn(`Failed to load schedules for audit ${auditId}:`, err);
          }
        }

        // Sort by due date (earliest first)
        allSchedules.sort((a, b) => {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : 0;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : 0;
          return dateA - dateB;
        });

        setSchedules(allSchedules);
      } catch (error) {
        console.error('Failed to load schedules:', error);
        setSchedules([]);
      } finally {
        setLoading(false);
      }
    };

    loadSchedules();
  }, [currentUserId]);

  // Filter schedules based on search query
  const filteredSchedules = useMemo(() => {
    if (!query.trim()) return schedules;

    const lowerQuery = query.toLowerCase().trim();
    return schedules.filter(
      (schedule) =>
        schedule.auditTitle.toLowerCase().includes(lowerQuery) ||
        schedule.auditId.toLowerCase().includes(lowerQuery) ||
        schedule.milestoneName.toLowerCase().includes(lowerQuery) ||
        (schedule.notes && schedule.notes.toLowerCase().includes(lowerQuery))
    );
  }, [schedules, query]);

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Check if date is overdue
  const isOverdue = (dateString: string, status: string) => {
    if (!dateString || status === 'Completed') return false;
    try {
      const dueDate = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dueDate.setHours(0, 0, 0, 0);
      return dueDate < today;
    } catch {
      return false;
    }
  };

  const columns: TableColumn<ScheduleItem>[] = [
    {
      key: 'no',
      header: 'No.',
      cellClassName: 'whitespace-nowrap',
      render: (_, index) => (
        <span className="text-sm font-semibold text-primary-700">{index + 1}</span>
      ),
    },
    {
      key: 'auditTitle',
      header: 'Audit Plan',
      render: (row) => (
        <div className="max-w-[280px]">
          <p className="text-sm font-semibold text-gray-900">{row.auditTitle}</p>
          <p className="text-xs text-gray-500 mt-0.5">{row.auditId}</p>
        </div>
      ),
    },
    {
      key: 'milestoneName',
      header: 'Milestone',
      render: (row) => (
        <span className="px-2 py-0.5 text-xs rounded bg-primary-100 text-primary-700">
          {row.milestoneName}
        </span>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      cellClassName: 'whitespace-nowrap',
      render: (row) => {
        const overdue = isOverdue(row.dueDate, row.status);
        return (
          <div>
            <p className={`text-sm font-medium ${overdue ? 'text-red-600' : 'text-gray-900'}`}>
              {formatDate(row.dueDate)}
            </p>
            {overdue && (
              <p className="text-xs text-red-500 mt-0.5">Overdue</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      cellClassName: 'whitespace-nowrap',
      render: (row) => {
        const displayStatus = isOverdue(row.dueDate, row.status) ? 'Overdue' : row.status;
        return (
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(displayStatus)}`}
          >
            {displayStatus}
          </span>
        );
      },
      align: 'center',
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row) => (
        <p className="text-sm text-gray-600 max-w-[300px] truncate" title={row.notes || ''}>
          {row.notes || '-'}
        </p>
      ),
    },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header consistent with Reports / Audit Planning */}
        <div className="bg-white border-b border-primary-100 shadow-sm mb-2">
          <div className="px-6 py-4">
            <h1 className="text-2xl font-semibold text-primary-600">Audit Schedule</h1>
            <p className="text-gray-600 text-sm mt-1">
              View schedules and milestones for your assigned audit plans
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Search bar */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search by audit title, ID, milestone, or notes..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Table card */}
          <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
              <h2 className="text-lg font-semibold text-white">
                Schedules ({filteredSchedules.length})
              </h2>
            </div>
            <div className="p-4">
              <DataTable<ScheduleItem>
                columns={columns}
                data={filteredSchedules}
                loading={loading}
                loadingMessage="Loading schedules..."
                emptyState="No schedules found for your assigned audit plans."
                rowKey={(row) => row.scheduleId}
                getRowClassName={() => 'transition-colors hover:bg-gray-50'}
              />
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AuditorSchedule;

