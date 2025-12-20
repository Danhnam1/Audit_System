import { useState, useEffect } from 'react';
import { getActionById, type Action } from '../../api/actions';
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
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [assignedToUser, setAssignedToUser] = useState<AdminUserDto | null>(null);
  const [rootCause, setRootCause] = useState<RootCause | null>(null);
  const [loadingRootCause, setLoadingRootCause] = useState(false);
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
    } catch (err: any) {
      console.error('Error loading root cause:', err);
      setRootCause(null);
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

  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower === 'completed' || statusLower === 'approved') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (statusLower === 'active' || statusLower === 'open') return 'bg-blue-100 text-blue-700 border-blue-200';
    if (statusLower === 'closed') return 'bg-gray-100 text-gray-700 border-gray-200';
    if (statusLower === 'pending' || statusLower === 'reviewed') return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-3 sm:p-4">
        <div
          className="relative bg-white rounded-xl shadow-lg w-full max-w-4xl max-h-[95vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Gradient */}
          <div className="sticky top-0 bg-primary-600 px-6 sm:px-8 py-6 border-b border-primary-700 z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">My Action Details</h2>
                  <p className="text-sm text-white/70 mt-0.5">View your assigned action</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white max-h-[calc(95vh-120px)]">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 text-lg font-medium">Loading action details...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-5 mb-6">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-orange-700 font-medium">{error}</p>
                </div>
              </div>
            ) : action ? (
              <div className="space-y-6">
                {/* Title and Status */}
                <div className="bg-gray-50 border-l-4 border-primary-600 p-6 rounded-r-lg">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-primary-700 uppercase tracking-wide mb-2">Title</label>
                      <h3 className="text-xl font-bold text-gray-900 break-words leading-tight">
                        {action.title}
                      </h3>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pl-[52px]">
                    <span className={`px-4 py-2 rounded-lg text-sm font-medium border ${getStatusColor(action.status)}`}>
                      {action.status}
                    </span>
                    {action.progressPercent > 0 && (
                      <span className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-100 text-primary-700 border border-primary-200">
                        {action.progressPercent}% Complete
                      </span>
                    )}
                  </div>
                </div>

                {/* Root Cause (if available) */}
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
                      // Parse format: "• name (category)\n  Description: desc"
                      const nameMatch = fullText.match(/^[•\-\*]\s*(.+?)\s*\([^)]+\)/);
                      const descMatch = fullText.match(/Description:\s*(.+)$/s);
                      
                      if (nameMatch) {
                        legacyRootCauseName = nameMatch[1].trim();
                      }
                      if (descMatch) {
                        legacyRootCauseDesc = descMatch[1].trim();
                      }
                      
                      // If parsing failed, use the whole text as name
                      if (!legacyRootCauseName && !legacyRootCauseDesc) {
                        legacyRootCauseName = fullText;
                      }
                    }
                  }
                  
                  if (!hasRootCauseFromApi && !legacyRootCauseName) return null;
                  
                  return (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 ">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-purple-700 uppercase tracking-wide pt-2">Assigned Root Cause</label>
                      </div>
                      {loadingRootCause ? (
                        <div className="flex items-center gap-2 pl-[52px]">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-300 border-t-purple-600"></div>
                          <span className="text-sm text-purple-600">Loading root cause...</span>
                        </div>
                      ) : rootCause ? (
                        <div className="pl-[52px] space-y-2">
                          <p className="text-lg font-bold text-purple-900">
                            {rootCause.name}
                          </p>
                          {rootCause.description && (
                            <p className="text-base text-gray-700 leading-relaxed">
                              {rootCause.description}
                            </p>
                          )}
                        </div>
                      ) : legacyRootCauseName ? (
                        <div className="pl-[52px] space-y-3">
                          <div className="space-y-2">
                            <p className="text-lg font-bold text-purple-900">
                              {legacyRootCauseName}
                            </p>
                            {legacyRootCauseDesc && (
                              <p className="text-base text-gray-700 leading-relaxed">
                                {legacyRootCauseDesc}
                              </p>
                            )}
                          </div>
                          
                        </div>
                      ) : null}
                    </div>
                  );
                })()}

                {/* Description */}
                {action.description && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide pt-2">Description</label>
                    </div>
                    <p className="text-base text-gray-800 leading-relaxed whitespace-pre-wrap break-words min-h-[80px] pl-[52px]">
                      {(() => {
                        // Clean up legacy descriptions that have embedded root cause info
                        let cleanDescription = action.description;
                        // Remove "Assigned Root Cause:" section if it exists (legacy data)
                        const rootCauseMatch = cleanDescription.match(/\n\nAssigned Root Cause:[\s\S]*/);
                        if (rootCauseMatch) {
                          cleanDescription = cleanDescription.substring(0, rootCauseMatch.index);
                        }
                        return cleanDescription;
                      })()}
                    </p>
                  </div>
                )}

                {/* Progress Bar */}
                {action.progressPercent > 0 && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Progress</h4>
                      </div>
                      <span className="text-2xl font-bold text-primary-600">{action.progressPercent}%</span>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-gray-200 rounded-full h-4 shadow-inner">
                        <div
                          className="bg-primary-600 h-4 rounded-full transition-all duration-500"
                          style={{ width: `${action.progressPercent}%` }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Responsible Person */}
                  <div 
                    className={`bg-purple-50 border border-purple-200 rounded-lg p-6 hover:bg-purple-100 transition-colors md:col-span-2 ${assignedToUser ? 'cursor-pointer' : ''}`}
                    onClick={() => assignedToUser && setShowResponsiblePersonModal(true)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-purple-700 uppercase tracking-wide">Responsible Person</label>
                    </div>
                    <p className="text-lg font-bold text-purple-900 pl-[52px]">
                      {assignedToUser?.fullName || action.assignedTo || 'N/A'}
                    </p>
                  </div>

                  {/* Created Date */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-green-700 uppercase tracking-wide">Created Date</label>
                    </div>
                    <p className="text-lg font-bold text-green-900 pl-[52px]">
                      {formatDate(action.createdAt)}
                    </p>
                  </div>

                  {/* Due Date */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-orange-700 uppercase tracking-wide">Due Date</label>
                    </div>
                    <p className="text-lg font-bold text-orange-900 pl-[52px]">
                      {formatDate(action.dueDate)}
                    </p>
                  </div>

                  {/* Closed Date - Full Width (if exists) */}
                  {action.closedAt && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 md:col-span-2">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Closed Date</label>
                      </div>
                      <p className="text-lg font-bold text-gray-900 pl-[52px]">
                        {formatDate(action.closedAt)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {action.findingId && (
                  <div className="bg-white border border-gray-200 rounded-lg p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-indigo-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Attachments</label>
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-sm font-bold rounded-full">
                        {attachments.length}
                      </span>
                    </div>
                    {loadingAttachments ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary-600 mx-auto mb-3"></div>
                          <span className="text-base text-gray-600 font-medium">Loading attachments...</span>
                        </div>
                      </div>
                    ) : attachments.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                          </svg>
                        </div>
                        <p className="text-base text-gray-500 font-medium">No attachments found</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {attachments.map((attachment) => {
                          const isImage = attachment.contentType?.toLowerCase().startsWith('image/');
                          const filePath = attachment.filePath || attachment.blobPath || '';
                          
                          // If it's an image, always show the image preview
                          if (isImage && filePath) {
                            return (
                              <div
                                key={attachment.attachmentId}
                                className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden hover:border-primary-300 transition-colors"
                              >
                                {/* Image Header */}
                                <div className="p-4 border-b-2 border-gray-200 bg-white">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-base font-bold text-gray-900 truncate">{attachment.fileName}</p>
                                        <p className="text-sm text-gray-500 font-medium">{formatFileSize(attachment.fileSize || 0)}</p>
                                      </div>
                                    </div>
                                    <a
                                      href={filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex-shrink-0 ml-3 p-2.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
                                      title="Open image in new tab"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                    </a>
                                  </div>
                                </div>
                                {/* Image Preview */}
                                <div className="p-4 bg-gray-50">
                                  <img
                                    src={filePath}
                                    alt={attachment.fileName}
                                    className="w-full h-auto max-h-96 object-contain rounded-lg border border-gray-200 bg-white cursor-pointer hover:opacity-90 transition-opacity"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.style.display = 'none';
                                      const parent = target.parentElement;
                                      if (parent) {
                                        parent.innerHTML = `
                                          <div class="p-8 text-center text-gray-500">
                                            <svg class="w-16 h-16 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p class="text-base font-medium">Image failed to load</p>
                                          </div>
                                        `;
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          }
                          
                          // Non-image files
                          return (
                            <div
                              key={attachment.attachmentId}
                              className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:bg-gray-100 hover:border-primary-300 transition-colors"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                  {/* File Icon */}
                                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                  </div>
                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-base font-bold text-gray-900 truncate">{attachment.fileName}</p>
                                    <p className="text-sm text-gray-500 font-medium">{formatFileSize(attachment.fileSize || 0)}</p>
                                  </div>
                                </div>
                                {/* Download Button */}
                                {filePath && (
                                  <a
                                    href={filePath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-shrink-0 ml-3 px-4 py-2.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors font-medium border border-primary-200 flex items-center gap-2"
                                    title="Open file"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Open
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
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
                  <h3 className="text-2xl font-bold mb-1">Responsible Person Details</h3>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-8 space-y-4">
              {/* Full Name */}
              {assignedToUser.fullName && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
                  <label className="block text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">Full Name</label>
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
