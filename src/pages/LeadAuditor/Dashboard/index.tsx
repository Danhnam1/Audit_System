import React from 'react';
import { MainLayout } from '../../../layouts';
import { useAuth } from '../../../contexts';
import { BarChartCard } from '../../../components/charts/BarChartCard';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useState } from 'react';

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
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
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
                activeIndex={activeIndex}
                activeOuterRadius={110}
                onMouseEnter={(_, index) => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
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
      </div>
    </MainLayout>
  );
};

export default LeadAuditorDashboard;
