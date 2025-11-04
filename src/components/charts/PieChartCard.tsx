import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

interface PieData {
  name: string;
  value: number;
  color: string;
  [key: string]: string | number;
}

interface PieChartCardProps {
  title: string;
  data: PieData[];
  height?: number;
  className?: string;
}

export const PieChartCard: React.FC<PieChartCardProps> = ({
  title,
  data,
  height = 300,
  className = '',
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={`bg-white rounded-xl border border-primary-100 shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-primary-600 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry: PieLabelRenderProps) => {
              const name = (entry && entry.name) ? String(entry.name) : '';
              const value = typeof entry?.value === 'number' ? entry.value : 0;
              return `${name}: ${((value / total) * 100).toFixed(0)}%`;
            }}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
