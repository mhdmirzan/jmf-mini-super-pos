import React from 'react';

export interface PriceDisplayProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  currency?: string;
  negative?: boolean;
  className?: string;
}

export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  amount,
  size = 'md',
  currency = 'Rs.',
  negative = false,
  className = '',
}) => {
  const formatted = Math.abs(amount).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm font-semibold',
    lg: 'text-lg font-bold',
    xl: 'text-2xl font-bold',
    hero: 'text-4xl lg:text-5xl font-extrabold tracking-tight',
  }[size];

  return (
    <span className={`inline-flex items-baseline font-mono tabular-nums ${sizeClasses} ${className}`}>
      {negative && <span className="mr-0.5">-</span>}
      <span className="text-[0.8em] font-normal mr-1 opacity-80">{currency}</span>
      <span>{formatted}</span>
    </span>
  );
};
