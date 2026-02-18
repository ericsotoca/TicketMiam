
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ScanResult, NutriScore } from '../types.ts';

interface Props {
  history: ScanResult[];
}

const scoreToPoints = (s: NutriScore) => {
  const map = { [NutriScore.A]: 4, [NutriScore.B]: 3, [NutriScore.C]: 2, [NutriScore.D]: 1, [NutriScore.E]: 0 };
  return map[s];
};

const TrendsChart: React.FC<Props> = ({ history }) => {
  const data = [...history].reverse().map(h => ({
    date: h.date.split(' ').slice(0, 2).join(' '), // Just day and month
    score: scoreToPoints(h.totalScore),
  }));

  return (
    <div className="h-48 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: '#94a3b8' }} 
          />
          <YAxis 
            hide={true}
            domain={[0, 4]} 
          />
          <Tooltip 
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
            formatter={(val: number) => {
              const reverse = ['E', 'D', 'C', 'B', 'A'];
              return [reverse[val], 'Score'];
            }}
          />
          <Line 
            type="monotone" 
            dataKey="score" 
            stroke="#10b981" 
            strokeWidth={3} 
            dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} 
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TrendsChart;
