import type { CartItem } from '../types';

const BILL_COUNTER_KEY = 'pos_draft_bill_counter';

/** Eight-digit draft bill number for in-progress carts (before invoice is finalized). */
export function nextBillReference(): string {
  const n = parseInt(sessionStorage.getItem(BILL_COUNTER_KEY) || '0', 10) + 1;
  sessionStorage.setItem(BILL_COUNTER_KEY, String(n));
  return String(n).padStart(8, '0');
}

export function formatDeletedItemLabel(item: CartItem): string {
  const name = item.product.item_name.trim();
  const unit = (item.product.unit || 'PCS').toUpperCase();
  if (unit === 'KG') {
    const kg = Number(item.quantity);
    const kgStr =
      kg % 1 === 0 ? `${kg}kg` : `${kg.toFixed(3).replace(/\.?0+$/, '')}kg`;
    if (/\d\s*kg/i.test(name)) return name;
    return `${name} ${kgStr}`;
  }
  const pcs = Math.floor(item.quantity);
  if (pcs !== 1) return `${name} (${pcs} pcs)`;
  return name;
}

export function buildDeletionMessage(itemLabel: string, billReference: string): string {
  return `${itemLabel} has been deleted from the bill no: ${billReference}`;
}
