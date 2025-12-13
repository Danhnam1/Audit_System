import { apiClient } from '../hooks/axios';

export interface IssueAccessGrantRequest {
  auditId: string;
  auditorId: string;
  deptId: number;
  validFrom: string; // ISO date string
  validTo: string; // ISO date string
  verifyCode?: string;
  ttlMinutes?: number;
}

export interface AccessGrant {
  grantId: string;
  auditId: string;
  auditorId: string;
  deptId: number;
  qrToken: string;
  qrUrl: string;
  verifyCode?: string;
  validFrom: string;
  validTo: string;
  status: string; // 'Active', 'Expired', 'Revoked'
  createdAt?: string;
}

export interface ScanAccessGrantRequest {
  qrToken: string;
  scannerUserId: string;
}

export interface ScanAccessGrantResponse {
  isValid: boolean;
  auditId?: string;
  auditorId?: string;
  deptId?: number;
  expiresAt?: string;
  reason?: string | null;
}

export interface VerifyCodeRequest {
  qrToken: string;
  scannerUserId: string;
  verifyCode: string;
}

export interface VerifyCodeResponse {
  isValid: boolean;
  reason?: string | null;
}

// Issue QR/permission for auditor
export const issueAccessGrant = async (request: IssueAccessGrantRequest): Promise<AccessGrant> => {
  const res: any = await apiClient.post('/AccessGrant/issue', request);
  return res?.data || res;
};

// Get list of access grants (with optional filters)
export const getAccessGrants = async (params?: {
  auditId?: string;
  deptId?: number;
  auditorId?: string;
}): Promise<AccessGrant[]> => {
  const queryParams = new URLSearchParams();
  if (params?.auditId) queryParams.append('auditId', params.auditId);
  if (params?.deptId !== undefined) queryParams.append('deptId', String(params.deptId));
  if (params?.auditorId) queryParams.append('auditorId', params.auditorId);
  
  const url = `/AccessGrant${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  const res: any = await apiClient.get(url);
  
  // Handle $values structure
  if (res?.$values && Array.isArray(res.$values)) {
    return res.$values;
  }
  if (Array.isArray(res)) {
    return res;
  }
  if (res?.data) {
    const data = res.data;
    if (data?.$values && Array.isArray(data.$values)) {
      return data.$values;
    }
    if (Array.isArray(data)) {
      return data;
    }
  }
  return [];
};

// Verify QR token (GET endpoint)
export const verifyQrToken = async (qrToken: string): Promise<ScanAccessGrantResponse> => {
  const res: any = await apiClient.get(`/AccessGrant/verify/${qrToken}`);
  return res?.data || res;
};

// Scan QR token (POST endpoint)
export const scanAccessGrant = async (request: ScanAccessGrantRequest): Promise<ScanAccessGrantResponse> => {
  const res: any = await apiClient.post('/AccessGrant/scan', request);
  return res?.data || res;
};

// Verify code (POST endpoint)
export const verifyCode = async (request: VerifyCodeRequest): Promise<VerifyCodeResponse> => {
  const res: any = await apiClient.post('/AccessGrant/verify-code', request);
  return res?.data || res;
};

