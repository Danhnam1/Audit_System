import React, { useRef } from 'react';

interface DRLUploadCardProps {
  drlFileName: string;
  onFileChange: (file: File | null) => void;
}

export const DRLUploadCard: React.FC<DRLUploadCardProps> = ({
  drlFileName,
  onFileChange,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSelect = (file: File | null) => {
    onFileChange(file);
  };

  return (
    <div className="rounded-xl border border-primary-100 bg-primary-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Upload Decision DRL / Template</h3>
          <p className="text-xs text-gray-600 mt-1">
            Lead uploads the DRL template (includes audit name, start/end dates, scope). If the DRL mentions
            sensitive areas, mark them in the next step.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
          >
            {drlFileName ? 'Replace file' : 'Upload file'}
          </button>
          {drlFileName && (
            <button
              onClick={() => handleSelect(null)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Remove
            </button>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          handleSelect(file ?? null);
        }}
      />
      <div className="mt-3 text-xs text-gray-700">
        {drlFileName ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-primary-100 text-primary-700">
            <span className="w-2 h-2 rounded-full bg-primary-500" />
            <span>{drlFileName}</span>
          </div>
        ) : (
          <span className="text-gray-500">No file selected.</span>
        )}
      </div>
    </div>
  );
};

