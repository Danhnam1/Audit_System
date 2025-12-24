import { useEffect, useMemo, useRef, useState } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { getAuditPlans } from '../../../api/audits';
import { getAuditDocuments, downloadAuditDocumentById } from '../../../api/auditDocuments';
import { getAdminUsers, getUserById } from '../../../api/adminUsers';
import { getAuditTeam } from '../../../api/auditTeam';
import { unwrap } from '../../../utils/normalize';
import { exportFile } from '../../../utils/globalUtil';

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
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string>('');
  const [selectedAuditTitle, setSelectedAuditTitle] = useState<string>('');
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
        // Load audit teams and users to filter audits by team membership
        const [teamsRes, usersRes] = await Promise.all([
          getAuditTeam().catch(() => []),
          getAdminUsers().catch(() => [])
        ]);
        
        const teams = Array.isArray(teamsRes) ? teamsRes : [];
        const users = Array.isArray(usersRes) ? usersRes : [];
        
        // Get current user's userId - try multiple methods (same as Reports page)
        let currentUserId: string | null = null;
        
        // Find by email (ProfileResponse doesn't have userId, need to look it up from AdminUsers)
        if (user?.email) {
          const found = users.find((u: any) => {
            const uEmail = String(u?.email || '').toLowerCase().trim();
            const userEmail = String(user.email).toLowerCase().trim();
            return uEmail === userEmail;
          });
          if (found?.userId) {
            currentUserId = String(found.userId);
          } else if (found?.$id) {
            currentUserId = String(found.$id);
          }
        }
        
        // Normalize currentUserId for comparison (lowercase, trim)
        const normalizedCurrentUserId = currentUserId ? String(currentUserId).toLowerCase().trim() : '';
        
        // Build set of auditIds where current user is a team member
        const userAuditIds = new Set<string>();
        teams.forEach((t: any) => {
          const teamUserId = String(t.userId || '').trim().toLowerCase();
          if (teamUserId && teamUserId === normalizedCurrentUserId) {
            const auditIdStr = String(t.auditId || '').trim();
            if (auditIdStr) {
              userAuditIds.add(auditIdStr);
              userAuditIds.add(auditIdStr.toLowerCase());
            }
          }
        });
        
        const res = await getAuditPlans();
        const arr = unwrap(res);
        
        // Get audit IDs where current user is the creator
        const creatorAuditIds = new Set<string>();
        if (normalizedCurrentUserId) {
          (Array.isArray(arr) ? arr : []).forEach((a: any) => {
            // Get createdBy from audit (try multiple fields)
            const createdBy = a?.createdBy || a?.createdByUser?.userId || a?.createdByUser?.id || a?.createdByUser?.$id;
            const createdByStr = createdBy ? String(createdBy).toLowerCase().trim() : null;
            
            if (createdByStr === normalizedCurrentUserId) {
              // Add all possible auditId formats
              const auditId = a?.auditId || a?.id || a?.$id;
              if (auditId) {
                const auditIdStr = String(auditId).trim();
                if (auditIdStr) {
                  creatorAuditIds.add(auditIdStr);
                  creatorAuditIds.add(auditIdStr.toLowerCase());
                }
              }
            }
          });
        }
        
        // Filter audits: show audits where user is in audit team OR is the creator
        const filtered = (Array.isArray(arr) ? arr : []).filter((a: any) => {
          // Check if user is in audit team OR is the creator
          const hasTeamAccess = normalizedCurrentUserId && userAuditIds.size > 0;
          const hasCreatorAccess = normalizedCurrentUserId && creatorAuditIds.size > 0;
          
          if (!hasTeamAccess && !hasCreatorAccess) {
            return false;
          }
          
          // Check if this audit is in user's audit list (team member) OR creator list
          const auditIdCandidates = [
            a.auditId,
            a.id,
            a.$id
          ].filter(Boolean).map(id => String(id).trim());
          
          // Check if any auditId format matches (team member OR creator)
          const isUserAudit = auditIdCandidates.some(auditId => {
            // Check team membership
            if (userAuditIds.has(auditId)) return true;
            if (userAuditIds.has(auditId.toLowerCase())) return true;
            
            // Check creator access
            if (creatorAuditIds.has(auditId)) return true;
            if (creatorAuditIds.has(auditId.toLowerCase())) return true;
            
            // Try lowercase version for team
            const lowerAuditId = auditId.toLowerCase();
            if (Array.from(userAuditIds).some(uid => uid.toLowerCase() === lowerAuditId)) return true;
            
            // Try lowercase version for creator
            if (Array.from(creatorAuditIds).some(uid => uid.toLowerCase() === lowerAuditId)) return true;
            
            return false;
          });
          
          return isUserAudit;
        });
        
        setAudits(filtered);
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
        setError('Failed to load audit list');
      } finally {
        setLoadingAudits(false);
      }
    };
    loadAudits();
  }, []);

  // Helper function to resolve user name from userId with lookup strategies
  const resolveUserName = (userId: string | null | undefined, currentUserMap: Record<string, string>, doc?: any): string => {
    if (!userId) {
      // Fallback to uploadedByUser field if available
      if (doc?.uploadedByUser) {
        if (typeof doc.uploadedByUser === 'object' && doc.uploadedByUser.fullName) {
          return doc.uploadedByUser.fullName;
        }
      }
      return 'Unknown';
    }
    
    const idStr = String(userId).trim();
    if (!idStr) return 'Unknown';

    let userName = '';
    
    // Strategy 1: Direct lookup
    if (idStr && Object.keys(currentUserMap).length > 0) {
      userName = currentUserMap[idStr];
      
      // Strategy 2: Case-insensitive lookup
      if (!userName) {
        userName = currentUserMap[idStr.toLowerCase()];
      }
      
      // Strategy 3: Try as number if it's numeric
      if (!userName && !isNaN(Number(idStr))) {
        userName = currentUserMap[String(Number(idStr))];
      }
    }
    
    // Fallback to uploadedByUser field (if it's an object with fullName)
    if (!userName && doc?.uploadedByUser) {
      if (typeof doc.uploadedByUser === 'object' && doc.uploadedByUser.fullName) {
        userName = doc.uploadedByUser.fullName;
      } else if (typeof doc.uploadedByUser === 'string') {
        userName = currentUserMap[doc.uploadedByUser] || currentUserMap[doc.uploadedByUser.toLowerCase()] || doc.uploadedByUser;
      }
    }
    
    // Final fallback
    if (!userName || userName.trim() === '') {
      return 'Unknown';
    }
    
    return userName;
  };

  // Load documents for all audits when audits list changes
  useEffect(() => {
    if (!audits.length) {
      lastDocFetchKeyRef.current = '';
      setLoadingDocs(false);
      setDocsLoaded(true);
      setDocumentsMap({});
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
        
        // Fetch all documents
        const results = await Promise.allSettled(auditIds.map(id => getAuditDocuments(id)));
        
        // First pass: collect all documents and extract unique userIds
        const allDocs: Array<{ doc: any; auditId: string }> = [];
        results.forEach((res, idx) => {
          const auditId = auditIds[idx];
          if (res.status === 'fulfilled') {
            const rows = Array.isArray(res.value) ? res.value : [res.value];
            rows.filter(Boolean).forEach((d: any) => {
              const sizeBytes = Number(d.sizeBytes ?? 0) || 0;
              const fileName = d.fileName || d.originalFileName || d.originalName || d.name || '';
              const url = d.blobPath || '';
              const hasDownload = Boolean(url);
              const hasInfo = hasDownload || sizeBytes > 0 || Boolean(fileName.trim());

              if (hasInfo) {
                allDocs.push({ doc: d, auditId });
              }
            });
          }
        });

        // Collect unique userIds that need to be resolved (GUIDs not in userMap)
        const userIdsToResolve = new Set<string>();
        allDocs.forEach(({ doc }) => {
          const uploadedById = doc.uploadedBy || doc.uploadedByUserId || '';
          const idStr = String(uploadedById || '').trim();
          if (idStr) {
            const isGuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
            const notInMap = !userMap[idStr] && !userMap[idStr.toLowerCase()];
            
            // If it's a GUID and not in map, fetch it
            if (isGuid && notInMap) {
              userIdsToResolve.add(idStr);
            }
          }
        });

        // Fetch all missing user info in parallel and update userMap
        let finalUserMap = { ...userMap };
        if (userIdsToResolve.size > 0) {
          const userPromises = Array.from(userIdsToResolve).map(async (userId) => {
            try {
              const userInfo = await getUserById(userId);
              const fullName = userInfo?.fullName || userInfo?.email || 'Unknown';
              return { userId, fullName };
            } catch (err) {
              console.warn(`Failed to fetch user info for ${userId}`, err);
              return { userId, fullName: 'Unknown' };
            }
          });

          const userResults = await Promise.allSettled(userPromises);
          userResults.forEach((result) => {
            if (result.status === 'fulfilled') {
              const { userId, fullName } = result.value;
              finalUserMap[userId] = fullName;
              finalUserMap[userId.toLowerCase()] = fullName;
            }
          });
          
          // Update userMap state for future use
          setUserMap(finalUserMap);
        }

        // Second pass: map documents with resolved user names
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
              const uploadedByName = resolveUserName(uploadedById, finalUserMap, d);

              return {
                auditId,
                id: String(fileName || `${auditId}_${uploadedAt || Date.now()}`),
                documentType: documentType || fileName || '—',
                contentType: contentType || '—',
                uploadedBy: uploadedByName,
                uploadedAt,
                sizeBytes,
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
      return { auditId: id, title };
    })
  ), [audits]);

  const visibleAuditRows = useMemo(() => {
    if (!docsLoaded) return auditRows;
    return auditRows.filter((row) => (documentsMap[row.auditId]?.length || 0) > 0);
  }, [auditRows, documentsMap, docsLoaded]);

  const handleViewDetails = (auditId: string, auditTitle: string) => {
    setSelectedAuditId(auditId);
    setSelectedAuditTitle(auditTitle);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setSelectedAuditId('');
    setSelectedAuditTitle('');
  };


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
      alert('Download failed');
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Number of files</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loadingAudits && (
                  <tr><td colSpan={3} className="px-6 py-4 text-sm text-gray-500">Loading audits...</td></tr>
                )}
                {!loadingAudits && visibleAuditRows.map(r => {
                  const docs = documentsMap[r.auditId] || [];
                  return (
                    <tr key={r.auditId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">{r.title}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center min-w-[2rem] h-8 rounded-full bg-primary-50 text-primary-700 text-sm font-semibold border border-primary-100">{docs.length}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetails(r.auditId, r.title)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >View Details</button>
                      </td>
                    </tr>
                  );
                })}
                {!loadingAudits && visibleAuditRows.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-sm text-gray-500">
                      {loadingDocs || !docsLoaded
                        ? 'Checking upload history...'
                        : 'Only audits with uploaded documents are displayed.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </div>

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 py-8">
            {/* Background overlay */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={handleCloseModal}></div>

            {/* Modal panel */}
            <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-5xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="bg-primary-600 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white" id="modal-title">
                  Upload History - {selectedAuditTitle}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="bg-white px-6 py-4 overflow-y-auto flex-1">
                {loadingDocs && (
                  <div className="text-center py-8">
                    <span className="text-sm text-gray-500">Loading history...</span>
                  </div>
                )}
                {!loadingDocs && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Document Type</th>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Content Type</th>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Uploaded By</th>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Uploaded At</th>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Size</th>
                          <th className="px-4 py-2 text-left text-gray-700 font-semibold">Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(documentsMap[selectedAuditId] || []).map(doc => {
                          const dateStr = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleString() : '—';
                          const sizeKB = doc.sizeBytes ? Math.round(doc.sizeBytes / 1024) : 0;
                          return (
                            <tr key={doc.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">{doc.documentType}</td>
                              <td className="px-4 py-2">{doc.contentType}</td>
                              <td className="px-4 py-2">{doc.uploadedBy}</td>
                              <td className="px-4 py-2">{dateStr}</td>
                              <td className="px-4 py-2">{sizeKB ? `${sizeKB} KB` : '—'}</td>
                              <td className="px-4 py-2">
                                {doc.url ? (
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary-600 hover:text-primary-700 font-medium"
                                  >View</a>
                                ) : (
                                  <button
                                    onClick={() => handleDownload(doc)}
                                    className="text-primary-600 hover:text-primary-700 font-medium"
                                  >View</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {(!documentsMap[selectedAuditId] || documentsMap[selectedAuditId].length === 0) && !loadingDocs && (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                              No documents have been uploaded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 flex justify-end">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default HistoryUploadPage;
