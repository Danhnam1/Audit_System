import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface ChartsSectionProps {
  findingsActionsSummary: any;
  fasTab: "overview" | "severity" | "actions";
  onTabChange: (tab: "overview" | "severity" | "actions") => void;
  findingsOverviewCards: Array<{
    label: string;
    value: number;
    color: string;
    bg: string;
    border: string;
  }>;
  severityCards: Array<{
    title: string;
    count: number;
    completed: number;
    overdue: number;
  }>;
  findingsSeverityChartData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  actionsStatusChartData: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  actionsSeverityBreakdownData: Array<{
    severity: string;
    completed: number;
    overdue: number;
  }>;
}

export const ChartsSection = ({
  findingsActionsSummary,
  fasTab,
  onTabChange,
  findingsOverviewCards,
  severityCards,
  findingsSeverityChartData,
  actionsStatusChartData,
  actionsSeverityBreakdownData,
}: ChartsSectionProps) => {
  if (!findingsActionsSummary) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs bg-gray-100 rounded-full p-1">
        {["overview", "severity", "actions"].map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab as any)}
            className={`px-3 py-1 rounded-full font-semibold transition-all ${
              fasTab === tab
                ? "bg-primary-600 text-white shadow-sm"
                : "text-gray-700 hover:bg-gray-200"
            }`}
          >
            {tab === "overview" ? "Overview" : tab === "severity" ? "Severity" : "Actions"}
          </button>
        ))}
      </div>

      {fasTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {findingsOverviewCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border ${card.border} bg-gradient-to-br ${card.bg} p-4 shadow-sm`}
            >
              <p className="text-[11px] font-semibold uppercase text-gray-600">{card.label}</p>
              <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {fasTab === "severity" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-700 uppercase">Findings by Severity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {severityCards.map((c) => (
                <div
                  key={c.title}
                  className="rounded-lg border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-3 shadow-sm"
                >
                  <p className="text-[11px] font-semibold text-gray-700 uppercase">{c.title}</p>
                  <p className="mt-1 text-xl font-bold text-gray-900">{c.count}</p>
                  <div className="mt-2 text-[11px] text-gray-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-700">Completed</span>
                      <span>{c.completed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-red-700">Overdue</span>
                      <span>{c.overdue}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase">Charts</h3>
            <div className="grid grid-cols-1 gap-4">
              {findingsSeverityChartData.length > 0 && (
                <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
                  <h4 className="text-[11px] font-semibold text-gray-700 mb-2 uppercase">Severity Pie</h4>
                  <div style={{ width: '100%', height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={findingsSeverityChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {findingsSeverityChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fasTab === "actions" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
              <h4 className="text-[11px] font-semibold text-gray-700 mb-2 uppercase">Actions Status</h4>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={actionsStatusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {actionsStatusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-3 shadow-sm">
              <h4 className="text-[11px] font-semibold text-gray-700 mb-2 uppercase">Actions Breakdown by Severity</h4>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={actionsSeverityBreakdownData}>
                    <XAxis dataKey="severity" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completed" fill="#10b981" name="Completed" />
                    <Bar dataKey="overdue" fill="#ef4444" name="Overdue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
