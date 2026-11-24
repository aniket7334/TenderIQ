import React from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
  };
  accentColor?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  className?: string;
}

const accentStyles = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
} as const;

const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  label,
  value,
  change,
  accentColor = 'blue',
  className,
}) => {
  return (
    <div
      className={clsx(
        'rounded-xl bg-white p-6 shadow-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div
          className={clsx(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            accentStyles[accentColor],
          )}
        >
          {icon}
        </div>
      </div>

      {change && (
        <div className="mt-4 flex items-center gap-1.5">
          {change.type === 'increase' ? (
            <TrendingUp className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-500" />
          )}
          <span
            className={clsx(
              'text-sm font-medium',
              change.type === 'increase' ? 'text-green-600' : 'text-red-600',
            )}
          >
            {change.value}%
          </span>
          <span className="text-sm text-gray-500">vs last month</span>
        </div>
      )}
    </div>
  );
};

export { StatsCard };
