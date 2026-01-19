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





