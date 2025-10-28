import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BarData {
  [key: string]: string | number;
}

interface BarConfig {
  dataKey: string;
  fill: string;
  name: string;
  radius?: [number, number, number, number];
}

interface BarChartCardProps {
  title: string;
  data: BarData[];
  bars: BarConfig[];
  xAxisKey: string;
  height?: number;
  className?: string;
}

export const BarChartCard: React.FC<BarChartCardProps> = ({
  title,
  data,
  bars,
  xAxisKey,
  height = 300,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-xl border border-primary-100 shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-primary-600 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
          <XAxis dataKey={xAxisKey} stroke="#64748b" style={{ fontSize: '12px' }} />
          <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0f2fe', borderRadius: '8px' }}
          />
          <Legend />
          {bars.map((bar, index) => (
            <Bar
              key={index}
              dataKey={bar.dataKey}
              fill={bar.fill}
              radius={bar.radius || [8, 8, 0, 0]}
              name={bar.name}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
