import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { getFindingsByAudit, type Finding } from '../../../api/findings';
import { getAuditPlanById } from '../../../api/audits';
import { getActionsByFinding } from '../../../api/actions';
import { toast } from 'react-toastify';
import { DataTable, type TableColumn } from '../../../components/DataTable';

const AuditDetail = () => {
  const { auditId } = useParams<{ auditId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'action' | 'rejectAction' | 'actionCompleted'>('action');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [auditDetails, setAuditDetails] = useState<any>(null);
  const [allActions, setAllActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingActions, setLoadingActions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (auditId) {
      loadFindings();
      loadAuditDetails();
    }
  }, [auditId]);

  useEffect(() => {
    if (findings.length > 0 && (activeTab === 'action' )) {
      loadAllActions();
    }
  }, [findings, activeTab]);

  const loadFindings = async () => {
    if (!auditId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getFindingsByAudit(auditId);
      setFindings(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load findings', err);
      setError(err?.message || 'Failed to load findings');
      toast.error('Failed to load findings: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const loadAuditDetails = async () => {
    if (!auditId) return;
    
    setLoadingDetails(true);
    try {
      const data = await getAuditPlanById(auditId);
      setAuditDetails(data);
    } catch (err: any) {
      console.error('Failed to load audit details', err);
      toast.error('Failed to load audit details: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadAllActions = async () => {
    if (!auditId || findings.length === 0) return;
    
    setLoadingActions(true);
    try {
      const actionsPromises = findings.map(async (finding) => {
        try {
          const actions = await getActionsByFinding(finding.findingId);
          return actions.map((action: any) => ({
            ...action,
            findingId: finding.findingId,
            findingTitle: finding.title,
          }));
        } catch (err) {
          console.error(`Failed to load actions for finding ${finding.findingId}`, err);
          return [];
        }
      });
      
      const actionsArrays = await Promise.all(actionsPromises);
      const flattened = actionsArrays.flat();
      setAllActions(flattened);
    } catch (err: any) {
      console.error('Failed to load actions', err);
      toast.error('Failed to load actions: ' + (err?.message || 'Unknown error'));
    } finally {
      setLoadingActions(false);
    }
  };

  // Filter actions based on active tab
  const filteredActions = useMemo(() => {
    if (activeTab === 'action') {
      // Show actions that are not rejected and not completed
      return allActions.filter(action => {
        const status = (action.status || '').toLowerCase();
        return status !== 'rejected' && status !== 'completed' && status !== 'closed';
      });
    }
    return [];
  }, [allActions, activeTab]);

  const formatDate = (dateString?: string) => {
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

  // Define columns for actions table
  const actionColumns: TableColumn<any>[] = useMemo(() => [
    {
      key: 'no',
      header: 'No.',
      cellClassName: 'whitespace-nowrap',
      align: 'center',
      render: (_, index) => (
        <span className="text-sm font-semibold text-primary-700">{index + 1}</span>
      ),
    },
    {
      key: 'finding',
      header: 'Non-compliance',
      render: (action) => (
        <div className="max-w-[300px]">
          <p className="text-sm font-semibold text-gray-900">{action.findingTitle || 'N/A'}</p>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Action Title',
      render: (action) => (
        <div className="max-w-[300px]">
          <p className="text-sm font-medium text-gray-900">{action.title || 'Untitled Action'}</p>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (action) => (
        <div className="max-w-[400px]">
          <p className="text-sm text-gray-700 line-clamp-2">
            {action.description || 'No description'}
          </p>
        </div>
      ),
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      cellClassName: 'whitespace-nowrap',
      render: (action) => (
        <p className="text-sm text-gray-900">{action.assignedTo || action.assignedUserName || 'N/A'}</p>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cellClassName: 'whitespace-nowrap',
      render: (action) => {
        const status = (action.status || '').toLowerCase();
        let colorClass = 'bg-gray-100 text-gray-800';
        if (status === 'completed' || status === 'closed') {
          colorClass = 'bg-green-100 text-green-800';
        } else if (status === 'rejected' || status === 'returned') {
          colorClass = 'bg-red-100 text-red-800';
        } else if (status === 'in progress' || status === 'in-progress') {
          colorClass = 'bg-yellow-100 text-yellow-800';
        }
        return (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
            {action.status || 'N/A'}
          </span>
        );
      },
    },
    {
      key: 'progress',
      header: 'Progress',
      cellClassName: 'whitespace-nowrap',
      render: (action) => {
        const progress = action.progressPercent || 0;
        return (
          <div className="w-32">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-600 mt-1">{progress}%</p>
          </div>
        );
      },
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      cellClassName: 'whitespace-nowrap',
      render: (action) => (
        <p className="text-sm text-gray-900">{action.dueDate ? formatDate(action.dueDate) : 'N/A'}</p>
      ),
    },
  ], []);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <button
              onClick={() => navigate('/lead-auditor/auditplanning')}
              className="text-primary-600 hover:text-primary-700 mb-2 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Audit Planning
            </button>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
              {loadingDetails ? 'Loading...' : auditDetails?.title || 'Audit Detail'}
            </h1>
            <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600">
              Review findings and actions for this audit
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('action')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'action'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Action
              </button>
              
            
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {loadingActions ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                  <p className="mt-4 text-gray-600">Loading actions...</p>
                </div>
              </div>
            ) : filteredActions.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-600 text-lg font-medium">No actions found</p>
                <p className="text-gray-500 text-sm mt-2">
                  {activeTab === 'action' && 'No active actions for this audit.'}
                  {activeTab === 'rejectAction' && 'No rejected actions for this audit.'}
                  {activeTab === 'actionCompleted' && 'No completed actions for this audit.'}
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <p className="text-sm text-gray-600">
                    Total {activeTab === 'action' ? 'active' : activeTab === 'rejectAction' ? 'rejected' : 'completed'} actions: 
                    <span className="font-semibold text-gray-900 ml-1">{filteredActions.length}</span>
                  </p>
                </div>
                <DataTable
                  columns={actionColumns}
                  data={filteredActions}
                  loading={false}
                  loadingMessage="Loading actions..."
                  emptyState="No actions found."
                  rowKey={(action, index) => action.actionId || index}
                  getRowClassName={() => 'transition-colors hover:bg-gray-50'}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AuditDetail;

