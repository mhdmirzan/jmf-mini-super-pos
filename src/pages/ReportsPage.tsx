import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { reportService } from '../services/api';
import {
  Button,
  Input,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
  PriceDisplay,
  EmptyState,
} from '../components/common';

type ReportTab = 'daily' | 'monthly' | 'products' | 'lowStock' | 'stockValue';

export default function ReportsPage() {
  const { user } = useAuth();
  const isSuperAdmin = (user?.role || '').toUpperCase() === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<ReportTab>('daily');
  const [loading, setLoading] = useState(false);

  // Daily Sales
  const [dailyDate, setDailyDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [dailyData, setDailyData] = useState<any>(null);

  // Monthly Sales
  const [monthlyYear, setMonthlyYear] = useState(new Date().getFullYear());
  const [monthlyMonth, setMonthlyMonth] = useState(new Date().getMonth() + 1);
  const [monthlyData, setMonthlyData] = useState<any>(null);

  // Product Sales
  const [prodDateFrom, setProdDateFrom] = useState('');
  const [prodDateTo, setProdDateTo] = useState('');
  const [productSalesData, setProductSalesData] = useState<any[]>([]);

  // Low Stock
  const [lowStockData, setLowStockData] = useState<any[]>([]);

  // Stock Valuation
  const [stockValData, setStockValData] = useState<any>(null);

  const loadDailySales = async () => {
    setLoading(true);
    try {
      const res = await reportService.dailySales(dailyDate);
      if (res.success) setDailyData(res);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthlySales = async () => {
    setLoading(true);
    try {
      const res = await reportService.monthlySales(monthlyYear, monthlyMonth);
      if (res.success) setMonthlyData(res);
    } finally {
      setLoading(false);
    }
  };

  const loadProductSales = async () => {
    setLoading(true);
    try {
      const res = await reportService.productSales({
        dateFrom: prodDateFrom || undefined,
        dateTo: prodDateTo || undefined,
      });
      if (res.success && res.products) setProductSalesData(res.products);
    } finally {
      setLoading(false);
    }
  };

  const loadLowStock = async () => {
    setLoading(true);
    try {
      const res = await reportService.lowStock();
      if (res.success && res.products) setLowStockData(res.products);
    } finally {
      setLoading(false);
    }
  };

  const loadStockValue = async () => {
    setLoading(true);
    try {
      const res = await reportService.stockValue();
      if (res.success) setStockValData(res);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!isSuperAdmin) {
      alert('Report download is restricted to Super Admin only.');
      return;
    }

    let csvContent = '';
    let fileName = '';

    const escapeCSV = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    if (activeTab === 'daily') {
      fileName = `daily_sales_report_${dailyDate}.csv`;
      const rows: string[][] = [
        ['DAILY SALES REPORT'],
        ['Date', dailyDate],
        ['Generated At', new Date().toLocaleString()],
        [],
        ['SUMMARY'],
        ['Total Invoices', String(dailyData?.summary?.total_invoices || '0')],
        ['Total Sales (Rs.)', Number(dailyData?.summary?.total_sales || 0).toFixed(2)],
        ['Total Discounts (Rs.)', Number(dailyData?.summary?.total_discounts || 0).toFixed(2)],
        ['Cash Sales (Rs.)', Number(dailyData?.summary?.cash_sales || 0).toFixed(2)],
        ['Card Sales (Rs.)', Number(dailyData?.summary?.card_sales || 0).toFixed(2)],
        [],
        ['INVOICES BREAKDOWN'],
        ['Invoice #', 'Time', 'Cashier', 'Payment Method', 'Discount (Rs.)', 'Total Amount (Rs.)'],
      ];

      (dailyData?.invoices || []).forEach((inv: any) => {
        rows.push([
          inv.invoice_number,
          new Date(inv.created_at).toLocaleTimeString(),
          inv.cashier_name || inv.cashier_id,
          inv.payment_method,
          Number(inv.total_discount || 0).toFixed(2),
          Number(inv.total_amount || 0).toFixed(2),
        ]);
      });

      csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
    } else if (activeTab === 'monthly') {
      fileName = `monthly_sales_report_${monthlyYear}_${monthlyMonth}.csv`;
      const rows: string[][] = [
        ['MONTHLY SALES REPORT'],
        ['Year', String(monthlyYear)],
        ['Month', String(monthlyMonth)],
        ['Generated At', new Date().toLocaleString()],
        [],
        ['SUMMARY'],
        ['Total Invoices', String(monthlyData?.summary?.total_invoices || '0')],
        ['Total Sales (Rs.)', Number(monthlyData?.summary?.total_sales || 0).toFixed(2)],
        ['Total Discounts (Rs.)', Number(monthlyData?.summary?.total_discounts || 0).toFixed(2)],
        ['Cash Sales (Rs.)', Number(monthlyData?.summary?.cash_sales || 0).toFixed(2)],
        ['Card Sales (Rs.)', Number(monthlyData?.summary?.card_sales || 0).toFixed(2)],
        [],
        ['DAILY BREAKDOWN'],
        ['Date', 'Invoice Count', 'Total Discounts (Rs.)', 'Gross Sales (Rs.)'],
      ];

      (monthlyData?.dailyBreakdown || []).forEach((day: any) => {
        rows.push([
          day.date,
          String(day.invoice_count),
          Number(day.total_discounts || 0).toFixed(2),
          Number(day.total_sales || 0).toFixed(2),
        ]);
      });

      csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
    } else if (activeTab === 'products') {
      fileName = `product_sales_volume_${prodDateFrom || 'start'}_to_${prodDateTo || 'end'}.csv`;
      const rows: string[][] = [
        ['PRODUCT SALES VOLUME REPORT'],
        ['From Date', prodDateFrom || 'All time'],
        ['To Date', prodDateTo || 'Present'],
        ['Generated At', new Date().toLocaleString()],
        [],
        ['PRODUCTS BREAKDOWN'],
        ['Item Code', 'Product Name', 'Quantity Sold', 'Invoice Count', 'Total Sales (Rs.)'],
      ];

      (productSalesData || []).forEach((item: any) => {
        rows.push([
          item.item_code,
          item.item_name,
          String(item.total_quantity_sold),
          String(item.invoice_count),
          Number(item.total_sales || 0).toFixed(2),
        ]);
      });

      csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
    } else if (activeTab === 'lowStock') {
      fileName = `low_stock_report_${new Date().toISOString().split('T')[0]}.csv`;
      const rows: string[][] = [
        ['LOW STOCK DEFICIT REPORT'],
        ['Generated At', new Date().toLocaleString()],
        [],
        ['LOW STOCK ITEMS'],
        ['Item Code', 'Product Name', 'Category', 'Available Stock', 'Minimum Threshold', 'Deficit Needed'],
      ];

      (lowStockData || []).forEach((p: any) => {
        const deficit = Math.max(0, p.minimum_quantity - p.quantity);
        rows.push([
          p.item_code,
          p.item_name,
          p.category_name || '-',
          String(p.quantity),
          String(p.minimum_quantity),
          String(deficit),
        ]);
      });

      csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
    } else if (activeTab === 'stockValue') {
      fileName = `stock_valuation_report_${new Date().toISOString().split('T')[0]}.csv`;
      const rows: string[][] = [
        ['STOCK VALUATION REPORT'],
        ['Generated At', new Date().toLocaleString()],
        [],
        ['SUMMARY'],
        ['Total Products (SKUs)', String(stockValData?.summary?.total_products || '0')],
        ['Total Units in Stock', String(stockValData?.summary?.total_quantity || '0')],
        ['Total Retail Value (Rs.)', Number(stockValData?.summary?.total_retail_value || 0).toFixed(2)],
        [],
        ['STOCK INVENTORY ITEMS'],
        ['Item Code', 'Product Name', 'Available Stock', 'Retail Price (Rs.)', 'Total Retail Value (Rs.)'],
      ];

      (stockValData?.products || []).forEach((p: any) => {
        rows.push([
          p.item_code,
          p.item_name,
          String(p.quantity),
          Number(p.retail_price || 0).toFixed(2),
          Number(p.retail_value || 0).toFixed(2),
        ]);
      });

      csvContent = rows.map((r) => r.map(escapeCSV).join(',')).join('\r\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (activeTab === 'daily') loadDailySales();
    else if (activeTab === 'monthly') loadMonthlySales();
    else if (activeTab === 'products') loadProductSales();
    else if (activeTab === 'lowStock') loadLowStock();
    else if (activeTab === 'stockValue') loadStockValue();
  }, [activeTab, dailyDate, monthlyYear, monthlyMonth]);

  return (
    <div className="p-4 h-full flex flex-col select-none gap-3 bg-[var(--pos-bg)]">
      {/* Header */}
      <PageHeader
        title="Reports"
        subtitle="Sales summaries, inventory reports, and audit totals"
        actions={
          isSuperAdmin ? (
            <Button
              onClick={handleDownloadReport}
              variant="secondary"
              size="sm"
              className="flex items-center gap-1.5 font-semibold text-slate-800 bg-white hover:bg-slate-50 border-slate-300"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download Report (CSV)</span>
            </Button>
          ) : (
            <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-500 rounded border border-slate-200 flex items-center gap-1 font-medium">
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Download: Super Admin only
            </span>
          )
        }
      />

      {/* Tabs */}
      <div className="pos-card p-1 flex gap-1 overflow-x-auto shrink-0">
        {[
          { key: 'daily', label: 'Daily Sales' },
          { key: 'monthly', label: 'Monthly Summary' },
          { key: 'products', label: 'Product Volume' },
          { key: 'lowStock', label: 'Low Stock Deficit' },
          { key: 'stockValue', label: 'Inventory Valuation' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as ReportTab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-[var(--pos-primary)] text-white font-bold'
                : 'text-[var(--pos-text-muted)] hover:text-[var(--pos-text)] hover:bg-[var(--pos-bg-subtle)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Viewport */}
      <div className="flex-1 overflow-auto flex flex-col gap-3 min-h-0">
        {/* Daily Sales */}
        {activeTab === 'daily' && (
          <div className="flex flex-col gap-3 h-full">
            <div className="pos-card p-3 flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs text-[var(--pos-text-muted)]">Select Date:</span>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="pos-input py-1 px-2 text-xs"
              />
              <Button onClick={loadDailySales} variant="primary" size="sm">
                Refresh
              </Button>
              {isSuperAdmin && (
                <Button onClick={handleDownloadReport} variant="secondary" size="sm" className="ml-auto flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </Button>
              )}
            </div>

            {dailyData?.summary && (
              <div className="grid grid-cols-4 gap-2 shrink-0">
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Total Sales</span>
                  <PriceDisplay amount={dailyData.summary.total_sales} size="lg" className="font-bold text-[var(--pos-text)] mt-0.5" />
                </div>
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Invoices</span>
                  <span className="font-mono font-bold text-lg text-[var(--pos-text)] mt-0.5 block">
                    {dailyData.summary.total_invoices}
                  </span>
                </div>
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Cash Sales</span>
                  <PriceDisplay amount={dailyData.summary.cash_sales} size="lg" className="font-bold text-[var(--pos-success)] mt-0.5" />
                </div>
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Card Sales</span>
                  <PriceDisplay amount={dailyData.summary.card_sales} size="lg" className="font-bold text-[var(--pos-accent)] mt-0.5" />
                </div>
              </div>
            )}

            <div className="pos-card flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Cashier</TableHead>
                    <TableHead align="center">Payment</TableHead>
                    <TableHead align="right">Discount</TableHead>
                    <TableHead align="right">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyData?.invoices?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-[var(--pos-text-muted)]">
                        No sales recorded on this date.
                      </TableCell>
                    </TableRow>
                  ) : (
                    dailyData?.invoices?.map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell monospace className="font-semibold text-xs text-[var(--pos-text)]">
                          {inv.invoice_number}
                        </TableCell>
                        <TableCell monospace className="text-xs text-[var(--pos-text-muted)]">
                          {new Date(inv.created_at).toLocaleTimeString()}
                        </TableCell>
                        <TableCell className="text-xs text-[var(--pos-text)]">
                          {inv.cashier_name || inv.cashier_id}
                        </TableCell>
                        <TableCell align="center">
                          <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] text-[var(--pos-text)]">
                            {inv.payment_method}
                          </span>
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                          {inv.total_discount > 0 ? `-${inv.total_discount.toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-text)]">
                          Rs. {inv.total_amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Monthly Summary */}
        {activeTab === 'monthly' && (
          <div className="flex flex-col gap-3 h-full">
            <div className="pos-card p-3 flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs text-[var(--pos-text-muted)]">Year:</span>
              <input
                type="number"
                value={monthlyYear}
                onChange={(e) => setMonthlyYear(parseInt(e.target.value) || 2026)}
                className="pos-input py-1 px-2 text-xs w-20 font-mono"
              />
              <span className="text-xs text-[var(--pos-text-muted)]">Month:</span>
              <select
                value={monthlyMonth}
                onChange={(e) => setMonthlyMonth(parseInt(e.target.value) || 1)}
                className="pos-select py-1 px-2 text-xs"
              >
                {[
                  'January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December',
                ].map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <Button onClick={loadMonthlySales} variant="primary" size="sm">
                Refresh
              </Button>
              {isSuperAdmin && (
                <Button onClick={handleDownloadReport} variant="secondary" size="sm" className="ml-auto flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </Button>
              )}
            </div>

            {monthlyData?.summary && (
              <div className="grid grid-cols-4 gap-2 shrink-0">
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Monthly Total</span>
                  <PriceDisplay amount={monthlyData.summary.total_sales} size="lg" className="font-bold text-[var(--pos-text)] mt-0.5" />
                </div>
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Invoices</span>
                  <span className="font-mono font-bold text-lg text-[var(--pos-text)] mt-0.5 block">
                    {monthlyData.summary.total_invoices}
                  </span>
                </div>
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Cash Total</span>
                  <PriceDisplay amount={monthlyData.summary.cash_sales} size="lg" className="font-bold text-[var(--pos-success)] mt-0.5" />
                </div>
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Card Total</span>
                  <PriceDisplay amount={monthlyData.summary.card_sales} size="lg" className="font-bold text-[var(--pos-accent)] mt-0.5" />
                </div>
              </div>
            )}

            <div className="pos-card flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead align="center">Invoices</TableHead>
                    <TableHead align="right">Discounts</TableHead>
                    <TableHead align="right">Gross Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyData?.dailyBreakdown?.map((day: any) => (
                    <TableRow key={day.date}>
                      <TableCell monospace className="font-semibold text-xs text-[var(--pos-text)]">
                        {day.date}
                      </TableCell>
                      <TableCell align="center" monospace className="text-xs text-[var(--pos-text-muted)]">
                        {day.invoice_count}
                      </TableCell>
                      <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                        {day.total_discounts.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-text)]">
                        Rs. {day.total_sales.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Product Volume */}
        {activeTab === 'products' && (
          <div className="flex flex-col gap-3 h-full">
            <div className="pos-card p-3 flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-xs text-[var(--pos-text-muted)]">From:</span>
              <input
                type="date"
                value={prodDateFrom}
                onChange={(e) => setProdDateFrom(e.target.value)}
                className="pos-input py-1 px-2 text-xs"
              />
              <span className="text-xs text-[var(--pos-text-muted)]">To:</span>
              <input
                type="date"
                value={prodDateTo}
                onChange={(e) => setProdDateTo(e.target.value)}
                className="pos-input py-1 px-2 text-xs"
              />
              <Button onClick={loadProductSales} variant="primary" size="sm">
                Filter
              </Button>
              {isSuperAdmin && (
                <Button onClick={handleDownloadReport} variant="secondary" size="sm" className="ml-auto flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </Button>
              )}
            </div>

            <div className="pos-card flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead align="center">Unit</TableHead>
                    <TableHead align="right">Qty Sold</TableHead>
                    <TableHead align="center">Invoices</TableHead>
                    <TableHead align="right">Gross Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productSalesData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center text-[var(--pos-text-muted)]">
                        No sales recorded for this date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    productSalesData.map((item) => {
                      const isKg = (item.unit || '').toUpperCase() === 'KG';
                      return (
                        <TableRow key={item.product_id}>
                          <TableCell monospace className="text-xs text-[var(--pos-text-muted)]">
                            {item.item_code}
                          </TableCell>
                          <TableCell className="font-semibold text-xs text-[var(--pos-text)]">
                            {item.item_name}
                          </TableCell>
                          <TableCell align="center">
                            {isKg ? (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                KG
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                PCS
                              </span>
                            )}
                          </TableCell>
                          <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-accent)]">
                            {isKg ? `${Number(item.total_quantity_sold).toFixed(3)} kg` : `${Math.floor(item.total_quantity_sold)} pcs`}
                          </TableCell>
                          <TableCell align="center" monospace className="text-xs text-[var(--pos-text-muted)]">
                            {item.invoice_count}
                          </TableCell>
                          <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-text)]">
                            Rs. {item.total_sales.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Low Stock Deficit */}
        {activeTab === 'lowStock' && (
          <div className="pos-card flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead align="center">Unit</TableHead>
                  <TableHead align="right">Available Stock</TableHead>
                  <TableHead align="right">Threshold</TableHead>
                  <TableHead align="right">Reorder Deficit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-[var(--pos-success)] font-semibold">
                      ✓ All inventory items are currently above their minimum threshold.
                    </TableCell>
                  </TableRow>
                ) : (
                  lowStockData.map((p) => {
                    const isKg = (p.unit || '').toUpperCase() === 'KG';
                    const deficit = Math.max(0, p.minimum_quantity - p.quantity);
                    return (
                      <TableRow key={p.id}>
                        <TableCell monospace className="font-semibold text-xs text-[var(--pos-text)]">
                          {p.item_code}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-[var(--pos-text)]">
                          {p.item_name}
                        </TableCell>
                        <TableCell className="text-xs text-[var(--pos-text-muted)]">
                          {p.category_name || '-'}
                        </TableCell>
                        <TableCell align="center">
                          {isKg ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              KG
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              PCS
                            </span>
                          )}
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-danger)]">
                          {isKg ? `${Number(p.quantity).toFixed(3)} kg` : `${Math.floor(p.quantity)} pcs`}
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                          {isKg ? `${Number(p.minimum_quantity).toFixed(3)} kg` : `${Math.floor(p.minimum_quantity)} pcs`}
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-danger)]">
                          +{isKg ? `${deficit.toFixed(3)} kg` : `${Math.floor(deficit)} pcs`} needed
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Stock Valuation */}
        {activeTab === 'stockValue' && (
          <div className="flex flex-col gap-3 h-full">
            {stockValData?.summary && (
              <div className="grid grid-cols-3 gap-2 shrink-0">
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Active SKUs</span>
                  <span className="font-mono font-bold text-lg text-[var(--pos-text)] mt-0.5 block">
                    {stockValData.summary.total_products}
                  </span>
                </div>
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Total Units</span>
                  <span className="font-mono font-bold text-lg text-[var(--pos-accent)] mt-0.5 block">
                    {stockValData.summary.total_quantity}
                  </span>
                </div>
                <div className="pos-card p-3 text-center">
                  <span className="text-[11px] text-[var(--pos-text-muted)] uppercase tracking-wider block">Total Retail Value</span>
                  <PriceDisplay amount={stockValData.summary.total_retail_value} size="lg" className="font-bold text-[var(--pos-success)] mt-0.5" />
                </div>
              </div>
            )}

            <div className="pos-card flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Product Name</TableHead>
                    <TableHead align="center">Unit</TableHead>
                    <TableHead align="right">Stock</TableHead>
                    <TableHead align="right">Retail Price</TableHead>
                    <TableHead align="right">Total Retail Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockValData?.products?.map((p: any) => {
                    const isKg = (p.unit || '').toUpperCase() === 'KG';
                    return (
                      <TableRow key={p.id}>
                        <TableCell monospace className="text-xs text-[var(--pos-text-muted)]">
                          {p.item_code}
                        </TableCell>
                        <TableCell className="font-medium text-xs text-[var(--pos-text)]">
                          {p.item_name}
                        </TableCell>
                        <TableCell align="center">
                          {isKg ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              KG
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                              PCS
                            </span>
                          )}
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs font-semibold">
                          {isKg ? `${Number(p.quantity).toFixed(3)} kg` : `${Math.floor(p.quantity)} pcs`}
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                          Rs. {p.retail_price.toFixed(2)}
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-text)]">
                          Rs. {p.retail_value.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
