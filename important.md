# Mini Supermarket Offline-First POS System

Act as a senior desktop software architect, database engineer, POS systems engineer, and full-stack developer.

Build a production-ready **offline-first POS system for a real mini supermarket**.

The application must be extremely simple for cashiers, reliable during internet outages, inexpensive to operate, and easy to maintain.

Do not over-engineer the system.

---

# 1. Core Architecture

Use exactly this architecture:

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

The Electron application MUST NOT depend on the internet to complete normal POS operations.

The local SQLite database is the primary operational database for each POS terminal.

Cloudflare D1 is the central cloud database.

Cloudflare Workers is the API and synchronization layer.

---

# 2. Critical Offline-First Rule

The following rule is mandatory:

> A sale must be completed locally before any attempt is made to communicate with the cloud.

Correct flow:

```text
Cashier scans products
        ↓
Electron
        ↓
Local SQLite transaction
        ↓
Sale successfully committed
        ↓
Receipt generated/printed
        ↓
Cashier sees SALE COMPLETED
        ↓
Transaction added to sync queue
        ↓
Internet available?
        ↓
YES → Upload to Cloudflare Worker
NO  → Remain queued
```

Never do:

```text
Cashier
 ↓
Cloudflare
 ↓
D1
 ↓
Sale completed
```

The cloud must never be a dependency for completing a sale.

---

# 3. Technology Stack

Use:

### Desktop

Electron

### Frontend

React
TypeScript
Vite
Tailwind CSS

Do NOT use Next.js for the Electron application.

### Local database

SQLite

Use a reliable SQLite library suitable for Electron.

Prefer:

* better-sqlite3

or another mature SQLite implementation if there is a strong technical reason.

### Cloud database

Cloudflare D1

### Cloud API

Cloudflare Workers

### API format

REST API using JSON

### Packaging

electron-builder

### Source control

GitHub

### Hardware

USB barcode scanner
80mm thermal receipt printer

---

# 4. General Design Principles

The application must be:

* Minimalistic
* Fast
* Easy for cashiers
* Easy to learn
* Suitable for different small and medium retail shops
* Responsive within the desktop window
* Keyboard-friendly
* Barcode-scanner friendly
* Offline-first
* Reliable
* Easy to maintain
* Low-cost to operate

Do not add unnecessary animations.

Do not add unnecessary dashboards.

Do not add unnecessary SaaS-style components.

Do not make the UI look like a complicated enterprise ERP.

The POS screen should prioritize speed.

---

# 5. User Roles

Implement role-based access control.

Roles:

```text
SUPER_ADMIN
ADMIN
CASHIER
```

Potential future roles may be added, but do not build unnecessary roles now.

## SUPER_ADMIN

Can:

* Create users
* Edit users
* Disable users
* Change user roles
* Reset user access
* Configure the number of allowed users
* Manage system settings
* View all sales
* View all stock
* Cancel invoices
* Process returns
* Edit products
* Edit pricing
* View reports

## ADMIN

Can:

* Manage products
* Manage stock
* Manage categories
* View sales
* Process sales returns
* Cancel invoices if permission is granted
* View reports

Cannot:

* Change the maximum number of users
* Manage SUPER_ADMIN
* Change system-level user limits

## CASHIER

Can:

* Create invoices
* Search products
* Scan products
* Process payments
* View their own sales
* Print receipts
* Process allowed sales returns

Cannot:

* Edit product prices
* Edit stock manually
* Create users
* Change permissions
* Cancel invoices unless explicitly permitted
* Change system settings

---

# 6. User Limit

The number of users must be controlled by the SUPER_ADMIN.

Create a system configuration such as:

```text
system_settings

id
setting_key
setting_value
updated_at
updated_by
```

Example:

```text
MAX_USERS = 5
```

Only SUPER_ADMIN can modify MAX_USERS.

Before creating a user:

```text
current_active_users < MAX_USERS
```

If the limit is reached:

```text
User limit reached.
Please contact the Super Admin.
```

Do not rely only on frontend validation.

The API/backend must enforce this rule as well.

---

# 7. Main Modules

The application should contain only these main modules initially:

```text
POS
Stock
Invoices
Sales Returns
Invoice Cancellation
Users
Settings
```

Reports can be included as a simple section under the relevant modules.

Do not build unnecessary CRM, accounting, HR, payroll, loyalty, e-commerce, or AI features.

---

# 8. STOCK MODULE

The Stock/Product entity must contain:

```text
Item Code
Item Category
Item Sub Category
Item Name
Quantity
Minimum Quantity
Cost
Retail Price
Retail Discount
Wholesale Price
```

