import { useState, useEffect } from 'react';
import { getFindingById, type Finding, updateFinding } from '../../../api/findings';
import { getAttachments, type Attachment } from '../../../api/attachments';
import { getUserById } from '../../../api/adminUsers';
import { getDepartmentById } from '../../../api/departments';
import { createRootCause, type CreateRootCauseDto, updateRootCause, approveRootCause, rejectRootCause, sendRootCauseForReview, deleteRootCause } from '../../../api/rootCauses';
import useAuthStore from '../../../store/useAuthStore';
import apiClient from '../../../api/client';
import { useAuth } from '../../../contexts';

interface FindingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  findingId: string;
}

const FindingDetailModal = ({ isOpen, onClose, findingId }: FindingDetailModalProps) => {
  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [witnessName, setWitnessName] = useState<string>('');
  const [witnessData, setWitnessData] = useState<any>(null);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [showWitnessModal, setShowWitnessModal] = useState(false);
  const [createdByName, setCreatedByName] = useState<string>('');
  const [createdByData, setCreatedByData] = useState<any>(null);
  const [showCreatedByModal, setShowCreatedByModal] = useState(false);
  const [rootCauses, setRootCauses] = useState<any[]>([]);
  const [draftRootCauses, setDraftRootCauses] = useState<any[]>([]);
  const [rootCauseName, setRootCauseName] = useState<string>('');
  const [rootCauseDescription, setRootCauseDescription] = useState<string>('');
  const [rootCauseCategory, setRootCauseCategory] = useState<string>('Finding');
  const [isEditingRootCause, setIsEditingRootCause] = useState(false);
  const [isSavingRootCause, setIsSavingRootCause] = useState(false);
  const [editingRootCauseId, setEditingRootCauseId] = useState<number | null>(null);
  const [reviewingRootCauseId, setReviewingRootCauseId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [editingReasonReject, setEditingReasonReject] = useState<string>('');
  const [isProcessingReview, setIsProcessingReview] = useState(false);
  const [sendingRootCauseId, setSendingRootCauseId] = useState<number | null>(null);
  const [deletingRootCauseId, setDeletingRootCauseId] = useState<number | null>(null);
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const { role } = useAuthStore();
  const { user } = useAuth();
  const isAuditeeOwner = role === 'AuditeeOwner';
  const isAuditor = role === 'Auditor';
  const isCreator = finding?.createdBy === user?.userId;
  
  // Debug logging
  console.log('🔍 Role check:', { role, isAuditor, isAuditeeOwner, userId: user?.userId, findingCreatedBy: finding?.createdBy, isCreator });

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (isOpen && findingId) {
      loadFinding();
      loadAttachments();
    }
  }, [isOpen, findingId]);

  const loadFinding = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFindingById(findingId);
      setFinding(data);
      
      // Fetch witness name if witnessId exists
      if (data?.witnessId) {
        try {
          const witnessUser = await getUserById(data.witnessId);
          setWitnessName(witnessUser?.fullName || '');
          setWitnessData(witnessUser);
        } catch (err) {
          console.error('Error loading witness:', err);
          setWitnessName('');
          setWitnessData(null);
        }
      }
      
      // Fetch createdBy user details
      if (data?.createdBy) {
        try {
          const createdByUser = await getUserById(data.createdBy);
          setCreatedByName(createdByUser?.fullName || '');
          setCreatedByData(createdByUser);
        } catch (err) {
          console.error('Error loading created by user:', err);
          setCreatedByName('');
          setCreatedByData(null);
        }
      }
      
      // Fetch createdBy user details
      if (data?.createdBy) {
        try {
          const createdByUser = await getUserById(data.createdBy);
          setCreatedByName(createdByUser?.fullName || '');
          setCreatedByData(createdByUser);
        } catch (err) {
          console.error('Error loading created by user:', err);
          setCreatedByName('');
          setCreatedByData(null);
        }
      }
      
      // Fetch department name if deptId exists
      if (data?.deptId) {
        try {
          const dept = await getDepartmentById(data.deptId);
          setDepartmentName(dept?.name || '');
        } catch (err) {
          console.error('Error loading department:', err);
          setDepartmentName('');
        }
      }

      // Fetch all root causes by finding ID and separate Draft from others
      try {
        const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
        const rootCausesList = res.data.$values || [];
        console.log('Loaded root causes for finding:', findingId, rootCausesList);
        
        // Separate draft and non-draft root causes
        const drafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() === 'draft');
        const nonDrafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() !== 'draft');
        
        setDraftRootCauses(drafts);
        setRootCauses(nonDrafts);
        console.log('📝 Draft root causes:', drafts.length, '✅ Pending/Approved/Rejected:', nonDrafts.length);
      } catch (err) {
        console.error('Error loading root causes:', err);
        setRootCauses([]);
        setDraftRootCauses([]);
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
      setAttachments(data);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
      // Don't show error for attachments, just log it
    } finally {
      setLoadingAttachments(false);
    }
  };

  const handleSaveRootCause = async () => {
    if (!finding || !rootCauseName.trim()) {
      showToast('Please enter root cause name', 'error');
      return;
    }

    if (!rootCauseCategory.trim()) {
      showToast('Please select a category', 'error');
      return;
    }

    setIsSavingRootCause(true);
    try {
      if (editingRootCauseId) {
        // Update existing root cause - API requires ReasonReject field
        // Find current root cause to get its status and reviewBy
        const currentRootCause = rootCauses.find(rc => rc.rootCauseId === editingRootCauseId);
        
        const rootCauseDto: Partial<CreateRootCauseDto> & { deptId?: number; findingId?: string; reasonReject?: string; reviewBy?: string } = {
          name: rootCauseName.trim(),
          description: rootCauseDescription.trim(),
          status:  'Pending', // Keep current status
          category: rootCauseCategory.trim(),
          deptId: finding.deptId || 0,
          findingId: findingId,
          reasonReject: editingReasonReject || '',
          reviewBy: currentRootCause?.reviewBy || '', // Include reviewBy if exists
        };
        
        console.log('📤 Updating root cause with payload:', rootCauseDto);
        await updateRootCause(editingRootCauseId, rootCauseDto as any);
        showToast('Root cause updated successfully!', 'success');
        setEditingRootCauseId(null);
      } else {
        // Create new root cause with Draft status
        const rootCauseDto: CreateRootCauseDto & { deptId: number; findingId: string; category: string } = {
          name: rootCauseName.trim(),
          description: rootCauseDescription.trim(),
          status: 'Draft',
          category: rootCauseCategory.trim(),
          deptId: finding.deptId || 0,
          findingId: findingId,
        };

        await createRootCause(rootCauseDto as any);
        showToast('Root cause saved as draft!', 'success');
      }
      
      setRootCauseName('');
      setRootCauseDescription('');
      setRootCauseCategory('Finding');
      setEditingReasonReject('');
      setIsEditingRootCause(false);
      
      // Reload all root causes and separate drafts
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      const drafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() === 'draft');
      const nonDrafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() !== 'draft');
      setDraftRootCauses(drafts);
      setRootCauses(nonDrafts);
    } catch (err: any) {
      console.error('Error saving root cause:', err);
      showToast('Failed to save root cause: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSavingRootCause(false);
    }
  };
  
  // Handle edit root cause
  const handleEditRootCause = (rc: any) => {
    setEditingRootCauseId(rc.rootCauseId);
    setRootCauseName(rc.name || '');
    setRootCauseDescription(rc.description || '');
    setRootCauseCategory(rc.category || 'Finding');
    setEditingReasonReject(rc.reasonReject || '');
    setIsEditingRootCause(true);
  };
  
  // Handle approve root cause
  const handleApproveRootCause = async (id: number) => {
    setIsProcessingReview(true);
    try {
      await approveRootCause(id);
      showToast('Root cause approved successfully!', 'success');
      
      // Reload root causes and separate drafts
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      const drafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() === 'draft');
      const nonDrafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() !== 'draft');
      setDraftRootCauses(drafts);
      setRootCauses(nonDrafts);
    } catch (err: any) {
      console.error('Error approving root cause:', err);
      showToast('Failed to approve root cause: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsProcessingReview(false);
    }
  };
  
  // Handle reject root cause
  const handleRejectRootCause = async (id: number, reason: string) => {
    if (!reason.trim()) {
      showToast('Please provide a reason for rejection', 'error');
      return;
    }
    
    setIsProcessingReview(true);
    try {
      await rejectRootCause(id, reason);
      showToast('Root cause rejected successfully!', 'success');
      setReviewingRootCauseId(null);
      setRejectReason('');
      
      // Reload root causes and separate drafts
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      const drafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() === 'draft');
      const nonDrafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() !== 'draft');
      setDraftRootCauses(drafts);
      setRootCauses(nonDrafts);
    } catch (err: any) {
      console.error('Error rejecting root cause:', err);
      showToast('Failed to reject root cause: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsProcessingReview(false);
    }
  };
  
  // Handle send draft for review
  const handleSendDraftForReview = async (id: number) => {
    setSendingRootCauseId(id);
    try {
      await sendRootCauseForReview(id);
      showToast('Root cause sent for review!', 'success');
      
      // Reload root causes and separate drafts
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      const drafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() === 'draft');
      const nonDrafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() !== 'draft');
      setDraftRootCauses(drafts);
      setRootCauses(nonDrafts);
    } catch (err: any) {
      console.error('Error sending draft for review:', err);
      showToast('Failed to send root cause: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setSendingRootCauseId(null);
    }
  };
  
  // Handle delete draft root cause
  const handleDeleteDraft = async (id: number) => {
    if (!confirm('Are you sure you want to delete this draft root cause?')) {
      return;
    }
    
    setDeletingRootCauseId(id);
    try {
      await deleteRootCause(id);
      showToast('Draft root cause deleted!', 'success');
      
      // Reload root causes and separate drafts
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      const drafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() === 'draft');
      const nonDrafts = rootCausesList.filter((rc: any) => rc.status?.toLowerCase() !== 'draft');
      setDraftRootCauses(drafts);
      setRootCauses(nonDrafts);
    } catch (err: any) {
      console.error('Error deleting draft:', err);
      showToast('Failed to delete draft: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setDeletingRootCauseId(null);
    }
  };
  
  // Check if any root cause is approved
  const hasApprovedRootCause = rootCauses.some(rc => rc.status?.toLowerCase() === 'approved');

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      // Format as "MMM dd, yyyy" (e.g., "Nov 21, 2025")
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getMonth()];
      const day = date.getDate();
      const year = date.getFullYear();
      return `${month} ${day}, ${year}`;
    } catch {
      return dateString;
    }
  };

  const getSeverityColor = (severity: string) => {
    const severityLower = severity?.toLowerCase() || '';
    if (severityLower.includes('high')) return 'bg-orange-50 text-orange-600 border border-orange-200';
    if (severityLower.includes('medium')) return 'bg-yellow-100 text-yellow-800';
    if (severityLower.includes('low')) return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto animate-slideUp"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Gradient */}
          <div className="sticky top-0 bg-gradient-to-r from-primary-600 to-primary-700 px-6 sm:px-8 py-6 shadow-lg z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white">Finding Details</h2>
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
          <div className="p-6 sm:p-8 bg-gradient-to-b from-gray-50 to-white">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 text-lg font-medium">Loading finding details...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5 mb-6 shadow-sm">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-orange-700 font-medium">{error}</p>
                </div>
              </div>
            )}

            {finding && !loading && (
              <div className="space-y-6">
                {/* Title - Highlighted with gradient */}
                <div className="bg-gradient-to-r from-primary-50 to-blue-50 border-l-4 border-primary-600 p-6 rounded-r-xl shadow-md">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-primary-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-primary-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-primary-700 uppercase tracking-wide mb-2">Title</label>
                      <p className="text-xl font-bold text-gray-900 leading-relaxed">{finding.title}</p>
                    </div>
                  </div>
                </div>

                {/* Description - Enhanced card */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                    </div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide pt-2">Description</label>
                  </div>
                  <p className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed min-h-[80px] pl-[52px]">
                    {finding.description || 'No description provided'}
                  </p>
                </div>

                {/* Info Grid - 2 columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Severity */}
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Severity</label>
                    </div>
                    <span className={`inline-block px-5 py-2.5 rounded-xl text-base font-bold shadow-sm ${getSeverityColor(finding.severity)}`}>
                      {finding.severity || 'N/A'}
                    </span>
                  </div>

                  {/* Department */}
                  {finding.deptId && (
                    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-blue-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Department</label>
                      </div>
                      <p className="text-base font-semibold text-gray-900 pl-[52px]">{departmentName || 'Loading...'}</p>
                    </div>
                  )}

               

                  {/* Witness */}
                  {finding.witnessId && (
                    <div 
                      className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow cursor-pointer hover:border-purple-300"
                      onClick={() => witnessData && setShowWitnessModal(true)}
                      title="Click to view witness details"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Witness</label>
                        {witnessData && (
                          <svg className="w-4 h-4 text-purple-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <p className="text-base font-semibold text-gray-900 pl-[52px]">{witnessName || 'Loading...'}</p>
                    </div>
                  )}

                  {/* Created By / Responsible Person */}
                  {finding.createdBy && (
                    <div 
                      className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow cursor-pointer hover:border-indigo-300"
                      onClick={() => createdByData && setShowCreatedByModal(true)}
                      title="Click to view responsible person details"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-indigo-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Creator Person </label>
                        {createdByData && (
                          <svg className="w-4 h-4 text-indigo-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <p className="text-base font-semibold text-gray-900 pl-[52px]">{createdByName || 'Loading...'}</p>
                    </div>
                  )}

                  {/* Dates */}
                  {finding.deadline && (
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 border-2 border-orange-200 rounded-xl p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-orange-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-orange-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-orange-700 uppercase tracking-wide">Deadline</label>
                      </div>
                      <p className="text-lg font-bold text-orange-900 pl-[52px]">{formatDate(finding.deadline)}</p>
                    </div>
                  )}
                  {finding.createdAt && (
                    <div className="bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-200 rounded-xl p-6 shadow-md">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 bg-green-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-green-700 uppercase tracking-wide">Created At</label>
                      </div>
                      <p className="text-lg font-bold text-green-900 pl-[52px]">{formatDate(finding.createdAt)}</p>
                    </div>
                  )}
                </div>

                {/* Attachments */}
                <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-indigo-200 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                    </div>
                    <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Attachments</label>
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
                        const isImage = attachment.contentType?.startsWith('image/');
                        
                        return (
                          <div
                            key={attachment.attachmentId}
                            className={`bg-gradient-to-br from-gray-50 to-gray-100/50 border-2 border-gray-200 rounded-xl overflow-hidden hover:border-primary-300 hover:shadow-lg transition-all ${
                              isImage ? '' : 'p-4'
                            }`}
                          >
                            {isImage ? (
                              /* Image Preview */
                              <div>
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
                                    {attachment.filePath && (
                                      <a
                                        href={attachment.filePath}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-shrink-0 ml-3 p-2.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
                                        title="Open image in new tab"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                      </a>
                                    )}
                                  </div>
                                </div>
                                {attachment.filePath && (
                                  <div className="p-4 bg-gray-50">
                                    <a
                                      href={attachment.filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block"
                                    >
                                      <img
                                        src={attachment.filePath}
                                        alt={attachment.fileName}
                                        className="w-full h-auto max-h-96 object-contain rounded-xl border-2 border-gray-200 bg-white cursor-pointer hover:opacity-90 transition-opacity shadow-md"
                                        onError={(e) => {
                                          // Fallback if the image fails to load
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
                                    </a>
                                  </div>
                                )}
                              </div>
                            ) : (
                              /* Non-image File */
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
                                {attachment.filePath && (
                                  <a
                                    href={attachment.filePath}
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
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                   {/* Root Cause - Editable for AuditeeOwner */}
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Root Cause</label>
                      </div>
                      {isAuditeeOwner && (
                        <button
                          onClick={() => setIsEditingRootCause(!isEditingRootCause)}
                          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-semibold flex items-center gap-2"
                        >
                          {isEditingRootCause ? (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Cancel
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              Add New
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {isEditingRootCause ? (
                      <div className="space-y-4">
                        {/* Root Cause Name Input */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                          <input
                            type="text"
                            value={rootCauseName}
                            onChange={(e) => setRootCauseName(e.target.value)}
                            placeholder="Enter root cause name"
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                          />
                        </div>

                        {/* Root Cause Category Input */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Category *</label>
                          <select
                            value={rootCauseCategory}
                            onChange={(e) => setRootCauseCategory(e.target.value)}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                          >
                            <option value="Finding">Finding</option>
                            <option value="Process">Process</option>
                            <option value="System">System</option>
                            <option value="Human Error">Human Error</option>
                            <option value="Training">Training</option>
                            <option value="Documentation">Documentation</option>
                            <option value="Other">Other</option>
                          </select>
                        </div>

                        {/* Root Cause Description Input */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                          <textarea
                            value={rootCauseDescription}
                            onChange={(e) => setRootCauseDescription(e.target.value)}
                            placeholder="Enter root cause description"
                            rows={4}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
                          />
                        </div>

                        {/* Rejection Reason - Display only if editing rejected root cause */}
                        {editingRootCauseId && editingReasonReject && (
                          <div>
                            <label className="block text-sm font-semibold text-rose-600 mb-2">Previous Rejection Reason</label>
                            <div className="bg-rose-50 border-2 border-rose-200 rounded-lg p-4">
                              <p className="text-sm text-rose-600">{editingReasonReject}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Please update the root cause based on this feedback</p>
                          </div>
                        )}

                        {/* Save Button */}
                        <div className="flex justify-end gap-3">
                          <button
                            onClick={() => setIsEditingRootCause(false)}
                            className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveRootCause}
                            disabled={isSavingRootCause || !rootCauseName.trim()}
                            className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all font-semibold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {isSavingRootCause ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Save as Draft
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Draft Root Causes - Only visible to AuditeeOwner */}
                        {isAuditeeOwner && draftRootCauses.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              Draft Root Causes ({draftRootCauses.length})
                            </h4>
                            {draftRootCauses.map((rc, index) => (
                              <div 
                                key={rc.rootCauseId || `draft-${index}`}
                                className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 shadow-sm mb-3"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <span className="text-sm font-bold text-yellow-700">D{index + 1}</span>
                                    </div>
                                    <h4 className="text-base font-bold text-gray-900">{rc.name}</h4>
                                  </div>
                                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full border border-yellow-300">
                                    Draft
                                  </span>
                                </div>
                                
                                {rc.description && (
                                  <p className="text-sm text-gray-700 mt-2 pl-10">{rc.description}</p>
                                )}
                                
                                <div className="flex items-center justify-between gap-4 mt-3 pl-10">
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    {rc.category}
                                  </span>
                                  
                                  {/* Draft Action Buttons */}
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleSendDraftForReview(rc.rootCauseId)}
                                      disabled={sendingRootCauseId === rc.rootCauseId}
                                      className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {sendingRootCauseId === rc.rootCauseId ? (
                                        <>
                                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                          Sending...
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                          </svg>
                                          Send
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteDraft(rc.rootCauseId)}
                                      disabled={deletingRootCauseId === rc.rootCauseId}
                                      className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                                    >
                                      {deletingRootCauseId === rc.rootCauseId ? (
                                        <>
                                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                          Deleting...
                                        </>
                                      ) : (
                                        <>
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                          </svg>
                                          Delete
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Pending/Approved/Rejected Root Causes */}
                        {rootCauses.length > 0 ? (
                          rootCauses.map((rc, index) => {
                            const statusLower = rc.status?.toLowerCase() || '';
                            const isPending = statusLower === 'pending' || statusLower === 'pendingreview';
                            const isApproved = statusLower === 'approved';
                            const isRejected = statusLower === 'rejected';
                            
                            // Debug log to check status
                            console.log(`Root Cause #${index + 1} "${rc.name}":`, {
                              status: rc.status,
                              isPending,
                              isApproved,
                              isRejected,
                              isAuditor,
                              isAuditeeOwner
                            });
                            
                            return (
                              <div 
                                key={rc.rootCauseId || index}
                                className="bg-gradient-to-br from-slate-50 to-slate-100/50 border-2 border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                      <span className="text-sm font-bold text-primary-700">#{index + 1}</span>
                                    </div>
                                    <h4 className="text-base font-bold text-gray-900">{rc.name}</h4>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isPending && (
                                      <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs font-semibold rounded-full border border-amber-200">
                                        Pending Review
                                      </span>
                                    )}
                                    {isApproved && (
                                      <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-semibold rounded-full border border-green-200 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Approved
                                      </span>
                                    )}
                                    {isRejected && (
                                      <span className="px-3 py-1 bg-rose-50 text-rose-600 text-xs font-semibold rounded-full border border-rose-200 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        Rejected
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {rc.description && (
                                  <p className="text-sm text-gray-700 mt-2 pl-10">{rc.description}</p>
                                )}
                                
                                {rc.reasonReject && isRejected && (
                                  <div className="mt-3 pl-10 bg-rose-50 border border-rose-200 rounded-lg p-3">
                                    <p className="text-xs font-semibold text-rose-600 mb-1">Rejection Reason:</p>
                                    <p className="text-sm text-rose-600">{rc.reasonReject}</p>
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between gap-4 mt-3 pl-10">
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    {rc.category}
                                  </span>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-2">
                                    {/* Auditor Review Buttons - Any Auditor can review pending root causes */}
                                    {isAuditor && isPending && !isAuditeeOwner && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApproveRootCause(rc.rootCauseId);
                                          }}
                                          disabled={isProcessingReview}
                                          className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          Approve
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setReviewingRootCauseId(rc.rootCauseId);
                                          }}
                                          disabled={isProcessingReview}
                                          className="px-3 py-1.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-xs font-semibold disabled:opacity-50 flex items-center gap-1"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    
                                    {/* AuditeeOwner Edit Button for Rejected */}
                                    {isAuditeeOwner && isRejected && (
                                      <button
                                        onClick={() => handleEditRootCause(rc)}
                                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-semibold flex items-center gap-1"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <p className="text-base text-gray-500 font-medium">No root cause added yet</p>
                            <p className="text-sm text-gray-400 mt-1">Click Add New button to create the first root cause</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-white border-t-2 border-gray-200 px-6 sm:px-8 py-5 flex justify-end shadow-lg">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all duration-200 text-base font-bold shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Created By Detail Modal */}
      {showCreatedByModal && createdByData && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setShowCreatedByModal(false)}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-8 rounded-t-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold mb-1">creator Person Details</h3>

                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-8 space-y-4">
                {/* Full Name */}
                {createdByData.fullName && (
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-2 border-purple-200 rounded-xl p-5 shadow-md">
                    <label className="block text-xs font-bold text-purple-700 uppercase tracking-wide mb-2">Full Name</label>
                    <p className="text-xl font-bold text-gray-900">{createdByData.fullName}</p>
                  </div>
                )}

                {/* Email */}
                {createdByData.email && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Email</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px]">{createdByData.email}</p>
                  </div>
                )}


                {/* Department */}
                {createdByData.department && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Department</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px]">{createdByData.department}</p>
                  </div>
                )}

                {/* Role */}
                {createdByData.roleName && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Role</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px]">{createdByData.roleName}</p>
                  </div>
                )}

               
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t-2 border-gray-200 px-6 py-4 rounded-b-2xl flex justify-end">
                <button
                  onClick={() => setShowCreatedByModal(false)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Witness Detail Modal */}
      {showWitnessModal && witnessData && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setShowWitnessModal(false)}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-auto animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <h3 className="text-2xl font-bold text-white">Witness Information</h3>
                  </div>
                  <button
                    onClick={() => setShowWitnessModal(false)}
                    className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                {/* Full Name */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-2 border-purple-200 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-200 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-purple-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <label className="text-xs font-bold text-purple-700 uppercase tracking-wide">Full Name</label>
                  </div>
                  <p className="text-lg font-bold text-purple-900 pl-[52px]">{witnessData.fullName || 'N/A'}</p>
                </div>

                {/* Email */}
                {witnessData.email && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Email</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px] break-all">{witnessData.email}</p>
                  </div>
                )}

                {/* Phone Number */}
                {witnessData.phoneNumber && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Phone Number</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px]">{witnessData.phoneNumber}</p>
                  </div>
                )}

                {/* Department */}
                {witnessData.department && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Department</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px]">{witnessData.department}</p>
                  </div>
                )}

                {/* Role */}
                {witnessData.roleName && (
                  <div className="bg-white border-2 border-gray-200 rounded-xl p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Role</label>
                    </div>
                    <p className="text-base font-semibold text-gray-900 pl-[52px]">{witnessData.roleName}</p>
                  </div>
                )}

            
              </div>

              {/* Footer */}
              <div className="bg-gray-50 border-t-2 border-gray-200 px-6 py-4 rounded-b-2xl flex justify-end">
                <button
                  onClick={() => setShowWitnessModal(false)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Root Cause Modal */}
      {reviewingRootCauseId && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => {
              setReviewingRootCauseId(null);
              setRejectReason('');
            }}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto animate-slideUp"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 rounded-t-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">Reject Root Cause</h3>
                  </div>
                  <button
                    onClick={() => {
                      setReviewingRootCauseId(null);
                      setRejectReason('');
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
                <p className="text-gray-700">Please provide a reason for rejecting this root cause:</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={4}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-colors resize-none"
                  autoFocus
                />
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3 rounded-b-2xl">
                <button
                  onClick={() => {
                    setReviewingRootCauseId(null);
                    setRejectReason('');
                  }}
                  disabled={isProcessingReview}
                  className="px-5 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-semibold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRejectRootCause(reviewingRootCauseId, rejectReason)}
                  disabled={isProcessingReview || !rejectReason.trim()}
                  className="px-5 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isProcessingReview ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[70] animate-slideDown">
          <div
            className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl ${
              toast.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-rose-600 text-white'
            }`}
          >
            {toast.type === 'success' ? (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="font-semibold text-base">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindingDetailModal;

