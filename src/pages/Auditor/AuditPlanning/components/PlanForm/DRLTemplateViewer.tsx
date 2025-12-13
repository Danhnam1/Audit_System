import React from 'react';

interface DRLTemplateViewerProps {
  drlFiles?: Array<{
    fileName: string;
    fileUrl?: string;
    fileId?: string;
  }>;
  assignmentId?: string;
}

export const DRLTemplateViewer: React.FC<DRLTemplateViewerProps> = ({ drlFiles, assignmentId }) => {
  if (!drlFiles || drlFiles.length === 0) {
    return null;
  }

  const handleDownload = (file: { fileName: string; fileUrl?: string; fileId?: string }) => {
    if (file.fileUrl) {
      // Open in new tab or download
      window.open(file.fileUrl, '_blank');
    } else if (file.fileId) {
      // TODO: Implement download API call if needed
      console.log('Download file:', file.fileId);
    }
  };

  return (
    <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h4 className="text-sm font-semibold text-blue-900">DRL Template (from Lead Auditor)</h4>
      </div>
      <p className="text-xs text-blue-700 mb-3">
        The Lead Auditor has provided the following DRL template(s) for reference when creating your audit plan.
      </p>
      <div className="space-y-2">
        {drlFiles.map((file, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-2 bg-white rounded border border-blue-200 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-700 truncate" title={file.fileName}>
                {file.fileName}
              </span>
            </div>
            <button
              onClick={() => handleDownload(file)}
              className="ml-2 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors flex items-center gap-1 flex-shrink-0"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

