import { useState } from 'react';
import { toast } from 'react-toastify';
import ActionDetailModal from '../../CAPAOwner/ActionDetailModal';
import { approveFindingActionHigherLevel, rejectFindingActionHigherLevel } from '../../../api/findings';

interface LeadAuditorActionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string | null;
  findingId?: string;
  onDataReload?: () => Promise<void>;
}

/**
 * Wrapper component for LeadAuditor to review actions with status "Approved"
 * Handles final approve/reject logic internally
 */
export default function LeadAuditorActionReviewModal({
  isOpen,
  onClose,
  actionId,
  findingId,
  onDataReload
}: LeadAuditorActionReviewModalProps) {
  const [processing, setProcessing] = useState(false);

  const handleApprove = async (actionIdParam: string, feedback: string) => {
    setProcessing(true);
    try {
      console.log('📤 [LeadAuditor] Approving action:', actionIdParam);
      
      await approveFindingActionHigherLevel(actionIdParam, feedback || '');
      
      toast.success('Action approved successfully!');
      
      // Wait for backend commit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reload data via parent callback
      if (onDataReload) {
        await onDataReload();
      }
      
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('✅ [LeadAuditor] Approval complete');
      onClose();
    } catch (err: any) {
      console.error('❌ [LeadAuditor] Approve error:', err);
      toast.error(err?.response?.data?.message || 'Failed to approve action');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (actionIdParam: string, feedback: string) => {
    setProcessing(true);
    try {
      console.log('📤 [LeadAuditor] Rejecting action:', actionIdParam);
      
      await rejectFindingActionHigherLevel(actionIdParam, feedback.trim());
      
      toast.success('Action rejected successfully!');
      
      // Wait for backend commit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reload data via parent callback
      if (onDataReload) {
        await onDataReload();
      }
      
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('✅ [LeadAuditor] Rejection complete');
      onClose();
    } catch (err: any) {
      console.error('❌ [LeadAuditor] Reject error:', err);
      toast.error(err?.response?.data?.message || 'Failed to reject action');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <ActionDetailModal
      isOpen={isOpen}
      onClose={onClose}
      actionId={actionId || undefined}
      findingId={findingId}
      expectedStatus="approved" // LeadAuditor reviews 'approved' actions
      showReviewButtons={true} // Wrapper always provides callbacks
      onApprove={handleApprove}
      onReject={handleReject}
      isProcessing={processing}
    />
  );
}
