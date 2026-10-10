import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { returnService, invoiceService, settingsService, systemService } from '../services/api';
import type { SalesReturn, Invoice, InvoiceItem } from '../types';
import ReceiptModal from '../components/ReceiptModal';
import {
  Button,
  Input,
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

interface ReturnItemSelection {
  invoiceItemId: string;
  productId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  originalQty: number;
  salesPrice: number;
  returnQty: number;
  reason: string;
  selected: boolean;
}

export default function ReturnsPage() {
  const { user } = useAuth();

  const [returnsList, setReturnsList] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(false);

  // New Return Guided Modal State
  const [isNewReturnOpen, setIsNewReturnOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [foundInvoice, setFoundInvoice] = useState<Invoice | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnItemSelection[]>([]);
  const [generalReason, setGeneralReason] = useState('Customer Return');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preview & Print Return Note
  const [selectedReturn, setSelectedReturn] = useState<SalesReturn | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>({});
  const [deviceId, setDeviceId] = useState('');

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const loadSettings = async () => {
    const s = await settingsService.get();
    if (s.success && s.settings) setShopSettings(s.settings);
    const d = await systemService.getDeviceId();
    if (d.success) setDeviceId(d.deviceId);
  };

  const loadReturns = async () => {
    setLoading(true);
    try {
      const res = await returnService.list();
      if (res.success && res.returns) {
        setReturnsList(res.returns);
      }
    } catch (err: any) {
      showToast('Error loading returns: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    loadReturns();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const handleSearchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceQuery.trim()) return;

    try {
      const res = await invoiceService.list({ status: 'COMPLETED' });
      if (res.success && res.invoices) {
        const match = res.invoices.find(
          (inv: Invoice) =>
            inv.invoice_number.toLowerCase() === invoiceQuery.trim().toLowerCase()
        );
        if (!match) {
          showToast(`Completed invoice "${invoiceQuery}" not found`, 'error');
          return;
        }

        const fullRes = await invoiceService.get(match.id);
        if (fullRes.success && fullRes.invoice) {
          setFoundInvoice(fullRes.invoice);
          setReturnItems(
            (fullRes.invoice.items || []).map((it: any) => {
              const itUnit = it.unit || 'PCS';
              const initReturn = itUnit === 'KG'
                ? Math.min(1, it.quantity)
                : Math.min(1, Math.floor(it.quantity));
              return {
                invoiceItemId: it.id,
                productId: it.product_id,
                itemCode: it.item_code,
                itemName: it.item_name,
                unit: itUnit,
                originalQty: it.quantity,
                salesPrice: it.unit_price,
                returnQty: initReturn,
                reason: 'Customer return',
                selected: true,
              };
            })
          );
          setCurrentStep(2);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error searching invoice', 'error');
    }
  };

  const handleToggleItem = (index: number) => {
    setReturnItems((prev) => {
      const copy = [...prev];
      copy[index].selected = !copy[index].selected;
      return copy;
    });
  };

  const handleToggleAll = (selectAll: boolean) => {
    setReturnItems((prev) => prev.map((it) => ({ ...it, selected: selectAll })));
  };

  const handleQtyChange = (index: number, qty: number) => {
    setReturnItems((prev) => {
      const copy = [...prev];
      const item = copy[index];
      const max = item.originalQty;
      if (item.unit === 'PCS') {
        const intQty = Math.max(1, Math.min(Math.floor(max), Math.floor(qty)));
        item.returnQty = intQty;
      } else {
        const safeQty = Math.max(0.001, Math.min(max, qty));
        item.returnQty = safeQty;
      }
      item.selected = true;
      return copy;
    });
  };

  const handleItemReasonChange = (index: number, reason: string) => {
    setReturnItems((prev) => {
      const copy = [...prev];
      copy[index].reason = reason;
      copy[index].selected = true;
      return copy;
    });
  };

  const handleConfirmReturn = async () => {
    const selected = returnItems.filter((it) => it.selected);
    if (selected.length === 0) {
      showToast('Select at least one item to return', 'error');
      return;
    }

    if (!foundInvoice) return;

    setIsSubmitting(true);
    try {
      const payload = {
        originalInvoiceId: foundInvoice.id,
        reason: generalReason.trim() || 'Customer return',
        processedBy: user?.id,
        deviceId,
        items: selected.map((it) => ({
          invoiceItemId: it.invoiceItemId,
          quantity: it.returnQty,
          reason: it.reason.trim() || generalReason,
        })),
      };

      const res = await returnService.create(payload);

      if (res.success && res.return) {
        showToast(`Return #${res.return.returnNumber} processed successfully`, 'success');

        const printReturn: SalesReturn = {
          id: res.return.id,
          return_number: res.return.returnNumber,
          original_invoice_id: foundInvoice.id,
          invoice_number: foundInvoice.invoice_number,
          reason: generalReason,
          processed_by: user?.id || '',
          processed_by_name: user?.fullName || user?.username,
          created_at: new Date().toISOString(),
          items: selected.map((it) => ({
            id: it.invoiceItemId,
            return_id: res.return.id,
            invoice_item_id: it.invoiceItemId,
            product_id: it.productId,
            item_code: it.itemCode,
            item_name: it.itemName,
            sales_price: it.salesPrice,
            quantity: it.returnQty,
            reason: it.reason,
          })),
        };

        setSelectedReturn(printReturn);
        setIsReceiptOpen(true);

        setIsNewReturnOpen(false);
        setFoundInvoice(null);
        setInvoiceQuery('');
        setReturnItems([]);
        setCurrentStep(1);
        loadReturns();
      } else {
        showToast(res.error || 'Failed to process return', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error processing return', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewReturn = async (returnId: string) => {
    const res = await returnService.get(returnId);
    if (res.success && res.return) {
      setSelectedReturn(res.return);
      setIsReceiptOpen(true);
    }
  };

  const selectedRefundTotal = returnItems
    .filter((it) => it.selected)
    .reduce((sum, it) => sum + it.returnQty * it.salesPrice, 0);

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
        title="Sales Returns"
        subtitle="Customer product returns and inventory restocking"
        count={returnsList.length}
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setFoundInvoice(null);
              setInvoiceQuery('');
              setReturnItems([]);
              setCurrentStep(1);
              setIsNewReturnOpen(true);
            }}
          >
            + Process Return
          </Button>
        }
      />

      {/* Returns List Table */}
      <div className="pos-card flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>Original Invoice #</TableHead>
              <TableHead>Date & Time</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Processed By</TableHead>
              <TableHead align="right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-[var(--pos-text-muted)]">
                  Loading return records...
                </TableCell>
              </TableRow>
            ) : returnsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <EmptyState
                    title="No sales returns recorded"
                    description="When a customer returns an item against an invoice, it will appear here."
                  />
                </TableCell>
              </TableRow>
            ) : (
              returnsList.map((ret) => (
                <TableRow key={ret.id}>
                  <TableCell monospace className="font-semibold text-xs text-[var(--pos-text)]">
                    {ret.return_number}
                  </TableCell>
                  <TableCell monospace className="text-xs text-[var(--pos-accent)] font-semibold">
                    {ret.invoice_number}
                  </TableCell>
                  <TableCell monospace className="text-xs text-[var(--pos-text-muted)]">
                    {new Date(ret.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--pos-text)]">
                    {ret.reason}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--pos-text-muted)]">
                    {ret.processed_by_name || ret.processed_by}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewReturn(ret.id)}
                    >
                      Print Note
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Guided Sales Return Dialog (Step 1 -> Step 2) */}
      {isNewReturnOpen && (
        <Dialog
          isOpen={true}
          onClose={() => setIsNewReturnOpen(false)}
          title="Process Sales Return"
          subtitle={
            currentStep === 1
              ? 'Step 1 of 2: Locate original sales invoice'
              : `Step 2 of 2: Select returned items for invoice #${foundInvoice?.invoice_number}`
          }
          size="lg"
        >
          <div className="space-y-4">
            {currentStep === 1 ? (
              /* Step 1: Find Invoice */
              <form onSubmit={handleSearchInvoice} className="space-y-4 py-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      label="Original Invoice Number"
                      required
                      autoFocus
                      value={invoiceQuery}
                      onChange={(e) => setInvoiceQuery(e.target.value)}
                      placeholder="e.g., INV-000001"
                      monospace
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" variant="primary">
                      Find Invoice
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-[var(--pos-text-muted)]">
                  Enter the exact invoice number printed on the customer receipt. Returns can only be processed against completed sales.
                </div>
              </form>
            ) : (
              /* Step 2: Select Items & Quantities */
              <div className="space-y-4">
                <div className="p-3 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[var(--pos-text-muted)]">Invoice: </span>
                    <strong className="font-mono text-[var(--pos-text)]">{foundInvoice?.invoice_number}</strong>
                    <span className="text-[var(--pos-text-muted)] ml-2">
                      ({foundInvoice?.created_at ? new Date(foundInvoice.created_at).toLocaleDateString() : ''})
                    </span>
                  </div>
                  <div className="font-mono text-[var(--pos-text)] font-semibold">
                    Original Total: Rs. {foundInvoice?.total_amount.toFixed(2)}
                  </div>
                </div>

                {/* Items selection table */}
                <div className="border border-[var(--pos-border)] rounded overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead align="center" className="w-12">
                          <input
                            type="checkbox"
                            checked={returnItems.length > 0 && returnItems.every((it) => it.selected)}
                            onChange={(e) => handleToggleAll(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            title="Select / Deselect All"
                          />
                        </TableHead>
                        <TableHead className="min-w-[180px]">Product</TableHead>
                        <TableHead align="right" className="min-w-[80px]">Sold Qty</TableHead>
                        <TableHead align="center" className="min-w-[110px]">Return Qty</TableHead>
                        <TableHead align="right" className="min-w-[90px]">Price</TableHead>
                        <TableHead className="min-w-[180px]">Specific Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returnItems.map((item, idx) => (
                        <TableRow
                          key={item.invoiceItemId}
                          selected={item.selected}
                          clickable
                          onClick={() => handleToggleItem(idx)}
                        >
                          <TableCell align="center">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => handleToggleItem(idx)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-xs text-[var(--pos-text)]">{item.itemName}</div>
                            <div className="text-[10px] text-[var(--pos-text-muted)] font-mono">
                              {item.itemCode}
                            </div>
                          </TableCell>
                          <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)] font-semibold">
                            {item.unit === 'KG'
                              ? `${Number(item.originalQty).toFixed(3)} kg`
                              : `${Math.floor(item.originalQty)} pcs`}
                          </TableCell>
                          <TableCell align="center">
                            <div className="inline-flex items-center gap-1">
                              <input
                                type="number"
                                min={item.unit === 'KG' ? "0.001" : "1"}
                                step={item.unit === 'KG' ? "any" : "1"}
                                max={item.originalQty}
                                value={item.unit === 'KG' ? item.returnQty : Math.floor(item.returnQty)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  if (item.unit === 'PCS' && (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E')) {
                                    e.preventDefault();
                                  }
                                }}
                                onChange={(e) => {
                                  if (item.unit === 'PCS') {
                                    const clean = e.target.value.replace(/[^0-9]/g, '');
                                    handleQtyChange(idx, clean === '' ? 1 : parseInt(clean, 10));
                                  } else {
                                    const val = parseFloat(e.target.value);
                                    handleQtyChange(idx, isNaN(val) ? 0 : val);
                                  }
                                }}
                                className="w-18 px-2 py-1 text-center border border-slate-300 rounded font-mono text-xs font-bold bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-[10px] font-bold text-slate-500">
                                {item.unit === 'KG' ? 'kg' : 'pcs'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell align="right" monospace className="text-xs font-semibold text-[var(--pos-text)]">
                            Rs. {item.salesPrice.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <input
                              type="text"
                              value={item.reason}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) =>
                                handleItemReasonChange(idx, e.target.value)
                              }
                              className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Input
                  label="General Reason / Return Note"
                  value={generalReason}
                  onChange={(e) => setGeneralReason(e.target.value)}
                />

                {/* Refund Total Summary */}
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded flex justify-between items-center text-xs">
                  <div>
                    <span className="font-bold text-emerald-950 block">Customer Refund Amount</span>
                    <span className="text-[11px] text-emerald-700">Stock will be replenished in inventory upon confirmation.</span>
                  </div>
                  <PriceDisplay amount={selectedRefundTotal} size="lg" className="font-bold text-emerald-950" />
                </div>
              </div>
            )}

            {/* Dialog Footer Actions */}
            <div className="pt-3 border-t border-[var(--pos-border)] flex justify-between items-center">
              <div>
                {currentStep === 2 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentStep(1)}
                  >
                    ← Back to Invoice Search
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsNewReturnOpen(false)}
                >
                  Cancel
                </Button>
                {currentStep === 2 && (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={selectedRefundTotal <= 0 || isSubmitting}
                    onClick={handleConfirmReturn}
                  >
                    {isSubmitting ? 'Restocking...' : `Confirm Return & Restock (${returnItems.filter(it => it.selected).length})`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Return Note Thermal Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        salesReturn={selectedReturn}
        shopSettings={shopSettings}
      />
    </div>
  );
}
