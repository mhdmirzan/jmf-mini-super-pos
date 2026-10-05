import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  shortcut?: string;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({
  children,
  variant = 'secondary',
  size = 'md',
  shortcut,
  loading = false,
  fullWidth = false,
  icon,
  className = '',
  disabled,
  ...props
}, ref) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors border select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'text-xs px-2.5 py-1.5 min-h-[34px] gap-1.5',
    md: 'text-sm px-3.5 py-2 min-h-[42px] gap-2',
    lg: 'text-base px-5 py-3 min-h-[50px] gap-2.5 font-bold',
  }[size];

  const variantClasses = {
    primary: 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900',
    accent: 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600',
    secondary: 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 font-bold',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700 border-transparent',
  }[variant];

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      ref={ref}
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${widthClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
      {shortcut && (
        <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/15 text-current opacity-85">
          {shortcut}
        </span>
      )}
    </button>
  );
});
