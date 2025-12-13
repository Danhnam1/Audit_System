import React from 'react';

interface PermissionPreviewPanelProps {
  sensitiveFlag: boolean;
}

export const PermissionPreviewPanel: React.FC<PermissionPreviewPanelProps> = ({ sensitiveFlag }) => {
  if (!sensitiveFlag) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
        No sensitive flag. Auditors will be assigned normally; no permission/QR issuance required.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 space-y-1">
      <div className="font-semibold">Sensitive flag is ON</div>
      <ul className="list-disc list-inside space-y-1 text-xs text-blue-800">
        <li>After Director approval + Kickoff Minutes, issue QR/permission for assigned auditors.</li>
        {/* <li>Permission issuance uses API: POST /admin/Audit/&#123;&#123;auditId&#125;&#125;/access-grant/issue (later step).</li> */}
        <li>Escorts/verify-code may be required by Security at scan time.</li>
      </ul>
    </div>
  );
};

