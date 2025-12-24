import { useState } from 'react';
import { toast } from 'react-toastify';
import ActionDetailModal from '../../CAPAOwner/ActionDetailModal';
import { approveActionWithFeedback, rejectAction } from '../../../api/actions';

interface AuditeeActionReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  actionId: string | null;
  findingId?: string;
  onDataReload?: () => Promise<void>;
}

/**
 * Wrapper component for AuditeeOwner to review actions with status "Reviewed"
 * Handles verify/decline logic internally
 */
export default function AuditeeActionReviewModal({
  isOpen,
  onClose,
  actionId,
  findingId,
  onDataReload
}: AuditeeActionReviewModalProps) {
  const [processing, setProcessing] = useState(false);

  const handleVerify = async (actionIdParam: string, feedback: string) => {
    setProcessing(true);
    try {
      
      await approveActionWithFeedback(actionIdParam, feedback || '');
      
      toast.success('Action verified successfully!');
      
      // Wait for backend commit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reload data via parent callback
      if (onDataReload) {
        await onDataReload();
      }
      
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      onClose();
    } catch (err: any) {
      console.error(' [AuditeeOwner] Verify error:', err);
      toast.error(err?.response?.data?.message || 'Failed to verify action');
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async (actionIdParam: string, feedback: string) => {
    setProcessing(true);
    try {
      
      await rejectAction(actionIdParam, feedback || '');
      
      toast.success('Action declined successfully!');
      
      // Wait for backend commit
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Reload data via parent callback
      if (onDataReload) {
        await onDataReload();
      }
      
      // Wait for UI to update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      onClose();
    } catch (err: any) {
      console.error(' [AuditeeOwner] Decline error:', err);
      toast.error(err?.response?.data?.message || 'Failed to decline action');
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
      expectedStatus="reviewed" // AuditeeOwner reviews 'reviewed' actions
      showReviewButtons={true} // Wrapper always provides callbacks
      onApprove={handleVerify}
      onReject={handleDecline}
      isProcessing={processing}
    />
  );
}
