import { useState, useEffect, useRef } from 'react';
import { MainLayout } from '../../layouts';
import { useAuth } from '../../contexts';
import useAuthStore, { useUserId } from '../../store/useAuthStore';
import { getAdminUsers, getUserById } from '../../api/adminUsers';
import { scanAccessGrant, verifyCode, type ScanAccessGrantResponse } from '../../api/accessGrant';
import { getDepartmentById } from '../../api/departments';
import { getAuditPlanById } from '../../api/audits';
import { toast } from 'react-toastify';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';

export default function ScanQR() {
  const { user } = useAuth();
  const authStore = useAuthStore();
  const userIdFromToken = useUserId();
  const navigate = useNavigate();
  const [scannerUserId, setScannerUserId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [qrToken, setQrToken] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanAccessGrantResponse | null>(null);
  const [scannedDept, setScannedDept] = useState<{ deptId: number; name: string; isSensitive: boolean } | null>(null);
  const [auditTitle, setAuditTitle] = useState<string>('');
  const [auditorName, setAuditorName] = useState<string>('');
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [scanningError, setScanningError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  // Load scanner user ID
  useEffect(() => {
    // First try to get from JWT token
    if (userIdFromToken) {
      setScannerUserId(userIdFromToken);
      return;
    }

    // Fallback: fetch from API by email
    const loadScannerUserId = async () => {
      try {
        const users = await getAdminUsers();
        const me = (users || []).find((u: any) => 
          String(u.email || '').toLowerCase() === String(authStore.user?.email || '').toLowerCase()
        );
        if (me) {
          const userId = String(me.userId || me.$id || '');
          setScannerUserId(userId);
        }
      } catch (error) {
        console.error('Failed to load scanner user ID:', error);
      }
    };

    if (authStore.user?.email) {
      loadScannerUserId();
    }
  }, [userIdFromToken, authStore.user?.email]);

  useEffect(() => {
    return () => {
      // Cleanup: stop scanner when component unmounts
      if (html5QrCodeRef.current && scanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, [scanning]);

  const startScanning = async () => {
    if (!scannerContainerRef.current) return;

    try {
      setScanningError(null);
      setScanResult(null);
      setQrToken('');
      setVerifyCodeInput('');

      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // QR code scanned successfully
          handleQrScanned(decodedText);
        },
        () => {
          // Ignore scanning errors (they're expected while scanning)
        }
      );

      setScanning(true);
    } catch (err: any) {
      console.error('Failed to start QR scanner:', err);
      setScanningError('Failed to start camera. Please check permissions.');
      toast.error('Failed to start camera. Please allow camera access.');
    }
  };

  const stopScanning = async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
    setScanningError(null);
  };

  const handleQrScanned = async (scannedToken: string) => {
    // Stop scanning
    await stopScanning();

    // Extract QR token from URL if it's a full URL
    let token = scannedToken;
    if (scannedToken.includes('/verify/')) {
      const parts = scannedToken.split('/verify/');
      token = parts[parts.length - 1].split('?')[0]; // Remove query params if any
    }

    setQrToken(token);

    // Scan the QR token
    if (!scannerUserId) {
      toast.error('User information not available. Please refresh the page.');
      return;
    }

    try {
      const result = await scanAccessGrant({
        qrToken: token,
        scannerUserId: scannerUserId,
      });

      if (result.isValid) {
        setScanResult(result);
        
        // Fetch names for display
        const fetchPromises: Promise<void>[] = [];
        
        // Fetch audit title
        if (result.auditId) {
          fetchPromises.push(
            getAuditPlanById(result.auditId)
              .then((audit: any) => {
                // Try multiple possible field paths for title
                const title = audit?.title || 
                             audit?.audit?.title || 
                             audit?.name ||
                             audit?.audit?.name ||
                             'N/A';
                setAuditTitle(title);
                console.log('[ScanQR] Loaded audit title:', title, 'from audit data:', audit);
              })
              .catch((e) => {
                console.warn('Failed to load audit info', e);
                setAuditTitle('N/A');
              })
          );
        }
        
        // Fetch auditor name
        if (result.auditorId) {
          fetchPromises.push(
            getUserById(result.auditorId)
              .then((auditor: any) => {
                setAuditorName(auditor?.fullName || 'N/A');
                if (auditor?.avatarUrl) {
                  setScanResult((prev) =>
                    prev ? { ...prev, avatarUrl: prev.avatarUrl || auditor.avatarUrl } : prev
                  );
                }
              })
              .catch((e) => {
                console.warn('Failed to load auditor info', e);
                setAuditorName('N/A');
              })
          );
        }
        
        // Fetch department info to know if sensitive
        if (result.deptId) {
          fetchPromises.push(
            getDepartmentById(Number(result.deptId))
              .then((dept: any) => {
                const isSensitive =
                  !!(dept as any)?.hasSensitiveAreas ||
                  (Array.isArray((dept as any)?.sensitiveAreas) && (dept as any).sensitiveAreas.length > 0);
                setScannedDept({
                  deptId: dept?.deptId || Number(result.deptId),
                  name: dept?.name || 'Department',
                  isSensitive,
                });
              })
              .catch((e) => {
                console.warn('Failed to load department info for sensitivity check', e);
                setScannedDept({
                  deptId: Number(result.deptId),
                  name: 'Department',
                  isSensitive: false,
                });
              })
          );
        }
        
        await Promise.allSettled(fetchPromises);
        toast.success('QR code scanned successfully!');
      } else {
        // Handle different error reasons
        const reason = result.reason || 'QR code is invalid';
        let errorMessage = reason;
        
        if (reason.toLowerCase().includes('expired')) {
          errorMessage = 'QR code has expired. Please request a new QR code from the auditor.';
        } else if (reason.toLowerCase().includes('invalid')) {
          errorMessage = 'QR code is invalid. Please check and try again.';
        }
        
        toast.error(errorMessage);
        setScanResult(result);
      }
    } catch (error: any) {
      console.error('Failed to scan QR code:', error);
      
      // Check if error response contains reason
      const errorData = error?.response?.data;
      let reason = 'Scan failed';
      
      if (errorData?.reason) {
        reason = errorData.reason;
      } else if (errorData?.message) {
        reason = errorData.message;
      } else if (error?.message) {
        reason = error.message;
      }
      
      // Handle expired case specifically
      if (reason.toLowerCase().includes('expired')) {
        toast.error('QR code has expired. Please request a new QR code from the auditor.');
      } else {
        toast.error(reason || 'Failed to scan QR code');
      }
      
      setScanResult({
        isValid: false,
        reason: reason,
        auditId: errorData?.auditId || null,
        auditorId: errorData?.auditorId || null,
        deptId: errorData?.deptId || null,
        expiresAt: errorData?.expiresAt || null,
        verifyCode: errorData?.verifyCode || undefined,
        avatarUrl: errorData?.avatarUrl || undefined,
      });
    }
  };

  const handleVerifyCode = async () => {
    if (!qrToken || !verifyCodeInput.trim()) {
      toast.error('Please enter verify code');
      return;
    }

    // If department is non-sensitive, skip verify and open checklist
    if (scannedDept && !scannedDept.isSensitive && scanResult?.auditId && scanResult?.deptId) {
      navigate(`/auditor/findings/department/${scanResult.deptId}`, {
        state: {
          auditId: scanResult.auditId,
          department: {
            deptId: scannedDept.deptId,
            name: scannedDept.name,
          },
          auditType: '',
        },
      });
      return;
    }

    if (!scannerUserId) {
      toast.error('User information not available. Please refresh the page.');
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyCode({
        qrToken: qrToken,
        scannerUserId: scannerUserId,
        verifyCode: verifyCodeInput.trim(),
      });

      if (result.isValid) {
        toast.success('Verify code is correct! Opening checklist...');

        // If we have auditId and deptId, route to auditor checklist view
        if (scanResult?.auditId && scanResult?.deptId) {
          try {
            const dept = await getDepartmentById(Number(scanResult.deptId));
            navigate(`/auditor/findings/department/${scanResult.deptId}`, {
              state: {
                auditId: scanResult.auditId,
                department: {
                  deptId: dept?.deptId || scanResult.deptId,
                  name: dept?.name || 'Department',
                  code: dept?.code || '',
                  description: dept?.description || '',
                },
                auditType: '',
              },
            });
          } catch {
            // Fallback: go to findings list by audit
            navigate(`/auditee-owner/findings/audit/${scanResult.auditId}`);
          }
        } else if (scanResult?.auditId) {
          navigate(`/auditee-owner/findings/audit/${scanResult.auditId}`);
        } else {
          toast.info('QR code verified successfully!');
        }
      } else {
        toast.error(result.reason || 'Verify code is incorrect');
      }
    } catch (error: any) {
      console.error('Failed to verify code:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Failed to verify code');
    } finally {
      setVerifying(false);
    }
  };

  const handleReset = () => {
    setQrToken('');
    setVerifyCodeInput('');
    setScanResult(null);
    setScanningError(null);
    setAuditTitle('');
    setAuditorName('');
    setScannedDept(null);
    if (scanning) {
      stopScanning();
    }
  };

  const layoutUser = user ? { name: user.fullName, avatar: undefined } : undefined;

  return (
    <MainLayout user={layoutUser}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4">
            <h1 className="text-2xl font-semibold text-gray-900">Scan QR Code</h1>
            <p className="text-gray-600 text-sm mt-1">
              Scan QR code from auditor to verify access and open audit checklist
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
            <div className="p-6">
              {/* Camera Scan Mode */}
              <div className="space-y-4">
                  <div className="flex justify-center">
                    <div
                      id="qr-reader"
                      ref={scannerContainerRef}
                      className="w-full max-w-md"
                      style={{ minHeight: '300px' }}
                    />
                  </div>

                  {scanningError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-800">{scanningError}</p>
                    </div>
                  )}

                  <div className="flex justify-center gap-3">
                    {!scanning ? (
                      <button
                        onClick={startScanning}
                        className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Start Scanning
                      </button>
                    ) : (
                      <button
                        onClick={stopScanning}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                        </svg>
                        Stop Scanning
                      </button>
                    )}
                  </div>
                </div>

              {/* Scan Result */}
              {scanResult && (
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan Result</h3>
                  
                  {scanResult.isValid ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm font-semibold text-green-900">QR Code is Valid</p>
                      </div>

                      {/* Avatar Image */}
                      {scanResult.avatarUrl && (
                        <div className="flex justify-center">
                          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-green-300 shadow-lg">
                            <img
                              src={scanResult.avatarUrl}
                              alt="Auditor Avatar"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {scanResult.auditId && (
                          <div>
                            <span className="font-medium text-gray-700">Audit:</span>
                            <p className="text-gray-900 mt-1">{auditTitle || 'Loading...'}</p>
                          </div>
                        )}
                        {scanResult.auditorId && (
                          <div>
                            <span className="font-medium text-gray-700">Auditor:</span>
                            <p className="text-gray-900 mt-1">{auditorName || 'Loading...'}</p>
                          </div>
                        )}
                        {scanResult.deptId && (
                          <div>
                            <span className="font-medium text-gray-700">Department:</span>
                            <p className="text-gray-900 mt-1">{scannedDept?.name || 'Loading...'}</p>
                          </div>
                        )}
                        {scanResult.expiresAt && (
                          <div>
                            <span className="font-medium text-gray-700">Expires At:</span>
                            <p className="text-gray-900 mt-1">
                              {new Date(scanResult.expiresAt).toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Verify Code Display (for Auditor) */}
                      {scanResult.verifyCode && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Verify Code
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-50 rounded-lg px-4 py-3 border border-gray-300">
                                <p className="text-2xl font-mono font-semibold text-gray-900 text-center">
                                  {scanResult.verifyCode}
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(scanResult.verifyCode!);
                                  toast.success('Verify code copied!');
                                }}
                                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                                title="Copy verify code"
                              >
                                Copy
                              </button>
                            </div>
                            <p className="text-xs text-gray-500">
                              Provide this code to the Auditor to access the checklist.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Verify Code Input (for non-sensitive departments - legacy support) */}
                      {!scanResult.verifyCode && scannedDept?.isSensitive && (
                        <div className="mt-4 pt-4 border-t border-green-200">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Verify Code (if required)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={verifyCodeInput}
                              onChange={(e) => setVerifyCodeInput(e.target.value)}
                              placeholder="Enter 6-digit verify code"
                              maxLength={6}
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            />
                            <button
                              onClick={handleVerifyCode}
                              disabled={verifying || !verifyCodeInput.trim()}
                              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {verifying ? 'Verifying...' : 'Verify'}
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-2">
                            Enter the verify code provided by the auditor to access the checklist
                          </p>
                        </div>
                      )}

                      {/* Direct Access Button (if verify code not required) */}
                      
                    </div>
                  ) : (() => {
                    const reasonLower = (scanResult.reason || '').toLowerCase();
                    // Backend returns "Expired" when now is outside [ValidFrom, ValidTo]
                    const isExpired = reasonLower.includes('expired');
                    // Legacy support: backend currently does NOT send "NotYetValid", but keep check for safety
                    const isNotYetValid = reasonLower.includes('notyetvalid') || reasonLower.includes('not yet');

                    return (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className="text-sm font-semibold text-red-900">
                            {isNotYetValid
                              ? 'QR Code Not Active Yet'
                              : isExpired
                            ? 'QR Code Has Expired' 
                            : 'QR Code is Invalid'}
                        </p>
                      </div>
                      {scanResult.reason && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-red-800 font-medium">Reason:</p>
                          <p className="text-sm text-red-700">
                              {isNotYetValid
                                ? 'This QR code is not active yet. Please try again after the start time.'
                                : isExpired
                              ? 'This QR code has expired. Please contact the auditor to request a new QR code.'
                              : scanResult.reason}
                          </p>
                          
                            {/* Display validity window if available */}
                            {(scanResult.validFrom || scanResult.expiresAt) && (
                              <div className="mt-3 p-3 bg-white rounded-lg border border-red-200 space-y-1">
                                <p className="text-xs text-gray-700 font-medium">Validity Window:</p>
                                {scanResult.validFrom && (
                                  <p className="text-xs text-gray-600">
                                    Starts: <strong>{new Date(scanResult.validFrom).toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}</strong>
                                  </p>
                                )}
                          {scanResult.expiresAt && (
                              <p className="text-xs text-gray-600">
                                    Expires: <strong>{new Date(scanResult.expiresAt).toLocaleString('en-US', { 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}</strong>
                              </p>
                                )}
                            </div>
                          )}
                          
                            {isExpired && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-red-200">
                              <p className="text-xs text-gray-600">
                                <strong>Note:</strong> QR codes are only valid within the time window defined by the Lead Auditor (from <em>Fieldwork Start</em> to <em>Evidence Due</em>). If you need access outside this window, please ask the Lead Auditor to issue a new QR code.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })()}

                  <button
                    onClick={handleReset}
                    className="mt-4 w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Scan Another QR Code
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

