import React, { useState, useEffect } from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { BarChartCard } from '../../../components/charts/BarChartCard';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import axios from 'axios';
import { createPortal } from 'react-dom';

// Department bar data
const barData = [
  { department: 'HR', Findings: 18, 'Finding Open': 15, 'Finding Closed': 8 },
  { department: 'IT', Findings: 3, 'Finding Open': 8, 'Finding Closed': 4 },
  { department: 'Finance', Findings: 60, 'Finding Open': 45, 'Finding Closed': 55 },
  { department: 'Marketing', Findings: 8, 'Finding Open': 12, 'Finding Closed': 10 },
  { department: 'Sales', Findings: 28, 'Finding Open': 24, 'Finding Closed': 22 },
  { department: 'Operations', Findings: 20, 'Finding Open': 14, 'Finding Closed': 18 },
  { department: 'Legal', Findings: 24, 'Finding Open': 38, 'Finding Closed': 34 },
  { department: 'Compliance', Findings: 12, 'Finding Open': 8, 'Finding Closed': 6 },
  { department: 'Quality', Findings: 30, 'Finding Open': 24, 'Finding Closed': 28 },
];

const orderStatusData = [
  { name: 'Sales', value: 68, color: '#0284c7' },
  { name: 'Product', value: 25, color: '#ff6b6b' },
  { name: 'Income', value: 14, color: '#10b981' },
];

const monthlyPie = [
  { name: 'Monthly', value: 65127, color: '#1e90ff' },
];

const yearlyPie = [
  { name: 'Yearly', value: 984246, color: '#fbbf24' },
];

const monthlyData = [
  { name: 'Monday', value: 18 },
  { name: 'Tuesday', value: 24 },
  { name: 'Wednesday', value: 32 },
  { name: 'Thursday', value: 28 },
  { name: 'Friday', value: 22 },
  { name: 'Saturday', value: 19 },
  { name: 'Sunday', value: 15 },
];

const radarData = [
  { subject: 'Completeness', A: 85 },
  { subject: 'Timeliness', A: 72 },
  { subject: 'Accuracy', A: 88 },
  { subject: 'Coverage', A: 70 },
  { subject: 'Responsiveness', A: 78 },
];

const RadarSummary: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">
      <h3 className="text-lg font-semibold text-primary-600 mb-4">Performance Radar</h3>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
            <defs>
              <linearGradient id="grad-radar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.9} />
                <stop offset="100%" stopColor="#ff2d95" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <PolarGrid />
            <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} />
            <Radar name="Score" dataKey="A" stroke="#7c3aed" fill="url(#grad-radar)" fillOpacity={0.6} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const MonthlyRevenueCard: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">
      <h3 className="text-center text-lg font-medium text-gray-700 mb-4">Finding weekly</h3>

      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="4%">
            <defs>
              <linearGradient id="grad-monthly" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                <stop offset="100%" stopColor="#7ee787" stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }} tickLine={true} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} interval={0} tickMargin={8} />
            <YAxis axisLine={false} tickLine={false} stroke="#94a3b8" ticks={[0, 5, 10, 15, 30]} />
            <Tooltip wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Bar dataKey="value" fill="url(#grad-monthly)" radius={[8, 8, 0, 0]} barSize={44} />
          </BarChart>
        </ResponsiveContainer>
      </div>

     
    </div>
  );
};

const ProfitCard: React.FC = () => {
  const profitData = [
    { name: 'Monday', value: 6 },
    { name: 'Tuesday', value: 8 },
    { name: 'Wednesday', value: 12 },
    { name: 'Thursday', value: 10 },
    { name: 'Friday', value: 9 },
    { name: 'Saturday', value: 11 },
    { name: 'Sunday', value: 7 },
  ];

  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl font-semibold text-gray-800">Actions</div>
        </div>
        <div className="text-gray-300">⋮</div>
      </div>

      <div style={{ width: '100%', height: 221 }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={profitData} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barGap={2} barCategoryGap="2%">
            <defs>
              <linearGradient id="grad-profit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff2d95" stopOpacity={1} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }} tickLine={true} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} interval={0} tickMargin={6} />
            <YAxis axisLine={false} tickLine={false} stroke="#94a3b8" domain={[0, 30]} ticks={[0, 5, 10, 15, 30]} />
            <Bar dataKey="value" fill="url(#grad-profit)" radius={[8, 8, 0, 0]} barSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      
    </div>
  );
};

