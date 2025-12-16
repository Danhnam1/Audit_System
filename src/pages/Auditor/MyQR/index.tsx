import { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAccessGrants } from '../../../api/accessGrant';
import { getAuditPlans } from '../../../api/audits';
import { getDepartmentById } from '../../../api/departments';
import { unwrap } from '../../../utils/normalize';
import { toast } from 'react-toastify';
import useAuthStore from '../../../store/useAuthStore';
import { getAdminUsers } from '../../../api/adminUsers';
import { QRCodeSVG } from 'qrcode.react';

interface AccessGrant {
  grantId: string;
  auditId: string;
  auditorId: string;
  deptId: number;
  qrToken: string;
  qrUrl: string;
  verifyCode?: string;
  validFrom: string;
  validTo: string;
  status: string;
  createdAt?: string;
}

interface Audit {
  auditId: string;
  title: string;
  startDate?: string;
  endDate?: string;
}

export default function MyQR() {
  const { user } = useAuth();
  const authStore = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [audits, setAudits] = useState<Record<string, Audit>>({});
  const [departments, setDepartments] = useState<Record<string, string>>({});
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [filteredGrants, setFilteredGrants] = useState<AccessGrant[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    loadMyUserId();
  }, []);

  useEffect(() => {
    if (myUserId) {
      loadData();
    }
  }, [myUserId]);

  useEffect(() => {
    if (selectedAuditId) {
      setFilteredGrants(grants.filter(g => g.auditId === selectedAuditId));
    } else {
      setFilteredGrants(grants);
    }
  }, [selectedAuditId, grants]);

  const loadMyUserId = async () => {
    try {
      const users = await getAdminUsers();
      const me = (users || []).find((u: any) => 
        String(u.email || '').toLowerCase() === String(authStore.user?.email || '').toLowerCase()
      );
      if (me) {
        const userId = String(me.userId || me.$id || '');
        setMyUserId(userId);
      }
      else {
        toast.error('Cannot resolve current user ID. Please relogin.');
      }
    } catch (error) {
      console.error('Failed to load user ID:', error);
      toast.error('Failed to load user information. Please try again.');
    }
  };

  const loadData = async () => {
    if (!myUserId) return;
    
    setLoading(true);
    try {
      // Load access grants for current user (auditor)
      const allGrants = await getAccessGrants({ auditorId: myUserId });
      // Defensive: even if API ignores auditorId, filter client-side by myUserId
      const mineOnly = (allGrants || []).filter(
        (g: AccessGrant) => String(g.auditorId || '').trim() === String(myUserId).trim()
      );
      setGrants(mineOnly);

      // Load audits to get titles
      const auditsData = await getAuditPlans();
      const auditsList = unwrap<Audit>(auditsData);
      const auditsArray = Array.isArray(auditsList) ? auditsList : [];
      
      const auditsMap: Record<string, Audit> = {};
      auditsArray.forEach((audit: Audit) => {
        auditsMap[audit.auditId] = audit;
      });
      setAudits(auditsMap);

      // Load departments names for grants
      const uniqueDeptIds = [...new Set(mineOnly.map(g => g.deptId).filter(Boolean))];
      const deptEntries: Array<[string, string]> = [];
      await Promise.all(
        uniqueDeptIds.map(async (deptId) => {
          try {
            const dept = await getDepartmentById(Number(deptId) || deptId);
            const name = (dept as any)?.name || (dept as any)?.deptName || `Dept ${deptId}`;
            deptEntries.push([String(deptId), name]);
          } catch (e) {
            console.warn('Failed to load department', deptId, e);
          }
        })
      );
      const deptMap: Record<string, string> = {};
      deptEntries.forEach(([id, name]) => {
        deptMap[id] = name;
      });
      setDepartments(deptMap);

      // Get unique audit IDs from grants
      const auditIds = [...new Set(mineOnly.map(g => g.auditId))];
      if (auditIds.length > 0 && !selectedAuditId) {
        setSelectedAuditId(auditIds[0]);
      }
    } catch (error: any) {
      console.error('Failed to load QR codes:', error);
      toast.error('Failed to load QR codes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const getAuditTitle = (auditId: string): string => {
    return audits[auditId]?.title || `Audit ${auditId.substring(0, 8)}...`;
  };

  const getDeptName = (deptId: number): string => {
    const key = String(deptId);
    return departments[key] || `Dept ${deptId}`;
  };

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: string): string => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'active') return 'bg-green-100 text-green-800';
    if (statusLower === 'expired') return 'bg-red-100 text-red-800';
    if (statusLower === 'revoked') return 'bg-gray-100 text-gray-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-semibold text-gray-900">My QR Codes</h1>
            <p className="text-gray-600 text-sm mt-1">
              View and manage your QR codes for audit access
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-600">Loading QR codes...</span>
            </div>
          ) : grants.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800">No QR codes found. QR codes will be issued when you are assigned to an audit.</p>
            </div>
          ) : (
            <>
              {/* Filter by Audit */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Audit
                </label>
                <select
                  value={selectedAuditId || ''}
                  onChange={(e) => setSelectedAuditId(e.target.value || null)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">All Audits</option>
                  {[...new Set(grants.map(g => g.auditId))].map(auditId => (
                    <option key={auditId} value={auditId}>
                      {getAuditTitle(auditId)}
                    </option>
                  ))}
                </select>
              </div>

              {/* QR Codes Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredGrants.map((grant) => {
                  return (
                    <div
                      key={grant.grantId}
                      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow"
                    >
                      {/* QR Code */}
                      <div className="flex justify-center mb-4">
                        <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                          {grant.qrUrl || grant.qrToken ? (
                            <QRCodeSVG
                              value={grant.qrUrl || grant.qrToken || ''}
                              size={150}
                              level="M"
                              includeMargin={true}
                            />
                          ) : (
                            <div className="w-[150px] h-[150px] flex items-center justify-center text-xs text-gray-400">
                              No QR URL
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Audit Info */}
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Audit
                          </label>
                          <p className="text-sm font-semibold text-gray-900">
                            {getAuditTitle(grant.auditId)}
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Department
                          </label>
                          <p className="text-sm font-semibold text-gray-900">
                            {getDeptName(grant.deptId)}
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Valid Period
                          </label>
                          <p className="text-sm text-gray-700">
                            {formatDate(grant.validFrom)} - {formatDate(grant.validTo)}
                          </p>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Status
                          </label>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getStatusColor(grant.status)}`}>
                            {grant.status}
                          </span>
                        </div>

                        {/* Verify code only available after QR is scanned by AuditeeOwner */}
                        {/* Verify code is not included in GET /api/AccessGrant response - it's only returned when scanning QR */}
                        {/* To get verify code, AuditeeOwner must scan the QR first, then verify code will be shown in scan result */}
                        {/* QR URL removed - not needed */}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