Recommended additional technical fields:

```text
id
barcode
created_at
updated_at
is_active
version
```

The UI should clearly distinguish:

```text
Cost
Retail Price
Retail Discount
Wholesale Price
```

---

# 9. Stock Rules

When a sale is completed:

```text
stock quantity decreases
```

When a sales return is completed:

```text
stock quantity increases
```

When stock is manually adjusted:

```text
stock adjustment is recorded
```

Never silently modify stock.

All stock changes must have a corresponding stock movement.

Use:

```text
PURCHASE
SALE
RETURN
ADJUSTMENT
```

for stock movement types.

---

# 10. INVENTORY DATABASE DESIGN

Create:

```text
products
categories
sub_categories
stock_movements
```

Product:

```text
products
-------------------------
id
item_code
barcode
category_id
sub_category_id
item_name
quantity
minimum_quantity
cost
retail_price
retail_discount
wholesale_price
is_active
created_at
updated_at
version
```

Categories:

```text
categories
-------------------------
id
name
created_at
updated_at
```

Subcategories:

```text
sub_categories
-------------------------
id
category_id
name
created_at
updated_at
```

Stock movements:

```text
stock_movements
-------------------------
id
product_id
movement_type
quantity
reference_type
reference_id
reason
created_by
created_at
```

---

# 11. INVOICE MODULE

Invoice must contain:

```text
Invoice Number
Cashier ID
Item Code
Item Name
Unit Price
Quantity
Unit Discount
Discount
Amount
```

Use two entities:

```text
invoices
invoice_items
```

Do NOT store multiple products in one invoice database row.

---

# 12. Invoice Database

Invoices:

```text
invoices
-------------------------
id
invoice_number
cashier_id
subtotal
total_discount
total_amount
payment_method
status
created_at
updated_at
device_id
sync_status
```

Invoice items:

```text
invoice_items
-------------------------
id
invoice_id
product_id
item_code
item_name
unit_price
quantity
unit_discount
discount
amount
created_at
```

Store item name and price in invoice_items as a historical snapshot.

If the product price changes later, old invoices must remain unchanged.

---

# 13. Invoice Status

Use:

```text
COMPLETED
CANCELLED
```

Do not delete completed invoices.

When an invoice is cancelled:

```text
invoice.status = CANCELLED
```

and create the appropriate stock reversal.

---

# 14. Sales Return

Sales return fields:

```text
Item ID
Item Code
Item Name
Item Category
Reason
Sales Price
```

Create:

```text
sales_returns
sales_return_items
```

Recommended structure:

```text
sales_returns
-------------------------
id
return_number
original_invoice_id
reason
processed_by
created_at
```

```text
sales_return_items
-------------------------
id
return_id
invoice_item_id
product_id
item_code
item_name
category_id
sales_price
quantity
reason
created_at
```

When a return is completed:

```text
stock increases
```

The original invoice must remain unchanged.

---

# 15. Invoice Cancellation

Invoice cancellation must NOT delete the invoice.

Correct:

```text
invoice
status = CANCELLED
```

Create a corresponding stock movement to reverse the sale.

Record:

```text
cancelled_by
cancelled_at
cancellation_reason
```

Only authorized users can cancel invoices.

---

# 16. PAYMENT

Support initially:

```text
CASH
CARD
```

For cash:

```text
Total
Cash Received
Change
```

Example:

```text
Total: Rs. 1,850
Cash: 2,000
Change: Rs. 150
```

Payment information should be stored with the invoice.

---

# 17. ER DIAGRAM

Use this relational structure:

