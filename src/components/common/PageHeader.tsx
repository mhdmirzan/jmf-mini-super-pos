import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: number | string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  count,
  badge,
  actions,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 shrink-0 ${className}`}>
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {title}
          </h1>
          {count !== undefined && (
            <span className="text-xs font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded">
              {count}
            </span>
          )}
          {badge}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
};
