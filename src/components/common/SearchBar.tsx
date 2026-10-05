import React, { forwardRef } from 'react';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  placeholder?: string;
  shortcut?: string;
  monospace?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(({
  value,
  onChange,
  onSubmit,
  onClear,
  placeholder,
  shortcut,
  monospace = false,
  autoFocus = false,
  disabled = false,
  className = '',
}, ref) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      onSubmit();
    } else if (e.key === 'Escape' && onClear && value) {
      e.preventDefault();
      onClear();
    }
  };

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      <span className="absolute left-3.5 text-slate-400 pointer-events-none flex items-center">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </span>
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={`w-full min-h-[44px] pl-10 pr-16 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-100 ${
          monospace ? 'font-mono font-bold tracking-wider' : 'font-normal'
        }`}
      />
      <div className="absolute right-2.5 flex items-center gap-1.5">
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
            tabIndex={-1}
            title="Clear [Esc]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        {shortcut && (
          <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded">
            {shortcut}
          </span>
        )}
      </div>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';