```text
                         ┌─────────────────┐
                         │     USERS       │
                         ├─────────────────┤
                         │ PK id           │
                         │ username        │
                         │ password_hash    │
                         │ role             │
                         │ is_active       │
                         └────────┬────────┘
                                  │
                                  │ created_by
                                  │
          ┌───────────────────────┼────────────────────────┐
          │                       │                        │
          ▼                       ▼                        ▼
 ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
 │    INVOICES     │      │ STOCK_MOVEMENTS │      │ SALES_RETURNS   │
 ├─────────────────┤      ├─────────────────┤      ├─────────────────┤
 │ PK id           │      │ PK id           │      │ PK id           │
 │ invoice_number  │      │ product_id FK   │      │ return_number   │
 │ cashier_id FK   │      │ movement_type   │      │ invoice_id FK   │
 │ subtotal        │      │ quantity        │      │ processed_by FK │
 │ total_discount  │      │ reference_id    │      │ reason          │
 │ total_amount    │      │ created_by FK   │      │ created_at      │
 │ payment_method  │      │ created_at      │      └────────┬────────┘
 │ status          │      └────────┬────────┘               │
 │ created_at      │               │                        │
 └────────┬────────┘               │                        ▼
          │                        │              ┌─────────────────┐
          │                        │              │ RETURN_ITEMS    │
          ▼                        │              ├─────────────────┤
 ┌─────────────────┐               │              │ PK id           │
 │  INVOICE_ITEMS  │               │              │ return_id FK    │
 ├─────────────────┤               │              │ invoice_item FK │
 │ PK id           │               │              │ product_id FK   │
 │ invoice_id FK   │               │              │ item_code       │
 │ product_id FK   │               │              │ item_name       │
 │ item_code       │               │              │ sales_price     │
 │ item_name       │               │              │ quantity        │
 │ unit_price      │               │              │ reason          │
 │ quantity        │               │              └─────────────────┘
 │ unit_discount   │               │
 │ discount        │               │
 │ amount          │               │
 └────────┬────────┘               │
          │                        │
          │                        │
          ▼                        ▼
                 ┌─────────────────────────┐
                 │        PRODUCTS         │
                 ├─────────────────────────┤
                 │ PK id                   │
                 │ item_code               │
                 │ barcode                 │
                 │ category_id FK          │
                 │ sub_category_id FK      │
                 │ item_name               │
                 │ quantity                │
                 │ minimum_quantity        │
                 │ cost                    │
                 │ retail_price             │
                 │ retail_discount         │
                 │ wholesale_price         │
                 │ is_active               │
                 │ created_at              │
                 │ updated_at              │
                 └──────────┬──────────────┘
                            │
                  ┌─────────┴──────────┐
                  │                    │
                  ▼                    ▼
          ┌───────────────┐    ┌────────────────┐
          │  CATEGORIES   │    │ SUB_CATEGORIES │
          ├───────────────┤    ├────────────────┤
          │ PK id         │    │ PK id          │
          │ name          │    │ category_id FK │
          └───────────────┘    │ name           │
                               └────────────────┘
```

Additional synchronization tables:

```text
┌───────────────────────┐
│      SYNC_QUEUE       │
├───────────────────────┤
│ PK id                 │
│ entity_type           │
│ entity_id             │
│ operation             │
│ payload               │
│ status                │
│ attempts              │
│ last_error            │
│ created_at            │
│ synced_at             │
└───────────────────────┘

┌───────────────────────┐
│       DEVICES         │
├───────────────────────┤
│ PK id                 │
│ device_id             │
│ device_name           │
│ last_sync_at          │
│ is_active              │
└───────────────────────┘
```

---

# 18. Local SQLite Transactions

A sale MUST be handled as one SQLite transaction.

Example:

```text
BEGIN TRANSACTION

1. Validate products
2. Validate stock
3. Create invoice
4. Create invoice items
5. Decrease stock
6. Create stock movements
7. Create sync queue records

COMMIT
```

If any step fails:

```text
ROLLBACK
```

Nothing should be partially saved.

This is one of the most important requirements of the system.

---

# 19. Sync Queue

Every cloud-relevant local change must enter the sync queue.

Example:

```text
sync_queue

id
entity_type
entity_id
operation
payload
status
attempts
last_error
created_at
synced_at
```

Status:

```text
PENDING
SYNCING
SYNCED
FAILED
```

The application should automatically attempt synchronization when internet connectivity is available.

Do not block the POS while synchronization happens.

---

# 20. Synchronization Rules

Synchronization must be:

* asynchronous
* retryable
* idempotent
* safe against duplicate transactions

Every transaction must have a globally unique ID.

Use:

```text
UUID
```

for internal IDs.

Also maintain:

```text
device_id
```

and:

```text
client_transaction_id
```

to prevent duplicate cloud records.

If a request is sent twice because of an internet interruption, the cloud API must recognize the existing transaction and not create a duplicate.

---

# 21. Multi-Terminal Support

PC 01 and PC 02 have separate local SQLite databases.

Each installation receives a unique:

```text
device_id
```

Example:

```text
POS-KANDY-01
POS-KANDY-02
```

Each sale records the device ID.

Do not assume that two offline terminals can have perfectly synchronized stock while disconnected.

The system should treat sales as independent transactions and synchronize them when connectivity returns.

---

# 22. Cloudflare Worker API

Create only the APIs actually required.

Example:

```text
POST   /api/sync
GET    /api/products
POST   /api/products
PUT    /api/products/:id

GET    /api/categories
POST   /api/categories

GET    /api/invoices
POST   /api/invoices

POST   /api/returns

POST   /api/invoices/:id/cancel

GET    /api/users
POST   /api/users
PUT    /api/users/:id
```

