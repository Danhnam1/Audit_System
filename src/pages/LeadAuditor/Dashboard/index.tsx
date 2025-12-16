import React from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { BarChartCard } from '../../../components/charts/BarChartCard';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

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
  { name: 'Jan', value: 12 },
  { name: 'Feb', value: 40 },
  { name: 'Mar', value: 35 },
  { name: 'Apr', value: 50 },
  { name: 'May', value: 25 },
  { name: 'Jun', value: 18 },
  { name: 'Jul', value: 20 },
  { name: 'Aug', value: 34 },
  { name: 'Sep', value: 14 },
];

const MonthlyRevenueCard: React.FC = () => {
  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">
      <h3 className="text-center text-lg font-medium text-gray-700 mb-4">Finding weekly</h3>

      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }} barGap={6} barCategoryGap="10%">
            <defs>
              <linearGradient id="grad-monthly" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                <stop offset="100%" stopColor="#7ee787" stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }} tickLine={true} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} interval={0} tickMargin={8} />
            <YAxis axisLine={false} tickLine={false} stroke="#94a3b8" ticks={[0, 15, 30, 45, 60]} />
            <Tooltip wrapperStyle={{ backgroundColor: '#fff', borderRadius: 8, border: '1px solid #e2e8f0' }} />
            <Bar dataKey="value" fill="url(#grad-monthly)" radius={[8, 8, 0, 0]} barSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>

     
    </div>
  );
};

const ProfitCard: React.FC = () => {
  const profitData = [
    { name: 'A', value: 6 },
    { name: 'B', value: 8 },
    { name: 'C', value: 12 },
    { name: 'D', value: 10 },
    { name: 'E', value: 9 },
    { name: 'F', value: 11 },
    { name: 'G', value: 7 },
    { name: 'H', value: 5 },
    { name: 'I', value: 3 },
  ];

  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-6 w-full">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl font-semibold text-gray-800">Actions</div>
          <div className="text-xs text-gray-400">Total Profit</div>
        </div>
        <div className="text-gray-300">⋮</div>
      </div>

      <div style={{ width: '100%', height: 209 }} className="mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={profitData} margin={{ top: 6, right: 0, left: 0, bottom: 0 }} barGap={6} barCategoryGap="8%">
            <defs>
              <linearGradient id="grad-profit" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff2d95" stopOpacity={1} />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity={1} />
              </linearGradient>
            </defs>
            <XAxis dataKey="name" axisLine={{ stroke: '#e5e7eb', strokeWidth: 1 }} tickLine={true} tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }} interval={0} tickMargin={6} />
            <YAxis axisLine={false} tickLine={false} stroke="#94a3b8" domain={[0, 60]} ticks={[0, 15, 30, 45, 60]} />
            <Bar dataKey="value" fill="url(#grad-profit)" radius={[8, 8, 0, 0]} barSize={22} />
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

const OrderStatusCard: React.FC<{ data: { name: string; value: number; color: string }[] }> = ({ data }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const percentage = Math.round((data.reduce((s, d) => s + d.value, 0) / 100) * 100);

  const gradientData = [
    { name: 'Draft', value: 45, startColor: '#ffb84d', endColor: '#ff7a00' },
    { name: 'Pending', value: 35, startColor: '#60e0ff', endColor: '#0284c7' },
    { name: 'Inprogress', value: 20, startColor: '#7ee787', endColor: '#10b981' },
  ];

  return (
    <div className="bg-white rounded-xl border border-primary-100 shadow-md p-4 w-full h-full flex flex-col">
      <h3 className="text-base font-semibold text-gray-800 mb-4">Audits</h3>
      
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
          <div className="text-2xl font-bold text-gray-800">{percentage}%</div>
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
            <span className="text-xs font-medium text-gray-800">{item.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const LeadAuditorDashboard: React.FC = () => {
  const { user } = useAuth();
  const layoutUser = user ? { name: (user as any).fullName || user.name, avatar: undefined } : undefined;

  return (
    <MainLayout title="Dashboard" user={layoutUser}>
      <div className="space-y-6">
        <div className="flex gap-6" style={{ height: 420 }}>
          <div className="w-80 h-full">
            <OrderStatusCard data={orderStatusData} />
          </div>
          <div className="flex-1 h-full">
            <BarChartCard
              title="Findings"
              data={barData}
              xAxisKey="department"
              bars={[
                { dataKey: 'Findings', fill: ['#ffb84d', '#ff7a00'], name: 'Findings' },
                { dataKey: 'Finding Open', fill: ['#60e0ff', '#0284c7'], name: 'Finding Open' },
                { dataKey: 'Finding Closed', fill: ['#7ee787', '#10b981'], name: 'Finding Closed' },
              ]}
              height={280}
              className="h-full"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6" style={{ height: 500 }}>
          <div className="h-full">
            <MonthlyRevenueCard />
          </div>
          <div className="h-full">
            <ProfitCard />
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default LeadAuditorDashboard;
