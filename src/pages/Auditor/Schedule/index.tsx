import { useState, useEffect, useMemo } from 'react';
import { MainLayout } from '../../../layouts';
import { getMyAssignments, updateActualAuditDate, rejectAssignment } from '../../../api/auditAssignments';
import { unwrap } from '../../../utils/normalize';
import { toast } from 'react-toastify';

interface Assignment {
  assignmentId: string;
  auditId: string;
  deptId: number;
  auditorId: string;
  notes?: string;
  assignedAt: string;
  status: string;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  estimatedDuration: number | null;
  actualAuditDate: string | null;
  reasonReject?: string | null;
  auditTitle: string;
  departmentName: string;
  auditorName: string;
}

const AuditorSchedule = () => {
  console.log('AuditorSchedule component rendering');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Helper function to format date for Set
  const formatDateForSet = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Load assignments
  useEffect(() => {
    const loadAssignments = async () => {
      setLoading(true);
      try {
        const response = await getMyAssignments();
        console.log('Schedule API response:', response);
        
        // Handle $values structure
        let assignmentsData: Assignment[] = [];
        if (response?.$values && Array.isArray(response.$values)) {
          assignmentsData = response.$values;
        } else if (Array.isArray(response)) {
          assignmentsData = response;
        } else {
          // Try unwrap if it's wrapped
          const unwrapped = unwrap<Assignment>(response);
          assignmentsData = Array.isArray(unwrapped) ? unwrapped : [];
        }
        
        console.log('Parsed assignments:', assignmentsData);
        setAssignments(assignmentsData);
      } catch (error) {
        console.error('Failed to load assignments:', error);
        setAssignments([]);
      } finally {
        setLoading(false);
      }
    };

    loadAssignments();
  }, []);

  // Get all dates that should be highlighted and map dates to assignments
  const highlightedDates = useMemo(() => {
    const plannedDates = new Set<string>(); // Blue dates (planned range)
    const actualDates = new Set<string>(); // Orange dates (actual audit dates)
    const dateToAssignmentMap = new Map<string, Assignment>(); // Map date string to assignment

    assignments.forEach((assignment) => {
      // Only add planned dates if status is "Assigned" and no actualAuditDate yet
      if (assignment.status === 'Assigned' && !assignment.actualAuditDate && assignment.plannedStartDate && assignment.plannedEndDate) {
        let start = new Date(assignment.plannedStartDate);
        let end = new Date(assignment.plannedEndDate);
        
        // Handle case where end date is before start date (swap them)
        if (end < start) {
          [start, end] = [end, start];
        }
        
        const current = new Date(start);
        // Set time to 00:00:00 to avoid timezone issues
        current.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999); // Include the end date
        
        while (current <= end) {
          const dateStr = formatDateForSet(current);
          plannedDates.add(dateStr);
          // Map this date to the assignment
          dateToAssignmentMap.set(dateStr, assignment);
          current.setDate(current.getDate() + 1);
        }
      }

      // Add actual audit date (orange)
      if (assignment.actualAuditDate) {
        const actualDate = new Date(assignment.actualAuditDate);
        actualDate.setHours(0, 0, 0, 0);
        const dateStr = formatDateForSet(actualDate);
        actualDates.add(dateStr);
      }
    });

    console.log('Highlighted dates:', { 
      plannedDates: Array.from(plannedDates), 
      actualDates: Array.from(actualDates) 
    });

    return { plannedDates, actualDates, dateToAssignmentMap };
  }, [assignments]);

  // Get assignments with status "Assigned" for sidebar (exclude those with actualAuditDate)
  const assignedSchedules = useMemo(() => {
    return assignments.filter(a => 
      a.status === 'Assigned' && 
      a.plannedStartDate && 
      a.plannedEndDate && 
      !a.actualAuditDate
    );
  }, [assignments]);

  // Get calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    // Day of week for first day (0 = Sunday, 6 = Saturday)
    const startDayOfWeek = firstDay.getDay();
    
    // Get days from previous month to fill the first week
    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      isPlanned: boolean;
      isActual: boolean;
    }> = [];
    
    // Previous month days
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      const dateStr = formatDateForSet(date);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isPlanned: highlightedDates.plannedDates.has(dateStr),
        isActual: highlightedDates.actualDates.has(dateStr),
      });
    }
    
    // Current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = formatDateForSet(date);
      const today = new Date();
      const isToday =
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate();
      
      days.push({
        date,
        isCurrentMonth: true,
        isToday,
        isPlanned: highlightedDates.plannedDates.has(dateStr),
        isActual: highlightedDates.actualDates.has(dateStr),
      });
    }
    
    // Next month days to fill the last week
    const remainingDays = 42 - days.length; // 6 weeks * 7 days
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      const dateStr = formatDateForSet(date);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        isPlanned: highlightedDates.plannedDates.has(dateStr),
        isActual: highlightedDates.actualDates.has(dateStr),
      });
    }
    
    return days;
  }, [currentDate, highlightedDates]);

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

  const formatDateShort = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Handle click on planned date (blue dates)
  const handleDateClick = (date: Date, dateStr: string) => {
    const assignment = highlightedDates.dateToAssignmentMap.get(dateStr);
    if (assignment && !assignment.actualAuditDate && assignment.status === 'Assigned') {
      setSelectedDate(date);
      setSelectedAssignment(assignment);
      setShowConfirmModal(true);
    }
  };

  // Handle confirm actual audit date
  const handleConfirmActualDate = async () => {
    if (!selectedAssignment || !selectedDate) return;

    setSubmitting(true);
    try {
      const dateStr = formatDateForSet(selectedDate);
      await updateActualAuditDate(selectedAssignment.assignmentId, dateStr);
      toast.success('Actual audit date updated successfully!');
      setShowConfirmModal(false);
      setSelectedDate(null);
      setSelectedAssignment(null);
      
      // Reload assignments
      const response = await getMyAssignments();
      let assignmentsData: Assignment[] = [];
      if (response?.$values && Array.isArray(response.$values)) {
        assignmentsData = response.$values;
      } else if (Array.isArray(response)) {
        assignmentsData = response;
      } else {
        const unwrapped = unwrap<Assignment>(response);
        assignmentsData = Array.isArray(unwrapped) ? unwrapped : [];
      }
      setAssignments(assignmentsData);
    } catch (error: any) {
      console.error('Failed to update actual audit date:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to update actual audit date');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle reject assignment
  const handleRejectAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // Handle confirm reject
  const handleConfirmReject = async () => {
    if (!selectedAssignment || !rejectReason.trim()) {
      toast.error('Please enter a reason for rejection');
      return;
    }

    setSubmitting(true);
    try {
      await rejectAssignment(selectedAssignment.assignmentId, rejectReason.trim());
      toast.success('Assignment rejected successfully!');
      setShowRejectModal(false);
      setSelectedAssignment(null);
      setRejectReason('');
      
      // Reload assignments
      const response = await getMyAssignments();
      let assignmentsData: Assignment[] = [];
      if (response?.$values && Array.isArray(response.$values)) {
        assignmentsData = response.$values;
      } else if (Array.isArray(response)) {
        assignmentsData = response;
      } else {
        const unwrapped = unwrap<Assignment>(response);
        assignmentsData = Array.isArray(unwrapped) ? unwrapped : [];
      }
      setAssignments(assignmentsData);
    } catch (error: any) {
      console.error('Failed to reject assignment:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to reject assignment');
    } finally {
      setSubmitting(false);
    }
  };

  console.log('AuditorSchedule render - assignments:', assignments.length, 'loading:', loading);
  
  // Early return for debugging - remove after fixing
  if (typeof window !== 'undefined') {
    console.log('Component is rendering in browser');
  }
  
  return (
    <MainLayout>
      <div className="space-y-6 bg-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl shadow-lg p-6 text-white">
          <h1 className="text-3xl font-bold mb-2">Audit Schedule</h1>
          <p className="text-blue-100">View your assigned audit schedules and dates</p>
        </div>

        {/* Main Content - Sidebar + Calendar */}
        <div className="flex gap-6">
          {/* Left Sidebar - Assignments List */}
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Assigned Schedules</h3>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              ) : assignedSchedules.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No assigned schedules</p>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-250px)] overflow-y-auto">
                  {assignedSchedules.map((assignment) => (
                    <div
                      key={assignment.assignmentId}
                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-gray-900 text-sm mb-1 truncate">
                            {assignment.auditTitle}
                          </h4>
                          <p className="text-xs text-gray-600">
                            {formatDateShort(assignment.plannedStartDate)} - {formatDateShort(assignment.plannedEndDate)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">{assignment.departmentName}</p>
                        </div>
                        <button
                          onClick={() => handleRejectAssignment(assignment)}
                          className="flex-shrink-0 px-2 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Calendar */}
          <div className="flex-1 flex justify-center">
            {/* Calendar Navigation */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 p-3 max-w-2xl w-full">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-800">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>
              <button
                onClick={goToToday}
                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium"
              >
                Today
              </button>
            </div>
            
            <button
              onClick={goToNextMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 mb-3 pb-2 border-b border-gray-200">
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-blue-500"></div>
              <span className="text-xs text-gray-600">Planned</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded bg-orange-500"></div>
              <span className="text-xs text-gray-600">Actual</span>
            </div>
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading schedule...</span>
            </div>
          ) : calendarDays.length > 0 ? (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1.5">
                {dayNames.map((day) => (
                  <div
                    key={day}
                    className="text-center font-medium text-gray-600 py-0.5 text-xs"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const dateStr = formatDateForSet(day.date);
                  const isPlanned = highlightedDates.plannedDates.has(dateStr);
                  const isActual = highlightedDates.actualDates.has(dateStr);
                  
                  let bgColor = '';
                  let textColor = 'text-gray-700';
                  
                  if (!day.isCurrentMonth) {
                    textColor = 'text-gray-300';
                  } else if (isActual) {
                    // Actual date takes priority (orange)
                    bgColor = 'bg-orange-500';
                    textColor = 'text-white font-semibold';
                  } else if (isPlanned) {
                    // Planned date range (blue)
                    bgColor = 'bg-blue-500';
                    textColor = 'text-white';
                  } else if (day.isToday) {
                    bgColor = 'bg-gray-100';
                    textColor = 'text-blue-600 font-semibold';
                  }

                  // Check if this date can be clicked (planned date without actual date, status = Assigned)
                  const canClick = isPlanned && !isActual && day.isCurrentMonth && highlightedDates.dateToAssignmentMap.has(dateStr);

                  return (
                    <div
                      key={index}
                      onClick={() => canClick && handleDateClick(day.date, dateStr)}
                      className={`
                        aspect-square p-0.5 rounded border transition-all
                        ${day.isCurrentMonth ? 'border-gray-200' : 'border-transparent'}
                        ${day.isToday && !isPlanned && !isActual ? 'border-blue-500 border-2' : ''}
                        ${bgColor || 'hover:bg-gray-50'}
                        ${textColor}
                        ${canClick ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : day.isCurrentMonth ? 'cursor-default' : 'cursor-default'}
                        flex flex-col items-center justify-center
                      `}
                      title={day.isCurrentMonth ? formatDate(day.date) : ''}
                    >
                      <span className="text-xs font-medium leading-tight">{day.date.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-500">No calendar data available</p>
            </div>
          )}
        </div>
          </div>
        </div>
      </div>

      {/* Confirm Actual Audit Date Modal */}
      {showConfirmModal && selectedDate && selectedAssignment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              if (!submitting) {
                setShowConfirmModal(false);
                setSelectedDate(null);
                setSelectedAssignment(null);
              }
            }}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Actual Audit Date
                </h3>
                <button
                  onClick={() => {
                    if (!submitting) {
                      setShowConfirmModal(false);
                      setSelectedDate(null);
                      setSelectedAssignment(null);
                    }
                  }}
                  disabled={submitting}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Assignment Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Audit
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {selectedAssignment.auditTitle}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Department
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {selectedAssignment.departmentName}
                  </p>
                </div>

                {/* Selected Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Selected Date
                  </label>
                  <p className="text-sm text-gray-900 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200 font-medium">
                    {formatDate(selectedDate)}
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    Are you sure you want to set <strong>{formatDate(selectedDate)}</strong> as the actual audit date for this assignment?
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    if (!submitting) {
                      setShowConfirmModal(false);
                      setSelectedDate(null);
                      setSelectedAssignment(null);
                    }
                  }}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmActualDate}
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Updating...
                    </>
                  ) : (
                    'Confirm'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Assignment Modal */}
      {showRejectModal && selectedAssignment && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              if (!submitting) {
                setShowRejectModal(false);
                setSelectedAssignment(null);
                setRejectReason('');
              }
            }}
          />
          
          {/* Modal */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Reject Assignment
                </h3>
                <button
                  onClick={() => {
                    if (!submitting) {
                      setShowRejectModal(false);
                      setSelectedAssignment(null);
                      setRejectReason('');
                    }
                  }}
                  disabled={submitting}
                  className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Assignment Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Audit
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {selectedAssignment.auditTitle}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Schedule
                  </label>
                  <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                    {formatDateShort(selectedAssignment.plannedStartDate)} - {formatDateShort(selectedAssignment.plannedEndDate)}
                  </p>
                </div>

                {/* Reject Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Please provide a reason for rejecting this assignment..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                    disabled={submitting}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    if (!submitting) {
                      setShowRejectModal(false);
                      setSelectedAssignment(null);
                      setRejectReason('');
                    }
                  }}
                  disabled={submitting}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={submitting || !rejectReason.trim()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Rejecting...
                    </>
                  ) : (
                    'Reject'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AuditorSchedule;
