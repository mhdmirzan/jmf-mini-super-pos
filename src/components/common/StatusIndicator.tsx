import React from 'react';

export interface StatusIndicatorProps {
  isOnline: boolean;
  pendingCount?: number;
  onSync?: () => void;
  isSyncing?: boolean;
  className?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  isOnline,
  pendingCount = 0,
  onSync,
  isSyncing = false,
  className = '',
}) => {
  return (
    <div className={`inline-flex items-center gap-2 text-xs font-medium ${className}`}>
      <span className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            isOnline ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
        <span className={isOnline ? 'text-slate-300' : 'text-rose-400 font-semibold'}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </span>

      {pendingCount > 0 && (
        <button
          type="button"
          onClick={onSync}
          disabled={isSyncing}
          className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/30 transition-colors cursor-pointer"
          title="Click to synchronize pending transactions"
        >
          {isSyncing ? 'Syncing...' : `${pendingCount} pending`}
        </button>
      )}
    </div>
  );
};
