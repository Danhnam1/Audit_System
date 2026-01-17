import { useState, useEffect } from 'react';
import { getActionById, getActionsByRootCause, type Action } from '../../api/actions';
import { getAttachments, type Attachment } from '../../api/attachments';
import { getUserById, type AdminUserDto } from '../../api/adminUsers';
import { getRootCauseById, type RootCause } from '../../api/rootCauses';

interface CAPAOwnerActionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string | undefined;
}

const CAPAOwnerActionDetailModal = ({ 
  isOpen, 
  onClose, 
  actionId
}: CAPAOwnerActionDetailModalProps) => {
  const [action, setAction] = useState<Action | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [_loadingAttachments, setLoadingAttachments] = useState(false);
  const [assignedToUser, setAssignedToUser] = useState<AdminUserDto | null>(null);
  const [rootCause, setRootCause] = useState<RootCause | null>(null);
  const [loadingRootCause, setLoadingRootCause] = useState(false);
  const [rootCauseActions, setRootCauseActions] = useState<Action[]>([]);
  const [showResponsiblePersonModal, setShowResponsiblePersonModal] = useState(false);

  useEffect(() => {
    if (isOpen && actionId) {
      loadAction();
    } else {
      // Reset state when modal closes
      setAction(null);
      setAssignedToUser(null);
      setAttachments([]);
      setError(null);
      setRootCause(null);
      setRootCauseActions([]);
    }
  }, [isOpen, actionId]);

  const loadAction = async () => {
    if (!actionId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getActionById(actionId);
      setAction(data);
      
      // Load attachments for this action
      if (actionId) loadAttachments(actionId);
      
      // Load assignedTo user info
      if (data.assignedTo) {
        loadAssignedToUser(data.assignedTo);
      }
      
      // Load root cause if rootCauseId exists
      if (data.rootCauseId) {
        loadRootCause(data.rootCauseId);
      } else {
        setRootCause(null);
      }
    } catch (err: any) {
      console.error('Error loading action:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load action details');
    } finally {
      setLoading(false);
    }
  };

  const loadRootCause = async (rootCauseId: number) => {
    setLoadingRootCause(true);
    try {
      const data = await getRootCauseById(rootCauseId);
      setRootCause(data);
      try {
        const actions = await getActionsByRootCause(rootCauseId);
        setRootCauseActions(actions || []);
      } catch (err) {
        console.warn('Error loading actions by root cause', err);
        setRootCauseActions([]);
      }
    } catch (err: any) {
      console.error('Error loading root cause:', err);
      setRootCause(null);
      setRootCauseActions([]);
    } finally {
      setLoadingRootCause(false);
    }
  };

  const loadAssignedToUser = async (userId: string) => {
    try {
      const userData = await getUserById(userId);
      setAssignedToUser(userData);
    } catch (err: any) {
      console.error('Error loading assignedTo user:', err);
    }
  };

  const loadAttachments = async (actionId: string) => {
    setLoadingAttachments(true);
    try {
      const data = await getAttachments('Action', actionId);
      setAttachments(data);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
    } finally {
      setLoadingAttachments(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Get status badge for attachment
  const getAttachmentStatusBadge = (status?: string) => {
    if (!status) return null;
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'rejected') {
      return (
        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded border border-red-300 flex-shrink-0">
          Rejected
        </span>
      );
    }
    if (statusLower === 'approved') {
      return (
        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded border border-green-300 flex-shrink-0">
          Approved
        </span>
      );
    }
    if (statusLower === 'open') {
      return (
        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded border border-blue-300 flex-shrink-0">
          Open
        </span>
      );
    }
    // Default: show status as-is
    return (
      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded border border-gray-300 flex-shrink-0">
        {status}
      </span>
    );
  };

  if (!isOpen) return null;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    } catch {
      return dateString;
    }
  };

  // Unused function
  // const getStatusColor = (_status: string) => {
  //   const statusLower = _status?.toLowerCase() || '';
  //   if (statusLower === 'completed' || statusLower === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  //   if (statusLower === 'active' || statusLower === 'open') return 'bg-blue-100 text-blue-700 border-blue-200';
  //   if (statusLower === 'closed') return 'bg-gray-100 text-gray-700 border-gray-200';
  //   if (statusLower === 'pending' || statusLower === 'reviewed') return 'bg-amber-100 text-amber-700 border-amber-200';
  //   return 'bg-gray-100 text-gray-700 border-gray-200';
  // };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-xl shadow-lg w-full max-w-5xl mx-auto max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-blue-600 px-6 py-5 flex items-center justify-between z-10 border-b border-blue-700">
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span className="text-white font-medium">Loading action details...</span>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold text-white">My Action Details</h2>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Loading action details...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <p className="font-medium">Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {!loading && !error && action ? (
              <div className="space-y-6">
                {/* Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Title */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Title
                    </label>
                    <input
                      type="text"
                      value={action.title || ''}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Status
                    </label>
                    <input
                      type="text"
                      value={action.status || ''}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Progress */}
                  {action.progressPercent > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Progress
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={`${action.progressPercent}%`}
                          readOnly
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                        />
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg">
                          <div
                            className="h-1 bg-blue-600 rounded-b-lg transition-all"
                            style={{ width: `${action.progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Root Cause */}
                {(() => {
                  // Check if root cause exists (from API or legacy description)
                  const hasRootCauseFromApi = rootCause || loadingRootCause;
                  
                  // Parse legacy root cause from description
                  let legacyRootCauseName = null;
                  let legacyRootCauseDesc = null;
                  if (!hasRootCauseFromApi && action.description) {
                    const match = action.description.match(/\n\nAssigned Root Cause:([\s\S]*?)(?:\n\nAssigned to:|$)/);
                    if (match) {
                      const fullText = match[1].trim();
                      const nameMatch = fullText.match(/^[•\-\*]\s*(.+?)\s*\([^)]+\)/);
                      const descMatch = fullText.match(/Description:\s*(.+)$/s);
                      
                      if (nameMatch) legacyRootCauseName = nameMatch[1].trim();
                      if (descMatch) legacyRootCauseDesc = descMatch[1].trim();
                      if (!legacyRootCauseName && !legacyRootCauseDesc) legacyRootCauseName = fullText;
                    }
                  }
                  
                  if (!hasRootCauseFromApi && !legacyRootCauseName) return null;
                  
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                            Root Cause Name
                          </label>
                          <input
                            type="text"
                            value={loadingRootCause ? 'Loading...' : (rootCause?.name || legacyRootCauseName || 'N/A')}
                            readOnly
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                          />
                        </div>
                        {((rootCause?.description || legacyRootCauseDesc) && !loadingRootCause) && (
                          <div className="md:col-span-2">
                            <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                              Root Cause Description
                            </label>
                            <textarea
                              value={rootCause?.description || legacyRootCauseDesc || ''}
                              readOnly
                              rows={4}
                              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium resize-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Remediation Proposals (Actions for this Root Cause) */}
                      <div className="space-y-3">
                        {(() => {
                          const visibleRootCauseActions =
                            rootCauseActions.filter(a => !actionId || a.actionId === actionId);
                          const proposals =
                            visibleRootCauseActions.length > 0 ? visibleRootCauseActions : rootCauseActions;
                          const count = proposals.length;
                          return (
                            <>
                              <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                                  Remediation Proposals
                                </h3>
                                <span className="text-xs text-gray-500">
                                  {count} action{count !== 1 ? 's' : ''}
                                </span>
                              </div>
                              {count === 0 ? (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
                                  No proposals linked to this root cause.
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  {proposals.map((rcAction, idx) => {
                                    const statusLower = (rcAction.status || '').toLowerCase();
                                    const statusColor =
                                      statusLower === 'completed' || statusLower === 'approved'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : statusLower === 'verified'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : statusLower === 'inprogress' || statusLower === 'in progress'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                        : 'bg-gray-50 text-gray-700 border-gray-200';
                                    return (
                                      <div
                                        key={rcAction.actionId || idx}
                                        className="border rounded-lg p-3 bg-white shadow-sm"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-900">{rcAction.title || 'Untitled action'}</p>
                                            {rcAction.description && (
                                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{rcAction.description}</p>
                                            )}
                                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                                              {rcAction.dueDate && (
                                                <span className="flex items-center gap-1">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                  </svg>
                                                  Due: {formatDate(rcAction.dueDate)}
                                                </span>
                                              )}
                                              {typeof rcAction.progressPercent === 'number' && (
                                                <span className="flex items-center gap-1">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                                  </svg>
                                                  {rcAction.progressPercent}% progress
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                          <span className={`px-2 py-1 rounded-full text-[11px] font-semibold border whitespace-nowrap ${statusColor}`}>
                                            {rcAction.status || 'N/A'}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </>
                  );
                })()}

                {/* Description */}
                {action.description && (() => {
                  // Clean up legacy descriptions that have embedded root cause info
                  let cleanDescription = action.description;
                  const rootCauseMatch = cleanDescription.match(/\n\nAssigned Root Cause:[\s\S]*/);
                  if (rootCauseMatch) {
                    cleanDescription = cleanDescription.substring(0, rootCauseMatch.index);
                  }
                  
                  return (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Description
                      </label>
                      <textarea
                        value={cleanDescription}
                        readOnly
                        rows={4}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium resize-none"
                      />
                    </div>
                  );
                })()}

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Responsible Person */}
                  <div 
                    className={`md:col-span-2 ${assignedToUser ? 'cursor-pointer' : ''}`}
                    onClick={() => assignedToUser && setShowResponsiblePersonModal(true)}
                  >
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Responsible Person
                    </label>
                    <input
                      type="text"
                      value={assignedToUser?.fullName || action.assignedTo || 'N/A'}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Created Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Created Date
                    </label>
                    <input
                      type="text"
                      value={formatDate(action.createdAt)}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Due Date
                    </label>
                    <input
                      type="text"
                      value={formatDate(action.dueDate)}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Closed Date */}
                  {action.closedAt && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Closed Date
                      </label>
                      <input
                        type="text"
                        value={formatDate(action.closedAt)}
                        readOnly
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                      />
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Attachments ({attachments.length})
                    </label>
                    <div className="space-y-3">
                      {attachments.map((attachment) => {
                        const isImage = attachment.contentType?.startsWith('image/');
                        const imageUrl = attachment.filePath || attachment.blobPath || '';
                        
                        return (
                          <div
                            key={attachment.attachmentId}
                            className="border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm"
                          >
                            {/* Image preview - Full width, good quality */}
                            {isImage && imageUrl && (
                              <div className="relative bg-gray-100">
                                <img
                                  src={imageUrl}
                                  alt={attachment.fileName}
                                  className="w-full h-auto max-h-96 object-contain"
                                  onError={(e) => {
                                    console.error('Image load error:', attachment.filePath);
                                    e.currentTarget.parentElement!.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* File info bar */}
                            <div className="p-3 bg-gray-50 border-t border-gray-200">
                              <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  {isImage ? (
                                    <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  ) : (
                                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-gray-700 font-medium truncate">{attachment.fileName}</p>
                                      {getAttachmentStatusBadge(attachment.status)}
                                    </div>
                                    <p className="text-xs text-gray-500">
                                      {formatFileSize(attachment.fileSize || 0)} • {new Date(attachment.uploadedAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={imageUrl}
                                  download={attachment.fileName}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-3 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex-shrink-0"
                                >
                                  Open
                                </a>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && !error && !action && (
              <div className="text-center py-8 text-gray-500">
                No action details found
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Responsible Person Detail Modal */}
      {showResponsiblePersonModal && assignedToUser && (
      <div className="fixed inset-0 z-[60] overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={() => setShowResponsiblePersonModal(false)}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div
            className="relative bg-white rounded-xl shadow-lg w-full max-w-2xl mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-purple-600 text-white p-6 rounded-t-xl">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-1">Responsible Personđ Details</h3>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-4">
              {/* Full Name */}
              {assignedToUser.fullName && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                  <label className="block text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Full Name</label>
                  <p className="text-xl font-bold text-gray-900">{assignedToUser.fullName}</p>
                </div>
              )}

              {/* Email */}
              {assignedToUser.email && (
                <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Email</label>
                  </div>
                  <p className="text-base font-semibold text-gray-900 pl-[52px]">{assignedToUser.email}</p>
                </div>
              )}


              {/* Role */}
              {assignedToUser.roleName && (
                <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Role</label>
                  </div>
                  <p className="text-base font-semibold text-gray-900 pl-[52px]">{assignedToUser.roleName}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end">
              <button
                onClick={() => setShowResponsiblePersonModal(false)}
                className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default CAPAOwnerActionDetailModal;
