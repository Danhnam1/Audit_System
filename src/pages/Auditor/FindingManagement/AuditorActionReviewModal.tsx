import { useState } from 'react';
import { toast } from 'react-toastify';
import ActionDetailModal from '../../CAPAOwner/ActionDetailModal';
import { approveFindingAction, returnFindingAction } from '../../../api/findings';

interface AuditorActionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string | null;
  findingId?: string;
  onDataReload?: () => Promise<void>;
}

/**
 * Wrapper component for Auditor to review actions with status "Verified"
 * Handles approve/return logic internally
 */
export default function AuditorActionReviewModal({
  isOpen,
  onClose,
  actionId,
  findingId,
  onDataReload
}: AuditorActionReviewModalProps) {
  const [processing, setProcessing] = useState(false);

  const handleApprove = async (actionIdParam: string, feedback: string) => {
    setProcessing(true);
    try {
      console.log('📤 [Auditor] Approving action:', actionIdParam);
      
      await approveFindingAction(actionIdParam, feedback);
      
      toast.success('Action approved successfully!');
      
      // Wait for backend commit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reload data via parent callback
      if (onDataReload) {
        await onDataReload();
      }
      
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('✅ [Auditor] Approval complete');
      onClose();
    } catch (err: any) {
      console.error('❌ [Auditor] Approve error:', err);
      toast.error(err?.response?.data?.message || 'Failed to approve action');
    } finally {
      setProcessing(false);
    }
  };

  const handleReturn = async (actionIdParam: string, feedback: string) => {
    setProcessing(true);
    try {
      console.log('📤 [Auditor] Returning action:', actionIdParam);
      
      await returnFindingAction(actionIdParam, feedback.trim());
      
      toast.success('Action returned successfully!');
      
      // Wait for backend commit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reload data via parent callback
      if (onDataReload) {
        await onDataReload();
      }
      
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log('✅ [Auditor] Return complete');
      onClose();
    } catch (err: any) {
      console.error('❌ [Auditor] Return error:', err);
      toast.error(err?.response?.data?.message || 'Failed to return action');
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
      expectedStatus="verified" // Auditor reviews 'verified' actions
      showReviewButtons={true} // Wrapper always provides callbacks
      onApprove={handleApprove}
      onReject={handleReturn}
      isProcessing={processing}
    />
  );
}