const DonutSummary: React.FC<{
  data: { name: string; value: number; color: string }[];
  title: string;
  subtitle?: string;
}> = ({ data, title, subtitle }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const display = data[0];
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">
      <div className="flex items-center gap-6">
        <div style={{ width: 120, height: 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                innerRadius={36}
                outerRadius={48}
                paddingAngle={2}
              >
                {data.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">{title}</div>
              <div className="text-3xl font-semibold">{display.value.toLocaleString()}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-green-600 font-medium">16.5% <span className="text-gray-400 text-sm">55.21 USD</span></div>
            </div>
          </div>
          {subtitle && <div className="mt-3 text-sm text-gray-500">{subtitle}</div>}
        </div>
      </div>
    </div>
  );
};

const OrderStatusCard: React.FC<{ data: { name: string; value: number; color: string }[]; onDetails?: () => void }> = ({ data, onDetails }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const gradientData = data.map((item, idx) => ({
    name: item.name,
    value: item.value,
    startColor: item.color,
    endColor: item.color,
  }));

  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4 w-full h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-gray-800">Audits</h3>
        <button
          onClick={() => onDetails && onDetails()}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-primary-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A2 2 0 0122 9.618V18a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h8.382a2 2 0 011.118.346L15 6" />
          </svg>
          Details
        </button>
      </div>
      
      <div className="flex flex-col items-center mb-4">
        <div style={{ width: 150, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {gradientData.map((item, idx) => (
                  <linearGradient id={`grad-donut-${idx}`} key={`grad-donut-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={item.startColor} stopOpacity={1} />
                    <stop offset="100%" stopColor={item.endColor} stopOpacity={1} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={gradientData}
                dataKey="value"
                startAngle={90}
                endAngle={-270}
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {gradientData.map((entry, idx) => (
                  <Cell key={idx} fill={`url(#grad-donut-${idx})`} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="text-center mt-3">
          <div className="text-2xl font-bold text-gray-800">{total}</div>
          <div className="text-xs text-gray-500 mt-1">Total</div>
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        {gradientData.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.startColor }}></div>
              <span className="text-xs text-gray-700">{item.name}</span>
            </div>
            <span className="text-xs font-medium text-gray-800">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LeadAuditorDashboard: React.FC = () => {
  const { user } = useAuth();
  const [auditCounts, setAuditCounts] = useState({ draftCount: 45, pendingCount: 35, inProgressCount: 20 });
  const layoutUser = user ? { name: (user as any).fullName || user.name, avatar: undefined } : undefined;

  useEffect(() => {
    const fetchAuditDashboard = async () => {
      try {
        const response = await axios.get('https://moca.mom/api/AuditDashboard/audits');
        setAuditCounts({
          draftCount: response.data.draftCount || 0,
          pendingCount: response.data.pendingCount || 0,
          inProgressCount: response.data.inProgressCount || 0,
        });
      } catch (error) {
        console.error('Failed to fetch audit dashboard:', error);
      }
    };

    fetchAuditDashboard();
  }, []);

  // keep full items for the details modal
  const [auditItems, setAuditItems] = useState({ drafts: [] as any[], pendings: [] as any[], inProgress: [] as any[] });
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'Draft' | 'Pending' | 'Inprogress'>('Draft');

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await axios.get('https://moca.mom/api/AuditDashboard/audits');
        const data = res.data || {};
        setAuditItems({
          drafts: (data.drafts && data.drafts.$values) || [],
          pendings: (data.pendings && data.pendings.$values) || [],
          inProgress: (data.inProgress && data.inProgress.$values) || [],
        });
      } catch (err) {
        console.error(err);
      }
    };

    fetchItems();
  }, []);

  const auditStatusData = [
    { name: 'Draft', value: auditCounts.draftCount, color: '#ffb84d' },
    { name: 'Pending', value: auditCounts.pendingCount, color: '#60e0ff' },
    { name: 'Inprogress', value: auditCounts.inProgressCount, color: '#7ee787' },
  ];

  const openDetails = () => {
    setActiveTab('Draft');
    setShowDetailModal(true);
  };

  return (
    <MainLayout title="Dashboard" user={layoutUser}>
      <div className="space-y-3">
        <div className="flex gap-6" style={{ height: 420 }}>
          <div className="w-80 h-full">
            <OrderStatusCard data={auditStatusData} onDetails={openDetails} />
          </div>
          <div className="flex-1 h-full">
            <BarChartCard
              title="Findings"
              data={barData}
              xAxisKey="department"
              bars={[
                { dataKey: 'Finding Closed', fill: ['#7ee787', '#10b981'], name: 'Finding Closed' },
                { dataKey: 'Finding Open', fill: ['#60e0ff', '#0284c7'], name: 'Finding Open' },
                { dataKey: 'Findings', fill: ['#ffb84d', '#ff7a00'], name: 'Findings' },
              ]}
              height={280}
              className="h-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 items-start" style={{ height: 360 }}>
          <div className="h-full">
            <MonthlyRevenueCard />
          </div>
          <div className="h-full">
            <ProfitCard />
          </div>
        </div>
        <div className="-mt-4">
          <RadarSummary />
        </div>
        {showDetailModal && createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-40" onClick={() => setShowDetailModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col border border-gray-100">
              <div className="px-6 py-4 border-b bg-gradient-to-r from-primary-600 to-primary-500 text-white flex items-center justify-between">
                <h2 className="text-lg font-semibold">Audit Details</h2>
                <button onClick={() => setShowDetailModal(false)} className="text-white hover:text-gray-200 bg-white/10 px-2 py-1 rounded-full">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-5">
                <div className="flex gap-3 mb-4">
                  {(['Draft','Pending','Inprogress'] as const).map((t) => (
                    <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-2 rounded-full border ${activeTab===t? 'bg-primary-600 border-primary-600 text-white shadow-sm' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <div className="overflow-auto" style={{ maxHeight: 420 }}>
                  <table className="w-full text-sm table-auto">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b">
                        <th className="py-3 px-4">Title</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4">Scope</th>
                        <th className="py-3 px-4">Start</th>
                        <th className="py-3 px-4">End</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {(activeTab==='Draft' ? auditItems.drafts : activeTab==='Pending' ? auditItems.pendings : auditItems.inProgress).map((a:any, i:number) => (
                        <tr key={i} className={`border-b hover:bg-gray-50 ${i % 2 === 0 ? '' : ''}`}>
                          <td className="py-3 px-4 align-top">{a.title || '—'}</td>
                          <td className="py-3 px-4 align-top">{a.type || '—'}</td>
                          <td className="py-3 px-4 align-top">{a.scope || '—'}</td>
                          <td className="py-3 px-4 align-top">{a.startDate ? new Date(a.startDate).toLocaleString() : '—'}</td>
                          <td className="py-3 px-4 align-top">{a.endDate ? new Date(a.endDate).toLocaleString() : '—'}</td>
                          <td className="py-3 px-4 align-top"><span className="px-2 py-0.5 rounded-full text-xs bg-gray-100">{a.status}</span></td>
                        </tr>
                      ))}
                      {((activeTab==='Draft' ? auditItems.drafts : activeTab==='Pending' ? auditItems.pendings : auditItems.inProgress).length === 0) && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-gray-500">No items</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>, document.body
        )}
      </div>
    </MainLayout>
  );
};

export default LeadAuditorDashboard;
