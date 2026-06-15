'use client';

import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple';
  icon?: string;
}

const colorClasses = {
  blue: 'text-blue-600',
  green: 'text-green-600',
  orange: 'text-orange-600',
  red: 'text-red-600',
  purple: 'text-purple-600',
};

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit = '',
  color = 'blue',
  icon,
}) => {
  const textColorClass = colorClasses[color];

  return (
    <div className="liquid-card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <div className="flex items-baseline mt-2">
            <p className={`text-3xl font-bold ${textColorClass}`}>{value}</p>
            {unit && <p className="text-gray-500 ml-2 text-sm">{unit}</p>}
          </div>
        </div>
        {icon && <div className="text-3xl">{icon}</div>}
      </div>
    </div>
  );
};
