import { getAuditPlanById } from '../api/audits';

export type AuditSummary = {
  auditId: string;
  title: string;
  status?: string;
  type?: string;
  scope?: string;
  startDate?: string;
  endDate?: string;
};

const summaryCache = new Map<string, AuditSummary>();

const normalizeSummary = (raw: any, auditId: string): AuditSummary => {
  const auditNode = raw?.audit || raw || {};
  return {
    auditId,
    title:
      auditNode.title ||
      auditNode.auditTitle ||
      raw?.title ||
      raw?.auditTitle ||
      auditId,
    status: auditNode.status || raw?.status || '-',
    type: auditNode.type || raw?.type,
    scope: auditNode.scope || raw?.scope,
    startDate: auditNode.startDate || raw?.startDate || auditNode.periodFrom || raw?.periodFrom,
    endDate: auditNode.endDate || raw?.endDate || auditNode.periodTo || raw?.periodTo,
  };
};

export const fetchAuditSummary = async (auditId?: string | null): Promise<AuditSummary | null> => {
  if (!auditId) return null;
  if (summaryCache.has(auditId)) return summaryCache.get(auditId)!;

  try {
    const res = await getAuditPlanById(auditId);
    const detail = res?.data?.data ?? res?.data ?? res;
    const normalized = normalizeSummary(detail, auditId);
    summaryCache.set(auditId, normalized);
    return normalized;
  } catch (err) {
    console.warn('[auditSummary] Failed to load audit plan', auditId, err);
    return null;
  }
};

export const fetchAuditSummaries = async (auditIds: string[]): Promise<Record<string, AuditSummary>> => {
  const uniqueIds = Array.from(new Set(auditIds.filter(Boolean)));
  const result: Record<string, AuditSummary> = {};

  const idsToFetch = uniqueIds.filter(id => !summaryCache.has(id));

  await Promise.all(
    idsToFetch.map(async id => {
      const summary = await fetchAuditSummary(id);
      if (summary) {
        summaryCache.set(id, summary);
      }
    })
  );

  uniqueIds.forEach(id => {
    const summary = summaryCache.get(id);
    if (summary) {
      result[id] = summary;
    }
  });

  return result;
};

