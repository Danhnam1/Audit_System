import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LineData {
  [key: string]: string | number;
}

interface LineConfig {
  dataKey: string;
  stroke: string;
  name: string;
  strokeWidth?: number;
}

interface LineChartCardProps {
  title: string;
  data: LineData[];
  lines: LineConfig[];
  xAxisKey: string;
  height?: number;
  className?: string;
}

export const LineChartCard: React.FC<LineChartCardProps> = ({
  title,
  data,
  lines,
  xAxisKey,
  height = 300,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-xl border border-primary-100 shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-primary-600 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
          <XAxis dataKey={xAxisKey} stroke="#64748b" style={{ fontSize: '12px' }} />
          <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0f2fe', borderRadius: '8px' }}
          />
          <Legend />
          {lines.map((line, index) => (
            <Line
              key={index}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              strokeWidth={line.strokeWidth || 2}
              name={line.name}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
