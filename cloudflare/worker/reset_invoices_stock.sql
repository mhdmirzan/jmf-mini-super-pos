-- Clear sales/history tables and permanently remove archived products.
-- Keeps: active products, users, system_settings, devices.

DELETE FROM sales_return_items;
DELETE FROM sales_returns;
DELETE FROM invoice_items;
DELETE FROM invoices;
DELETE FROM stock_movements;
DELETE FROM approval_requests;
DELETE FROM products WHERE is_active = 0;
