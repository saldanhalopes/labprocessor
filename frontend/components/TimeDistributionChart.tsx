import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { AnalysisRow } from '../types';

interface TimeDistributionChartProps {
  data: AnalysisRow[];
}

export const TimeDistributionChart: React.FC<TimeDistributionChartProps> = ({ data }) => {
  // Prepare data for chart: truncate names if too long
  const chartData = data.map(item => ({
    name: item.testName.length > 15 ? item.testName.substring(0, 15) + '...' : item.testName,
    fullName: item.testName,
    time: item.estimatedTime,
    technique: item.technique
  }));

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 shadow-lg rounded-lg">
          <p className="font-semibold text-slate-800">{payload[0].payload.fullName}</p>
          <p className="text-sm text-slate-600">
            Técnica: <span className="font-medium">{payload[0].payload.technique}</span>
          </p>
          <p className="text-sm text-teal-600 font-bold">
            Tempo: {payload[0].value.toFixed(1)} h
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[300px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="name" 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            axisLine={{ stroke: '#cbd5e1' }}
            tickLine={false}
          />
          <YAxis 
            tick={{ fill: '#64748b', fontSize: 12 }} 
            axisLine={false}
            tickLine={false}
            label={{ value: 'Horas (h)', angle: -90, position: 'insideLeft', fill: '#94a3b8', fontSize: 12 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="time" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.time > 5 ? '#f59e0b' : '#0d9488'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