The sync endpoint should be the primary mechanism for synchronizing POS transactions.

---

# 23. Cloud Database

Cloudflare D1 should contain the same core business entities:

```text
users
categories
sub_categories
products
invoices
invoice_items
sales_returns
sales_return_items
stock_movements
devices
system_settings
```

The cloud database is the central record for management/reporting.

The local database is the operational record for the POS terminal.

---

# 24. Authentication

Authentication must work locally.

The cashier should be able to log into the POS even when the internet is unavailable, assuming the account has previously been synchronized to that device.

Store only the necessary authentication information locally.

Never store plain-text passwords.

Use secure password hashing.

When internet is available, user/account changes synchronize to the terminal.

---

# 25. RLS / Authorization

Because Cloudflare D1 does not provide PostgreSQL-style Supabase RLS, implement equivalent **server-side authorization in Cloudflare Workers**.

Do not trust the Electron client.

The Worker must determine:

```text
Who is the user?
What role do they have?
What action are they attempting?
Are they allowed to perform it?
```

The client UI can hide unauthorized actions, but the Worker must enforce authorization.

Use role-based access rules equivalent to:

```text
SUPER_ADMIN
ADMIN
CASHIER
```

---

# 26. POS UI

The POS screen must be the simplest screen in the application.

Suggested layout:

```text
┌───────────────────────────────────────────────────────┐
│ MINI SUPER POS                    Cashier: CASH01    │
├───────────────────────────────────────────────────────┤
│ Barcode / Item Code                                   │
│ [________________________________________] [SCAN]     │
├───────────────────────────────────────────────────────┤
│ Item             Qty      Price      Disc.    Amount │
│                                                       │
│ Coca Cola         2        250         0       500   │
│ Bread             1        180         0       180   │
│ Biscuit           2        150        10       290   │
│                                                       │
├───────────────────────────────────────────────────────┤
│                              Subtotal       970       │
│                              Discount        10       │
│                              TOTAL          960       │
│                                                       │
│        [ CASH ]                 [ CARD ]              │
└───────────────────────────────────────────────────────┘
```

Large buttons.

Large totals.

Minimal navigation.

Keyboard shortcuts where useful.

Barcode scanner input must work without mouse interaction.

---

# 27. Stock UI

Use a simple table:

```text
Item Code | Item Name | Category | Stock | Min | Cost | Retail | Wholesale
```

Highlight:

```text
Stock <= Minimum Quantity
```

as low stock.

Do not use excessive colors.

---

# 28. Invoice UI

Provide:

```text
Invoice Number
Date/Time
Cashier
Items
Subtotal
Discount
Total
Payment Method
```

Allow printing.

Allow searching previous invoices.

---

# 29. Return UI

Cashier/Admin should search an invoice.

Then:

```text
Invoice
 ↓
Select item
 ↓
Enter return quantity
 ↓
Select reason
 ↓
Confirm
 ↓
Stock increases
 ↓
Return recorded
```

Never delete the original sale.

---

# 30. Invoice Cancellation UI

Search invoice.

Show:

```text
Invoice details
Items
Total
Cashier
Date
```

Then:

```text
Cancel Invoice
```

Require cancellation reason.

Require appropriate permission.

Then:

```text
invoice → CANCELLED

stock → reversed

audit record → created
```

---

# 31. Audit Trail

Keep a simple audit log for important actions:

```text
Login
Product price change
Stock adjustment
Invoice cancellation
Sales return
User creation
User modification
User disabling
System setting change
```

Fields:

```text
id
user_id
action
entity_type
entity_id
details
created_at
device_id
```

---

# 32. UI Design

Design the application as a **generic retail POS**, not specifically for one supermarket.

Visual direction:

* Minimal
* Professional
* Neutral
* Clean
* High contrast
* Fast
* Desktop optimized
* No unnecessary gradients
* No excessive cards
* No marketing-style elements
* No advertisements
* No promotional banners
* No unnecessary icons
* No distracting animations

The application should feel like software used at a real checkout counter.

---

# 33. Navigation

Use a simple sidebar:

```text
POS

Stock
  Products
  Categories

Invoices

Sales Returns

Reports

Users

Settings
```

Cashiers should see only the sections they are authorized to use.

---

# 34. Error Handling

Never allow an application crash to lose a sale.

Show clear messages such as:

```text
Insufficient stock.

Product not found.

Invalid quantity.

Unable to print receipt.

Invoice saved locally and waiting for synchronization.

Cloud synchronization temporarily unavailable.
```

