
import React from 'react';
import { NutriScore } from '../types';

interface Props {
  score: NutriScore;
  size?: 'sm' | 'md' | 'lg';
}

const NutriScoreBadge: React.FC<Props> = ({ score, size = 'md' }) => {
  const config = {
    [NutriScore.A]: { color: 'bg-emerald-600', text: 'text-white' },
    [NutriScore.B]: { color: 'bg-green-500', text: 'text-white' },
    [NutriScore.C]: { color: 'bg-yellow-400', text: 'text-black' },
    [NutriScore.D]: { color: 'bg-orange-500', text: 'text-white' },
    [NutriScore.E]: { color: 'bg-red-600', text: 'text-white' },
  };

  const sizes = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-lg',
    lg: 'w-16 h-16 text-3xl',
  };

  return (
    <div className={`${config[score].color} ${config[score].text} ${sizes[size]} rounded-lg flex items-center justify-center font-bold shadow-sm transition-transform hover:scale-105`}>
      {score}
    </div>
  );
};

export default NutriScoreBadge;
