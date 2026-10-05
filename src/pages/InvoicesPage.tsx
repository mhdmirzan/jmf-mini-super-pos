import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { invoiceService, settingsService } from '../services/api';
import type { Invoice } from '../types';
import ReceiptModal from '../components/ReceiptModal';
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
  Dialog,
  PageHeader,
  PriceDisplay,
  Toast,
  EmptyState,
} from '../components/common';

export default function InvoicesPage() {
  const { user, hasRole } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchNumber, setSearchNumber] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Selected invoice
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>({});

  // Cancellation
  const [cancellingInvoice, setCancellingInvoice] = useState<Invoice | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const loadSettings = async () => {
    const s = await settingsService.get();
    if (s.success && s.settings) setShopSettings(s.settings);
  };

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const res = await invoiceService.list({
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (res.success && res.invoices) {
        let list = res.invoices;
        if (searchNumber.trim()) {
          const q = searchNumber.trim().toLowerCase();
          list = list.filter((inv: Invoice) =>
            inv.invoice_number.toLowerCase().includes(q) ||
            (inv.cashier_name && inv.cashier_name.toLowerCase().includes(q)) ||
            (inv.cashier_username && inv.cashier_username.toLowerCase().includes(q))
          );
        }
        setInvoices(list);
      }
    } catch (err: any) {
      showToast('Error loading invoices: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadInvoices();
  }, [statusFilter, dateFrom, dateTo]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadInvoices();
  };

  const handleViewInvoice = async (invoiceId: string) => {
    const res = await invoiceService.get(invoiceId);
    if (res.success && res.invoice) {
      setSelectedInvoice(res.invoice);
    }
  };

  const handlePrintReceipt = async (invoice: Invoice) => {
    if (!invoice.items) {
      const res = await invoiceService.get(invoice.id);
      if (res.success && res.invoice) {
        setSelectedInvoice(res.invoice);
        setIsReceiptOpen(true);
        return;
      }
    }
    setSelectedInvoice(invoice);
    setIsReceiptOpen(true);
  };

  const openCancelModal = (inv: Invoice) => {
    setCancellingInvoice(inv);
    setCancelReason('');
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingInvoice || !cancelReason.trim()) {
      showToast('Cancellation reason is required', 'error');
      return;
    }

    setIsCancelling(true);
    try {
      const res = await invoiceService.cancel({
        invoiceId: cancellingInvoice.id,
        cancelledBy: user?.id,
        reason: cancelReason.trim(),
      });

      if (res.success) {
        showToast(
          `Invoice ${cancellingInvoice.invoice_number} cancelled and inventory restored`,
          'success'
        );
        setCancellingInvoice(null);
        if (selectedInvoice?.id === cancellingInvoice.id) {
          setSelectedInvoice(null);
        }
        loadInvoices();
      } else {
        showToast(res.error || 'Failed to cancel invoice', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error cancelling invoice', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const completedInvoices = invoices.filter((i) => i.status === 'COMPLETED');
  const totalSalesRevenue = completedInvoices.reduce((s, i) => s + i.total_amount, 0);

  return (
    <div className="p-4 h-full flex flex-col select-none gap-3 bg-[var(--pos-bg)]">
      {/* Toast Alert */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Page Header */}
      <PageHeader
        title="Invoices"
        subtitle="Sales transactions and receipt reprints"
        count={invoices.length}
        actions={
          <div className="text-xs text-[var(--pos-text-muted)] flex items-center gap-3">
            <span>
              Total Sales: <strong className="font-mono text-[var(--pos-text)]">Rs. {totalSalesRevenue.toFixed(2)}</strong>
            </span>
          </div>
        }
      />

      {/* Search & Filters Bar */}
      <div className="pos-card p-3 shrink-0">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-[240px]">
            <Input
              value={searchNumber}
              onChange={(e) => setSearchNumber(e.target.value)}
              placeholder="Search invoice number or cashier..."
              monospace
            />
          </div>

          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' },
              ]}
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--pos-text-muted)]">
            <span>From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="pos-input py-1 px-2 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--pos-text-muted)]">
            <span>To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="pos-input py-1 px-2 text-xs"
            />
          </div>

          <Button type="submit" variant="primary" size="sm">
            Filter
          </Button>

          {(searchNumber || statusFilter || dateFrom || dateTo) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchNumber('');
                setStatusFilter('');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Reset
            </Button>
          )}
        </form>
      </div>

      {/* Invoices Table */}
      <div className="pos-card flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Cashier</TableHead>
              <TableHead align="right">Subtotal</TableHead>
              <TableHead align="right">Discount</TableHead>
              <TableHead align="right">Total Amount</TableHead>
              <TableHead align="center">Payment</TableHead>
              <TableHead align="center">Status</TableHead>
              <TableHead align="right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center text-[var(--pos-text-muted)]">
                  Loading invoices...
                </TableCell>
              </TableRow>
            ) : invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <EmptyState
                    title="No invoices found"
                    description="No sales matched your search or date filter."
                  />
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell monospace className="font-semibold text-xs text-[var(--pos-text)]">
                    {inv.invoice_number}
                  </TableCell>
                  <TableCell monospace className="text-xs text-[var(--pos-text-muted)]">
                    {new Date(inv.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--pos-text)]">
                    {inv.cashier_name || inv.cashier_username || inv.cashier_id}
                  </TableCell>
                  <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                    {inv.subtotal.toFixed(2)}
                  </TableCell>
                  <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                    {inv.total_discount > 0 ? `-${inv.total_discount.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-text)]">
                    Rs. {inv.total_amount.toFixed(2)}
                  </TableCell>
                  <TableCell align="center">
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] text-[var(--pos-text)]">
                      {inv.payment_method}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                        inv.status === 'COMPLETED'
                          ? 'bg-emerald-50 text-[var(--pos-success)] border border-emerald-200'
                          : 'bg-rose-50 text-[var(--pos-danger)] border border-rose-200'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </TableCell>
                  <TableCell align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleViewInvoice(inv.id)}
                      >
                        View
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handlePrintReceipt(inv)}
                      >
                        Print
                      </Button>
                      {hasRole('ADMIN') && inv.status === 'COMPLETED' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => openCancelModal(inv)}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Invoice Detail Dialog */}
      {selectedInvoice && (
        <Dialog
          isOpen={true}
          onClose={() => setSelectedInvoice(null)}
          title={`Invoice: ${selectedInvoice.invoice_number}`}
          subtitle={new Date(selectedInvoice.created_at).toLocaleString()}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedInvoice(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handlePrintReceipt(selectedInvoice)}
              >
                Print Receipt
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 p-3 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded text-xs">
              <div>
                <span className="text-[var(--pos-text-muted)] block">Cashier</span>
                <span className="font-semibold text-[var(--pos-text)]">
                  {selectedInvoice.cashier_name || selectedInvoice.cashier_username || selectedInvoice.cashier_id}
                </span>
              </div>
              <div>
                <span className="text-[var(--pos-text-muted)] block">Payment Method</span>
                <span className="font-semibold text-[var(--pos-text)]">{selectedInvoice.payment_method}</span>
              </div>
              <div>
                <span className="text-[var(--pos-text-muted)] block">Status</span>
                <span className={`font-bold ${
                  selectedInvoice.status === 'COMPLETED' ? 'text-[var(--pos-success)]' : 'text-[var(--pos-danger)]'
                }`}>
                  {selectedInvoice.status}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-[var(--pos-border)] rounded overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead align="right">Price</TableHead>
                    <TableHead align="center">Qty</TableHead>
                    <TableHead align="right">Discount</TableHead>
                    <TableHead align="right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedInvoice.items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="font-medium text-xs text-[var(--pos-text)]">
                          {item.item_name}
                        </div>
                        <div className="text-[10px] text-[var(--pos-text-muted)] font-mono">
                          {item.item_code}
                        </div>
                      </TableCell>
                      <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                        {item.unit_price.toFixed(2)}
                      </TableCell>
                      <TableCell align="center" monospace className="text-xs font-semibold">
                        {item.quantity}
                      </TableCell>
                      <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                        {item.discount > 0 ? `-${item.discount.toFixed(2)}` : '-'}
                      </TableCell>
                      <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-text)]">
                        {item.amount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Invoice Total */}
            <div className="p-3 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded flex justify-between items-center text-xs">
              <div className="space-y-0.5 text-[var(--pos-text-muted)]">
                <div>Subtotal: <span className="font-mono text-[var(--pos-text)]">Rs. {selectedInvoice.subtotal.toFixed(2)}</span></div>
                {selectedInvoice.total_discount > 0 && (
                  <div>Total Discount: <span className="font-mono text-[var(--pos-danger)]">-Rs. {selectedInvoice.total_discount.toFixed(2)}</span></div>
                )}
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[var(--pos-text-muted)] block">Total Payable</span>
                <PriceDisplay amount={selectedInvoice.total_amount} size="lg" className="font-bold text-[var(--pos-text)]" />
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Invoice Cancellation Dialog (Section 22) */}
      {cancellingInvoice && (
        <Dialog
          isOpen={true}
          onClose={() => setCancellingInvoice(null)}
          title="Cancel Invoice?"
          size="sm"
        >
          <form onSubmit={handleConfirmCancel} className="space-y-3">
            <div className="p-3 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--pos-text-muted)]">Invoice:</span>
                <strong className="font-mono text-[var(--pos-text)]">{cancellingInvoice.invoice_number}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--pos-text-muted)]">Amount:</span>
                <strong className="font-mono text-[var(--pos-text)]">Rs. {cancellingInvoice.total_amount.toFixed(2)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--pos-text-muted)]">Cashier:</span>
                <span className="text-[var(--pos-text)]">{cancellingInvoice.cashier_name || cancellingInvoice.cashier_username || cancellingInvoice.cashier_id}</span>
              </div>
            </div>

            <p className="text-xs text-[var(--pos-text-muted)]">
              Cancelling will reverse this sale and restore item quantities back to stock.
            </p>

            <Input
              label="Reason for Cancellation *"
              required
              autoFocus
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g., Customer return, error in bill"
            />

            <div className="pt-3 border-t border-[var(--pos-border)] flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isCancelling}
                onClick={() => setCancellingInvoice(null)}
              >
                Keep Invoice
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={isCancelling}
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Invoice'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        invoice={selectedInvoice}
        shopSettings={shopSettings}
      />
    </div>
  );
}
