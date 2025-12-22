import { useState, useEffect } from 'react';
import { getFindingById, type Finding } from '../../../api/findings';
import { getAttachments, type Attachment } from '../../../api/attachments';
import { getUserById } from '../../../api/adminUsers';
import { getDepartmentById } from '../../../api/departments';
import { createRootCause, type CreateRootCauseDto, updateRootCause, approveRootCause, rejectRootCause, getRootCauseLogs } from '../../../api/rootCauses';
import useAuthStore from '../../../store/useAuthStore';
import apiClient from '../../../api/client';

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
  const [witnessName, setWitnessName] = useState<string>('');
  const [witnessData, setWitnessData] = useState<any>(null);
  const [departmentName, setDepartmentName] = useState<string>('');
  const [showWitnessModal, setShowWitnessModal] = useState(false);
  const [createdByName, setCreatedByName] = useState<string>('');
  const [createdByData, setCreatedByData] = useState<any>(null);
  const [showCreatedByModal, setShowCreatedByModal] = useState(false);
  const [rootCauses, setRootCauses] = useState<any[]>([]);
  const [rootCauseName, setRootCauseName] = useState<string>('');
  const [rootCauseDescription, setRootCauseDescription] = useState<string>('');
  const [rootCauseCategory, setRootCauseCategory] = useState<string>('Finding');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [isEditingRootCause, setIsEditingRootCause] = useState(false);
  const [isSavingRootCause, setIsSavingRootCause] = useState(false);
  const [editingRootCauseId, setEditingRootCauseId] = useState<number | null>(null);
  const [reviewingRootCauseId, setReviewingRootCauseId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [editingReasonReject, setEditingReasonReject] = useState<string>('');
  const [isProcessingReview, setIsProcessingReview] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [rootCauseToDelete, setRootCauseToDelete] = useState<number | null>(null);
  
  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'details' | 'rootcauses'>('details');
  
  const { role } = useAuthStore();
  const isAuditeeOwner = role === 'AuditeeOwner';
  const isAuditor = role === 'Auditor';
  
  // Debug logging
  console.log('🔍 Role check:', { role, isAuditor, isAuditeeOwner, findingCreatedBy: finding?.createdBy });

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

      // Fetch all root causes by finding ID with their history
      try {
        const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
        const rootCausesList = res.data.$values || [];
        console.log('Loaded root causes for finding:', findingId, rootCausesList);
        
        // Fetch history for each root cause
        const rootCausesWithHistory = await Promise.all(
          rootCausesList.map(async (rc: any) => {
            try {
              const logs = await getRootCauseLogs(rc.rootCauseId);
              return { ...rc, history: logs };
            } catch (err) {
              console.error('Error loading history for root cause:', rc.rootCauseId, err);
              return { ...rc, history: [] };
            }
          })
        );
        
        setRootCauses(rootCausesWithHistory);
      } catch (err) {
        console.error('Error loading root causes:', err);
        setRootCauses([]);
      }
    } catch (err: any) {
      console.error('Error loading finding:', err);
      setError(err?.message || 'Failed to load finding details');
    } finally {
      setLoading(false);
    }
  };

  const loadAttachments = async () => {
    try {
      const data = await getAttachments('finding', findingId);
      setAttachments(data);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
      // Don't show error for attachments, just log it
    }
  };

  const handleSaveRootCause = async () => {
    if (!finding || !rootCauseName.trim()) {
      showToast('Please enter root cause name', 'error');
      return;
    }

    // Validate category
    if (!rootCauseCategory.trim()) {
      showToast('Please select a category', 'error');
      return;
    }
    
    // If "Other" is selected, validate custom category
    if (rootCauseCategory === 'Other' && !customCategory.trim()) {
      showToast('Please enter a custom category name', 'error');
      return;
    }
    
    // Determine final category value
    const finalCategory = rootCauseCategory === 'Other' ? customCategory.trim() : rootCauseCategory.trim();

    // Check for duplicate root cause name (case-insensitive)
    const trimmedName = rootCauseName.trim();
    const isDuplicate = rootCauses.some((rc: any) => {
      // When editing, exclude the current root cause from duplicate check
      if (editingRootCauseId && rc.rootCauseId === editingRootCauseId) {
        return false;
      }
      // Case-insensitive comparison
      return rc.name?.trim().toLowerCase() === trimmedName.toLowerCase();
    });

    if (isDuplicate) {
      showToast('A root cause with this name already exists. Please use a different name.', 'error');
      return;
    }

    setIsSavingRootCause(true);
    try {
      if (editingRootCauseId) {
        // Update existing root cause - keep as Draft
        const currentRootCause = rootCauses.find(rc => rc.rootCauseId === editingRootCauseId);
        
        const rootCauseDto: Partial<CreateRootCauseDto> & { deptId?: number; findingId?: string; reasonReject?: string; reviewBy?: string } = {
          name: rootCauseName.trim(),
          description: rootCauseDescription.trim(),
          status: 'Draft', // Keep as draft when editing
          category: finalCategory,
          deptId: finding.deptId || 0,
          findingId: findingId,
          reasonReject: editingReasonReject || (currentRootCause?.reasonReject || ''),
          reviewBy: currentRootCause?.reviewBy || '',
        };
        
        console.log('📤 Updating root cause with payload:', rootCauseDto);
        await updateRootCause(editingRootCauseId, rootCauseDto as any);
        showToast('Root cause saved as draft!', 'success');
        setEditingRootCauseId(null);
      } else {
        // Create new root cause as Draft (not submitted yet)
        const rootCauseDto: CreateRootCauseDto & { deptId: number; findingId: string; category: string } = {
          name: rootCauseName.trim(),
          description: rootCauseDescription.trim(),
          status: 'Draft', // Save as draft instead of Pending
          category: finalCategory,
          deptId: finding.deptId || 0,
          findingId: findingId,
        };

        await createRootCause(rootCauseDto as any);
        showToast('Root cause saved as draft!', 'success');
      }
      
      setRootCauseName('');
      setRootCauseDescription('');
      setRootCauseCategory('Finding');
      setCustomCategory('');
      setEditingReasonReject('');
      setIsEditingRootCause(false);
      
      // Reload all root causes
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      setRootCauses(rootCausesList);
      
      // Small delay to ensure state is updated before dispatching event
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Dispatch event to notify other components about root cause update
      console.log('📢 Dispatching rootCauseUpdated event for finding:', findingId);
      window.dispatchEvent(new CustomEvent('rootCauseUpdated', {
        detail: { findingId: findingId }
      }));
    } catch (err: any) {
      console.error('Error saving root cause:', err);
      showToast('Failed to save root cause: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsSavingRootCause(false);
    }
  };
  
  // Submit all draft root causes at once
  const handleSubmitAllRootCauses = async () => {
    const draftRootCauses = rootCauses.filter(rc => rc.status?.toLowerCase() === 'draft');
    
    if (draftRootCauses.length === 0) {
      showToast('No draft root causes to submit', 'error');
      return;
    }
    
    setIsProcessingReview(true);
    try {
      // Update all draft root causes to Pending status
      await Promise.all(
        draftRootCauses.map(async (rc) => {
          const rootCauseDto: Partial<CreateRootCauseDto> & { deptId?: number; findingId?: string; reasonReject?: string; reviewBy?: string } = {
            name: rc.name,
            description: rc.description,
            status: 'Pending', // Change from Draft to Pending
            category: rc.category,
            deptId: finding?.deptId || 0,
            findingId: findingId,
            reasonReject: rc.reasonReject || '',
            reviewBy: rc.reviewBy || '',
          };
          await updateRootCause(rc.rootCauseId, rootCauseDto as any);
        })
      );
      
      showToast(`${draftRootCauses.length} root cause(s) submitted for review!`, 'success');
      
      // Reload all root causes
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      setRootCauses(rootCausesList);
      
      // Small delay to ensure state is updated before dispatching event
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Dispatch event to notify other components about root cause update
      console.log('📢 Dispatching rootCauseUpdated event for finding:', findingId);
      window.dispatchEvent(new CustomEvent('rootCauseUpdated', {
        detail: { findingId: findingId }
      }));
    } catch (err: any) {
      console.error('Error submitting root causes:', err);
      showToast('Failed to submit root causes: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsProcessingReview(false);
    }
  };
  
  // Delete draft root cause
  const handleDeleteRootCause = (id: number) => {
    setRootCauseToDelete(id);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteRootCause = async () => {
    if (!rootCauseToDelete) return;
    
    try {
      await apiClient.delete(`/RootCauses/${rootCauseToDelete}`);
      showToast('Draft deleted successfully!', 'success');
      
      // Reload all root causes
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      setRootCauses(rootCausesList);
    } catch (err: any) {
      console.error('Error deleting root cause:', err);
      showToast('Failed to delete draft: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setShowDeleteConfirmModal(false);
      setRootCauseToDelete(null);
    }
  };
  
  // Handle edit root cause
  const handleEditRootCause = (rc: any) => {
    setEditingRootCauseId(rc.rootCauseId);
    setRootCauseName(rc.name || '');
    setRootCauseDescription(rc.description || '');
    
    // Check if category is in the predefined list
    const predefinedCategories = ['Finding', 'Process', 'Human Error', 'Training', 'Documentation'];
    const category = rc.category || 'Finding';
    
    if (predefinedCategories.includes(category)) {
      setRootCauseCategory(category);
      setCustomCategory('');
    } else {
      // Custom category - set to "Other" and populate custom field
      setRootCauseCategory('Other');
      setCustomCategory(category);
    }
    
    setEditingReasonReject(rc.reasonReject || '');
    setIsEditingRootCause(true);
  };
  
  // Handle approve root cause
  const handleApproveRootCause = async (id: number) => {
    setIsProcessingReview(true);
    try {
      await approveRootCause(id);
      showToast('Root cause approved successfully!', 'success');
      
      // Reload root causes
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      setRootCauses(rootCausesList);
      
      // Small delay to ensure state is updated before dispatching event
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Dispatch event to notify other components about root cause update
      console.log('📢 Dispatching rootCauseUpdated event for finding:', findingId);
      window.dispatchEvent(new CustomEvent('rootCauseUpdated', {
        detail: { findingId: findingId }
      }));
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
      
      // Reload root causes
      const res = await apiClient.get(`/RootCauses/by-finding/${findingId}`);
      const rootCausesList = res.data.$values || [];
      setRootCauses(rootCausesList);
      
      // Small delay to ensure state is updated before dispatching event
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Dispatch event to notify other components about root cause update
      console.log('📢 Dispatching rootCauseUpdated event for finding:', findingId);
      window.dispatchEvent(new CustomEvent('rootCauseUpdated', {
        detail: { findingId: findingId }
      }));
    } catch (err: any) {
      console.error('Error rejecting root cause:', err);
      showToast('Failed to reject root cause: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setIsProcessingReview(false);
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
          className="relative bg-white rounded-xl shadow-lg w-full max-w-5xl mx-auto max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-blue-600 px-6 py-5 flex items-center justify-between z-10 border-b border-blue-700">
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span className="text-white font-medium">Loading finding details...</span>
                </div>
              ) : (
                <div>
                  <h2 className="text-2xl font-bold text-white">Finding Details</h2>
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
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-3 text-gray-600">Loading finding details...</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-6 text-red-700">
                <p className="font-medium">Error</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {finding && !loading && (
              <>
                {/* Tab Navigation */}
                <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
                  <div className="flex px-6">
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors ${
                        activeTab === 'details'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setActiveTab('rootcauses')}
                      className={`px-6 py-4 font-medium text-sm border-b-2 transition-colors relative ${
                        activeTab === 'rootcauses'
                          ? 'border-blue-600 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Root Causes
                      {rootCauses.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-600 text-xs font-semibold rounded-full">
                          {rootCauses.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                  {activeTab === 'details' && (
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
                      value={finding.title || ''}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Description
                    </label>
                    <textarea
                      value={finding.description || 'No description provided'}
                      readOnly
                      rows={4}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium resize-none"
                    />
                  </div>

                  {/* Severity */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                      Severity
                    </label>
                    <input
                      type="text"
                      value={finding.severity || 'N/A'}
                      readOnly
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                    />
                  </div>

                  {/* Department */}
                  {finding.deptId && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Department
                      </label>
                      <input
                        type="text"
                        value={departmentName || 'Loading...'}
                        readOnly
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                      />
                    </div>
                  )}

               

                  {/* Witness */}
                  {finding.witnessId && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Witness
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={witnessName || 'Loading...'}
                          readOnly
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium pr-10"
                        />
                        {witnessData && (
                          <button
                            onClick={() => setShowWitnessModal(true)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Click to view witness details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Created By / Responsible Person */}
                  {finding.createdBy && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Creator Person
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={createdByName || 'Loading...'}
                          readOnly
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium pr-10"
                        />
                        {createdByData && (
                          <button
                            onClick={() => setShowCreatedByModal(true)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Click to view responsible person details"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  {finding.deadline && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Deadline
                      </label>
                      <input
                        type="text"
                        value={formatDate(finding.deadline)}
                        readOnly
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 font-medium"
                      />
                    </div>
                  )}
                  {finding.createdAt && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                        Created At
                      </label>
                      <input
                        type="text"
                        value={formatDate(finding.createdAt)}
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
                        const imageUrl = attachment.filePath ? `${attachment.filePath}` : '';
                        
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
                                    <p className="text-gray-700 font-medium truncate">{attachment.fileName}</p>
                                    <p className="text-xs text-gray-500">
                                      {formatFileSize(attachment.fileSize || 0)} • {new Date(attachment.uploadedAt).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <a
                                  href={imageUrl || attachment.filePath}
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
                    </div>
                  )}

                  {activeTab === 'rootcauses' && (
                    <div className="space-y-6">
                      {/* Root Cause - Editable for AuditeeOwner */}
                      <div className="bg-white border-2 border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-200 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Root Cause</label>
                      </div>
                      {isAuditeeOwner && !rootCauses.some(rc => rc.status?.toLowerCase() === 'pending' || rc.status?.toLowerCase() === 'approved') && (
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
                            onChange={(e) => {
                              setRootCauseCategory(e.target.value);
                              if (e.target.value !== 'Other') {
                                setCustomCategory('');
                              }
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                          >
                            <option value="Finding">Finding</option>
                            <option value="Process">Process</option>
                            <option value="Human Error">Human Error</option>
                            <option value="Training">Training</option>
                            <option value="Documentation">Documentation</option>     
                            <option value="Other">Other</option>     
                          </select>
                          {rootCauseCategory === 'Other' && (
                            <div className="mt-3">
                             
                              <input
                                type="text"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                placeholder="Enter category "
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                              />
                            </div>
                          )}
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
                            className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {isSavingRootCause ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                               
                               Save Draft
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Submit All Drafts Button */}
                        {isAuditeeOwner && rootCauses.some(rc => rc.status?.toLowerCase() === 'draft') && (
                          <div className="mb-4 flex justify-end">
                            <button
                              onClick={handleSubmitAllRootCauses}
                              disabled={isProcessingReview}
                              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                              {isProcessingReview ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                  Submitting...
                                </>
                              ) : (
                                <>
                          
                                  Submit All ({rootCauses.filter(rc => rc.status?.toLowerCase() === 'draft').length})
                                </>
                              )}
                            </button>
                          </div>
                        )}
                        {/* Root Causes List */}
                        {rootCauses.length > 0 ? (
                          rootCauses.map((rc, index) => {
                            const statusLower = rc.status?.toLowerCase() || '';
                            const isDraft = statusLower === 'draft';
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
                                className={`rounded-lg p-5 transition-colors ${
                                  isApproved 
                                    ? 'bg-green-50 border-2 border-green-300 shadow-sm' 
                                    : isRejected
                                    ? 'bg-rose-50 border border-rose-200'
                                    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                      isApproved 
                                        ? 'bg-green-200' 
                                        : 'bg-primary-100'
                                    }`}>
                                      {isApproved ? (
                                        <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                      ) : (
                                        <span className={`text-sm font-bold ${
                                          isApproved ? 'text-green-700' : 'text-primary-700'
                                        }`}>#{index + 1}</span>
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <h4 className={`text-base font-bold ${
                                        isApproved ? 'text-green-900' : 'text-gray-900'
                                      }`}>{rc.name}</h4>
                                      {isApproved && (
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-semibold rounded-full border border-green-300 flex items-center gap-1">
                                            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Approved
                                          </span>
                                          {rc.reviewBy && (
                                            <span className="text-[10px] text-green-600 font-medium">
                                              by {rc.reviewBy}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isDraft && (
                                      <span className="px-3 py-1 bg-gray-50 text-gray-600 text-xs font-semibold rounded-full border border-gray-300">
                                        Draft
                                      </span>
                                    )}
                                    {isPending && (
                                      <span className="px-3 py-1 bg-amber-50 text-amber-600 text-xs font-semibold rounded-full border border-amber-200">
                                        Pending Review
                                      </span>
                                    )}
                                    {isApproved && (
                                      <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-full border-2 border-green-300 flex items-center gap-1.5 shadow-sm">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
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
                                
                                {/* History - Inline Display - Only show if there are logs with actual changes */}
                                {(() => {
                                  // First, check if there are any logs with changes
                                  if (!rc.history || rc.history.length === 0) return null;
                                  
                                  const logsWithChanges = rc.history.filter((log: any) => {
                                    let oldData: any = {};
                                    let newData: any = {};
                                    
                                    try {
                                      oldData = JSON.parse(log.oldValue || '{}');
                                      newData = JSON.parse(log.newValue || '{}');
                                    } catch (e) {
                                      return false;
                                    }
                                    
                                    // Only show Name, Description, ReasonReject changes
                                    const relevantFields = ['Name', 'Description', 'ReasonReject'];
                                    return relevantFields.some(field => oldData[field] !== newData[field]);
                                  });
                                  
                                  // Only render if there are logs with changes
                                  if (logsWithChanges.length === 0) return null;
                                  
                                  return (
                                    <div className="mt-3 pl-10 border-l-2 border-gray-300 pl-4">
                                      <h5 className="text-xs font-semibold text-gray-600 mb-2 uppercase">History</h5>
                                      <div className="space-y-2">
                                        {logsWithChanges.map((log: any) => {
                                          let oldData: any = {};
                                          let newData: any = {};
                                          
                                          try {
                                            oldData = JSON.parse(log.oldValue || '{}');
                                            newData = JSON.parse(log.newValue || '{}');
                                          } catch (e) {
                                            console.error('Error parsing log values:', e);
                                            return null;
                                          }
                                          
                                          // Only show Name, Description, ReasonReject changes
                                          const relevantFields = ['Name', 'Description', 'ReasonReject'];
                                          const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
                                          
                                          relevantFields.forEach(field => {
                                            if (oldData[field] !== newData[field]) {
                                              changes.push({
                                                field: field,
                                                oldValue: oldData[field],
                                                newValue: newData[field]
                                              });
                                            }
                                          });
                                          
                                          if (changes.length === 0) return null;
                                          
                                          return (
                                            <div key={log.logId} className="bg-gray-50 border border-gray-200 rounded p-3 text-xs">
                                              <div className="text-gray-500 mb-2">
                                                {new Date(log.performedAt).toLocaleString('en-US', {
                                                  month: 'short',
                                                  day: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })}
                                              </div>
                                              {changes.map((change, idx) => (
                                                <div key={idx} className="mb-2 last:mb-0">
                                                  <span className="font-medium text-gray-700">{change.field}:</span>
                                                  <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-gray-500">{change.oldValue || 'empty'}</span>
                                                    <span className="text-gray-400">→</span>
                                                    <span className="text-gray-900 font-medium">{change.newValue || 'empty'}</span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                                
                                <div className="flex items-center justify-between gap-4 mt-3 pl-10">
                                  <span className="flex items-center gap-1 text-xs text-gray-500">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    {rc.category}
                                  </span>
                                  
                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-2">
                                    {/* Draft Actions - Edit and Delete */}
                                    {isAuditeeOwner && isDraft && (
                                      <>
                                        <button
                                          onClick={() => handleEditRootCause(rc)}
                                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-semibold flex items-center gap-1"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                          </svg>
                                          Edit
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRootCause(rc.rootCauseId);
                                          }}
                                          className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs font-semibold flex items-center gap-1"
                                          title="Delete draft"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      </>
                                    )}
                                    
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
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
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
                    <h3 className="text-2xl font-bold mb-1">creator Person Details</h3>

                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-8 space-y-4">
                {/* Full Name */}
                {createdByData.fullName && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
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
                  className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
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
              className="relative bg-white rounded-xl shadow-lg w-full max-w-2xl mx-auto"
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
                  className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => {
              setShowDeleteConfirmModal(false);
              setRootCauseToDelete(null);
            }}
          />
          
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-auto">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Delete Draft?
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Are you sure you want to delete this draft? This action cannot be undone.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirmModal(false);
                    setRootCauseToDelete(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteRootCause}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindingDetailModal;

