import React from 'react';
import type { Invoice, SalesReturn } from '../types';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: Invoice | null;
  salesReturn?: SalesReturn | null;
  shopSettings?: {
    shopName?: string;
    shopAddress?: string;
    shopPhone?: string;
    receiptFooter?: string;
  };
}

export default function ReceiptModal({
  isOpen,
  onClose,
  invoice,
  salesReturn,
  shopSettings,
}: ReceiptModalProps) {
  const [isPrinting, setIsPrinting] = React.useState(false);
  const [printError, setPrintError] = React.useState('');

  if (!isOpen || (!invoice && !salesReturn)) return null;

  const handlePrint = async () => {
    setPrintError('');
    const receiptEl = document.getElementById('printable-receipt');
    const receiptHtml = receiptEl ? receiptEl.innerHTML : '';

    if (window.electronAPI?.invoke) {
      setIsPrinting(true);
      try {
        const result = await window.electronAPI.invoke('printer:printReceipt', { html: receiptHtml });
        if (!result?.success) {
          setPrintError(result?.error || 'Printer is not ready');
          window.print();
        }
      } catch (err: any) {
        setPrintError(err?.message || 'Print failed');
        window.print();
      } finally {
        setIsPrinting(false);
      }
      return;
    }

    window.print();
  };

  const shopName = shopSettings?.shopName || 'STORE NAME';
  const shopAddress = shopSettings?.shopAddress || '';
  const shopPhone = shopSettings?.shopPhone || '';
  const receiptFooter =
    shopSettings?.receiptFooter || 'Thank you for shopping with us!';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 select-none">
      <div className="bg-white rounded-lg border border-[var(--pos-border)] shadow-xl max-w-sm w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in duration-100">
        {/* Modal Header */}
        <div className="p-3.5 px-4 border-b border-[var(--pos-border)] flex justify-between items-center bg-[var(--pos-bg-subtle)] print:hidden">
          <span className="font-bold text-xs uppercase tracking-wider text-[var(--pos-text)]">
            {invoice ? 'Receipt Preview (80mm)' : 'Return Note Preview (80mm)'}
          </span>
        </div>

        {/* Receipt Content (Formatted for 80mm Thermal Printer) */}
        <div
          id="printable-receipt"
          className="p-5 overflow-y-auto flex-1 font-mono text-xs text-black leading-tight bg-white select-text"
          style={{ width: '80mm', margin: '0 auto' }}
        >
          {/* Header */}
          <div className="text-center mb-3">
            <div className="font-black text-base uppercase tracking-wider">
              {shopName}
            </div>
            {shopAddress && <div className="text-[11px] text-slate-700 mt-0.5">{shopAddress}</div>}
            {shopPhone && <div className="text-[11px] text-slate-700">Tel: {shopPhone}</div>}
            <div className="border-b border-dashed border-black my-2.5" />
            <div className="font-bold text-[13px] tracking-wide">
              {invoice ? 'SALES RECEIPT' : 'SALES RETURN NOTE'}
            </div>
            <div className="border-b border-dashed border-black my-2.5" />
          </div>

          {/* Meta Info */}
          <div className="mb-2 text-[11px] space-y-1">
            {invoice && (
              <>
                <div className="flex justify-between">
                  <span>Invoice #:</span>
                  <span className="font-bold">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(invoice.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{invoice.cashier_name || invoice.cashier_username || invoice.cashier_id}</span>
                </div>
                <div className="flex justify-between">
                  <span>Rate Type:</span>
                  <span className="font-bold">
                    {invoice.price_type === 'WHOLESALE' || invoice.items?.some((i) => i.price_type === 'WHOLESALE')
                      ? 'WHOLESALE'
                      : 'RETAIL'}
                  </span>
                </div>
                {invoice.status === 'CANCELLED' && (
                  <div className="text-center text-rose-600 font-bold border border-rose-600 p-1 my-1">
                    *** CANCELLED ***
                  </div>
                )}
              </>
            )}

            {salesReturn && (
              <>
                <div className="flex justify-between">
                  <span>Return #:</span>
                  <span className="font-bold">{salesReturn.return_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Orig Inv #:</span>
                  <span>{salesReturn.invoice_number}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>{new Date(salesReturn.created_at).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Reason:</span>
                  <span>{salesReturn.reason}</span>
                </div>
              </>
            )}
          </div>

          <div className="border-b border-dashed border-black my-2.5" />

          {/* Items Table */}
          {invoice && invoice.items && (
            <div className="mb-2">
              <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-300 mb-1">
                <span className="w-1/2">Item</span>
                <span className="w-1/6 text-right">Qty</span>
                <span className="w-1/6 text-right">Price</span>
                <span className="w-1/6 text-right">Amt</span>
              </div>
              <div className="space-y-1">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="text-[11px]">
                    <div className="flex items-center justify-between font-medium">
                      <span className="truncate max-w-[180px]">{item.item_name}</span>
                      <span className="text-[9px] font-mono font-bold px-1 rounded border border-black/20 text-slate-700">
                        {item.price_type === 'WHOLESALE' ? 'W' : 'R'}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span className="w-1/2 text-slate-400 pl-1">#{item.item_code}</span>
                      <span className="w-1/6 text-right">
                        {Number.isInteger(item.quantity) ? item.quantity : Number(item.quantity).toFixed(3)}
                      </span>
                      <span className="w-1/6 text-right">{item.unit_price.toFixed(2)}</span>
                      <span className="w-1/6 text-right font-medium text-black">{item.amount.toFixed(2)}</span>
                    </div>
                    {item.discount > 0 && (
                      <div className="text-[10px] text-slate-500 italic pl-1">
                        (Disc: -{item.discount.toFixed(2)})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Return Items */}
          {salesReturn && salesReturn.items && (
            <div className="mb-2">
              <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-300 mb-1">
                <span className="w-1/2">Returned Item</span>
                <span className="w-1/6 text-right">Qty</span>
                <span className="w-1/6 text-right">Price</span>
                <span className="w-1/6 text-right">Refund</span>
              </div>
              <div className="space-y-1">
                {salesReturn.items.map((item, idx) => (
                  <div key={idx} className="text-[11px]">
                    <div className="font-medium truncate">{item.item_name}</div>
                    <div className="flex justify-between text-slate-600 text-[10px]">
                      <span className="w-1/2 text-slate-400 pl-1">#{item.item_code}</span>
                      <span className="w-1/6 text-right">
                        {Number.isInteger(item.quantity) ? item.quantity : Number(item.quantity).toFixed(3)}
                      </span>
                      <span className="w-1/6 text-right">{item.sales_price.toFixed(2)}</span>
                      <span className="w-1/6 text-right font-medium text-black">
                        {(item.quantity * item.sales_price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-b border-dashed border-black my-2.5" />

          {/* Totals */}
          {invoice && (
            <div className="space-y-1 text-[11px] mb-3">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>Rs. {invoice.subtotal.toFixed(2)}</span>
              </div>
              {invoice.total_discount > 0 && (
                <div className="flex justify-between text-slate-700">
                  <span>Discount:</span>
                  <span>-Rs. {invoice.total_discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                <span>TOTAL:</span>
                <span>Rs. {invoice.total_amount.toFixed(2)}</span>
              </div>

              <div className="pt-2 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>Payment Method:</span>
                  <span className="font-bold">{invoice.payment_method}</span>
                </div>
                {invoice.payment_method === 'CASH' && (
                  <>
                    <div className="flex justify-between">
                      <span>Cash Tendered:</span>
                      <span>Rs. {(invoice.cash_received || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Change Given:</span>
                      <span>Rs. {(invoice.cash_change || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {salesReturn && salesReturn.items && (
            <div className="space-y-1 text-[11px] mb-3">
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-black">
                <span>TOTAL REFUND:</span>
                <span>
                  Rs.{' '}
                  {salesReturn.items
                    .reduce((sum, it) => sum + it.quantity * it.sales_price, 0)
                    .toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <div className="border-b border-dashed border-black my-2.5" />

          {/* Footer */}
          <div className="text-center text-[10px] text-slate-600 space-y-1">
            <div>{receiptFooter}</div>
            <div className="text-[9px] text-slate-400">Powered by Buyra</div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 px-4 border-t border-[var(--pos-border)] flex justify-end gap-2 bg-[var(--pos-bg-subtle)] print:hidden">
          {printError && (
            <span className="mr-auto text-[11px] text-rose-600 self-center">{printError}</span>
          )}
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="pos-btn pos-btn-primary pos-btn-sm"
          >
            {isPrinting ? 'Printing...' : 'Print Receipt'}
          </button>
          <button
            onClick={onClose}
            className="pos-btn pos-btn-secondary pos-btn-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
