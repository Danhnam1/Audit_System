import React from 'react';

interface Props {
  summary: any;
  severityEntries: [string, any][];
  severityTotal: number;
}

const SummaryTab: React.FC<Props> = ({ summary, severityEntries, severityTotal }) => {
  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-primary-600">Summary Findings</h2>
        <span className="text-xs text-gray-500">Overview for the selected audit.</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-lg border border-gray-100 p-3">
          <div className="text-xs text-gray-500">Total</div>
          <div className="text-xl font-semibold text-primary-700">{summary?.totalFindings ?? 0}</div>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-gray-100 p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">Severity Breakdown</div>
        <div className="space-y-2">
          {severityEntries.map(([name, val]) => {
            const count = Number(val as any) || 0;
            const pct = severityTotal ? Math.round((count * 100) / severityTotal) : 0;
            const lc = String(name).toLowerCase();
            const color = lc.includes('critical') || lc.includes('high') ? '#ef4444' : lc.includes('major') || lc.includes('medium') ? '#f59e0b' : '#3b82f6';
            return (
              <div key={name} className="flex items-center gap-3">
                <span className="w-24 text-sm text-gray-700">{name}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
                <span className="w-20 text-right text-sm text-gray-700">{count} ({pct}%)</span>
              </div>
            );
          })}
          {severityEntries.length === 0 && (
            <div className="text-sm text-gray-500">No data</div>
          )}
        </div>
      </div>
    </>
  );
};

export default SummaryTab;

