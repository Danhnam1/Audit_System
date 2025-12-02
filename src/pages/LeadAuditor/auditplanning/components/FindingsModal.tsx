import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getFindingsByAudit, type Finding } from '../../../../api/findings';
import { getAuditPlanById } from '../../../../api/audits';
import { toast } from 'react-toastify';

interface FindingsModalProps {
  showModal: boolean;
  auditId: string | null;
  auditTitle?: string;
  onClose: () => void;
}

export const FindingsModal: React.FC<FindingsModalProps> = ({
  showModal,
  auditId,
  auditTitle,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'findings' | 'details' | 'actions' | string>('findings');
  const [findings, setFindings] = useState<Finding[]>([]);
  const [auditDetails, setAuditDetails] = useState<any>(null);
  const [allActions, setAllActions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingActions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (showModal && auditId) {
      loadFindings();
      if (activeTab === 'details') {
        loadAuditDetails();
      }
    } else {
      setFindings([]);
      setAuditDetails(null);
      setAllActions([]);
      setError(null);
    }
  }, [showModal, auditId, activeTab]);

  const loadFindings = async () => {
    if (!auditId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await getFindingsByAudit(auditId);
      console.log('loadFindings data222:', data);
      console.log('loadFindings data isArray222:', Array.isArray(data));
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
    if (!auditId || auditDetails) return;
    
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


  const getSeverityColor = (severity: string) => {
    const severityLower = severity?.toLowerCase() || '';
    if (severityLower.includes('high') || severityLower.includes('critical')) {
      return 'bg-red-100 text-red-800 border-red-300';
    }
    if (severityLower.includes('medium')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
    if (severityLower.includes('low') || severityLower.includes('minor')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'open' || statusLower === 'pending') {
      return 'bg-blue-100 text-blue-800';
    }
    if (statusLower === 'closed' || statusLower === 'resolved') {
      return 'bg-gray-100 text-gray-800';
    }
    if (statusLower === 'in progress' || statusLower === 'in-progress') {
      return 'bg-purple-100 text-purple-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  if (!showModal) return null;

  const modalContent = (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] overflow-hidden">
      <div className="h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-8 py-6 shadow-lg">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-white">Findings</h3>
                {auditTitle && (
                  <p className="text-sm text-white/90 mt-1">{auditTitle}</p>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all duration-200"
                title="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white">
            <div className="px-8">
              <nav className="flex space-x-8" aria-label="Tabs">
                <button
                  onClick={() => setActiveTab('findings')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'findings'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Findings
                </button>
                {/* <button
                  onClick={() => {
                    setActiveTab('details');
                    loadAuditDetails();
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'details'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Audit Details
                </button>
                <button
                  onClick={() => {
                    setActiveTab('actions');
                  }}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'actions'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Actions
                </button>
                <button
                  onClick={() => setActiveTab('summary')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === 'summary'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Summary
                </button> */}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-50 to-white">
            <div className="p-8">
              {activeTab === 'findings' && loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                    <p className="mt-4 text-gray-600">Loading findings...</p>
                  </div>
                </div>
              ) : activeTab === 'findings' && error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                  <p className="text-red-800 font-medium">{error}</p>
                  <button
                    onClick={loadFindings}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : activeTab === 'findings' && findings.length === 0 ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                  <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-gray-600 text-lg font-medium">No findings found</p>
                  <p className="text-gray-500 text-sm mt-2">This audit plan has no findings yet.</p>
                </div>
              ) : activeTab === 'findings' ? (
                <div className="space-y-4">
                  <div className="mb-6">
                    <p className="text-sm text-gray-600">
                      Total findings: <span className="font-semibold text-gray-900">{findings.length}</span>
                    </p>
                  </div>
                  
                  {findings.map((finding, index) => (
                    <div
                      key={finding.findingId || index}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-semibold text-gray-900">
                              {finding.title || `Finding #${index + 1}`}
                            </h4>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(finding.severity || '')}`}>
                              {finding.severity || 'N/A'}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(finding.status || '')}`}>
                              {finding.status || 'N/A'}
                            </span>
                          </div>
                          {finding.description && (
                            <p className="text-sm text-gray-700 leading-relaxed mb-4">
                              {finding.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                        <div>
                          <span className="text-xs font-semibold text-gray-500 uppercase">Created At</span>
                          <p className="text-sm text-gray-900 mt-1">
                            {formatDate(finding.createdAt)}
                          </p>
                        </div>
                        {finding.deadline && (
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Deadline</span>
                            <p className="text-sm text-gray-900 mt-1">
                              {formatDate(finding.deadline)}
                            </p>
                          </div>
                        )}
                        {finding.source && (
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Source</span>
                            <p className="text-sm text-gray-900 mt-1">
                              {finding.source}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : activeTab === 'details' ? (
                <div>
                  {loadingDetails ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                        <p className="mt-4 text-gray-600">Loading audit details...</p>
                      </div>
                    </div>
                  ) : auditDetails ? (
                    <div className="space-y-6">
                      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Title</span>
                            <p className="text-sm text-gray-900 mt-1">{auditDetails.title || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Type</span>
                            <p className="text-sm text-gray-900 mt-1">{auditDetails.type || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Scope</span>
                            <p className="text-sm text-gray-900 mt-1">{auditDetails.scope || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Status</span>
                            <p className="text-sm text-gray-900 mt-1">{auditDetails.status || 'N/A'}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">Start Date</span>
                            <p className="text-sm text-gray-900 mt-1">{formatDate(auditDetails.startDate)}</p>
                          </div>
                          <div>
                            <span className="text-xs font-semibold text-gray-500 uppercase">End Date</span>
                            <p className="text-sm text-gray-900 mt-1">{formatDate(auditDetails.endDate)}</p>
                          </div>
                        </div>
                        {auditDetails.objective && (
                          <div className="mt-4">
                            <span className="text-xs font-semibold text-gray-500 uppercase">Objective</span>
                            <p className="text-sm text-gray-900 mt-1">{auditDetails.objective}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                      <p className="text-gray-600 text-lg font-medium">No audit details found</p>
                    </div>
                  )}
                </div>
              ) : activeTab === 'actions' ? (
                <div>
                  {loadingActions ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                        <p className="mt-4 text-gray-600">Loading actions...</p>
                      </div>
                    </div>
                  ) : allActions.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
                      <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className="text-gray-600 text-lg font-medium">No actions found</p>
                      <p className="text-gray-500 text-sm mt-2">No actions have been created for the findings in this audit.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="mb-6">
                        <p className="text-sm text-gray-600">
                          Total actions: <span className="font-semibold text-gray-900">{allActions.length}</span>
                        </p>
                      </div>
                      
                      {allActions.map((action, index) => (
                        <div
                          key={action.actionId || index}
                          className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-lg font-semibold text-gray-900">
                                  {action.title || `Action #${index + 1}`}
                                </h4>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(action.status || '')}`}>
                                  {action.status || 'N/A'}
                                </span>
                              </div>
                              {action.findingTitle && (
                                <p className="text-xs text-gray-500 mb-2">
                                  Related Finding: <span className="font-medium">{action.findingTitle}</span>
                                </p>
                              )}
                              {action.description && (
                                <p className="text-sm text-gray-700 leading-relaxed mb-4">
                                  {action.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                            <div>
                              <span className="text-xs font-semibold text-gray-500 uppercase">Assigned To</span>
                              <p className="text-sm text-gray-900 mt-1">
                                {action.assignedTo || action.assignedUserName || 'N/A'}
                              </p>
                            </div>
                            {action.dueDate && (
                              <div>
                                <span className="text-xs font-semibold text-gray-500 uppercase">Due Date</span>
                                <p className="text-sm text-gray-900 mt-1">
                                  {formatDate(action.dueDate)}
                                </p>
                              </div>
                            )}
                            {action.createdAt && (
                              <div>
                                <span className="text-xs font-semibold text-gray-500 uppercase">Created At</span>
                                <p className="text-sm text-gray-900 mt-1">
                                  {formatDate(action.createdAt)}
                                </p>
                              </div>
                            )}
                            {action.progressPercent !== undefined && (
                              <div>
                                <span className="text-xs font-semibold text-gray-500 uppercase">Progress</span>
                                <div className="mt-1">
                                  <div className="w-full bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-primary-600 h-2 rounded-full"
                                      style={{ width: `${action.progressPercent || 0}%` }}
                                    ></div>
                                  </div>
                                  <p className="text-xs text-gray-600 mt-1">{action.progressPercent || 0}%</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'summary' ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Total Findings</p>
                          <p className="text-2xl font-bold text-gray-900 mt-2">{findings.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Total Actions</p>
                          <p className="text-2xl font-bold text-gray-900 mt-2">{allActions.length}</p>
                        </div>
                        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">Open Findings</p>
                          <p className="text-2xl font-bold text-gray-900 mt-2">
                            {findings.filter(f => (f.status || '').toLowerCase() === 'open' || (f.status || '').toLowerCase() === 'pending').length}
                          </p>
                        </div>
                        <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Findings by Severity</h4>
                    <div className="space-y-3">
                      {['High', 'Medium', 'Low'].map((severity) => {
                        const count = findings.filter(f => 
                          (f.severity || '').toLowerCase().includes(severity.toLowerCase())
                        ).length;
                        return (
                          <div key={severity} className="flex items-center justify-between">
                            <span className="text-sm text-gray-700">{severity}</span>
                            <div className="flex items-center gap-3">
                              <div className="w-32 bg-gray-200 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    severity === 'High' ? 'bg-red-500' :
                                    severity === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                  style={{ width: `${findings.length > 0 ? (count / findings.length) * 100 : 0}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-semibold text-gray-900 w-8 text-right">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-white px-8 py-5 border-t border-gray-200 shadow-lg">
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

