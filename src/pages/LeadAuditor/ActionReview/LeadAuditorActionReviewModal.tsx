import { useState } from 'react';
import { toast } from 'react-toastify';
import { getUserFriendlyErrorMessage } from '../../../utils/errorMessages';
import ActionDetailModal from '../../CAPAOwner/ActionDetailModal';
import { approveFindingActionHigherLevel, rejectFindingActionHigherLevel } from '../../../api/findings';
import { updateActionProgressPercent } from '../../../api/actions';
import { getAttachments, updateAttachmentStatus } from '../../../api/attachments';

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
      
      // IMPORTANT: Approve only attachments with status "Open" before approving the action
      try {
        const attachments = await getAttachments('Action', actionIdParam);
        const openAttachments = attachments.filter(att => att.status?.toLowerCase() === 'open');
        // const rejectedAttachments = attachments.filter(att => att.status?.toLowerCase() === 'rejected'); // Unused
        
        
        if (openAttachments.length > 0) {
          const approvePromises = openAttachments.map(async (attachment) => {
            try {
              await updateAttachmentStatus(attachment.attachmentId, 'Approved');
            } catch (err: any) {
              console.error(`  ✗ Failed to approve attachment ${attachment.fileName}:`, err);
            }
          });
          await Promise.all(approvePromises);
        }
      } catch (attErr) {
        console.warn('Could not load/approve attachments:', attErr);
      }
      
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
      
      onClose();
    } catch (err: any) {
      toast.error(getUserFriendlyErrorMessage(err, 'Failed to approve action. Please try again.'));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (actionIdParam: string, feedback: string) => {
    setProcessing(true);
    try {
      
      await rejectFindingActionHigherLevel(actionIdParam, feedback.trim());
      
      // Reset progress to 0 when action is rejected
      try {
        await updateActionProgressPercent(actionIdParam, 0);
      } catch (progressError: any) {
        // Don't fail the whole operation if progress reset fails
      }
      
      toast.success('Action rejected successfully!');
      
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
      toast.error(getUserFriendlyErrorMessage(err, 'Failed to reject action. Please try again.'));
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
