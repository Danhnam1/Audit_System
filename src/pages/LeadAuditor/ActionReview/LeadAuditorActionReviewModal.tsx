import { useState } from 'react';
import { toast } from 'react-toastify';
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
      console.log('📤 [LeadAuditor] Approving action:', actionIdParam);
      
      // IMPORTANT: Approve only attachments with status "Open" before approving the action
      try {
        const attachments = await getAttachments('Action', actionIdParam);
        const openAttachments = attachments.filter(att => att.status?.toLowerCase() === 'open');
        const rejectedAttachments = attachments.filter(att => att.status?.toLowerCase() === 'rejected');
        
        console.log(`📎 Attachments to approve (Open status): ${openAttachments.length}`);
        console.log(`❌ Attachments NOT to approve (Rejected status): ${rejectedAttachments.length}`);
        
        if (openAttachments.length > 0) {
          console.log(`✅ [LeadAuditor] Approving ${openAttachments.length} attachment(s) with "Open" status...`);
          const approvePromises = openAttachments.map(async (attachment) => {
            try {
              await updateAttachmentStatus(attachment.attachmentId, 'Approved');
              console.log(`  ✓ Approved attachment: ${attachment.fileName}`);
            } catch (err: any) {
              console.error(`  ✗ Failed to approve attachment ${attachment.fileName}:`, err);
            }
          });
          await Promise.all(approvePromises);
          console.log(`✅ [LeadAuditor] Approved ${openAttachments.length} attachment(s)`);
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
      
      // Reset progress to 0 when action is rejected
      try {
        await updateActionProgressPercent(actionIdParam, 0);
        console.log('✅ [LeadAuditor] Progress reset to 0 after rejection');
      } catch (progressError: any) {
        console.error('⚠️ [LeadAuditor] Failed to reset progress:', progressError);
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
