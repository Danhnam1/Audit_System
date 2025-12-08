import { useState } from 'react';
import type { AdminUserDto } from '../../../../api/adminUsers';

interface AuditorSelectionTableProps {
  auditors: AdminUserDto[];
  selectedAuditorId: string | null;
  onSelectionChange: (id: string | null) => void;
}

export const AuditorSelectionTable = ({
  auditors,
  selectedAuditorId,
  onSelectionChange,
}: AuditorSelectionTableProps) => {
  const [searchTerm, setSearchTerm] = useState('');

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
        <input
          type="text"
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <span className="text-sm text-gray-600">
          {filteredAuditors.length} auditor(s) found
        </span>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left w-12"></th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Name
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                Email
              </th>
              
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAuditors.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No auditors found
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
                    className={`hover:bg-gray-50 cursor-pointer ${
                      isSelected ? 'bg-primary-50' : ''
                    }`}
                    onClick={handleRowClick}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="radio"
                        name="auditor-selection"
                        checked={isSelected}
                        onChange={handleRadioChange}
                        className="w-4 h-4 text-primary-600 focus:ring-primary-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {auditor.fullName || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {auditor.email || '—'}
                    </td>
                    
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

