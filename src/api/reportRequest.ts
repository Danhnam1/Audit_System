import { apiClient } from '../hooks/axios';

export interface SubmitReportRequest {
  auditId: string;
}

export interface ApproveReportRequest {
  comment?: string;
}

export interface RejectReportRequest {
  comment?: string;
}

export interface ViewReportRequest {
  reportRequestId: string;
  auditId: string;
  requestedBy: string;
  title?: string;
  status: string;
  filePath?: string;
  requestedAt?: string;
  completedAt?: string;
  note?: string;
}

// Submit final report (Auditor)
export const submitFinalReport = async (auditId: string): Promise<ViewReportRequest> => {
  const res = await apiClient.post('/ReportRequest/final/submit', { auditId } as SubmitReportRequest);
  return res?.data?.data ?? res?.data ?? res;
};

// Approve final report (Lead Auditor or Director)
export const approveFinalReport = async (
  reportRequestId: string,
  comment?: string
): Promise<ViewReportRequest> => {
  const res = await apiClient.post(
    `/ReportRequest/final/${encodeURIComponent(reportRequestId)}/approve`,
    { comment: comment || '' } as ApproveReportRequest
  );
  return res?.data?.data ?? res?.data ?? res;
};

// Reject final report (Lead Auditor or Director)
export const rejectFinalReport = async (
  reportRequestId: string,
  comment?: string
): Promise<ViewReportRequest> => {
  const res = await apiClient.post(
    `/ReportRequest/final/${encodeURIComponent(reportRequestId)}/reject`,
    { comment: comment || '' } as RejectReportRequest
  );
  return res?.data?.data ?? res?.data ?? res;
};

// Get all report requests
export const getAllReportRequests = async (): Promise<ViewReportRequest[]> => {
  const res = await apiClient.get('/ReportRequest');
  const { unwrap } = await import('../utils/normalize');
  const unwrapped = unwrap<ViewReportRequest[]>(res);
  // Flatten in case unwrap returns array of arrays
  return Array.isArray(unwrapped) ? unwrapped.flat() : [];
};

// Get report request by ID
export const getReportRequestById = async (id: string): Promise<ViewReportRequest | null> => {
  try {
    const res = await apiClient.get(`/ReportRequest/${encodeURIComponent(id)}`);
    return res?.data ?? res;
  } catch (error) {
    console.error('Failed to get report request:', error);
    return null;
  }
};

// Get report request by audit ID (returns the LATEST one)
// Priority: completedAt (when reject/approve happens) > requestedAt (when submit happens)
export const getReportRequestByAuditId = async (auditId: string): Promise<ViewReportRequest | null> => {
  try {
    const allRequests = await getAllReportRequests();
    // Filter all ReportRequests for this auditId
    const matchingRequests = allRequests.filter(r => r.auditId === auditId);
    
    if (matchingRequests.length === 0) {
      return null;
    }
    
    // If only one, return it
    if (matchingRequests.length === 1) {
      return matchingRequests[0];
    }
    
    // If multiple, return the LATEST one
    // Compare max(completedAt, requestedAt) for each ReportRequest to find the most recent action
    const latest = matchingRequests.reduce((latest, current) => {
      const latestCompletedAt = latest.completedAt ? new Date(latest.completedAt).getTime() : 0;
      const currentCompletedAt = current.completedAt ? new Date(current.completedAt).getTime() : 0;
      const latestRequestedAt = latest.requestedAt ? new Date(latest.requestedAt).getTime() : 0;
      const currentRequestedAt = current.requestedAt ? new Date(current.requestedAt).getTime() : 0;
      
      // Get the latest timestamp for each ReportRequest (completedAt or requestedAt, whichever is newer)
      const latestLatest = Math.max(latestCompletedAt, latestRequestedAt);
      const currentLatest = Math.max(currentCompletedAt, currentRequestedAt);
      
      // Use the ReportRequest with the latest timestamp
      return currentLatest >= latestLatest ? current : latest;
    });
    
    return latest;
  } catch (error) {
    console.error('Failed to get report request by audit ID:', error);
    return null;
  }
};

// Get report request from submitAudit API (Reports page)
// Filter by status values that come from submitAudit: "Pending", "Approved", "Returned"
export const getReportRequestFromSubmitAudit = async (auditId: string): Promise<ViewReportRequest | null> => {
  try {
    const allRequests = await getAllReportRequests();
    // Filter ReportRequests for this auditId with statuses from submitAudit API
    const submitAuditStatuses = ['Pending', 'Approved', 'Returned', 'Rejected'];
    const matchingRequests = allRequests.filter(r => {
      if (r.auditId !== auditId) return false;
      const status = String(r.status || '').trim();
      return submitAuditStatuses.some(s => status === s || status.toLowerCase() === s.toLowerCase());
    });
    
    if (matchingRequests.length === 0) {
      return null;
    }
    
    // Return the LATEST one
    if (matchingRequests.length === 1) {
      return matchingRequests[0];
    }
    
    const latest = matchingRequests.reduce((latest, current) => {
      const latestCompletedAt = latest.completedAt ? new Date(latest.completedAt).getTime() : 0;
      const currentCompletedAt = current.completedAt ? new Date(current.completedAt).getTime() : 0;
      const latestRequestedAt = latest.requestedAt ? new Date(latest.requestedAt).getTime() : 0;
      const currentRequestedAt = current.requestedAt ? new Date(current.requestedAt).getTime() : 0;
      const latestLatest = Math.max(latestCompletedAt, latestRequestedAt);
      const currentLatest = Math.max(currentCompletedAt, currentRequestedAt);
      return currentLatest >= latestLatest ? current : latest;
    });
    
    return latest;
  } catch (error) {
    console.error('Failed to get report request from submitAudit:', error);
    return null;
  }
};

// Get report request from submitFinalReport API (Final Summary page)
// Filter by status values that come from submitFinalReport: "PendingFirstApproval", "PendingSecondApproval", "Approved", "Rejected"
export const getReportRequestFromFinalSubmit = async (auditId: string): Promise<ViewReportRequest | null> => {
  try {
    const allRequests = await getAllReportRequests();
    // Filter ReportRequests for this auditId with statuses from submitFinalReport API
    const finalSubmitStatuses = ['PendingFirstApproval', 'PendingSecondApproval', 'Approved', 'Rejected', 'Returned'];
    const matchingRequests = allRequests.filter(r => {
      if (r.auditId !== auditId) return false;
      const status = String(r.status || '').trim();
      return finalSubmitStatuses.some(s => status === s || status.toLowerCase() === s.toLowerCase());
    });
    
    if (matchingRequests.length === 0) {
      return null;
    }
    
    // Return the LATEST one
    if (matchingRequests.length === 1) {
      return matchingRequests[0];
    }
    
    const latest = matchingRequests.reduce((latest, current) => {
      const latestCompletedAt = latest.completedAt ? new Date(latest.completedAt).getTime() : 0;
      const currentCompletedAt = current.completedAt ? new Date(current.completedAt).getTime() : 0;
      const latestRequestedAt = latest.requestedAt ? new Date(latest.requestedAt).getTime() : 0;
      const currentRequestedAt = current.requestedAt ? new Date(current.requestedAt).getTime() : 0;
      const latestLatest = Math.max(latestCompletedAt, latestRequestedAt);
      const currentLatest = Math.max(currentCompletedAt, currentRequestedAt);
      return currentLatest >= latestLatest ? current : latest;
    });
    
    return latest;
  } catch (error) {
    console.error('Failed to get report request from final submit:', error);
    return null;
  }
};
