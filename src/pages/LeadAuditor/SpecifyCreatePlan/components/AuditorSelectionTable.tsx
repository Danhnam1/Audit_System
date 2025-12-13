import { useState, useRef } from 'react';
import type { AdminUserDto } from '../../../../api/adminUsers';

interface AuditorSelectionTableProps {
  auditors: AdminUserDto[];
  selectedAuditorId: string | null;
  onSelectionChange: (id: string | null) => void;
  drlFiles?: Map<string, { file: File; fileName: string }>;
  onDrlFileChange?: (auditorId: string, file: File | null) => void;
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
    console.log('[AuditorSelectionTable] handleSelection called:', { auditorId, type: typeof auditorId });
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
                    console.log('[AuditorSelectionTable] Row clicked:', { 
                      auditorId, 
                      userId: auditor.userId,
                      selectedAuditorId 
                    });
                    if (auditorId && auditorId !== '') {
                      handleSelection(auditorId);
                    } else {
                      console.warn('[AuditorSelectionTable] Invalid auditorId:', auditorId);
                    }
                  };

                  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                    e.stopPropagation();
                    console.log('[AuditorSelectionTable] Radio changed:', { 
                      auditorId, 
                      userId: auditor.userId,
                      checked: e.target.checked
                    });
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
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                if (onDrlFileChange) {
                                  onDrlFileChange(auditorId, file);
                                }
                              }}
                            />
                            {drlFiles.has(auditorId) ? (
                              <div className="flex items-center gap-2 flex-1">
                                <span className="inline-flex items-center gap-1 text-xs text-primary-700 bg-primary-50 px-2 py-1 rounded-full border border-primary-200">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span className="max-w-[160px] truncate">{drlFiles.get(auditorId)?.fileName || 'File uploaded'}</span>
                                </span>
                                <button
                                  onClick={() => {
                                    if (onDrlFileChange) {
                                      onDrlFileChange(auditorId, null);
                                    }
                                    const input = fileInputRefs.current.get(auditorId);
                                    if (input) input.value = '';
                                  }}
                                  className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition"
                                  title="Remove file"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => fileInputRefs.current.get(auditorId)?.click()}
                                  className="p-2 text-primary-600 hover:text-primary-700 rounded-full hover:bg-primary-50 transition"
                                  title="Replace file"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9M20 20v-5h-.581m-15.357-2a8.003 8.003 0 0015.357 2" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => fileInputRefs.current.get(auditorId)?.click()}
                                className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition shadow-sm"
                                title="Upload DRL"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
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

