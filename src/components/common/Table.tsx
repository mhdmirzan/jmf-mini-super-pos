import React from 'react';

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <div className="w-full overflow-auto">
    <table className={`w-full text-left border-collapse text-sm ${className}`} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <thead className={`bg-slate-100/90 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10 ${className}`} {...props}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <tbody className={`divide-y divide-slate-200/80 bg-white font-normal ${className}`} {...props}>
    {children}
  </tbody>
);

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  clickable?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  selected = false,
  clickable = false,
  className = '',
  children,
  ...props
}) => (
  <tr
    className={`h-[48px] transition-colors whitespace-nowrap ${
      selected
        ? 'bg-blue-50/90 text-blue-900 font-semibold'
        : clickable
        ? 'hover:bg-slate-50 cursor-pointer'
        : 'hover:bg-slate-50/60'
    } ${className}`}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  className = '',
  children,
  align = 'left',
  ...props
}) => {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
    char: 'text-left',
  }[align] || 'text-left';

  return (
    <th
      className={`px-3 py-2.5 font-semibold text-slate-700 select-none align-middle whitespace-nowrap ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
};

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  monospace?: boolean;
}

export const TableCell: React.FC<TableCellProps> = ({
  className = '',
  children,
  align = 'left',
  monospace = false,
  ...props
}) => {
  const alignClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify',
    char: 'text-left',
  }[align] || 'text-left';

  return (
    <td
      className={`px-3 py-2.5 text-slate-800 align-middle ${monospace ? 'font-mono' : ''} ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
};

