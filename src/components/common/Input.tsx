import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  monospace?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onClear?: () => void;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  monospace = false,
  leftIcon,
  rightIcon,
  onClear,
  value,
  className = '',
  disabled,
  id,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-slate-700 tracking-wide"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-slate-400 pointer-events-none flex items-center">
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          value={value}
          disabled={disabled}
          className={`w-full min-h-[42px] px-3 py-2 text-sm text-slate-900 bg-white border rounded-lg transition-colors focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-500 disabled:border-slate-200 ${
            monospace ? 'font-mono' : ''
          } ${leftIcon ? 'pl-9' : ''} ${rightIcon || (onClear && value) ? 'pr-12' : ''} ${
            error ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-300'
          } ${className}`}
          {...props}
        />
        {onClear && value && !disabled ? (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-full cursor-pointer"
            tabIndex={-1}
            title="Clear"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : rightIcon ? (
          <span className="absolute right-3 text-slate-500 flex items-center z-10">
            {rightIcon}
          </span>
        ) : null}
      </div>
      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      {helperText && !error && <p className="text-xs text-slate-500">{helperText}</p>}
    </div>
  );
});

Input.displayName = 'Input';
