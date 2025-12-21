import { useState, useEffect, useRef } from 'react';
import useAuthStore, { useUserId } from '../../store/useAuthStore';
import { getAdminUsers, getUserById } from '../../api/adminUsers';
import { scanAccessGrant, verifyCode, type ScanAccessGrantResponse } from '../../api/accessGrant';
import { getDepartmentById } from '../../api/departments';
import { getAuditPlanById } from '../../api/audits';
import { toast } from 'react-toastify';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';

interface ScanQRContentProps {
  onClose?: () => void;
}

export default function ScanQRContent({ onClose }: ScanQRContentProps) {
  const authStore = useAuthStore();
  const userIdFromToken = useUserId();
  const navigate = useNavigate();
  const [scannerUserId, setScannerUserId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [qrToken, setQrToken] = useState<string>('');
  const [manualInput, setManualInput] = useState(false);
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
    if (userIdFromToken) {
      setScannerUserId(userIdFromToken);
      return;
    }

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

      const html5QrCode = new Html5Qrcode('qr-reader-modal');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleQrScanned(decodedText);
        },
        () => {}
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
    await stopScanning();

    let token = scannedToken;
    if (scannedToken.includes('/verify/')) {
      const parts = scannedToken.split('/verify/');
      token = parts[parts.length - 1].split('?')[0];
    }

    setQrToken(token);

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
        
        const fetchPromises: Promise<void>[] = [];
        
        if (result.auditId) {
          fetchPromises.push(
            getAuditPlanById(result.auditId)
              .then((audit: any) => {
                const title = audit?.title || 
                             audit?.audit?.title || 
                             audit?.name ||
                             audit?.audit?.name ||
                             'N/A';
                setAuditTitle(title);
              })
              .catch((e) => {
                console.warn('Failed to load audit info', e);
                setAuditTitle('N/A');
              })
          );
        }
        
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
      
      const errorData = error?.response?.data;
      let reason = 'Scan failed';
      
      if (errorData?.reason) {
        reason = errorData.reason;
      } else if (errorData?.message) {
        reason = errorData.message;
      } else if (error?.message) {
        reason = error.message;
      }
      
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

  const handleManualInput = async () => {
    if (!qrToken.trim()) {
      toast.error('Please enter a QR token');
      return;
    }

    if (!scannerUserId) {
      toast.error('User information not available. Please refresh the page.');
      return;
    }

    try {
      const result = await scanAccessGrant({
        qrToken: qrToken.trim(),
        scannerUserId: scannerUserId,
      });

      if (result.isValid) {
        setScanResult(result);
        
        const fetchPromises: Promise<void>[] = [];
        
        if (result.auditId) {
          fetchPromises.push(
            getAuditPlanById(result.auditId)
              .then((audit: any) => {
                const title = audit?.title || 
                             audit?.audit?.title || 
                             audit?.name ||
                             audit?.audit?.name ||
                             'N/A';
                setAuditTitle(title);
              })
              .catch((e) => {
                console.warn('Failed to load audit info', e);
                setAuditTitle('N/A');
              })
          );
        }
        
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
      
      const errorData = error?.response?.data;
      let reason = 'Scan failed';
      
      if (errorData?.reason) {
        reason = errorData.reason;
      } else if (errorData?.message) {
        reason = errorData.message;
      } else if (error?.message) {
        reason = error.message;
      }
      
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
      if (onClose) onClose();
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
            if (onClose) onClose();
          } catch {
            navigate(`/auditee-owner/findings/audit/${scanResult.auditId}`);
            if (onClose) onClose();
          }
        } else if (scanResult?.auditId) {
          navigate(`/auditee-owner/findings/audit/${scanResult.auditId}`);
          if (onClose) onClose();
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
    setManualInput(false);
    setAuditTitle('');
    setAuditorName('');
    setScannedDept(null);
    if (scanning) {
      stopScanning();
    }
  };

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
        <div className="p-6">
          {/* Toggle between camera scan and manual input */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              onClick={() => {
                setManualInput(false);
                handleReset();
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                !manualInput
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Camera Scan
            </button>
            <button
              onClick={() => {
                setManualInput(true);
                stopScanning();
                handleReset();
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                manualInput
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Manual Input
            </button>
          </div>

          {/* Camera Scan Mode */}
          {!manualInput && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div
                  id="qr-reader-modal"
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
          )}

          {/* Manual Input Mode */}
          {manualInput && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  QR Token / URL
                </label>
                <input
                  type="text"
                  value={qrToken}
                  onChange={(e) => setQrToken(e.target.value)}
                  placeholder="Enter QR token or paste QR URL"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleManualInput}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
              >
                Scan QR Token
              </button>
            </div>
          )}

          {/* Scan Result - Same as original ScanQR component */}
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
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm font-semibold text-red-900">
                      {scanResult.reason?.toLowerCase().includes('expired') 
                        ? 'QR Code Has Expired' 
                        : 'QR Code is Invalid'}
                    </p>
                  </div>
                  {scanResult.reason && (
                    <p className="text-sm text-red-700 mt-2">{scanResult.reason}</p>
                  )}
                </div>
              )}

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
  );
}

