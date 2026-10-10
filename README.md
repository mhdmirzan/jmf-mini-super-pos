# Buyra

Buyra is a high-speed, offline-first Point of Sale (POS) system for retail shops. Each shop configures its own store name, address, and receipt details.

Designed to never lose a sale during internet blackouts by executing all checkout operations on embedded SQLite with zero cloud dependencies.

---

## Features

- **100% Offline-First Operations:** Sales, receipts, refunds, and inventory tracking are committed locally in SQLite first.
- **Fast Cashier POS Terminal:**
  - Barcode scanner input with auto-add without mouse interaction.
  - Real-time item lookup by code or product name.
  - Cart line discounts and quantity hotkeys.
  - Cash & Card tender with fast tender calculation and real-time change display.
  - 80mm thermal receipt printing.
- **Stock & Inventory Control:**
  - Stock levels with Low-Stock threshold badges.
  - Clear separation of Cost, Retail Price, Retail Discount, and Wholesale Price.
  - Strict stock auditing: every change creates a `PURCHASE`, `SALE`, `RETURN`, or `ADJUSTMENT` movement.
- **Category & Sub-Category Hierarchy:** Dual-pane taxonomy organization.
- **Invoice Auditing & Cancellation:**
  - Invoices are never silently deleted.
  - Cancellation marks invoice as `CANCELLED`, requires a reason, and reverses stock automatically.
- **Customer Sales Returns:**
  - Invoice search, item selection, quantity validation, and automatic stock replenishment.
  - Printable 80mm sales return notes.
- **Operational Reports:**
  - Daily sales breakdown with cash vs card totals.
  - Monthly revenue summaries.
  - Product sales volume rankings.
  - Low stock replenishment alerts.
  - Total inventory valuation at cost vs retail.
- **Role-Based Access Control (RBAC):**
  - Roles: `SUPER_ADMIN`, `ADMIN`, `CASHIER`.
  - Super Admin configurable `MAX_USERS` license limit strictly enforced in the database.
- **Cloudflare Edge Sync Gateway:**
  - Cloudflare Worker + Cloudflare D1 integration.
  - Background asynchronous queue uploader with idempotency protection against duplicate transactions.

---

## Technology Stack

- **Desktop:** Electron
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS
- **Local Database:** SQLite (`better-sqlite3` with WAL mode)
- **Cloud Database:** Cloudflare D1
- **Edge API:** Cloudflare Workers
- **Packaging:** electron-builder

---

## Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Test Suite
Runs the automated offline transaction, stock deduction, sales returns, and user limit tests:
```bash
npm test
```

### 3. Build Web Bundle
```bash
npm run build:vite
```

### 4. Run Locally in Development Mode
```bash
npm run dev
```

### 5. Build Desktop Installer
```bash
npm run build
```

---

## Default Login Credentials

On first run, the local SQLite database automatically seeds an initial Super Admin account:

- **Username:** `admin`
- **Password:** `admin123`
- **Role:** `SUPER_ADMIN`

Sample retail products (Beverages, Bakery, Dairy, Grocery, Household) with barcodes and prices are also seeded automatically for testing barcode scanning and checkout out of the box.

---

## Hardware Configuration

- **Barcode Scanner:** Any standard USB barcode scanner operating in keyboard emulation mode (scans barcode + sends Enter).
- **Receipt Printer:** Standard 80mm USB / Ethernet thermal receipt printer. The preview modal is formatted for 80mm roll width.

---

## License

ISC License.
