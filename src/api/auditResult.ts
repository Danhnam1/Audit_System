import { apiClient } from "../hooks/axios";

export interface AuditResult {
  auditId: string;
  result: string;
  percentage: number;
  comment?: string | null;
}

export interface UpdateAuditResultPayload {
  result?: string;
  percentage?: number;
  comment?: string | null;
}

export interface CalculateAuditResultRequest {
  passThreshold?: number;
}

// GET /api/AuditResult/audit/{auditId}
export const getAuditResultByAuditId = async (auditId: string): Promise<AuditResult | null> => {
  if (!auditId) return null;

  const res: any = await apiClient.get(`/AuditResult/audit/${encodeURIComponent(auditId)}`);
  const data = res?.data ?? res;
  return data ?? null;
};

// POST /api/AuditResult/calculate/{auditId}
export const calculateAuditResult = async (
  auditId: string,
  passThreshold?: number
): Promise<AuditResult> => {
  if (!auditId) {
    throw new Error("auditId is required to calculate audit result");
  }

  const body: CalculateAuditResultRequest = {};
  if (typeof passThreshold === "number") {
    body.passThreshold = passThreshold;
  }

  const res: any = await apiClient.post(
    `/AuditResult/calculate/${encodeURIComponent(auditId)}`,
    body
  );
  return res?.data ?? res;
};

// PUT /api/AuditResult/manager/{auditId}
export const updateAuditResultManager = async (
  auditId: string,
  payload: UpdateAuditResultPayload
): Promise<AuditResult> => {
  if (!auditId) {
    throw new Error("auditId is required to update audit result");
  }
  const res: any = await apiClient.put(
    `/AuditResult/manager/${encodeURIComponent(auditId)}`,
    payload
  );
  return res?.data ?? res;
};

