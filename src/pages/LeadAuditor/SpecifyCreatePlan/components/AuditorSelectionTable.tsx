import { useState, useRef } from 'react';
import type { AdminUserDto } from '../../../../api/adminUsers';

interface AuditorSelectionTableProps {
  auditors: AdminUserDto[];
  selectedAuditorId: string | null;
  onSelectionChange: (id: string | null) => void;
  drlFiles?: Map<string, File[]>;
  onDrlFileChange?: (auditorId: string, files: File[] | null) => void;
}

export const AuditorSelectionTable = ({
  auditors,
  selectedAuditorId,
  onSelectionChange,
  drlFiles = new Map(),
  onDrlFileChange,
}: AuditorSelectionTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Filter auditors by search term
  const filteredAuditors = auditors.filter((auditor) => {
    const searchLower = searchTerm.toLowerCase();
    const name = (auditor.fullName || '').toLowerCase();
    const email = (auditor.email || '').toLowerCase();
    return name.includes(searchLower) || email.includes(searchLower);
  });

  // Handle individual selection (radio button - only one can be selected)
  const handleSelection = (auditorId: string) => {
    // Always select the clicked auditor (radio button behavior)
    onSelectionChange(auditorId);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <div className="bg-primary-50 border border-primary-200 rounded-lg px-4 py-2">
          <span className="text-sm font-medium text-primary-700">
            {filteredAuditors.length} {filteredAuditors.length === 1 ? 'auditor' : 'auditors'}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
              <tr>
                <th className="px-6 py-4 text-left w-12"></th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Name
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    Email
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-56">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    DRL File
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAuditors.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-gray-500 font-medium">No auditors found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAuditors.map((auditor) => {
                  const auditorId = String(auditor.userId || '');
                  // Compare strings directly
                  const isSelected = selectedAuditorId !== null && selectedAuditorId === auditorId && auditorId !== '';

                  const handleRowClick = (e: React.MouseEvent) => {
                    // Don't trigger if clicking on the radio button itself
                    if ((e.target as HTMLElement).tagName === 'INPUT') {
                      return;
                    }
                    if (auditorId && auditorId !== '') {
                      handleSelection(auditorId);
                    } else {
                      console.warn('[AuditorSelectionTable] Invalid auditorId:', auditorId);
                    }
                  };

                  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                    e.stopPropagation();
                    if (e.target.checked && auditorId && auditorId !== '') {
                      handleSelection(auditorId);
                    }
                  };

                  return (
                    <tr
                      key={auditor.userId}
                      className={`hover:bg-primary-50 cursor-pointer transition-colors duration-150 ${
                        isSelected ? 'bg-primary-100 border-l-4 border-primary-600' : ''
                      }`}
                      onClick={handleRowClick}
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <input
                            type="radio"
                            name="auditor-selection"
                            checked={isSelected}
                            onChange={handleRadioChange}
                            className="w-5 h-5 text-primary-600 focus:ring-primary-500 cursor-pointer"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                            <span className="text-primary-700 font-semibold text-sm">
                              {(auditor.fullName || 'U')[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="text-sm font-medium text-gray-900">
                            {auditor.fullName || '—'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-700 flex items-center gap-2">
                          {auditor.email || '—'}
                        </div>
                      </td>
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        {isSelected ? (
                          <div className="flex items-center gap-2">
                            <input
                              ref={(el) => {
                                if (el) fileInputRefs.current.set(auditorId, el);
                                else fileInputRefs.current.delete(auditorId);
                              }}
                              type="file"
                              multiple
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                              className="hidden"
                              onChange={(e) => {
                                const files = e.target.files ? Array.from(e.target.files) : [];
                                if (onDrlFileChange && files.length > 0) {
                                  // Pass new files to parent - parent will handle merging
                                  const existingFiles = drlFiles.get(auditorId) || [];
                                  const mergedFiles = [...existingFiles, ...files];
                                  onDrlFileChange(auditorId, mergedFiles);
                                }
                                e.target.value = ''; // Reset input to allow re-uploading same files
                              }}
                            />
                            {drlFiles.has(auditorId) && drlFiles.get(auditorId)!.length > 0 ? (
                              <div className="flex flex-col gap-2 flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  {drlFiles.get(auditorId)!.map((file, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center gap-1 text-xs text-primary-700 bg-gradient-to-r from-primary-50 to-primary-100 px-2 py-1 rounded-full border border-primary-200 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                      <svg className="w-3 h-3 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <span className="max-w-[120px] truncate" title={file.name}>
                                        {file.name}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const currentFiles = drlFiles.get(auditorId) || [];
                                          const updatedFiles = currentFiles.filter((_, i) => i !== index);
                                          if (onDrlFileChange) {
                                            onDrlFileChange(auditorId, updatedFiles.length > 0 ? updatedFiles : null);
                                          }
                                        }}
                                        className="ml-1 text-red-600 hover:text-red-700 p-0.5 rounded-full hover:bg-red-50 transition"
                                        title="Remove file"
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => fileInputRefs.current.get(auditorId)?.click()}
                                    className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-white border border-primary-200 rounded-lg shadow-sm hover:bg-primary-50 hover:border-primary-300 transition flex items-center gap-1"
                                    title="Add more files"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Add more
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (onDrlFileChange) {
                                        onDrlFileChange(auditorId, null);
                                      }
                                      const input = fileInputRefs.current.get(auditorId);
                                      if (input) input.value = '';
                                    }}
                                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-300 transition flex items-center gap-1"
                                    title="Remove all files"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Clear all
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => fileInputRefs.current.get(auditorId)?.click()}
                                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-200"
                                title="Upload DRL files (Multiple files supported)"
                              >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Upload Files
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

