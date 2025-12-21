import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../layouts';
import { useAuth } from '../../contexts';
import { PageHeader } from '../../components';
import { getAuditAssignmentsByDepartmentPost } from '../../api/auditAssignments';
import { getDepartmentById } from '../../api/departments';
import { unwrap } from '../../utils/normalize';
import { toast } from 'react-toastify';
import { useDeptId } from '../../store/useAuthStore';
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
  auditorName?: string;
  status?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasAudit: boolean;
  audits: Array<{
    auditId: string;
    auditTitle: string;
    auditorName?: string;
    date: string;
    type: 'planned' | 'actual';
  }>;
}

const AuditScheduleCalendar = () => {
  const { user } = useAuth();
  const deptId = useDeptId();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<AuditAssignment[]>([]);
  const [department, setDepartment] = useState<{ deptId: number; name: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showScanQRModal, setShowScanQRModal] = useState(false);

  // Get department from deptId hook
  useEffect(() => {
    const loadDepartment = async () => {
      try {
        console.log('👤 User object:', user);
        console.log('📋 deptId from hook:', deptId);
        
        // Try to get department from deptId hook first
        if (deptId) {
          console.log('📋 Loading department with deptId:', deptId);
          const dept = await getDepartmentById(deptId);
          console.log('✅ Department loaded:', dept);
          setDepartment({
            deptId: dept.deptId || deptId,
            name: dept.name || 'Department',
          });
          return;
        }
        
        // Fallback: try to get department from user object
        if (user?.deptId) {
          console.log('📋 Loading department with user.deptId:', user.deptId);
          const dept = await getDepartmentById(user.deptId);
          console.log('✅ Department loaded:', dept);
          setDepartment({
            deptId: dept.deptId || user.deptId,
            name: dept.name || 'Department',
          });
          return;
        }

        // If no deptId found
        console.warn('⚠️ No deptId found in hook or user object');
        toast.warning('Department information not found. Please contact administrator.');
      } catch (error) {
        console.error('Failed to load department:', error);
        toast.error('Failed to load department information');
      }
    };

    loadDepartment();
  }, [deptId, user]);

  // Load assignments and schedules
  useEffect(() => {
    const loadData = async () => {
      if (!department?.deptId) return;

      setLoading(true);
      try {
        // Get assignments for this department using POST method
        const assignmentsResponse: any = await getAuditAssignmentsByDepartmentPost(department.deptId);
        console.log('📦 Raw API response:', assignmentsResponse);
        
        let assignmentsData: AuditAssignment[] = [];
        
        if (assignmentsResponse?.$values && Array.isArray(assignmentsResponse.$values)) {
          assignmentsData = assignmentsResponse.$values;
          console.log('✅ Found $values array:', assignmentsData.length, 'items');
        } else if (Array.isArray(assignmentsResponse)) {
          assignmentsData = assignmentsResponse;
          console.log('✅ Response is direct array:', assignmentsData.length, 'items');
        } else if (assignmentsResponse?.data) {
          const data = assignmentsResponse.data;
          if (data?.$values && Array.isArray(data.$values)) {
            assignmentsData = data.$values;
            console.log('✅ Found data.$values:', assignmentsData.length, 'items');
          } else if (Array.isArray(data)) {
            assignmentsData = data;
            console.log('✅ Found data array:', assignmentsData.length, 'items');
          }
        } else {
          const unwrapped = unwrap<AuditAssignment>(assignmentsResponse);
          assignmentsData = Array.isArray(unwrapped) ? unwrapped : [];
          console.log('✅ Used unwrap fallback:', assignmentsData.length, 'items');
        }

        console.log('📋 Parsed assignments:', assignmentsData);
        
        // Filter only assignments with status "Assigned"
        const assignedOnly = assignmentsData.filter(a => {
          const status = (a.status || '').trim();
          console.log('Checking assignment status:', status, '=== "Assigned"?', status === 'Assigned');
          return status === 'Assigned';
        });
        
        console.log('✅ Filtered Assigned assignments:', assignedOnly.length, 'items');
        console.log('📅 Assignments with dates:', assignedOnly.map(a => ({
          auditTitle: a.auditTitle,
          plannedStartDate: a.plannedStartDate,
          plannedEndDate: a.plannedEndDate,
          status: a.status
        })));
        
        setAssignments(assignedOnly);
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

    // Create map of dates to audits - only for Assigned status
    const dateToAuditsMap = new Map<string, Array<{
      auditId: string;
      auditTitle: string;
      auditorName?: string;
      date: string;
      type: 'planned' | 'actual';
    }>>();

    console.log('🗓️ Processing assignments for calendar:', assignments.length);
    
    assignments.forEach((assignment) => {
      // Only process assignments with status "Assigned"
      const status = (assignment.status || '').trim();
      if (status !== 'Assigned') {
        console.log('⏭️ Skipping assignment with status:', status);
        return;
      }
      
      const auditTitle = assignment.auditTitle || 'Audit';
      const auditorName = assignment.auditorName || 'Unknown Auditor';
      
      console.log('📅 Processing assignment:', {
        auditTitle,
        actualAuditDate: assignment.actualAuditDate
      });
      
      // Chỉ tô màu xanh cho ngày có actualAuditDate
      if (assignment.actualAuditDate) {
        let actualDate: Date;
        
        if (typeof assignment.actualAuditDate === 'string') {
          // Extract YYYY-MM-DD from ISO string (e.g., "2025-12-30T00:00:00" -> "2025-12-30")
          const dateMatch = assignment.actualAuditDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            actualDate = new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3]));
          } else {
            actualDate = new Date(assignment.actualAuditDate);
          }
        } else {
          actualDate = new Date(assignment.actualAuditDate);
        }
        
        actualDate.setHours(0, 0, 0, 0);
        const dateStr = formatDateForSet(actualDate);
        
        if (!dateToAuditsMap.has(dateStr)) {
          dateToAuditsMap.set(dateStr, []);
        }
        dateToAuditsMap.get(dateStr)!.push({
          auditId: assignment.auditId,
          auditTitle,
          auditorName,
          date: dateStr,
          type: 'planned', // Dùng type 'planned' để tô màu xanh
        });
        console.log('✅ Added actual audit date:', dateStr, 'for', auditTitle);
      } else {
        console.log('⚠️ Assignment missing actualAuditDate');
      }
    });

    console.log('🗓️ Date to audits map:', Array.from(dateToAuditsMap.entries()).map(([date, audits]) => ({
      date,
      count: audits.length,
      audits: audits.map(a => ({ title: a.auditTitle, auditor: a.auditorName }))
    })));

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
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-5 max-w-3xl mx-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading schedule...</span>
              </div>
            ) : (
              <>
                {/* Calendar Navigation */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    onClick={goToPreviousMonth}
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-semibold text-gray-800">
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
                    className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mb-3 pb-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded bg-blue-500"></div>
                    <span className="text-sm text-gray-600">Planned Date</span>
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
                    const dateStr = formatDateForSet(day.date);
                    const hasPlanned = day.audits.some(a => a.type === 'planned');
                    
                    // Debug for current month days with audits
                    if (day.isCurrentMonth && day.hasAudit) {
                      console.log(`📅 Day ${day.date.getDate()}/${day.date.getMonth() + 1}/${day.date.getFullYear()}:`, {
                        dateStr,
                        hasPlanned,
                        auditsCount: day.audits.length,
                        audits: day.audits.map(a => ({ title: a.auditTitle, auditor: a.auditorName, type: a.type }))
                      });
                    }
                    
                    let bgColor = '';
                    let textColor = 'text-gray-700';
                    
                    if (!day.isCurrentMonth) {
                      textColor = 'text-gray-300';
                    } else if (hasPlanned) {
                      // Tô màu xanh cho ngày có actualAuditDate
                      bgColor = 'bg-blue-500';
                      textColor = 'text-white';
                    } else if (day.isToday) {
                      bgColor = 'bg-gray-100';
                      textColor = 'text-blue-600 font-semibold';
                    }

                    // Build tooltip text with auditor name and audit title
                    let tooltipText = '';
                    if (day.audits.length > 0) {
                      const tooltipParts = day.audits.map(a => {
                        if (a.auditorName && a.auditTitle) {
                          return `${a.auditorName} - ${a.auditTitle}`;
                        } else if (a.auditTitle) {
                          return a.auditTitle;
                        }
                        return 'Audit';
                      });
                      tooltipText = tooltipParts.join('\n');
                    } else {
                      tooltipText = formatDate(day.date);
                    }

                    return (
                      <div
                        key={index}
                        className={`
                          min-h-[60px] p-2 rounded border transition-all relative group
                          ${day.isCurrentMonth ? 'border-gray-200' : 'border-transparent'}
                          ${day.isToday && !hasPlanned ? 'border-blue-500 border-2' : ''}
                          ${bgColor || 'hover:bg-gray-50'}
                          ${textColor}
                          flex flex-col items-center justify-center
                          ${day.hasAudit ? 'cursor-pointer' : ''}
                        `}
                        title={tooltipText}
                      >
                        <span className="text-base font-medium leading-tight">{day.date.getDate()}</span>
                        {day.hasAudit && (
                          <div className="absolute bottom-1.5 left-1/2 transform -translate-x-1/2 flex gap-1">
                            {day.audits.map((_, idx) => (
                              <div
                                key={idx}
                                className="w-2 h-2 rounded-full bg-blue-300"
                              />
                            ))}
                          </div>
                        )}
                        {/* Tooltip */}
                        {day.hasAudit && day.isCurrentMonth && (
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 min-w-[280px] max-w-sm">
                            <div className="space-y-2">
                              {day.audits.map((audit, idx) => (
                                <div key={idx} className={idx > 0 ? 'pt-2 border-t border-gray-700' : ''}>
                                  {audit.auditorName && (
                                    <div className="font-bold text-white text-base mb-1 flex items-center gap-2">
                                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                      </svg>
                                      {audit.auditorName}
                                    </div>
                                  )}
                                  <div className="text-gray-200 text-sm leading-relaxed flex items-start gap-2">
                                    <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span>{audit.auditTitle}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                              <div className="border-8 border-transparent border-t-gray-900"></div>
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

