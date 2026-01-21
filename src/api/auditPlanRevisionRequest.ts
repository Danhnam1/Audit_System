import apiClient from './client';
import { unwrap } from '../utils/normalize';

export interface ViewAuditPlanRevisionRequest {
  requestId: string;
  auditId: string;
  auditTitle?: string;
  requestedBy: string;
  requestedByName?: string;
  comment?: string;
  findingIds?: string[];
  status?: string;
  requestedAt?: string;
  respondedAt?: string;
  respondedBy?: string;
  respondedByName?: string;
  responseComment?: string;
}

export interface CreateAuditPlanRevisionRequest {
  auditId: string;
  comment?: string;
  findingIds?: string[];
}

export interface ApproveRejectRequest {
  responseComment?: string;
}

export interface ViewAuditPlanRevisionRequestMarkedItem {
  requestId: string;
  auditItemId: string;
  createdAt: string;
  status: string; // Status của marked item: "Pending", "Approved", "Rejected"
  auditId: string;
  questionTextSnapshot: string;
  section: string;
  order?: number;
  itemStatus: string; // Status của AuditChecklistItem
  comment?: string;
  markStatus: string;
}

// Create revision request (Lead Auditor)
export const createAuditPlanRevisionRequest = async (
  dto: CreateAuditPlanRevisionRequest
): Promise<ViewAuditPlanRevisionRequest> => {
  const res: any = await apiClient.post('/AuditPlanRevisionRequest', dto);
  return res?.data ?? res;
};

// Get revision request by ID
export const getAuditPlanRevisionRequestById = async (
  requestId: string
): Promise<ViewAuditPlanRevisionRequest> => {
  const res: any = await apiClient.get(`/AuditPlanRevisionRequest/${requestId}`);
  return res?.data ?? res;
};

// Get revision requests by audit ID
export const getAuditPlanRevisionRequestsByAuditId = async (
  auditId: string
): Promise<ViewAuditPlanRevisionRequest[]> => {
  const res: any = await apiClient.get(`/AuditPlanRevisionRequest/audit/${auditId}`);
  const data = res?.data ?? res;
  return unwrap<ViewAuditPlanRevisionRequest>(data);
};

// Get my revision requests (Lead Auditor)
export const getMyAuditPlanRevisionRequests = async (): Promise<ViewAuditPlanRevisionRequest[]> => {
  const res: any = await apiClient.get('/AuditPlanRevisionRequest/my-requests');
  const data = res?.data ?? res;
  return unwrap<ViewAuditPlanRevisionRequest>(data);
};

// Get pending requests for Director
export const getPendingRevisionRequestsForDirector = async (): Promise<ViewAuditPlanRevisionRequest[]> => {
  const res: any = await apiClient.get('/AuditPlanRevisionRequest/pending-for-director');
  const data = res?.data ?? res;
  return unwrap<ViewAuditPlanRevisionRequest>(data);
};

// Get approved requests for Director
export const getApprovedRevisionRequestsForDirector = async (): Promise<ViewAuditPlanRevisionRequest[]> => {
  const res: any = await apiClient.get('/AuditPlanRevisionRequest?status=Approved');
  const data = res?.data ?? res;
  return unwrap<ViewAuditPlanRevisionRequest>(data);
};

// Get rejected requests for Director
export const getRejectedRevisionRequestsForDirector = async (): Promise<ViewAuditPlanRevisionRequest[]> => {
  const res: any = await apiClient.get('/AuditPlanRevisionRequest?status=Rejected');
  const data = res?.data ?? res;
  return unwrap<ViewAuditPlanRevisionRequest>(data);
};

// Get all requests for Director (pending, approved, rejected)
export const getAllRevisionRequestsForDirector = async (): Promise<ViewAuditPlanRevisionRequest[]> => {
  const res: any = await apiClient.get('/AuditPlanRevisionRequest/for-director');
  const data = res?.data ?? res;
  return unwrap<ViewAuditPlanRevisionRequest>(data);
};

// Get all revision requests (with optional status filter)
export const getAllAuditPlanRevisionRequests = async (status?: string): Promise<ViewAuditPlanRevisionRequest[]> => {
  const queryParams = new URLSearchParams();
  if (status) {
    queryParams.append('status', status);
  }
  const url = `/AuditPlanRevisionRequest${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  const res: any = await apiClient.get(url);
  const data = res?.data ?? res;
  return unwrap<ViewAuditPlanRevisionRequest>(data);
};

// Approve revision request (Director)
export const approveAuditPlanRevisionRequest = async (
  requestId: string,
  responseComment?: string
): Promise<ViewAuditPlanRevisionRequest> => {
  const res: any = await apiClient.put(`/AuditPlanRevisionRequest/${requestId}/approve`, {
    responseComment: responseComment || '',
  });
  return res?.data ?? res;
};

// Reject revision request (Director)
export const rejectAuditPlanRevisionRequest = async (
  requestId: string,
  responseComment?: string
): Promise<ViewAuditPlanRevisionRequest> => {
  const res: any = await apiClient.put(`/AuditPlanRevisionRequest/${requestId}/reject`, {
    responseComment: responseComment || '',
  });
  return res?.data ?? res;
};

// Get marked items by request ID
export const getMarkedItemsByRequestId = async (
  requestId: string
): Promise<ViewAuditPlanRevisionRequestMarkedItem[]> => {
  const res: any = await apiClient.get(`/AuditPlanRevisionRequest/${requestId}/marked-items`);
  const data = res?.data ?? res;
  console.log('[getMarkedItemsByRequestId] Raw API response:', { requestId, res, data });
  console.log('[getMarkedItemsByRequestId] Data structure:', {
    isArray: Array.isArray(data),
    has$values: Array.isArray(data?.$values),
    hasValues: Array.isArray(data?.values),
    $valuesLength: data?.$values?.length,
    valuesLength: data?.values?.length
  });
  
  // Unwrap handles: array, { $values: [...] }, { values: [...] }
  const unwrapped = unwrap<ViewAuditPlanRevisionRequestMarkedItem>(data);
  console.log('[getMarkedItemsByRequestId] Unwrapped data:', { requestId, unwrapped, count: unwrapped?.length || 0 });
  console.log('[getMarkedItemsByRequestId] Unwrapped is array?', Array.isArray(unwrapped));
  
  // Log each item in unwrapped array
  if (Array.isArray(unwrapped) && unwrapped.length > 0) {
    console.log('[getMarkedItemsByRequestId] Unwrapped items details:');
    unwrapped.forEach((item: any, idx: number) => {
      console.log(`  Item ${idx + 1}:`, {
        $id: item.$id,
        auditItemId: item.auditItemId,
        findingId: item.findingId,
        status: item.status,
        questionTextSnapshot: item.questionTextSnapshot?.substring(0, 50),
        title: item.title?.substring(0, 50)
      });
    });
  }
  
  // Ensure we always return an array
  if (!Array.isArray(unwrapped)) {
    console.warn('[getMarkedItemsByRequestId] Unwrapped data is not an array, returning empty array');
    console.warn('[getMarkedItemsByRequestId] Unwrapped type:', typeof unwrapped, unwrapped);
    return [];
  }
  
  return unwrapped;
};





