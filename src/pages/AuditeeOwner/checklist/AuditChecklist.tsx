import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import {
  getAuditChecklistItems,
  type ChecklistItemDto,
} from '../../../api/checklists';
import { toast } from 'react-toastify';

interface RouteParams {
  auditId?: string;
  deptId?: string;
}

type AuditChecklistItem = ChecklistItemDto & {
  id?: string;
  auditId?: string;
  deptId?: number;
  departmentId?: number;
  questionTextSnapshot?: string;
  itemDescription?: string;
};

const AuditChecklist = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { auditId, deptId } = useParams<RouteParams>();

  const [items, setItems] = useState<AuditChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedDeptId = useMemo(
    () => (deptId ? parseInt(deptId, 10) || null : null),
    [deptId]
  );

  useEffect(() => {
    const loadItems = async () => {
      if (!auditId) {
        setError('Missing auditId');
        return;
      }
      try {
        setLoading(true);
        setError(null);

        const data: any = await getAuditChecklistItems(auditId);
        const allItems: AuditChecklistItem[] = Array.isArray(data) ? data : [];

        // Filter by department if possible
        const filtered =
          parsedDeptId != null
            ? allItems.filter((item) => {
                const rawDept =
                  (item as any).deptId ??
                  (item as any).departmentId ??
                  (item as any).deptID ??
                  null;
                if (rawDept == null) return true; // if BE doesn't send dept, show all items
                const numeric = typeof rawDept === 'string' ? parseInt(rawDept, 10) : Number(rawDept);
                return numeric === parsedDeptId;
              })
            : allItems;

        if (filtered.length === 0) {
          toast.info('No checklist items found for this audit/department.');
        }

        setItems(filtered);
      } catch (err: any) {
        console.error('Failed to load audit checklist items:', err);
        const msg =
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load checklist items';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    };

    loadItems();
  }, [auditId, parsedDeptId]);

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const groupedBySection = useMemo(() => {
    const groups: Record<string, AuditChecklistItem[]> = {};
    items.forEach((item) => {
      const section =
        (item as any).section ||
        (item as any).category ||
        'General';
      if (!groups[section]) {
        groups[section] = [];
      }
      groups[section].push(item);
    });
    return groups;
  }, [items]);

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Audit Checklist</h1>
              <p className="text-gray-600 text-sm mt-1">
                Audit ID: <span className="font-mono text-xs">{auditId}</span>
                {parsedDeptId != null && (
                  <>
                    {' '}
                    · Dept ID:{' '}
                    <span className="font-mono text-xs">{parsedDeptId}</span>
                  </>
                )}
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
            >
              Back
            </button>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            {loading ? (
              <div className="flex items-center gap-3 text-gray-600">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600" />
                <span>Loading checklist items...</span>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-600">
                No checklist items available for this audit/department.
              </p>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedBySection).map(([section, sectionItems]) => (
                  <div key={section} className="border border-gray-200 rounded-lg">
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-gray-900">
                        {section}
                      </h2>
                      <span className="text-xs text-gray-500">
                        {sectionItems.length} item(s)
                      </span>
                    </div>
                    <div className="divide-y divide-gray-200">
                      {sectionItems.map((item) => {
                        const description =
                          (item as any).questionTextSnapshot ||
                          (item as any).itemDescription ||
                          (item as any).questionText ||
                          'Checklist item';
                        const status =
                          (item as any).status ||
                          (item as any).itemStatus ||
                          'Pending';
                        const severity =
                          (item as any).severity ||
                          (item as any).severityDefault ||
                          '';

                        return (
                          <div
                            key={(item as any).id || (item as any).auditChecklistItemId}
                            className="px-4 py-3 flex flex-col gap-1"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <p className="text-sm text-gray-900">{description}</p>
                              <div className="flex flex-col items-end gap-1">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  {status}
                                </span>
                                {severity && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-800">
                                    {severity}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AuditChecklist;


