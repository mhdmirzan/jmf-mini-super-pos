# Mini Supermarket Offline-First POS System — Architecture & Documentation

## 1. System Overview

This POS system is designed from the ground up to be **100% offline-first**. POS terminals operating at checkout counters complete sales transactions locally using SQLite before making any attempt to communicate with the cloud.

```text
                         INTERNET
                            │
                            ▼
                 ┌────────────────────┐
                 │ Cloudflare Workers │
                 │      REST API      │
                 └─────────┬──────────┘
                           │
                           ▼
                 ┌────────────────────┐
                 │   Cloudflare D1    │
                 │   SQLite Database  │
                 └─────────▲──────────┘
                           │
                         SYNC
                           │
             ┌─────────────┴─────────────┐
             │                           │
      ┌──────▼──────┐             ┌──────▼──────┐
      │ Electron POS│             │ Electron POS│
      │    PC 01    │             │    PC 02    │
      │              │             │             │
      │ Local SQLite │             │ Local SQLite│
      └──────┬───────┘             └──────┬──────┘
             │                            │
          Scanner                      Scanner
          Printer                      Printer
```

---

## 2. Core Business Principles & Rules

### Mandatory Offline-First Rule
> **A sale must be completed locally before any attempt is made to communicate with the cloud.**

The cloud database is never an operational dependency for completing a checkout sale.

### Single SQLite Transaction Guarantee
Every completed sale executes within one atomic SQLite transaction:
1. Validate products exist and are active.
2. Verify available stock (`product.quantity >= cart.quantity`).
3. Generate sequential invoice number (`INV-XXXXXX`).
4. Insert `invoices` header record.
5. Insert `invoice_items` historical snapshots (fixed price and name at moment of sale).
6. Deduct product stock (`quantity = quantity - ?`).
7. Insert `stock_movements` record (`SALE` movement type).
8. Enqueue to `sync_queue` table with status `PENDING`.
9. Commit transaction. (If any error occurs, automatic ROLLBACK ensures data integrity).

---

## 3. Technology Stack

- **Desktop Framework:** Electron
- **Frontend Framework:** React 19 + TypeScript + Vite + Tailwind CSS
- **Local Embedded Database:** SQLite (`better-sqlite3` with WAL mode & busy timeout)
- **Cloud Database:** Cloudflare D1
- **Edge API & Sync:** Cloudflare Workers
- **Desktop Packaging:** electron-builder

---

## 4. Hardware Support

### USB Barcode Scanner
- Standard HID Keyboard Emulation.
- Scans barcode and emits Enter key.
- Autofocused search input recognizes barcode immediately and adds item to cart without mouse interaction.

### 80mm Thermal Receipt Printer
- Standard 80mm roll width.
- Thermal receipt preview component with `@media print` optimized CSS.
- Automatically fits shop branding, date/time, cashier name, line items, discounts, total, cash received, and change.

---

## 5. Security & RBAC Roles

| Role | Permissions |
| :--- | :--- |
| **SUPER_ADMIN** | Manage users, configure `MAX_USERS` limit, shop settings, view all sales, cancel invoices, process returns, edit products & pricing, view reports |
| **ADMIN** | Manage products, categories, manual stock adjustments, view sales, process returns, view reports |
| **CASHIER** | Scan/search items, create invoices, process cash/card payment, print receipts, process allowed customer returns |

### Active User Limit Enforced
- System parameter `MAX_USERS` in `system_settings` is strictly controlled by `SUPER_ADMIN`.
- System enforces `active_users < MAX_USERS` both at the application UI level and inside SQLite repository transactions.
