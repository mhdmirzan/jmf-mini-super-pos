import React, { useState, useEffect, useMemo } from 'react';
import { billDeletionService } from '../services/api';
import type { BillItemDeletion } from '../types';
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  PageHeader,
  EmptyState,
  Toast,
} from '../components/common';

export default function BillDeletionsPage() {
  const [deletions, setDeletions] = useState<BillItemDeletion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchBill, setSearchBill] = useState('');
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const loadDeletions = async () => {
    setLoading(true);
    try {
      const res = await billDeletionService.list({ limit: 200 });
      if (res.success && res.deletions) {
        setDeletions(res.deletions as BillItemDeletion[]);
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load notifications', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeletions();
    billDeletionService.markAdminSeen().catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    if (!searchBill.trim()) return deletions;
    const q = searchBill.trim().toLowerCase();
    return deletions.filter(
      (d) =>
        d.bill_reference.toLowerCase().includes(q) ||
        d.message.toLowerCase().includes(q) ||
        (d.cashier_name || '').toLowerCase().includes(q) ||
        (d.product_name || '').toLowerCase().includes(q)
    );
  }, [deletions, searchBill]);

  const groupedByBill = useMemo(() => {
    const map = new Map<string, BillItemDeletion[]>();
    for (const row of filtered) {
      const key = row.bill_reference;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return Array.from(map.entries()).sort(
      (a, b) =>
        new Date(b[1][0].created_at).getTime() - new Date(a[1][0].created_at).getTime()
    );
  }, [filtered]);

  return (
    <div className="p-4 h-full flex flex-col select-none gap-3 bg-[var(--pos-bg)]">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <PageHeader
        title="Bill Item Deletions"
        subtitle="Items removed from open bills by cashiers — grouped by draft bill number"
        count={filtered.length}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadDeletions}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await billDeletionService.markAdminSeen();
                setToast({ message: 'All notifications marked as read', type: 'success' });
                loadDeletions();
              }}
            >
              Mark all read
            </Button>
          </div>
        }
      />

      {/* Search bar */}
      <div className="flex flex-wrap gap-2 items-center shrink-0 py-1">
        <div className="flex-1 min-w-[240px]">
          <Input
            value={searchBill}
            onChange={(e) => setSearchBill(e.target.value)}
            placeholder="Search bill no, product name, or cashier…"
            monospace
          />
        </div>
        {searchBill && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSearchBill('')}
          >
            Reset
          </Button>
        )}
      </div>

      {/* Main content — fills remaining viewport */}
      <div className="pos-card flex-1 overflow-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center p-8">
            <EmptyState
              title={loading ? 'Loading…' : 'No deletion notifications'}
              description="When a cashier removes a line from the billing panel, it will appear here with the bill number and product details."
            />
          </div>
        ) : (
          <div className="p-3 space-y-4">
            {groupedByBill.map(([billRef, rows]) => (
              <div
                key={billRef}
                className="border border-[var(--pos-border)] rounded-lg overflow-hidden bg-white"
              >
                <div className="px-4 py-2.5 bg-[var(--pos-bg-subtle)] border-b border-[var(--pos-border)] flex flex-wrap justify-between gap-2 items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold uppercase text-[var(--pos-text-muted)] tracking-wider">
                      Draft bill
                    </span>
                    <span className="font-mono font-bold text-base text-[var(--pos-text)]">
                      #{billRef}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--pos-text-muted)]">
                    {rows.length} deletion{rows.length === 1 ? '' : 's'} · Terminal{' '}
                    <span className="font-mono">{rows[0].device_id || 'POS'}</span>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Cashier</TableHead>
                      <TableHead>Notification</TableHead>
                      <TableHead align="right">Qty</TableHead>
                      <TableHead align="right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-xs font-mono whitespace-nowrap">
                          {new Date(row.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="text-xs font-semibold">
                          {row.cashier_name || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-[var(--pos-text)]">
                          {row.message}
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs">
                          {(row.unit || '').toUpperCase() === 'KG'
                            ? `${Number(row.quantity).toFixed(3)} kg`
                            : `${Math.floor(row.quantity)} pcs`}
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs font-semibold">
                          Rs. {Number(row.line_amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
