import { useState, useEffect } from 'react';
import { getFindingById, type Finding, witnessConfirmFinding, witnessDisagreeFinding } from '../../api/findings';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById } from '../../api/adminUsers';
import { getDepartmentById } from '../../api/departments';
import { getSeverityColor } from '../../constants/statusColors';
import { toast } from 'react-toastify';
import { getUserFriendlyErrorMessage } from '../../utils/errorMessages';
import { getRootCauseLogs } from '../../api/rootCauses';
import { getActionsByRootCause, type Action } from '../../api/actions';
import { apiClient } from '../../hooks/axios';

interface WitnessedFindingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  findingId: string;
}

const WitnessedFindingDetailModal = ({ isOpen, onClose, findingId }: WitnessedFindingDetailModalProps) => {
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [witnessName, setWitnessName] = useState<string>('');
  const [departmentName, setDepartmentName] = useState<string>('');
  const [createdByName, setCreatedByName] = useState<string>('');
  const [descriptionHeight, setDescriptionHeight] = useState<number>(120);
  
  // Root causes and actions state
  const [rootCauses, setRootCauses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'rootcauses'>('details');
  
  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  useEffect(() => {
    if (isOpen && findingId) {
      console.log('[WitnessedFindingDetailModal] 🚀 Modal opened with findingId:', findingId);
      loadFinding();
      loadAttachments();
      loadRootCauses();
    } else {
      console.log('[WitnessedFindingDetailModal] ⏸️ Modal closed or no findingId');
    }
  }, [isOpen, findingId]);

  // Auto-adjust textarea height based on content
  useEffect(() => {
    if (finding?.description) {
      const textarea = document.getElementById('finding-description-textarea');
      if (textarea) {
        // Reset height to calculate scrollHeight
        textarea.style.height = 'auto';
        const scrollHeight = textarea.scrollHeight;
        // Set height with min and max constraints
        const newHeight = Math.min(Math.max(scrollHeight, 120), 300);
        setDescriptionHeight(newHeight);
        textarea.style.height = `${newHeight}px`;
      }
    }
  }, [finding?.description]);

  const loadFinding = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFindingById(findingId);
      setFinding(data);
      
      // Fetch witness name
      if (data?.witnessId) {
        try {
          const witnessUser = await getUserById(data.witnessId);
          setWitnessName(witnessUser?.fullName || '');
        } catch (err) {
          console.error('Error loading witness:', err);
          setWitnessName('Unknown');
        }
      }
      
      // Fetch createdBy user details
      if (data?.createdBy) {
        try {
          const createdByUser = await getUserById(data.createdBy);
          setCreatedByName(createdByUser?.fullName || '');
        } catch (err) {
          console.error('Error loading created by user:', err);
          setCreatedByName('Unknown');
        }
      }
      
      // Fetch department name
      if (data?.deptId) {
        try {
          const dept = await getDepartmentById(data.deptId);
          setDepartmentName(dept?.name || '');
        } catch (err) {
          console.error('Error loading department:', err);
          setDepartmentName('Unknown');
        }
      }
    } catch (err: any) {
      console.error('Error loading finding:', err);
      setError(err?.message || 'Failed to load finding details');
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async () => {
    setLoadingAttachments(true);
    try {
      const data = await getAttachments('finding', findingId);
      // Filter out inactive attachments
      const activeAttachments = (data || []).filter(att => (att.status || '').toLowerCase() !== 'inactive');
      setAttachments(activeAttachments);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const loadRootCauses = async () => {
    console.log('[WitnessedFindingDetailModal] 🔍 Loading root causes for finding:', findingId);
    try {
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}?_t=${Date.now()}`);
      console.log('[WitnessedFindingDetailModal] 📦 API Response:', res);
      
      // API client returns data directly (not in res.data)
      const responseData = res.data || res;
      console.log('[WitnessedFindingDetailModal] 📦 Response data:', responseData);
      
      // Try multiple ways to extract the array
      let rootCausesList: any[] = [];
      try {
        if (Array.isArray(responseData)) {
          console.log('[WitnessedFindingDetailModal] 🔍 Format: Array');
          rootCausesList = responseData;
        } else if (responseData?.$values && Array.isArray(responseData.$values)) {
          console.log('[WitnessedFindingDetailModal] 🔍 Format: $values');
          rootCausesList = responseData.$values;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          console.log('[WitnessedFindingDetailModal] 🔍 Format: data');
          rootCausesList = responseData.data;
        } else if (responseData?.value && Array.isArray(responseData.value)) {
          console.log('[WitnessedFindingDetailModal] 🔍 Format: value');
          rootCausesList = responseData.value;
        } else {
          console.warn('[WitnessedFindingDetailModal] ⚠️ Unknown response format:', responseData);
        }
      } catch (parseErr) {
        console.error('[WitnessedFindingDetailModal] ❌ Error parsing response:', parseErr);
      }
      
      console.log('[WitnessedFindingDetailModal] 📋 Root causes list:', rootCausesList);
      console.log('[WitnessedFindingDetailModal] 📊 Root causes count:', rootCausesList.length);
      
      if (!Array.isArray(rootCausesList) || rootCausesList.length === 0) {
        console.log('[WitnessedFindingDetailModal] ⚠️ No root causes found for this finding');
        setRootCauses([]);
        return;
      }
      
      console.log('[WitnessedFindingDetailModal] 🔄 Starting to process root causes...');
      
      // Fetch history and actions for each root cause
      const rootCausesWithHistory = await Promise.all(
        rootCausesList.map(async (rc: any, index: number) => {
          console.log(`[WitnessedFindingDetailModal] 🔄 Processing root cause ${index + 1}/${rootCausesList.length}:`, rc);
          try {
            console.log(`[WitnessedFindingDetailModal] 📜 Fetching logs for ${rc.rootCauseId}...`);
            const logs = await getRootCauseLogs(rc.rootCauseId);
            console.log(`[WitnessedFindingDetailModal] ✅ Logs loaded for ${rc.rootCauseId}:`, logs.length);
            
            // Fetch actions (remediation proposals) for this root cause
            let actions: Action[] = [];
            try {
              console.log(`[WitnessedFindingDetailModal] 🎯 Fetching actions for ${rc.rootCauseId}...`);
              actions = await getActionsByRootCause(rc.rootCauseId);
              console.log(`[WitnessedFindingDetailModal] ✅ Actions loaded for ${rc.rootCauseId}:`, actions.length);
            } catch (actionErr) {
              console.error('[WitnessedFindingDetailModal] ❌ Error loading actions:', rc.rootCauseId, actionErr);
            }
            return { ...rc, history: logs, actions: actions };
          } catch (err) {
            console.error('[WitnessedFindingDetailModal] ❌ Error loading history for root cause:', rc.rootCauseId, err);
            return { ...rc, history: [], actions: [] };
          }
        })
      );
      
      console.log('[WitnessedFindingDetailModal] 🎉 Final root causes with history:', rootCausesWithHistory);
      console.log('[WitnessedFindingDetailModal] 💾 Setting state with', rootCausesWithHistory.length, 'root causes');
      setRootCauses(rootCausesWithHistory);
      console.log('[WitnessedFindingDetailModal] ✅ State updated successfully');
    } catch (err: any) {
      console.error('[WitnessedFindingDetailModal] ❌ Error loading root causes:', err);
      console.error('[WitnessedFindingDetailModal] ❌ Error details:', err?.response?.data || err?.message);
      console.error('[WitnessedFindingDetailModal] ❌ Stack trace:', err?.stack);
      setRootCauses([]);
    }
  };

  const handleDownload = (attachment: Attachment) => {
    const downloadUrl = attachment.filePath || attachment.blobPath;
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const handleApprove = async () => {
    if (!finding) return;
    
    try {
      await witnessConfirmFinding(finding.findingId);
      toast.success('Finding confirmed successfully!');
      
      // Reload finding to get updated status
      await loadFinding();
    } catch (err: any) {
      console.error('Error confirming witness:', err);
      toast.error(err?.message || 'Failed to confirm finding');
    }
  };

  const handleRejectClick = () => {
    setShowRejectModal(true);
  };

  const handleRejectConfirm = async () => {
    if (!finding) return;
    
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }

    setSubmittingReject(true);
    try {
      await witnessDisagreeFinding(finding.findingId, rejectReason.trim());
      toast.success('Finding rejected successfully. Auditor will be notified.');
      
      // Close modal and reload finding
      setShowRejectModal(false);
      setRejectReason('');
      await loadFinding();
    } catch (err: any) {
      console.error('Error rejecting witness:', err);
      toast.error(getUserFriendlyErrorMessage(err, 'Failed to reject finding. Please try again.'));
    } finally {
      setSubmittingReject(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-xl font-semibold text-white">Finding Details (Witness View)</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
              {error}
            </div>
          ) : finding ? (
            <div className="space-y-6">
              {/* Tabs */}
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px space-x-8">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'details'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Finding Details
                  </button>
                  <button
                    onClick={() => setActiveTab('rootcauses')}
                    className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'rootcauses'
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Root Causes & Actions
                    {rootCauses.length > 0 && (
                      <span className="ml-2 px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-600 rounded-full">
                        {rootCauses.length}
                      </span>
                    )}
                  </button>
                </nav>
              </div>

              {/* Tab Content */}
              {activeTab === 'details' ? (
                <>
              {/* Finding Info */}
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(finding.severity)}`}>
                        {finding.severity}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        finding.status === 'Open' ? 'bg-blue-100 text-blue-700' :
                        finding.status === 'Received' ? 'bg-yellow-100 text-yellow-700' :
                        finding.status === 'Closed' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {finding.status}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{finding.title}</h3>
                    <div className="mt-3">
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Description</label>
                      <div className="border border-gray-300 rounded-lg bg-gray-50 overflow-hidden">
                        <textarea
                          id="finding-description-textarea"
                          readOnly
                          value={finding.description || ''}
                          className="w-full p-3 bg-transparent text-gray-700 resize-none focus:outline-none border-0"
                          style={{ 
                            minHeight: '120px', 
                            maxHeight: '300px', 
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            display: 'block',
                            width: '100%',
                            height: `${descriptionHeight}px`
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meta Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Department</label>
                    <p className="text-gray-900 font-medium">{departmentName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created By</label>
                    <p className="text-gray-900 font-medium">{createdByName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Witness</label>
                    <p className="text-gray-900 font-medium">{witnessName || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Deadline</label>
                    <p className="text-gray-900 font-medium">
                      {finding.deadline ? new Date(finding.deadline).toLocaleDateString('vi-VN') : 'No deadline'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created Date</label>
                    <p className="text-gray-900 font-medium">
                      {finding.createdAt ? new Date(finding.createdAt).toLocaleDateString('vi-VN') : 'N/A'}
                    </p>
                  </div>
                  {finding.source && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Source</label>
                      <p className="text-gray-900 font-medium">{finding.source}</p>
                    </div>
                  )}
                  {(finding.source?.toLowerCase() === 'external' || finding.externalAuditorName) && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">External Auditor Name</label>
                      <p className="text-gray-900 font-medium">{finding.externalAuditorName || 'N/A'}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Attachments */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attachments ({attachments.length})
                </h4>
                {loadingAttachments ? (
                  <div className="text-gray-500 text-sm">Loading attachments...</div>
                ) : attachments.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {attachments.map((attachment) => (
                      <div
                        key={attachment.attachmentId}
                        className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                      >
                        <div className="flex-shrink-0">
                          <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{attachment.fileName}</p>
                          <p className="text-xs text-gray-500">
                            {attachment.fileSize ? `${(attachment.fileSize / 1024).toFixed(2)} KB` : 'Unknown size'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownload(attachment)}
                          className="flex-shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Download"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm bg-gray-50 rounded-lg p-4 text-center">
                    No attachments available
                  </div>
                )}
              </div>
                </>
              ) : (
                /* Root Causes Tab */
                <div className="space-y-4">
                  {rootCauses.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg">
                      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="mt-3 text-gray-500 font-medium">No root causes found</p>
                    </div>
                  ) : (
                    rootCauses.map((rc: any, index: number) => (
                      <div key={rc.rootCauseId} className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                        {/* Root Cause Header */}
                        <div className="space-y-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-bold text-blue-700">#{index + 1}</span>
                              </div>
                           
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-lg font-bold text-gray-900 mb-2 break-words">{rc.name}</h4>
                            {rc.description && (
                              <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words">{rc.description}</p>
                            )}
                          </div>
                          
                          {rc.reasonReject && (
                            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                              <div className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-red-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                  <svg className="w-4 h-4 text-red-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-red-900 mb-1">Rejection Reason:</p>
                                  <p className="text-sm text-red-700 whitespace-pre-wrap break-words">{rc.reasonReject}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions (Remediation Proposals) */}
                        {rc.actions && rc.actions.length > 0 && (
                          <div className="mt-6 pt-6 border-t-2 border-gray-200">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                              </div>
                              <h5 className="text-base font-bold text-gray-900">
                                Remediation Actions ({rc.actions.length})
                              </h5>
                            </div>
                            <div className="space-y-3">
                              {rc.actions.map((action: Action, idx: number) => (
                                <div key={action.actionId} className="bg-gradient-to-r from-blue-50 to-white border-2 border-blue-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                      <span className="text-white text-xs font-bold">#{idx + 1}</span>
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-2">
                                     
                                      {action.description && (
                                        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap break-words">{action.description}</p>
                                      )}
                                      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                                        {action.dueDate && (
                                          <div className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span className="font-medium">Due: {new Date(action.dueDate).toLocaleDateString('vi-VN')}</span>
                                          </div>
                                        )}
                                        {typeof action.progressPercent === 'number' && (
                                          <div className="flex items-center gap-1.5">
                                            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                            </svg>
                                            <span className="font-medium">{action.progressPercent}% progress</span>
                                          </div>
                                        )}
                                      </div>
                                      {action.reviewFeedback && (
                                        <div className="mt-2 pt-2 border-t border-blue-200">
                                          <p className="text-xs font-semibold text-gray-700 mb-1">Review Feedback:</p>
                                          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap break-words">{action.reviewFeedback}</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* History */}
                        {rc.history && rc.history.length > 0 && (
                          <div className="mt-6 pt-6 border-t-2 border-gray-200">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </div>
                              <h5 className="text-base font-bold text-gray-900">History</h5>
                            </div>
                            <div className="space-y-3 pl-2">
                              {rc.history.map((log: any, logIndex: number) => (
                                <div key={log.logId} className="flex items-start gap-4 relative">
                                  {/* Timeline line */}
                                  {logIndex < rc.history.length - 1 && (
                                    <div className="absolute left-2 top-8 bottom-0 w-0.5 bg-gradient-to-b from-blue-300 to-transparent"></div>
                                  )}
                                  
                                  {/* Timeline dot */}
                                  <div className="flex-shrink-0 w-4 h-4 bg-blue-500 rounded-full mt-1 ring-4 ring-blue-100 relative z-10"></div>
                                  
                                  {/* Content */}
                                  <div className="flex-1 min-w-0 bg-gradient-to-r from-blue-50 to-transparent border-l-4 border-blue-400 rounded-r-lg p-4 -ml-2">
                                    <p className="text-sm text-gray-700 break-words">
                                      <span className="font-bold text-gray-900">{log.changedBy || 'System'}</span>
                                      {' '}changed status to{' '}
                                      <span className="font-bold text-blue-700">{log.newStatus}</span>
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5">
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      {new Date(log.changedAt).toLocaleString('vi-VN')}
                                    </p>
                                    {log.reasonReject && (
                                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                        <p className="text-xs text-red-700 font-medium whitespace-pre-wrap break-words">
                                          <span className="font-bold">Reason:</span> {log.reasonReject}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

            </div>
          ) : null}
        </div>

        {/* Footer - always visible */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex gap-3">
            {finding?.status === 'Open' && (
              <>
                <button
                  onClick={handleApprove}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </button>
                <button
                  onClick={handleRejectClick}
                  className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Reject
                </button>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="bg-red-600 px-6 py-4 rounded-t-xl">
              <h3 className="text-lg font-semibold text-white">Reject Finding</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-700 mb-4">
                Please provide a reason for rejecting this finding:
              </p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                rows={4}
                placeholder="Enter rejection reason..."
                disabled={submittingReject}
              />
            </div>
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                disabled={submittingReject}
                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={submittingReject || !rejectReason.trim()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {submittingReject && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WitnessedFindingDetailModal;
