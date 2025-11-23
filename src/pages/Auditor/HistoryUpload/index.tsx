import { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditPlans } from '../../../api/audits';
import { getAuditDocuments, downloadAuditDocumentById } from '../../../api/auditDocuments';
import { getAdminUsers } from '../../../api/adminUsers';
import { unwrap } from '../../../utils/normalize';
import { exportFile } from '../../../utils/globalUtil';
import { getStatusColor } from '../../../constants';

interface AuditDocRow {
  auditId: string;
  id?: string;
  documentType?: string;
  contentType?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  sizeBytes?: number;
  status?: string;
  url?: string;
}

const resolveAuditId = (audit: any, idx?: number) => {
  const candidate = audit?.auditId ;
  if (candidate !== undefined && candidate !== null && String(candidate).trim() !== '') {
    return String(candidate).trim();
  }
  if (typeof idx === 'number') {
    return `audit_${idx}`;
  }
  return 'audit_unknown';
};

const HistoryUploadPage = () => {
  const { user } = useAuth();
  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  const [audits, setAudits] = useState<any[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [documentsMap, setDocumentsMap] = useState<Record<string, AuditDocRow[]>>({});
  const [expandedAudit, setExpandedAudit] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [docsLoaded, setDocsLoaded] = useState(false);
  const lastDocFetchKeyRef = useRef<string>('');

  // Load audits (Submitted + Completed) similar to reports page
  useEffect(() => {
    const loadAudits = async () => {
      setLoadingAudits(true);
      setError(null);
      try {
        const res = await getAuditPlans();
        const arr = unwrap(res);
        const visible = (Array.isArray(arr) ? arr : []).filter((a: any) => {
          const v = String(a.status || a.state || a.approvalStatus || '').toLowerCase().replace(/\s+/g, '');
          // History only for audits that are Completed (including backend 'Approved')
          return v.includes('completed') || v.includes('complete') || v.includes('approve');
        });
        setAudits(visible);
        // Preload users once for name mapping
        try {
          const users = await getAdminUsers();
          const map: Record<string, string> = {};
          (users || []).forEach(u => {
            // Map by multiple possible ID fields - prioritize fullName
            const userId = u.userId || u.$id;
            const email = u.email;
            const fullName = u.fullName || '';
            
            // Primary mapping: userId -> fullName (prefer fullName over email)
            if (userId) {
              const idStr = String(userId).trim();
              if (idStr && fullName) {
                // Map exact match
                map[idStr] = fullName;
                // Map lowercase for case-insensitive lookup
                map[idStr.toLowerCase()] = fullName;
                // Also try with different formats
                if (!isNaN(Number(idStr))) {
                  map[String(Number(idStr))] = fullName;
                }
              } else if (idStr && email) {
                // Fallback to email if no fullName
                map[idStr] = email;
                map[idStr.toLowerCase()] = email;
              }
            }
            
            // Also map by email for fallback lookup
            if (email && fullName) {
              const emailStr = String(email).trim();
              if (emailStr) {
                map[emailStr] = fullName;
                map[emailStr.toLowerCase()] = fullName;
              }
            }
          });
          setUserMap(map);
        } catch (e) {
          console.warn('Load users for upload history failed', e);
        }
      } catch (e) {
        console.error('Load audits failed', e);
        setError('Không tải được danh sách audit');
      } finally {
        setLoadingAudits(false);
      }
    };
    loadAudits();
  }, []);

  // Load documents for all audits when audits list changes
  useEffect(() => {
    if (!audits.length) {
      lastDocFetchKeyRef.current = '';
      return;
    }
    const fetchDocs = async () => {
      setLoadingDocs(true);
      setDocsLoaded(false);
      try {
        const auditIds = audits.map((a, idx) => resolveAuditId(a, idx));
        const fetchKey = auditIds.join('|');
        if (lastDocFetchKeyRef.current === fetchKey) {
          setLoadingDocs(false);
          setDocsLoaded(true);
          return;
        }
        lastDocFetchKeyRef.current = fetchKey;
        const results = await Promise.allSettled(auditIds.map(id => getAuditDocuments(id)));
        const next: Record<string, AuditDocRow[]> = {};
        results.forEach((res, idx) => {
          const auditId = auditIds[idx];
          if (res.status === 'fulfilled') {
            const rows = Array.isArray(res.value) ? res.value : [res.value];
            const mapped = rows.filter(Boolean).map((d: any) => {
              const documentType = d.documentType || '';
              const contentType = d.contentType || '';
              const uploadedAt = d.uploadedAt || '';
              const sizeBytes = Number(d.sizeBytes ?? 0) || 0;
              const fileName = d.fileName || d.originalFileName || d.originalName || d.name || '';
              const url = d.blobPath || '';
              const hasDownload = Boolean(url);
              const hasInfo = hasDownload || sizeBytes > 0 || Boolean(fileName.trim());

              if (!hasInfo) {
                return null;
              }

              // Resolve uploadedBy name from userId
              const uploadedById = d.uploadedBy || d.uploadedByUserId || '';
              const idStr = String(uploadedById || '').trim();
              let uploadedByName = '';
              
              // Try multiple lookup strategies for userId -> fullName
              if (idStr && Object.keys(userMap).length > 0) {
                // Strategy 1: Direct lookup
                uploadedByName = userMap[idStr];
                
                // Strategy 2: Case-insensitive lookup
                if (!uploadedByName) {
                  uploadedByName = userMap[idStr.toLowerCase()];
                }
                
                // Strategy 3: Try as number if it's numeric
                if (!uploadedByName && !isNaN(Number(idStr))) {
                  uploadedByName = userMap[String(Number(idStr))];
                }
              }
              
              // Fallback to uploadedByUser field (if it's an object with fullName)
              if (!uploadedByName && d.uploadedByUser) {
                if (typeof d.uploadedByUser === 'object' && d.uploadedByUser.fullName) {
                  uploadedByName = d.uploadedByUser.fullName;
                } else if (typeof d.uploadedByUser === 'string') {
                  // If it's a string, try to look it up in userMap
                  uploadedByName = userMap[d.uploadedByUser] || userMap[d.uploadedByUser.toLowerCase()] || d.uploadedByUser;
                }
              }
              
              // Final fallback - don't show ID, show Unknown instead
              if (!uploadedByName || uploadedByName.trim() === '') {
                uploadedByName = 'Unknown';
              }

              return {
                auditId,
                id: String(fileName || `${auditId}_${uploadedAt || Date.now()}`),
                documentType: documentType || fileName || '—',
                contentType: contentType || '—',
                uploadedBy: uploadedByName,
                uploadedAt,
                sizeBytes,
                status: d.status || '—',
                url,
              } as AuditDocRow | null;
            }).filter(Boolean) as AuditDocRow[];
            next[auditId] = mapped;
          } else {
            next[auditId] = [];
          }
        });
        setDocumentsMap(next);
      } catch (e) {
        console.error('Fetch document history failed', e);
      } finally {
        setLoadingDocs(false);
        setDocsLoaded(true);
      }
    };
    fetchDocs();
  }, [audits, userMap]);

  const auditRows = useMemo(() => (
    (Array.isArray(audits) ? audits : []).map((a: any, idx: number) => {
      const id = resolveAuditId(a, idx);
      const title = a.title || `Audit ${idx + 1}`;
      const rawStatus = a.status || a.state || a.approvalStatus || '—';
      const norm = String(rawStatus).toLowerCase().replace(/\s+/g, '');
      const status = (norm.includes('approve') || norm.includes('completed')) ? 'Completed' : rawStatus;
      return { auditId: id, title, status };
    })
  ), [audits]);

  const visibleAuditRows = useMemo(() => {
    if (!docsLoaded) return auditRows;
    return auditRows.filter((row) => (documentsMap[row.auditId]?.length || 0) > 0);
  }, [auditRows, documentsMap, docsLoaded]);

  const toggleExpand = (auditId: string) => {
    setExpandedAudit(prev => prev === auditId ? '' : auditId);
  };

  useEffect(() => {
    if (!docsLoaded || !expandedAudit) return;
    if ((documentsMap[expandedAudit]?.length || 0) === 0) {
      setExpandedAudit('');
    }
  }, [docsLoaded, documentsMap, expandedAudit]);

  const handleDownload = async (doc: AuditDocRow) => {
    if (!doc || !doc.id) return;
    try {
      const blob = await downloadAuditDocumentById(doc.id, doc.auditId);
      const extMap: Record<string, string> = {
        'application/pdf': 'pdf',
        'image/png': 'png',
        'image/jpeg': 'jpg',
      };
      const ext = extMap[(doc.contentType || '').toLowerCase()] || 'bin';
      const base = (doc.documentType || 'document').toString().replace(/\s+/g, '-').toLowerCase();
      const filename = `${base}-${doc.auditId || 'audit'}.${ext}`;
      exportFile(blob, filename);
    } catch (e) {
      alert('Tải xuống thất bại');
      // eslint-disable-next-line no-console
      console.error('download document failed', e);
    }
  };

  return (
    <MainLayout user={layoutUser}>
      <div className="bg-white border-b border-primary-100 shadow-sm mb-6">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-primary-600">History Upload</h1>
            <p className="text-gray-600 text-sm mt-1">Document upload history for each Audit</p>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-6">
        <div className="bg-white rounded-xl border border-primary-100 shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-primary-100 bg-gradient-primary">
            <h2 className="text-lg font-semibold text-white">Audit Upload History</h2>
          </div>

          {error && <div className="px-6 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">{error}</div>}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Audit</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Uploads</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loadingAudits && (
                  <tr><td colSpan={4} className="px-6 py-4 text-sm text-gray-500">Đang tải audits...</td></tr>
                )}
                {!loadingAudits && visibleAuditRows.map(r => {
                  const docs = documentsMap[r.auditId] || [];
                  return (
                    <tr key={r.auditId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{r.title}</span>
                      </td>
                      <td className="px-6 py-4"><span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(r.status)}`}>{r.status}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-8 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold border border-primary-100">{docs.length}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleExpand(r.auditId)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >{expandedAudit === r.auditId ? 'Hide' : 'View'} Details</button>
                      </td>
                    </tr>
                  );
                })}
                {!loadingAudits && visibleAuditRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-sm text-gray-500">
                      {loadingDocs || !docsLoaded
                        ? 'Đang kiểm tra lịch sử upload...'
                        : 'Chỉ hiển thị các audit đã có tài liệu được upload.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {expandedAudit && (
            <div className="border-t border-primary-100">
              <div className="px-6 py-3 flex items-center justify-between bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">
                  Uploads for {auditRows.find(a => a.auditId === expandedAudit)?.title || 'Audit'}
                </h3>
                {loadingDocs && <span className="text-xs text-gray-500">Đang tải lịch sử...</span>}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-700">Document Type</th>
                      <th className="px-4 py-2 text-left text-gray-700">Content Type</th>
                      <th className="px-4 py-2 text-left text-gray-700">Uploaded By</th>
                      <th className="px-4 py-2 text-left text-gray-700">Uploaded At</th>
                      <th className="px-4 py-2 text-left text-gray-700">Size</th>
                      <th className="px-4 py-2 text-left text-gray-700">Status</th>
                      <th className="px-4 py-2 text-left text-gray-700">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(documentsMap[expandedAudit] || []).map(doc => {
                      const dateStr = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : '—';
                      const sizeKB = doc.sizeBytes ? Math.round(doc.sizeBytes / 1024) : 0;
                      return (
                        <tr key={doc.id} className="hover:bg-white">
                          <td className="px-4 py-2">{doc.documentType}</td>
                          <td className="px-4 py-2">{doc.contentType}</td>
                          <td className="px-4 py-2">{doc.uploadedBy}</td>
                          <td className="px-4 py-2">{dateStr}</td>
                          <td className="px-4 py-2">{sizeKB ? `${sizeKB} KB` : '—'}</td>
                          <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(doc.status || '')}`}>{doc.status}</span></td>
                          <td className="px-4 py-2">
                            {doc.url ? (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-600 hover:text-primary-700"
                              >Download</a>
                            ) : (
                              <button
                                onClick={() => handleDownload(doc)}
                                className="text-primary-600 hover:text-primary-700"
                              >Download</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(!documentsMap[expandedAudit] || documentsMap[expandedAudit].length === 0) && !loadingDocs && (
                      <tr><td colSpan={7} className="px-4 py-3 text-center text-gray-500">Chưa có tài liệu nào được upload</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default HistoryUploadPage;
