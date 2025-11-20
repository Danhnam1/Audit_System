import React from 'react';

export type FilterDefinition = {
  id: string;
  label: string;
  type: 'select' | 'dateRange' | 'numberRange';
  getOptions?: () => Array<{ value: string; label: string }>; // for select
};

export interface ActiveFilters {
  [id: string]: any; // select -> string, dateRange -> { from: string; to: string }
}

interface FilterBarProps {
  definitions: FilterDefinition[];
  active: ActiveFilters;
  onChange: (next: ActiveFilters) => void;
  emptyLabel?: string;
  className?: string;
  singleMode?: boolean; // if true, only one filter active at a time
}

const FilterBar: React.FC<FilterBarProps> = ({ definitions, active, onChange, emptyLabel = 'Add filter...', className, singleMode }) => {
  const remaining = definitions.filter(d => !(d.id in active));

  const addFilter = (id: string) => {
    if (!id) return;
    const def = definitions.find(d => d.id === id);
    if (!def) return;
    const initialValue = def.type === 'dateRange' ? { from: '', to: '' } : def.type === 'numberRange' ? { min: '', max: '' } : '';
    const next = singleMode ? { [id]: initialValue } : { ...active, [id]: initialValue };
    onChange(next);
  };

  const updateValue = (id: string, value: any) => {
    const next = { ...active, [id]: value };
    onChange(next);
  };

  const remove = (id: string) => {
    const next = { ...active };
    delete next[id];
    onChange(next);
  };

  return (
    <div className={className || ''}>
      <div className="flex flex-wrap gap-3 items-start">
        {/* Add filter dropdown */}
        {remaining.length > 0 && (
          <select
            value=""
            onChange={e => addFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="">{emptyLabel}</option>
            {remaining.map(r => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        )}

        {/* Active filters */}
        {Object.entries(active).map(([id, val]) => {
          const def = definitions.find(d => d.id === id);
          if (!def) return null;
          if (def.type === 'select') {
            const opts = def.getOptions ? def.getOptions() : [];
            return (
              <div key={id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                <span className="text-xs font-medium text-gray-700">{def.label}:</span>
                <select
                  value={val}
                  onChange={e => updateValue(id, e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                >
                  <option value="">All</option>
                  {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                  aria-label="Remove filter"
                >✕</button>
              </div>
            );
          }
          if (def.type === 'dateRange') {
            const from = val?.from || ''; const to = val?.to || '';
            return (
              <div key={id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                <span className="text-xs font-medium text-gray-700">{def.label}:</span>
                <input
                  type="date"
                  value={from}
                  onChange={e => updateValue(id, { from: e.target.value, to })}
                  className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                />
                <span className="text-gray-400 text-xs">→</span>
                <input
                  type="date"
                  value={to}
                  onChange={e => updateValue(id, { from, to: e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                  aria-label="Remove filter"
                >✕</button>
              </div>
            );
          }
          if (def.type === 'numberRange') {
            const min = val?.min || ''; const max = val?.max || '';
            return (
              <div key={id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5">
                <span className="text-xs font-medium text-gray-700">{def.label}:</span>
                <input
                  type="number"
                  value={min}
                  onChange={e => updateValue(id, { min: e.target.value, max })}
                  placeholder="Min"
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                />
                <span className="text-gray-400 text-xs">-</span>
                <input
                  type="number"
                  value={max}
                  onChange={e => updateValue(id, { min, max: e.target.value })}
                  placeholder="Max"
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                  aria-label="Remove filter"
                >✕</button>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

export default FilterBar;
