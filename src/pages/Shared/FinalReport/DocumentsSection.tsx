interface DocumentsSectionProps {
  documents: any[];
  isImage: (contentType?: string, fileName?: string) => boolean;
  expandedImages: Set<string>;
  handleFileAction: (file: any) => void;
  toggleImageExpand: (id: string) => void;
}

export const DocumentsSection = ({
  documents,
  isImage,
  expandedImages,
  handleFileAction,
  toggleImageExpand,
}: DocumentsSectionProps) => {
  return (
    <div className="text-sm text-gray-700">
      {documents.length === 0 ? (
        <p className="text-gray-500 text-xs">No documents recorded for this audit.</p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {documents.map((d: any) => {
            const docId = d.docId || "";
            const isImg = isImage(d.contentType, d.title || d.fileName);
            const isExpanded = expandedImages.has(docId);
            const filePath = d.blobPath;
            return (
              <li key={docId} className="border border-primary-200 rounded-md p-2 bg-white">
                <button
                  onClick={() => handleFileAction(d)}
                  className="w-full flex items-center justify-between gap-2 text-left"
                  title={isImg ? "Click to expand/collapse image" : "Click to open file"}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 hover:text-primary-600 transition-colors">
                      {d.title || d.documentType || "Document"}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Type: {d.documentType || "N/A"} · Final: {String(d.isFinalVersion ?? false)}
                    </p>
                    {d.contentType && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{d.contentType}</p>
                    )}
                  </div>
                  {isImg && (
                    <svg
                      className={`w-3 h-3 text-primary-400 flex-shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                  {!isImg && filePath && (
                    <svg
                      className="w-3 h-3 text-primary-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                </button>
                {isImg && isExpanded && filePath && (
                  <div className="mt-2 border-t border-primary-200 pt-2">
                    <div className="relative w-full">
                      <img
                        src={filePath}
                        alt={d.title || "Document image"}
                        className="w-full h-auto rounded border border-primary-200 max-h-64 object-contain bg-primary-50"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EImage not available%3C/text%3E%3C/svg%3E";
                        }}
                      />
                      <button
                        onClick={() => toggleImageExpand(docId)}
                        className="absolute top-1 right-1 bg-white/90 hover:bg-white border border-primary-300 rounded p-1.5 shadow-sm transition-colors"
                        title="Collapse image"
                      >
                        <svg
                          className="w-4 h-4 text-primary-700"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
