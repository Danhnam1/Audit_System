import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BarData {
  [key: string]: string | number;
}

interface BarConfig {
  dataKey: string;
  // fill can be a single color string or a tuple for gradient [start, end]
  fill: string | [string, string];
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
      <div style={{ width: '100%', height, minWidth: 0, minHeight: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
          <defs>
            {bars.map((bar, i) => {
              if (Array.isArray(bar.fill)) {
                const id = `grad-bar-${i}`;
                const [from, to] = bar.fill;
                return (
                  <linearGradient id={id} key={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={from} stopOpacity={1} />
                    <stop offset="100%" stopColor={to} stopOpacity={1} />
                  </linearGradient>
                );
              }
              return null;
            })}
          </defs>
          <XAxis 
            dataKey={xAxisKey} 
            stroke="#cbd5e1" 
            style={{ fontSize: '13px', fontWeight: 500 }}
            angle={-45}
            textAnchor="end"
            height={100}
          />
          <YAxis stroke="#cbd5e1" style={{ fontSize: '13px' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '2px solid #3b82f6', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
            cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
          />
          <Legend verticalAlign="bottom" align="center" iconType="rect" wrapperStyle={{ paddingTop: '20px' }} />
          {bars.map((bar, index) => {
            const fill = Array.isArray(bar.fill) ? `url(#grad-bar-${index})` : String(bar.fill);
            return (
              <Bar
                key={index}
                dataKey={bar.dataKey}
                fill={fill}
                radius={bar.radius || [8, 8, 0, 0]}
                name={bar.name}
              />
            );
          })}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
