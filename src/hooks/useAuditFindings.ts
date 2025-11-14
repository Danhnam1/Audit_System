import { useState, useCallback } from 'react';
import { getAuditPlans } from '../api/audits';
import { getAuditChecklistItems } from '../api/checklists';
import { createFinding, type CreateFindingPayload } from '../api/findings';

export interface AuditPlan {
  auditId: string;
  [key: string]: any;
}

export interface ChecklistItem {
  id: string;
  auditId: string;
  itemDescription: string;
  status: string;
  severity?: string;
  [key: string]: any;
}

export interface FindingCreationResult {
  success: boolean;
  finding?: any;
  error?: string;
}

export const useAuditFindings = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditPlans, setAuditPlans] = useState<AuditPlan[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);

  // Fetch all audit plans
  const fetchAuditPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAuditPlans();
      
      // Handle response that might be wrapped in $values or values
      let plans = data;
      if (data?.$values) {
        plans = data.$values;
      } else if (data?.values) {
        plans = data.values;
      } else if (data?.data) {
        plans = data.data;
      }
      
      setAuditPlans(Array.isArray(plans) ? plans : []);
      return plans;
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch audit plans';
      setError(errorMsg);
      console.error('Error fetching audit plans:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch checklist items for a specific audit
  const fetchChecklistItems = useCallback(async (auditId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data: any = await getAuditChecklistItems(auditId);
      console.log('fetchChecklistItems received data:', data, 'isArray:', Array.isArray(data));
      
      // API already unwraps in checklists.ts, so data should be an array
      // No need to unwrap again
      const items = Array.isArray(data) ? data : [];
      console.log('fetchChecklistItems returning items:', items);
      
      setChecklistItems(items);
      return items;
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to fetch checklist items';
      setError(errorMsg);
      console.error('Error fetching checklist items:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create finding from checklist item with status change
  const createFindingFromChecklistItem = useCallback(async (
    checklistItem: ChecklistItem,
    additionalData?: Partial<CreateFindingPayload>
  ): Promise<FindingCreationResult> => {
    try {
      setLoading(true);
      setError(null);

      // Use additionalData directly if provided with all required fields
      if (additionalData && additionalData.title && additionalData.description) {
        console.log('Using provided payload:', additionalData);
        const result = await createFinding(additionalData as CreateFindingPayload);
        
        return {
          success: true,
          finding: result,
        };
      }

      // Fallback to building from checklist item
      let severity = checklistItem.severity || checklistItem.status || 'Minor';
      
      const severityMap: Record<string, string> = {
        'minor': 'Minor',
        'major': 'Major',
        'critical': 'Critical',
        'observation': 'Observation',
        'low': 'Minor',
        'medium': 'Minor',
        'high': 'Major',
      };
      
      severity = severityMap[severity.toLowerCase()] || severity;

      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 30);

      const payload: CreateFindingPayload = {
        auditId: checklistItem.auditId,
        auditItemId: checklistItem.id,
        title: additionalData?.title || `Finding: ${checklistItem.itemDescription || 'Checklist Item'}`,
        description: additionalData?.description || checklistItem.itemDescription || 'No description provided',
        severity: additionalData?.severity || severity,
        status: additionalData?.status || 'Open',
        deadline: additionalData?.deadline || deadline.toISOString(),
        rootCauseId: additionalData?.rootCauseId || 0,
        deptId: additionalData?.deptId || 0,
        reviewerId: additionalData?.reviewerId || null,
        source: additionalData?.source || 'Internal Audit',
        externalAuditorName: additionalData?.externalAuditorName || 'N/A',
      };

      console.log('Built payload:', payload);
      const result = await createFinding(payload);
      
      return {
        success: true,
        finding: result,
      };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to create finding';
      setError(errorMsg);
      console.error('Error creating finding:', err);
      return {
        success: false,
        error: errorMsg,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  // Process audit plan and create findings for items with specific statuses
  const processAuditAndCreateFindings = useCallback(async (
    auditId: string,
    statusTriggers: string[] = ['minor', 'major', 'critical']
  ) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch checklist items for this audit
      const items = await fetchChecklistItems(auditId);
      
      if (!Array.isArray(items) || items.length === 0) {
        return {
          success: true,
          message: 'No checklist items found for this audit',
          findings: [],
        };
      }

      // Filter items that match the status triggers
      const itemsToProcess = items.filter(item => {
        const status = (item.status || '').toLowerCase();
        return statusTriggers.some(trigger => status.includes(trigger.toLowerCase()));
      });

      if (itemsToProcess.length === 0) {
        return {
          success: true,
          message: `No items with status: ${statusTriggers.join(', ')}`,
          findings: [],
        };
      }

      // Create findings for each matching item
      const results = await Promise.allSettled(
        itemsToProcess.map(item => createFindingFromChecklistItem(item))
      );

      const successfulFindings = results
        .filter((r): r is PromiseFulfilledResult<FindingCreationResult> => 
          r.status === 'fulfilled' && r.value.success
        )
        .map(r => r.value.finding);

      const failedFindings = results
        .filter((r): r is PromiseRejectedResult | PromiseFulfilledResult<FindingCreationResult> => 
          r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
        );

      return {
        success: failedFindings.length === 0,
        message: `Created ${successfulFindings.length} findings, ${failedFindings.length} failed`,
        findings: successfulFindings,
        errors: failedFindings,
      };
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to process audit';
      setError(errorMsg);
      console.error('Error processing audit:', err);
      return {
        success: false,
        message: errorMsg,
        findings: [],
      };
    } finally {
      setLoading(false);
    }
  }, [fetchChecklistItems, createFindingFromChecklistItem]);

  return {
    loading,
    error,
    auditPlans,
    checklistItems,
    fetchAuditPlans,
    fetchChecklistItems,
    createFindingFromChecklistItem,
    processAuditAndCreateFindings,
  };
};
