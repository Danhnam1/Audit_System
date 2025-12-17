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

  const isImageFile = (file: { fileName: string; fileUrl?: string; fileId?: string }) => {
    const url = (file.fileUrl || '').toLowerCase();
    const name = (file.fileName || '').toLowerCase();
    const candidates = [url, name];

    return candidates.some((source) =>
      source.endsWith('.png') ||
      source.endsWith('.jpg') ||
      source.endsWith('.jpeg') ||
      source.endsWith('.gif') ||
      source.endsWith('.webp') ||
      source.endsWith('.bmp')
    );
  };

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
      <div className="space-y-2">
        {drlFiles.map((file, index) => (
          <div
            key={index}
            className="p-2 bg-white rounded border-blue-200 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm text-gray-700 truncate" title={file.fileName}>
                    {file.fileName}
                  </span>
                </div>

                {/* Inline preview for image files */}
                {isImageFile(file) && file.fileUrl && (
                  <div className="mt-1">
                    <img
                      src={file.fileUrl}
                      alt={file.fileName}
                      className="max-h-64 rounded border border-gray-200 object-contain"
                    />
                  </div>
                )}
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
          </div>
        ))}
      </div>
    </div>
  );
};