Never show technical errors such as:

```text
SQLITE_CONSTRAINT_FOREIGNKEY
```

to the cashier.

Technical errors should go to logs.

---

# 35. Connection Status

Show a small status indicator:

```text
● Online
```

or:

```text
● Offline
```

and when there are pending records:

```text
● Offline
12 transactions waiting to sync
```

This should be subtle and not interfere with the POS.

---

# 36. Development Phases

Build the application in these phases.

## Phase 1 — Project Foundation

Create:

```text
Electron
React
TypeScript
Vite
Tailwind
SQLite
electron-builder
```

Create:

```text
main process
preload
renderer
database layer
IPC layer
```

Establish secure Electron architecture.

Do not expose Node.js directly to the renderer.

---

## Phase 2 — Database

Create SQLite migrations.

Implement:

```text
users
categories
sub_categories
products
invoices
invoice_items
sales_returns
sales_return_items
stock_movements
devices
sync_queue
system_settings
audit_logs
```

Add indexes for:

```text
barcode
item_code
invoice_number
created_at
product_id
```

---

## Phase 3 — Authentication

Implement:

```text
SUPER_ADMIN
ADMIN
CASHIER
```

Implement local authentication.

Implement permissions.

Implement maximum-user configuration.

---

## Phase 4 — Stock

Build:

```text
Categories
Subcategories
Products
Stock
Stock adjustment
Low stock
```

---

## Phase 5 — POS

Build:

```text
Barcode scanning
Product search
Cart
Quantity
Discount
Total
Cash
Card
Receipt
```

Use SQLite transactions.

---

## Phase 6 — Returns and Cancellation

Build:

```text
Sales return
Invoice cancellation
Stock reversal
Audit trail
```

---

## Phase 7 — Synchronization

Build:

```text
sync_queue
device_id
online detection
background sync
retry mechanism
idempotency
conflict handling
```

Test extensively with the internet disconnected.

---

## Phase 8 — Cloudflare

Create:

```text
Cloudflare Worker
Cloudflare D1
REST API
Authentication verification
Authorization
Sync endpoints
```

---

## Phase 9 — Reports

Only basic reports:

```text
Today's Sales
Daily Sales
Monthly Sales
Product Sales
Low Stock
Stock Value
```

Do not build advanced analytics yet.

---

## Phase 10 — Hardware

Test with:

```text
USB barcode scanner
80mm thermal printer
```

Verify:

```text
scan → sale → SQLite → receipt
```

with internet completely disconnected.

---

# 37. Testing Requirements

Before calling the system production-ready, test:

### Offline sale

```text
Disconnect internet
↓
Scan product
↓
Complete sale
↓
Print receipt
↓
Verify SQLite
```

### Synchronization

```text
Reconnect internet
↓
Pending transaction uploads
↓
Cloud confirms
↓
Local transaction becomes SYNCED
```

### Duplicate prevention

Simulate:

```text
Upload starts
↓
Internet disconnects
↓
Request may have reached server
↓
Retry
```

Verify only one invoice exists.

### Two POS terminals

```text
PC01 offline
PC02 online
```

Both sell the same product.

Reconnect PC01.

Verify both transactions synchronize correctly.

### Cancellation

Verify stock reversal.

### Return

Verify stock increase.

### User permissions

Test every role.

---

# 38. Important Development Rule

Do not build the entire application in one huge generated code dump.

Build and test in phases.

At the end of every phase:

1. Run the application.
2. Test the feature.
3. Fix errors.
4. Commit to Git.
5. Then continue.

Never proceed while the database layer or transaction logic is broken.

---

# 39. Deliverables

The final project should contain:

```text
mini-supermarket-pos/

├── electron/
│   ├── main/
│   ├── preload/
│   └── ipc/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   └── types/
│
├── database/
│   ├── migrations/
│   ├── repositories/
│   └── seed/
│
├── sync/
│   ├── queue/
│   ├── uploader/
│   └── conflict/
│
├── cloudflare/
│   └── worker/
│
├── tests/
│
├── docs/
│
├── electron-builder.yml
├── package.json
└── README.md
```

---

# 40. First Task

Do NOT immediately implement every feature.

Start with Phase 1 only.

Create a working Electron + React + TypeScript + Vite + Tailwind application.

Then implement:

```text
Electron main process
Electron preload
Secure IPC
React renderer
SQLite connection
Database migration system
```

Create the initial database schema.

Show the database connection working.

Then stop and wait for the next phase.

Do not add unnecessary functionality before the foundation is tested.

The application must remain offline-first throughout the entire development process.
