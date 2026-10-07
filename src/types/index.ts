export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'CASHIER';

export interface User {
  id: string;
  username: string;
  fullName: string;
  full_name?: string;
  role: UserRole;
  is_active?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  item_code: string;
  item_name: string;
  unit?: 'PCS' | 'KG' | string;
  quantity: number;
  minimum_quantity: number;
  cost: number;
  retail_price: number;
  retail_discount: number;
  wholesale_price: number;
  is_active: number;
  created_at?: string;
  updated_at?: string;
  version?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  priceType?: 'RETAIL' | 'WHOLESALE';
  unitPrice: number;
  unitDiscount: number;
  discount: number;
  amount: number;
}

export interface BillItemDeletion {
  id: string;
  bill_reference: string;
  product_id?: string | null;
  product_name: string;
  item_code?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  line_amount: number;
  cashier_id?: string | null;
  cashier_name?: string | null;
  device_id?: string | null;
  message: string;
  seen_by_admin: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  cashier_id: string;
  cashier_name?: string;
  cashier_username?: string;
  subtotal: number;
  total_discount: number;
  total_amount: number;
  payment_method: 'CASH' | 'CARD';
  cash_received: number | null;
  cash_change: number | null;
  status: 'COMPLETED' | 'CANCELLED';
  price_type?: 'RETAIL' | 'WHOLESALE';
  cancelled_by?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  device_id?: string;
  sync_status: string;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  item_code: string;
  item_name: string;
  unit_price: number;
  quantity: number;
  unit_discount: number;
  discount: number;
  amount: number;
  price_type?: 'RETAIL' | 'WHOLESALE';
  created_at: string;
}

export interface SalesReturn {
  id: string;
  return_number: string;
  original_invoice_id: string;
  invoice_number?: string;
  reason: string;
  processed_by: string;
  processed_by_name?: string;
  created_at: string;
  items?: SalesReturnItem[];
}

export interface SalesReturnItem {
  id: string;
  return_id: string;
  invoice_item_id: string;
  product_id: string;
  item_code: string;
  item_name: string;
  sales_price: number;
  quantity: number;
  reason: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  movement_type: 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT';
  quantity: number;
  reference_type: string;
  reference_id: string;
  reason: string;
  created_by: string;
  created_by_name?: string;
  item_name?: string;
  item_code?: string;
  created_at: string;
}

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  updated_at: string;
  updated_by: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name?: string;
  username?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  device_id: string;
  created_at: string;
}
