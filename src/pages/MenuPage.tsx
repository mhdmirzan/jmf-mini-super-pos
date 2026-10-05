import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface MenuItem {
  title: string;
  subtitle: string;
  path: string;
  shortcut?: string;
  roles: string[];
  icon: React.ReactNode;
}

const menuItems: MenuItem[] = [
  {
    title: 'POS Checkout',
    subtitle: 'Barcode scanning, item search & fast customer billing',
    path: '/pos',
    shortcut: 'F1',
    roles: ['SUPER_ADMIN', 'ADMIN', 'CASHIER'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    title: 'Stock & Inventory',
    subtitle: 'Product catalog, pricing, cost margins & stock tracking',
    path: '/products',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    title: 'Categories',
    subtitle: 'Supermarket departments & sub-category organization',
    path: '/categories',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
  },
  {
    title: 'Invoices & Receipts',
    subtitle: 'Sales history, receipt reprints & transaction cancellation',
    path: '/invoices',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Sales Returns',
    subtitle: 'Customer returns, refunds & automated stock replenishment',
    path: '/returns',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 15v-1a4 4 0 00-4-4H4m0 0l4-4m-4 4l4 4m6 4v1a3 3 0 003 3h4" />
      </svg>
    ),
  },
  {
    title: 'Reports & Analytics',
    subtitle: 'Daily sales, monthly summaries & inventory valuation',
    path: '/reports',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: 'Settings & Terminal',
    subtitle: 'Store branding, receipt layout, hardware & user accounts',
    path: '/settings',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function MenuPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userRole = (user?.role || '').toUpperCase();

  const accessibleItems = menuItems.filter((item) =>
    item.roles.includes(userRole)
  );

  return (
    <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-8 select-none bg-[var(--pos-bg)] overflow-y-auto">
      {/* Top Banner */}
      <div className="max-w-5xl w-full mx-auto mb-6 text-center">
        <div className="flex flex-col items-center justify-center gap-2 border-b border-[var(--pos-border)] pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--pos-text)] tracking-tight">
              Main Menu
            </h1>
            <p className="text-xs text-[var(--pos-text-muted)] mt-1">
              Select a section to begin. You can return to this menu at any time using the Back button.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-xs px-2.5 py-1 rounded bg-[var(--pos-bg-subtle)] text-[var(--pos-text-muted)] font-mono border border-[var(--pos-border)]">
              Terminal: POS-01
            </span>
          </div>
        </div>
      </div>

      {/* Grid of the 7 Boxes - Centered Grid & Centered Card Content */}
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 justify-center">
        {accessibleItems.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className="pos-card p-6 text-center flex flex-col items-center justify-between min-h-[180px] cursor-pointer transition-all hover:border-[var(--pos-primary)] hover:shadow-md active:scale-[0.98] group bg-white border border-[var(--pos-border)] rounded-xl relative"
          >
            {item.shortcut && (
              <span className="absolute top-3 right-3 text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--pos-bg-subtle)] text-[var(--pos-text-muted)] border border-[var(--pos-border)]">
                {item.shortcut}
              </span>
            )}

            <div className="flex flex-col items-center w-full">
              <div className="w-14 h-14 rounded-xl bg-[var(--pos-bg-subtle)] group-hover:bg-slate-900 text-slate-800 group-hover:text-white flex items-center justify-center transition-colors mb-3 shadow-xs">
                {item.icon}
              </div>

              <h2 className="text-base font-bold text-[var(--pos-text)] group-hover:text-slate-900 transition-colors">
                {item.title}
              </h2>
            </div>

            <p className="text-xs text-[var(--pos-text-muted)] mt-2 leading-relaxed text-center">
              {item.subtitle}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
