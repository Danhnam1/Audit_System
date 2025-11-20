import { unwrap } from '../utils/normalize';
import type { AdminUserDto } from '../api/adminUsers';

export interface PlanLike {
  auditId?: string;
  id?: string;
  $id?: string;
  title?: string;
  scopeDepartments?: any;
  auditTeams?: any;
  schedules?: any;
}

export interface RecipientSelection {
  userId: string;
  reason: 'AuditeeOwner' | 'AuditTeam' | 'DepartmentHead' | 'Other';
}

export interface ExtractedDates {
  dueDate?: string | null;
}

// Extract due date from schedules; fallback to undefined
export const extractDueDate = (raw: PlanLike): ExtractedDates => {
  const schedules = unwrap<any>((raw as any)?.schedules);
  // Prefer field "dueDate" as per backend screenshot
  const dates = (schedules || [])
    .map((s: any) => s?.dueDate || s?.evidenceDate || s?.deadline || s?.periodTo)
    .filter(Boolean) as string[];
  const earliest = dates.length
    ? new Date(dates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0]).toISOString()
    : null;
  return { dueDate: earliest };
};

// Compute recipients by role and scope
export const getRecipientsForApproval = (
  raw: PlanLike,
  users: AdminUserDto[]
): RecipientSelection[] => {
  const scopeDeps = unwrap<any>((raw as any)?.scopeDepartments);
  const scopeDeptIds = new Set<string>(
    (scopeDeps || []).map((d: any) => String(d.deptId ?? d.departmentId ?? d.id))
  );

  const recipients: RecipientSelection[] = [];

  // 1) Auditee Owners in scoped departments
  users
    .filter(u => String(u.roleName || '').toLowerCase().includes('auditee'))
    .forEach(u => {
      const matchDept = u.deptId != null && scopeDeptIds.has(String(u.deptId));
      if (matchDept) recipients.push({ userId: String(u.userId || u.$id || u.email), reason: 'AuditeeOwner' });
    });

  // 2) Audit Team (Lead Auditor + Auditors) listed in the plan
  const team = unwrap<any>((raw as any)?.auditTeams);
  (team || []).forEach((m: any) => {
    const id = String(m.userId || m.id || m.$id || m.email || '');
    if (id) recipients.push({ userId: id, reason: 'AuditTeam' });
  });

  // 3) Department Heads (optional): users with roleName containing 'head' and matching departments
  users
    .filter(u => String(u.roleName || '').toLowerCase().includes('head'))
    .forEach(u => {
      const matchDept = u.deptId != null && scopeDeptIds.has(String(u.deptId));
      if (matchDept) recipients.push({ userId: String(u.userId || u.$id || u.email), reason: 'DepartmentHead' });
    });

  // De-duplicate by userId
  const uniq = Array.from(
    new Map(recipients.map(r => [r.userId, r])).values()
  );
  return uniq;
};
