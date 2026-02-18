
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface Props {
  proteins: number;
  carbs: number;
  fats: number;
}

const NutritionChart: React.FC<Props> = ({ proteins, carbs, fats }) => {
  // Fix: Avoid rendering if all values are zero to prevent Recharts layout errors
  const total = proteins + carbs + fats;
  const data = total === 0 ? [
    { name: 'Aucune donnée', value: 1, color: '#f1f5f9' }
  ] : [
    { name: 'Protéines', value: proteins || 0, color: '#10b981' },
    { name: 'Glucides', value: carbs || 0, color: '#3b82f6' },
    { name: 'Lipides', value: fats || 0, color: '#f59e0b' },
  ];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={85}
            paddingAngle={5}
            dataKey="value"
            animationDuration={1000}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => total === 0 ? '-' : `${value.toFixed(1)}g`}
            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
          />
          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default NutritionChart;
