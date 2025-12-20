import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../layouts';
import { useAuth } from '../../contexts';
import { PageHeader } from '../../components';
import { getAuditAssignmentsByDepartment } from '../../api/auditAssignments';
import { getDepartmentById } from '../../api/departments';
import { unwrap } from '../../utils/normalize';
import { toast } from 'react-toastify';
import ScanQRContent from './ScanQRContent';

interface AuditAssignment {
  assignmentId: string;
  auditId: string;
  deptId: number;
  plannedStartDate?: string | null;
  plannedEndDate?: string | null;
  actualAuditDate?: string | null;
  auditTitle?: string;
  departmentName?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasAudit: boolean;
  audits: Array<{
    auditId: string;
    auditTitle: string;
    date: string;
    type: 'planned' | 'actual';
  }>;
}

const AuditScheduleCalendar = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<AuditAssignment[]>([]);
  const [department, setDepartment] = useState<{ deptId: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showScanQRModal, setShowScanQRModal] = useState(false);

  // Get department from user
  useEffect(() => {
    const loadDepartment = async () => {
      try {
        // Try to get department from user object
        if (user?.deptId) {
          const dept = await getDepartmentById(user.deptId);
          setDepartment({
            deptId: dept.deptId || user.deptId,
            name: dept.name || 'Department',
          });
          return;
        }

        // If no deptId in user, try to get from assignments
        // This is a fallback - ideally user should have deptId
        toast.warning('Department information not found. Please contact administrator.');
      } catch (error) {
        console.error('Failed to load department:', error);
        toast.error('Failed to load department information');
      }
    };

    loadDepartment();
  }, [user]);

  // Load assignments and schedules
  useEffect(() => {
    const loadData = async () => {
      if (!department?.deptId) return;

      setLoading(true);
      try {
        // Get assignments for this department
        const assignmentsResponse: any = await getAuditAssignmentsByDepartment(department.deptId);
        let assignmentsData: AuditAssignment[] = [];
        
        if (Array.isArray(assignmentsResponse)) {
          assignmentsData = assignmentsResponse;
        } else if (assignmentsResponse?.$values && Array.isArray(assignmentsResponse.$values)) {
          assignmentsData = assignmentsResponse.$values;
        } else if (assignmentsResponse?.data && Array.isArray(assignmentsResponse.data)) {
          assignmentsData = assignmentsResponse.data;
        } else {
          const unwrapped = unwrap<AuditAssignment>(assignmentsResponse);
          assignmentsData = Array.isArray(unwrapped) ? unwrapped : [];
        }

        setAssignments(assignmentsData);
      } catch (error) {
        console.error('Failed to load audit data:', error);
        toast.error('Failed to load audit schedule');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [department]);

  // Format date for Set
  const formatDateForSet = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Get calendar days with audit information
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay();
    
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Create map of dates to audits
    const dateToAuditsMap = new Map<string, Array<{
      auditId: string;
      auditTitle: string;
      date: string;
      type: 'planned' | 'actual';
    }>>();

    assignments.forEach((assignment) => {
      const auditTitle = assignment.auditTitle || 'Audit';
      
      // Add planned dates
      if (assignment.plannedStartDate && assignment.plannedEndDate) {
        let start = new Date(assignment.plannedStartDate);
        let end = new Date(assignment.plannedEndDate);
        
        if (end < start) {
          [start, end] = [end, start];
        }
        
        const current = new Date(start);
        current.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        
        while (current <= end) {
          const dateStr = formatDateForSet(current);
          if (!dateToAuditsMap.has(dateStr)) {
            dateToAuditsMap.set(dateStr, []);
          }
          dateToAuditsMap.get(dateStr)!.push({
            auditId: assignment.auditId,
            auditTitle,
            date: dateStr,
            type: 'planned',
          });
          current.setDate(current.getDate() + 1);
        }
      }

      // Add actual audit date
      if (assignment.actualAuditDate) {
        const actualDate = new Date(assignment.actualAuditDate);
        actualDate.setHours(0, 0, 0, 0);
        const dateStr = formatDateForSet(actualDate);
        if (!dateToAuditsMap.has(dateStr)) {
          dateToAuditsMap.set(dateStr, []);
        }
        dateToAuditsMap.get(dateStr)!.push({
          auditId: assignment.auditId,
          auditTitle,
          date: dateStr,
          type: 'actual',
        });
      }
    });

    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = formatDateForSet(date);
      const audits = dateToAuditsMap.get(dateStr) || [];
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        hasAudit: audits.length > 0,
        audits,
      });
    }
    
    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDateForSet(date);
      const audits = dateToAuditsMap.get(dateStr) || [];
      const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();
      
      days.push({
        date,
        isCurrentMonth: true,
        isToday,
        hasAudit: audits.length > 0,
        audits,
      });
    }
    
    // Next month days
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateStr = formatDateForSet(date);
      const audits = dateToAuditsMap.get(dateStr) || [];
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        hasAudit: audits.length > 0,
        audits,
      });
    }
    
    return days;
  }, [currentDate, assignments]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="px-4 sm:px-6">
          <PageHeader
            title="Audit Schedule"
            subtitle={department ? `Schedule for ${department.name}` : 'View scheduled audit dates'}
          />
        </div>

        {/* Scan QR Code Button */}
        <div className="px-4 sm:px-6">
          <button
            onClick={() => setShowScanQRModal(true)}
            className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Scan QR Code
          </button>
        </div>

        {/* Calendar */}
        <div className="px-4 sm:px-6">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading schedule...</span>
              </div>
            ) : (
              <>
                {/* Calendar Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </h2>
                    <button
                      onClick={goToToday}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Today
                    </button>
                  </div>
                  
                  <button
                    onClick={goToNextMonth}
                    className="p-2 hover:bg-gray-100 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mb-4 pb-3 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-500"></div>
                    <span className="text-sm text-gray-600">Planned Date</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-orange-500"></div>
                    <span className="text-sm text-gray-600">Actual Audit Date</span>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {/* Day headers */}
                  {dayNames.map((day) => (
                    <div
                      key={day}
                      className="text-center font-semibold text-gray-700 py-2 text-sm"
                    >
                      {day}
                    </div>
                  ))}

                  {/* Calendar days */}
                  {calendarDays.map((day, index) => {
                    const hasPlanned = day.audits.some(a => a.type === 'planned');
                    const hasActual = day.audits.some(a => a.type === 'actual');
                    
                    let bgColor = '';
                    let textColor = 'text-gray-700';
                    
                    if (!day.isCurrentMonth) {
                      textColor = 'text-gray-300';
                    } else if (hasActual) {
                      bgColor = 'bg-orange-500';
                      textColor = 'text-white font-semibold';
                    } else if (hasPlanned) {
                      bgColor = 'bg-blue-500';
                      textColor = 'text-white';
                    } else if (day.isToday) {
                      bgColor = 'bg-gray-100';
                      textColor = 'text-blue-600 font-semibold';
                    }

                    const tooltipText = day.audits.length > 0
                      ? day.audits.map(a => a.auditTitle).join(', ')
                      : formatDate(day.date);

                    return (
                      <div
                        key={index}
                        className={`
                          aspect-square p-1 rounded border transition-all relative group
                          ${day.isCurrentMonth ? 'border-gray-200' : 'border-transparent'}
                          ${day.isToday && !hasPlanned && !hasActual ? 'border-blue-500 border-2' : ''}
                          ${bgColor || 'hover:bg-gray-50'}
                          ${textColor}
                          flex flex-col items-center justify-center
                          ${day.hasAudit ? 'cursor-pointer' : ''}
                        `}
                        title={tooltipText}
                      >
                        <span className="text-sm font-medium">{day.date.getDate()}</span>
                        {day.hasAudit && (
                          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                            {day.audits.map((audit, idx) => (
                              <div
                                key={idx}
                                className={`w-1.5 h-1.5 rounded-full ${
                                  audit.type === 'actual' ? 'bg-orange-300' : 'bg-blue-300'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                        {/* Tooltip */}
                        {day.hasAudit && day.isCurrentMonth && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            {tooltipText}
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                              <div className="border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Scan QR Modal */}
      {showScanQRModal && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Scan QR Code</h2>
              <button
                onClick={() => setShowScanQRModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <ScanQRContent onClose={() => setShowScanQRModal(false)} />
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AuditScheduleCalendar;

