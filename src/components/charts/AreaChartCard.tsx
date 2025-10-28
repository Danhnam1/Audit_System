import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AreaData {
  [key: string]: string | number;
}

interface AreaConfig {
  dataKey: string;
  stroke: string;
  fill: string;
  name: string;
  stackId?: string;
}

interface AreaChartCardProps {
  title: string;
  data: AreaData[];
  areas: AreaConfig[];
  xAxisKey: string;
  height?: number;
  className?: string;
}

export const AreaChartCard: React.FC<AreaChartCardProps> = ({
  title,
  data,
  areas,
  xAxisKey,
  height = 300,
  className = '',
}) => {
  return (
    <div className={`bg-white rounded-xl border border-primary-100 shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-primary-600 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
          <XAxis dataKey={xAxisKey} stroke="#64748b" style={{ fontSize: '12px' }} />
          <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0f2fe', borderRadius: '8px' }}
          />
          <Legend />
          {areas.map((area, index) => (
            <Area
              key={index}
              type="monotone"
              dataKey={area.dataKey}
              stackId={area.stackId}
              stroke={area.stroke}
              fill={area.fill}
              name={area.name}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
