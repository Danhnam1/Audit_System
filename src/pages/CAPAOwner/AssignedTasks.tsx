import { useState, useEffect } from 'react';
import { MainLayout } from '../../layouts';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { getMyAssignedActions } from '../../api/actions';
import { getFindingById } from '../../api/findings';
import FindingDetailModal from '../Auditor/FindingManagement/FindingDetailModal';
import CAPAOwnerActionDetailModal from './CAPAOwnerActionDetailModal';
import StartActionModal from './StartActionModal';

interface Task {
  actionId: string;
  findingId: string;
  title: string;
  description: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
  originalStatus: string; // Original status from API
  dueDate: string | null;
  assignedBy: string;
  createdAt: string;
  progressPercent: number;
  reviewFeedback?: string | null; // Review feedback from API
}

const AssignedTasks = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const auditIdFromState = (location.state as any)?.auditId || auditId || '';
  const auditTitle = (location.state as any)?.auditTitle || '';

  const [activeTab, setActiveTab] = useState<'action' | 'reject' | 'completed'>('action');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [showActionDetailModal, setShowActionDetailModal] = useState(false);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedStartActionId, setSelectedStartActionId] = useState<string | null>(null);
  const [showReviewFeedbackModal, setShowReviewFeedbackModal] = useState(false);
  const [selectedReviewFeedback, setSelectedReviewFeedback] = useState<string | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  
  // Search and filter states
  const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const defaultDate = tomorrow.toISOString().split('T')[0];

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState<string>(defaultDate);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const allActions = await getMyAssignedActions();
        console.log('📦 Raw Actions from API (check rootCauseId field):', JSON.stringify(allActions, null, 2));
        console.log('📊 Total actions received:', allActions.length);
        
        // Log each action with its details
        allActions.forEach((a: any, index: number) => {
          console.log(`Action ${index + 1}:`, {
            actionId: a.actionId,
            findingId: a.findingId,
            rootCauseId: a.rootCauseId,
            title: a.title,
            status: a.status,
            hasRootCauseId: 'rootCauseId' in a,
            rootCauseValue: a.rootCauseId
          });
        });
        
        // Filter actions by auditId if provided
        let actions = allActions;
        if (auditIdFromState) {
          console.log(`🔍 Filtering actions by auditId: ${auditIdFromState}`);
          
          // Get unique findingIds from actions
          const uniqueFindingIds = Array.from(new Set(allActions.map((a: any) => a.findingId).filter(Boolean)));
          console.log('📋 Unique findingIds found:', uniqueFindingIds);
          
          // Fetch findings to get auditIds
          const findingPromises = uniqueFindingIds.map(async (findingId: string) => {
            try {
              const finding = await getFindingById(findingId);
              return finding;
            } catch (err) {
              console.error(`❌ Error loading finding ${findingId}:`, err);
              return null;
            }
          });

          const findings = await Promise.all(findingPromises);
          const validFindings = findings.filter((f): f is any => f !== null);
          
          console.log('📋 Valid findings loaded:', validFindings.length);
          
          // Filter actions: only include those whose finding has matching auditId
          const findingIdsForAudit = validFindings
            .filter((f: any) => {
              // Handle nested audit structure (f.audit.auditId)
              const findingAuditId = f.auditId || 
                                    f.AuditId || 
                                    f.auditPlanId ||
                                    f.audit?.auditId ||
                                    f.audit?.AuditId;
              
              console.log(`🔍 Finding ${f.findingId} -> Audit ID: ${findingAuditId}, Looking for: ${auditIdFromState}`);
              
              return String(findingAuditId) === String(auditIdFromState);
            })
            .map((f: any) => f.findingId);
          
          console.log(`📌 Finding IDs for audit ${auditIdFromState}:`, findingIdsForAudit);
          
          // Filter actions before removing duplicates
          const filteredBeforeDedupe = allActions.filter((a: any) => findingIdsForAudit.includes(a.findingId));
          console.log(`✅ Actions after audit filter: ${filteredBeforeDedupe.length}`);
          
          // Log all actions before deduplication
          filteredBeforeDedupe.forEach((a: any, index: number) => {
            console.log(`  Action ${index + 1} before dedupe:`, {
              actionId: a.actionId,
              findingId: a.findingId,
              rootCauseId: a.rootCauseId,
              title: a.title
            });
          });
          
          // Remove duplicate actions by actionId (keeping unique actions)
          const uniqueActionIds = new Set<string>();
          actions = filteredBeforeDedupe.filter((a: any) => {
            if (uniqueActionIds.has(a.actionId)) {
              console.log(`🚫 Removing duplicate actionId: ${a.actionId} (rootCauseId: ${a.rootCauseId})`);
              return false;
            }
            uniqueActionIds.add(a.actionId);
            return true;
          });
          
          console.log(`✅ After removing duplicates: ${actions.length} unique actions`);
          
          // Log final actions
          actions.forEach((a: any, index: number) => {
            console.log(`  Final Action ${index + 1}:`, {
              actionId: a.actionId,
              findingId: a.findingId,
              rootCauseId: a.rootCauseId,
              title: a.title,
              status: a.status
            });
          });
        } else {
          console.log('⚠️ No auditId provided, showing all actions');
        }
        
        // Map API actions to Task interface
        const mappedTasks: Task[] = actions.map((action) => {
          console.log('Mapping action:', action.actionId, 'reviewFeedback:', action.reviewFeedback);
          // Determine UI status based on API status and due date
          let uiStatus: 'Pending' | 'In Progress' | 'Completed' | 'Overdue' = 'Pending';
          
          if (action.status === 'Closed' || action.closedAt) {
            uiStatus = 'Completed';
          } else if (action.progressPercent > 0) {
            uiStatus = 'In Progress';
          } else if (action.status === 'Approved' || action.status === 'Open') {
            // Check if overdue
            if (action.dueDate) {
              const dueDate = new Date(action.dueDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              if (dueDate < today) {
                uiStatus = 'Overdue';
              } else {
                uiStatus = action.progressPercent > 0 ? 'In Progress' : 'Pending';
              }
            } else {
              uiStatus = action.progressPercent > 0 ? 'In Progress' : 'Pending';
            }
          }
          
          return {
            actionId: action.actionId,
            findingId: action.findingId,
            title: action.title,
            description: action.description,
            status: uiStatus,
            originalStatus: action.status, // Keep original status from API
            dueDate: action.dueDate || null,
            assignedBy: action.assignedBy || '',
            createdAt: action.createdAt || '',
            progressPercent: action.progressPercent || 0,
            reviewFeedback: action.reviewFeedback, // Keep review feedback (can be string, null, or undefined)
          };
        });
        
        setTasks(mappedTasks);
      } catch (err: any) {
        console.error('Error fetching assigned tasks:', err);
        setError(err?.response?.data?.message || 'Failed to load assigned tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [auditIdFromState]);

  // Filter tasks based on active tab
  const filteredTasksByTab = activeTab === 'reject' 
    ? tasks.filter(task => {
        // Filter out actions with status "Archived"
        const statusLower = task.originalStatus?.toLowerCase() || '';
        if (statusLower === 'archived') return false;
        // Filter actions with status "Rejected"
        return statusLower === 'rejected';
      })
    : activeTab === 'completed'
    ? tasks.filter(task => {
        // Filter out actions with status "Archived"
        const statusLower = task.originalStatus?.toLowerCase() || '';
        if (statusLower === 'archived') return false;
        // Filter actions with status "Completed"
        return statusLower === 'completed';
      })
    : tasks.filter(task => {
        // Filter out actions with status "Archived"
        const statusLower = task.originalStatus?.toLowerCase() || '';
        if (statusLower === 'archived') return false;
        // For action tab, filter actions with status "Reviewed", "Approved", "Active", or "InProgress"
        return statusLower === 'reviewed' || statusLower === 'approved' || statusLower === 'active' || statusLower === 'inprogress';
      });

  // Apply search and date filters
  const filteredTasks = filteredTasksByTab.filter(task => {
    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        task.title?.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower) ||
        task.actionId?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }
    
    // Date range filter (filter by dueDate)
    if (dateFrom && task.dueDate) {
      const taskDate = new Date(task.dueDate);
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      taskDate.setHours(0, 0, 0, 0);
      if (taskDate < fromDate) return false;
    }
    
    if (dateTo && task.dueDate) {
      const taskDate = new Date(task.dueDate);
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (taskDate > toDate) return false;
    }
    
    return true;
  });

  // Sort tasks: Continue first, Start second, Completed last
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // Get priority: Continue = 1, Start = 2, Completed = 3
    const getPriority = (progress: number) => {
      if (progress > 0 && progress < 100) return 1; // Continue
      if (progress === 0) return 2; // Start
      return 3; // Completed (100%)
    };
    
    const priorityA = getPriority(a.progressPercent);
    const priorityB = getPriority(b.progressPercent);
    
    return priorityA - priorityB;
  });


  const getProgressColor = (percent: number) => {
    if (percent === 0) return 'bg-gray-300';
    if (percent <= 25) return 'bg-red-500';
    if (percent <= 50) return 'bg-yellow-500';
    if (percent <= 75) return 'bg-blue-500';
    return 'bg-green-500';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const handleViewDetail = (task: Task) => {
    setSelectedFindingId(task.findingId);
    setShowDetailModal(true);
  };

  const handleViewAction = (actionId: string) => {
    setSelectedActionId(actionId);
    setShowActionDetailModal(true);
    console.log('Opening action modal from AssignedTasks - ActionId:', actionId);
  };

  const handleStart = (actionId: string) => {
    setSelectedStartActionId(actionId);
    setShowStartModal(true);
  };

  const toggleFinding = (findingId: string) => {
    setExpandedFindings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(findingId)) {
        newSet.delete(findingId);
      } else {
        newSet.add(findingId);
      }
      return newSet;
    });
  };

  const handleStartSuccess = () => {
    // Reload tasks after successful start
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const allActions = await getMyAssignedActions();
        
        // Filter actions by auditId if provided
        let actions = allActions;
        if (auditIdFromState) {
          const uniqueFindingIds = Array.from(new Set(allActions.map((a: any) => a.findingId).filter(Boolean)));
          const findingPromises = uniqueFindingIds.map(async (findingId: string) => {
            try {
              const finding = await getFindingById(findingId);
              return finding;
            } catch (err) {
              return null;
            }
          });
          const findings = await Promise.all(findingPromises);
          const validFindings = findings.filter((f): f is any => f !== null);
          const findingIdsForAudit = validFindings
            .filter((f: any) => {
              // Handle nested audit structure (f.audit.auditId)
              const findingAuditId = f.auditId || 
                                    f.AuditId || 
                                    f.auditPlanId ||
                                    f.audit?.auditId ||
                                    f.audit?.AuditId;
              return String(findingAuditId) === String(auditIdFromState);
            })
            .map((f: any) => f.findingId);
          actions = allActions.filter((a: any) => findingIdsForAudit.includes(a.findingId));
          
          // Remove duplicate actions by actionId
          const uniqueActionIds = new Set<string>();
          actions = actions.filter((a: any) => {
            if (uniqueActionIds.has(a.actionId)) {
              return false;
            }
            uniqueActionIds.add(a.actionId);
            return true;
          });
        }
        
        const mappedTasks: Task[] = actions.map((action) => {
          let uiStatus: 'Pending' | 'In Progress' | 'Completed' | 'Overdue' = 'Pending';
          
          if (action.status === 'Closed' || action.closedAt) {
            uiStatus = 'Completed';
          } else if (action.progressPercent > 0) {
            uiStatus = 'In Progress';
          } else if (action.status === 'Approved' || action.status === 'Open') {
            if (action.dueDate) {
              const dueDate = new Date(action.dueDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              dueDate.setHours(0, 0, 0, 0);
              if (dueDate < today) {
                uiStatus = 'Overdue';
              } else {
                uiStatus = action.progressPercent > 0 ? 'In Progress' : 'Pending';
              }
            } else {
              uiStatus = action.progressPercent > 0 ? 'In Progress' : 'Pending';
            }
          }
          
          return {
            actionId: action.actionId,
            findingId: action.findingId,
            title: action.title,
            description: action.description,
            status: uiStatus,
            originalStatus: action.status, // Keep original status from API
            dueDate: action.dueDate || null,
            assignedBy: action.assignedBy || '',
            createdAt: action.createdAt || '',
            progressPercent: action.progressPercent || 0,
            reviewFeedback: action.reviewFeedback, // Keep review feedback (can be string, null, or undefined)
          };
        });
        
        setTasks(mappedTasks);
      } catch (err: any) {
        console.error('Error fetching assigned tasks:', err);
        setError(err?.response?.data?.message || 'Failed to load assigned tasks');
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            {auditIdFromState && (
              <button
                onClick={() => navigate('/capa-owner/tasks')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {auditTitle ? `${auditTitle} - Assigned Tasks` : 'Assigned Tasks'}
            </h1>
          </div>
          {auditTitle && (
            <p className="text-gray-600 text-sm ml-11">Tasks for this audit</p>
          )}
        </div>

        {/* Action Tab Container */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Tabs */}
          <div className="flex space-x-1 px-4 sm:px-6 border-b border-gray-200" role="tablist">
            <button
              onClick={() => setActiveTab('action')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'action'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              role="tab"
            >
              Action
            </button>
            <button
              onClick={() => setActiveTab('reject')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'reject'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              role="tab"
            >
              Reject Action
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              role="tab"
            >
              Action Completed
            </button>
          </div>

          {/* Action Tab Content */}
          {(activeTab === 'action' || activeTab === 'reject' || activeTab === 'completed') && (
            <div className="p-4 sm:p-6">
              {/* Search and Filter Bar */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Search Input */}
                  <div className="flex-1">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by title, description, or ID..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Date From */}
                  <div className="w-full sm:w-48">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="From Date"
                    />
                  </div>
                  
                  {/* Date To */}
                  <div className="w-full sm:w-48">
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      placeholder="To Date"
                    />
                  </div>
                  
                  {/* Clear Filters */}
                  {(searchTerm || dateFrom || dateTo) && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setDateFrom('');
                        setDateTo('');
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      Clear
                    </button>
                  )}
                </div>
                
                {/* Results Count */}
                <div className="text-sm text-gray-600">
                  Showing {sortedTasks.length} of {filteredTasksByTab.length} tasks
                </div>
              </div>

              {/* Loading State */}
              {loading && (
                <div className="p-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="text-gray-500 mt-2">Loading tasks...</p>
                </div>
              )}

              {/* Error State */}
              {error && !loading && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm sm:text-base">{error}</p>
                </div>
              )}

              {/* Tasks Grouped by Finding */}
              {!loading && !error && (
                <div className="space-y-4">
                  {sortedTasks.length === 0 ? (
                    <div className="p-6 sm:p-8 text-center">
                      <p className="text-gray-500 text-sm sm:text-base">No tasks found</p>
                    </div>
                  ) : (() => {
                    // Group tasks by findingId
                    const findingGroups = new Map<string, Task[]>();
                    sortedTasks.forEach(task => {
                      if (!findingGroups.has(task.findingId)) {
                        findingGroups.set(task.findingId, []);
                      }
                      findingGroups.get(task.findingId)!.push(task);
                    });
                    
                    return Array.from(findingGroups.entries()).map(([findingId, tasks]) => {
                      const isExpanded = expandedFindings.has(findingId);
                      const firstTask = tasks[0];
                      // Extract finding title from task title (remove user-specific suffix after ' - ')
                      const findingTitle = firstTask.title.split(' - ')[0];
                      
                      return (
                        <div key={findingId} className="border border-gray-200 rounded-lg overflow-hidden">
                          {/* Finding Header */}
                          <div
                            onClick={() => toggleFinding(findingId)}
                            className="bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <svg
                                  className={`w-5 h-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <div className="flex-1">
                                  <h3 className="text-sm font-semibold text-gray-900">{findingTitle}</h3>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} assigned                        </p>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Tasks List */}
                          {isExpanded && (
                            <div className="divide-y divide-gray-200">
                              {tasks.map((task, index) => (
                                <div key={task.actionId} className="bg-white hover:bg-gray-50 transition-colors">
                                  <div className="px-4 py-4">
                                    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                                      {/* Task Info */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start gap-3">
                                          <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                                            <span className="text-sm font-bold text-primary-700">#{index + 1}</span>
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-semibold text-gray-900 truncate">{task.title}</h4>
                                            {/* <p className="text-xs text-gray-500 mt-1">ID: {task.actionId}</p> */}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Due Date */}
                                      <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span>{formatDate(task.dueDate)}</span>
                                      </div>
                                      
                                      {/* Progress */}
                                      <div className="w-full lg:w-32">
                                        <div className="flex items-center gap-2">
                                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                                            <div
                                              className={`${getProgressColor(task.progressPercent)} h-2 rounded-full transition-all`}
                                              style={{ width: `${task.progressPercent}%` }}
                                            ></div>
                                          </div>
                                          <span className="text-xs font-medium text-gray-700 w-10 text-right">{task.progressPercent}%</span>
                                        </div>
                                      </div>
                                      
                                      {/* Actions */}
                                      <div className="flex items-center gap-2">
                                        {activeTab === 'reject' ? (
                                          <>
                                            <button
                                              onClick={() => {
                                                const feedback = task.reviewFeedback;
                                                setSelectedReviewFeedback(feedback && typeof feedback === 'string' && feedback.trim() !== '' ? feedback : 'No feedback available');
                                                setShowReviewFeedbackModal(true);
                                              }}
                                              className="p-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors"
                                              title="View Feedback"
                                            >
                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                              </svg>
                                            </button>
                                            <button
                                              onClick={() => handleStart(task.actionId)}
                                              className="px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs font-medium"
                                            >
                                              Retry
                                            </button>
                                          </>
                                        ) : task.progressPercent === 100 ? (
                                          <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-xs font-medium">
                                            Completed
                                          </span>
                                        ) : task.progressPercent > 0 ? (
                                          <button
                                            onClick={() => handleStart(task.actionId)}
                                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                                          >
                                            Continue
                                          </button>
                                        ) : (
                                          <button
                                            onClick={() => handleStart(task.actionId)}
                                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                                          >
                                            Start
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleViewDetail(task)}
                                          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                          title="View Finding"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                          </svg>
                                        </button>
                                        <button
                                          onClick={() => handleViewAction(task.actionId)}
                                          className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                          title="View Action"
                                        >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                          </svg>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Finding Detail Modal */}
        {selectedFindingId && (
          <FindingDetailModal
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedFindingId(null);
            }}
            findingId={selectedFindingId}
          />
        )}

        {/* Action Detail Modal */}
        {selectedActionId && (
          <CAPAOwnerActionDetailModal
            isOpen={showActionDetailModal}
            onClose={() => {
              setShowActionDetailModal(false);
              setSelectedActionId(null);
            }}
            actionId={selectedActionId}
          />
        )}

        {/* Start Action Modal */}
        {selectedStartActionId && (
          <StartActionModal
            isOpen={showStartModal}
            onClose={() => {
              setShowStartModal(false);
              setSelectedStartActionId(null);
            }}
            onSuccess={handleStartSuccess}
            actionId={selectedStartActionId}
          />
        )}

        {/* Review Feedback Modal */}
        {showReviewFeedbackModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => {
                setShowReviewFeedbackModal(false);
                setSelectedReviewFeedback(null);
              }}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
              <div
                className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">Review Feedback</h2>
                  <button
                    onClick={() => {
                      setShowReviewFeedbackModal(false);
                      setSelectedReviewFeedback(null);
                    }}
                    className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-6">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm sm:text-base text-gray-700 whitespace-pre-wrap break-words">
                      {selectedReviewFeedback || 'No feedback available'}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex justify-end">
                  <button
                    onClick={() => {
                      setShowReviewFeedbackModal(false);
                      setSelectedReviewFeedback(null);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AssignedTasks;
