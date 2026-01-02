import { getAuditApprovals } from '../api/audits';
import { unwrap } from '../utils/normalize';

/**
 * Load rejection comment and determine who rejected the plan
 * This function handles multiple fallback strategies to load rejection comments
 * 
 * @param auditId - The audit plan ID
 * @param detailsWithSchedules - Plan details with schedules merged
 * @returns Object containing latestRejectionComment and rejectedBy
 */
export const loadRejectionComment = async (
  auditId: string,
  detailsWithSchedules: any
): Promise<{
  latestRejectionComment: string | null;
  rejectedBy: string | null;
}> => {
  let latestRejectionComment: string | null = null;
  let rejectedBy: string | null = null;
  
  const planStatus = String(
    detailsWithSchedules.status ||
      detailsWithSchedules.audit?.status ||
      ""
  ).toLowerCase().replace(/\s+/g, '');
  const isRejected = planStatus === "rejected" || planStatus === "declined";
  
  if (isRejected) {
    // Determine who rejected based on backend status
    // Backend sets status to "Declined" when Lead Auditor rejects
    // Backend sets status to "Rejected" when Director rejects
    if (planStatus === "declined") {
      rejectedBy = "Lead Auditor";
    } else if (planStatus === "rejected") {
      rejectedBy = "Director";
    }
    
    // First, check if comment is stored directly in the audit/auditPlan record
    latestRejectionComment =
      detailsWithSchedules.comment ||
      detailsWithSchedules.note || 
      detailsWithSchedules.audit?.comment ||
      detailsWithSchedules.audit?.note ||
      null;
    
    // If not found in audit record, try to get from AuditApproval table
    if (!latestRejectionComment) {
      try {
        const approvalsResponse = await getAuditApprovals();
        const approvals = unwrap(approvalsResponse) || [];
        const currentAuditId = String(
          detailsWithSchedules.auditId ||
            detailsWithSchedules.id ||
            auditId
        )
          .trim()
          .toLowerCase();
        
        // More robust filtering: case-insensitive comparison and handle different ID field names
        const related = approvals.filter((a: any) => {
          const approvalAuditId = String(
            a.auditId || a.audit?.auditId || a.audit?.id || ""
          )
            .trim()
            .toLowerCase();
          return (
            approvalAuditId === currentAuditId && approvalAuditId !== ""
          );
        });
        
        if (related.length > 0) {
          const rejected = related
            .filter((a: any) => {
              const approvalStatus = String(a.status || "").toLowerCase();
              return (
                approvalStatus.includes("rejected") ||
                approvalStatus === "rejected" ||
                approvalStatus.includes("declined") ||
                approvalStatus === "declined plan"
              );
            })
            .sort((a: any, b: any) => {
              const aTime = new Date(
                a.approvedAt || a.createdAt || 0
              ).getTime();
              const bTime = new Date(
                b.approvedAt || b.createdAt || 0
              ).getTime();
              return bTime - aTime;
            });
          
          if (rejected.length > 0) {
            // Try multiple possible field names for comment
            latestRejectionComment =
              rejected[0].comment ||
              rejected[0].rejectionComment || 
              rejected[0].note || 
              rejected[0].reason || 
              null;
            
            // rejectedBy is already determined from backend status above
            // Store rejection info in detailsWithSchedules
            if (rejectedBy) {
              (detailsWithSchedules as any).rejectedBy = rejectedBy;
            }
            
            // Debug logging
            if (!latestRejectionComment) {
              console.warn(
                "⚠️ Rejection comment not found for audit:",
                currentAuditId,
                {
                  rejectedItem: rejected[0],
                  allFields: Object.keys(rejected[0]),
                }
              );
            }
          }
        } else {
          console.warn(
            "⚠️ No related approvals found for audit:",
            currentAuditId,
            {
              totalApprovals: approvals.length,
              sampleApproval: approvals[0],
            }
          );
        }
      } catch (approvalErr) {
        console.error(
          "Failed to load audit approvals for plan",
          approvalErr
        );
      }
    }
  }

  return {
    latestRejectionComment,
    rejectedBy,
  };
};

