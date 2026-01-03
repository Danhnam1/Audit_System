import { useState, useEffect, useMemo } from 'react';
import { getAuditTeam } from '../api/auditTeam';
import { getDepartments } from '../api/departments';
import { getAuditCriteria } from '../api/auditCriteria';
import { getChecklistTemplates } from '../api/checklists';
import { getAdminUsers } from '../api/adminUsers';
import { getPlansWithDepartments } from '../services/auditPlanning.service';
import type { AuditPlan } from '../types/auditPlan';

interface UseAuditPlanDataProps {
  userIdFromToken?: string | null;
  user?: any;
}

export const useAuditPlanData = ({ userIdFromToken, user }: UseAuditPlanDataProps) => {
  // Data fetching states
  const [auditorOptions, setAuditorOptions] = useState<any[]>([]);
  const [ownerOptions, setOwnerOptions] = useState<any[]>([]);
  const [auditTeams, setAuditTeams] = useState<any[]>([]);
  const [departments, setDepartments] = useState<Array<{ deptId: number | string; name: string }>>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);

  // Plans data
  const [existingPlans, setExistingPlans] = useState<AuditPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);

  // Load audit teams - needs to be refreshed when plans change
  const fetchAuditTeams = async () => {
    try {
      const teams = await getAuditTeam();
      // Filter out AuditeeOwner from audit teams
      const filteredTeams = Array.isArray(teams) 
        ? teams.filter((m: any) => {
            const role = String(m.roleInTeam || '').toLowerCase().replace(/\s+/g, '');
            return role !== 'auditeeowner';
          })
        : [];
      setAuditTeams(filteredTeams);
    } catch (err) {
      console.error("Failed to load audit teams", err);
    }
  };

  // Load audit plans and audit teams
  useEffect(() => {
    const fetchPlans = async () => {
      setLoadingPlans(true);
      try {
        const merged = await getPlansWithDepartments();
        
        // Enrich plans with rejectedBy information for rejected/declined plans
        // Backend sets status to "Declined" when Lead Auditor rejects
        // Backend sets status to "Rejected" when Director rejects
        const enrichedPlans = merged.map((plan: any) => {
          const planStatus = String(plan.status || '').toLowerCase().replace(/\s+/g, '');
          if (planStatus === 'declined') {
            return { ...plan, rejectedBy: 'Lead Auditor' };
          } else if (planStatus === 'rejected') {
            return { ...plan, rejectedBy: 'Director' };
          }
          return plan;
        });
        
        setExistingPlans(enrichedPlans);
        
        // Refresh audit teams after loading plans to ensure we have latest team assignments
        await fetchAuditTeams();
      } catch (error) {
        setExistingPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    };
    fetchPlans();
  }, []);

  // Also load audit teams on initial mount (before plans are loaded)
  useEffect(() => {
    fetchAuditTeams();
  }, []);

  // Load users for PlanDetailsModal and form
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const users = await getAdminUsers();
        const norm = (s: string) =>
          String(s || "")
            .toLowerCase()
            .replace(/\s+/g, "");
        const auditors = (users || []).filter(
          (u: any) => norm(u.roleName) === "auditor" || norm(u.roleName) === "leadauditor"
        );
        const owners = (users || []).filter(
          (u: any) => norm(u.roleName) === "auditeeowner"
        );
        setAuditorOptions(auditors);
        setOwnerOptions(owners);
      } catch (err) {
        console.error("Failed to load users", err);
      }
    };
    fetchUsers();
  }, []);

  // Load checklist templates and criteria
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getChecklistTemplates();
        setChecklistTemplates(Array.isArray(data) ? data : []);

        try {
          const crit = await getAuditCriteria();
          // Filter out inactive criteria
          const activeCriteria = Array.isArray(crit) 
            ? crit.filter((c: any) => {
                const status = String(c.status || '').toLowerCase().trim();
                return status !== 'inactive';
              })
            : [];
          setCriteria(activeCriteria);
        } catch (e) {
          console.error("Failed to load audit criteria", e);
        }
      } catch (err) {
        console.error("Failed to load checklist templates", err);
      }
    };
    load();
  }, []);

  // Load departments
  useEffect(() => {
    const loadDepts = async () => {
      if (departments.length > 0) return;
      try {
        const res: any = await getDepartments();
        const list = (res || []).map((d: any) => ({
          deptId: d.deptId ?? d.$id ?? d.id,
          name: d.name || d.code || "—",
        }));
        setDepartments(list);
      } catch (err) {
        console.error("Failed to load departments", err);
      }
    };
    loadDepts();
  }, [departments.length]);

  // Refresh plans function
  const refreshPlans = async () => {
    setLoadingPlans(true);
    try {
      const merged = await getPlansWithDepartments();
      const enrichedPlans = merged.map((plan: any) => {
        const planStatus = String(plan.status || '').toLowerCase().replace(/\s+/g, '');
        if (planStatus === 'declined') {
          return { ...plan, rejectedBy: 'Lead Auditor' };
        } else if (planStatus === 'rejected') {
          return { ...plan, rejectedBy: 'Director' };
        }
        return plan;
      });
      setExistingPlans(enrichedPlans);
      await fetchAuditTeams();
    } catch (error) {
      setExistingPlans([]);
    } finally {
      setLoadingPlans(false);
    }
  };

  return {
    auditorOptions,
    ownerOptions,
    auditTeams,
    departments,
    criteria,
    checklistTemplates,
    existingPlans,
    loadingPlans,
    setDepartments,
    setExistingPlans,
    refreshPlans,
    fetchAuditTeams,
  };
};

