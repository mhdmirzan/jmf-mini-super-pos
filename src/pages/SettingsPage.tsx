import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { settingsService, systemService, auditService } from '../services/api';
import type { AuditLog } from '../types';
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
  PageHeader,
  Toast,
  EmptyState,
} from '../components/common';

export default function SettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = (user?.role || '').toUpperCase() === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<'shop' | 'system' | 'audit'>('shop');
  const [loading, setLoading] = useState(false);

  // Settings State
  const [shopName, setShopName] = useState('Mini Super');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for shopping with us! Please come again.');
  const [invoicePrefix, setInvoicePrefix] = useState('INV');
  const [returnPrefix, setReturnPrefix] = useState('RET');
  const [maxUsers, setMaxUsers] = useState('5');

  // Diagnostics State
  const [deviceId, setDeviceId] = useState('');
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [copiedDevice, setCopiedDevice] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const sRes = await settingsService.get();
      if (sRes.success && sRes.settings) {
        const map: Record<string, string> = {};
        if (Array.isArray(sRes.settings)) {
          sRes.settings.forEach((s: any) => {
            map[s.setting_key] = s.setting_value;
          });
        } else {
          Object.assign(map, sRes.settings);
        }

        if (map['SHOP_NAME']) setShopName(map['SHOP_NAME']);
        if (map['SHOP_ADDRESS']) setShopAddress(map['SHOP_ADDRESS']);
        if (map['SHOP_PHONE']) setShopPhone(map['SHOP_PHONE']);
        if (map['RECEIPT_FOOTER']) setReceiptFooter(map['RECEIPT_FOOTER']);
        if (map['INVOICE_PREFIX']) setInvoicePrefix(map['INVOICE_PREFIX']);
        if (map['RETURN_PREFIX']) setReturnPrefix(map['RETURN_PREFIX']);
        if (map['MAX_USERS']) setMaxUsers(map['MAX_USERS']);
      }

      const dRes = await systemService.getDeviceId();
      if (dRes.success) setDeviceId(dRes.deviceId);

      const dbRes = await systemService.getDbStatus();
      if (dbRes.success) setDbStatus(dbRes);

      const aRes = await auditService.list();
      if (aRes.success && aRes.logs) {
        setAuditLogs(aRes.logs);
      }
    } catch (err: any) {
      showToast('Error loading settings: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const handleSaveShopSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await settingsService.set({ key: 'SHOP_NAME', value: shopName, updatedBy: user?.id });
      await settingsService.set({ key: 'SHOP_ADDRESS', value: shopAddress, updatedBy: user?.id });
      await settingsService.set({ key: 'SHOP_PHONE', value: shopPhone, updatedBy: user?.id });
      await settingsService.set({ key: 'RECEIPT_FOOTER', value: receiptFooter, updatedBy: user?.id });
      await settingsService.set({ key: 'INVOICE_PREFIX', value: invoicePrefix, updatedBy: user?.id });
      await settingsService.set({ key: 'RETURN_PREFIX', value: returnPrefix, updatedBy: user?.id });

      showToast('Store settings and receipt layout saved', 'success');
      loadAll();
    } catch (err: any) {
      showToast(err.message || 'Error saving settings', 'error');
    }
  };

  const handleSaveSystemLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(maxUsers, 10);
    if (isNaN(num) || num < 1) {
      showToast('MAX_USERS must be at least 1', 'error');
      return;
    }

    try {
      const res = await settingsService.set({
        key: 'MAX_USERS',
        value: String(num),
        updatedBy: user?.id,
      });

      if (res.success) {
        showToast('MAX_USERS system limit updated', 'success');
        loadAll();
      } else {
        showToast(res.error || 'Failed to update limit', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating limit', 'error');
    }
  };

  const copyDeviceId = () => {
    if (!deviceId) return;
    navigator.clipboard.writeText(deviceId);
    setCopiedDevice(true);
    setTimeout(() => setCopiedDevice(false), 2000);
  };

  const filteredLogs = auditLogs.filter((log) => {
    const actionMatch = !auditActionFilter || log.action === auditActionFilter;
    const searchMatch =
      !auditSearch ||
      (log.user_name || log.username || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase());
    return actionMatch && searchMatch;
  });

  return (
    <div className="p-4 h-full flex flex-col select-none gap-3 bg-[var(--pos-bg)] overflow-y-auto">
      {/* Toast Alert */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <PageHeader
        title="Settings"
        subtitle="Store branding, receipt parameters, and system diagnostics"
      />

      {/* Tabs */}
      <div className="pos-card p-1 flex gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('shop')}
          className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
            activeTab === 'shop'
              ? 'bg-[var(--pos-primary)] text-white font-bold'
              : 'text-[var(--pos-text-muted)] hover:text-[var(--pos-text)]'
          }`}
        >
          Store & Receipt
        </button>

        {user?.role !== 'CASHIER' && (
          <>
            <button
              onClick={() => setActiveTab('system')}
              className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${
                activeTab === 'system'
                  ? 'bg-[var(--pos-primary)] text-white font-bold'
                  : 'text-[var(--pos-text-muted)] hover:text-[var(--pos-text)]'
              }`}
            >
              Hardware & Database
            </button>

            {isSuperAdmin && (
              <button
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
                  activeTab === 'audit'
                    ? 'bg-[var(--pos-primary)] text-white font-bold'
                    : 'text-[var(--pos-text-muted)] hover:text-[var(--pos-text)]'
                }`}
              >
                <span>Audit Trail</span>
                <span className="text-[10px] font-mono opacity-80">({auditLogs.length})</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        {/* Tab 1: Store & Receipt Profile */}
        {activeTab === 'shop' && (
          <div className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-7 pos-card p-4">
              <div className="mb-4 pb-2 border-b border-[var(--pos-border)]">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--pos-text)]">
                  Store Details & Receipt Header
                </h3>
              </div>

              <form onSubmit={handleSaveShopSettings} className="space-y-3">
                <Input
                  label="Supermarket / Store Name *"
                  required
                  disabled={user?.role === 'CASHIER'}
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                />

                <Input
                  label="Store Address"
                  disabled={user?.role === 'CASHIER'}
                  value={shopAddress}
                  onChange={(e) => setShopAddress(e.target.value)}
                />

                <Input
                  label="Telephone / Contact"
                  disabled={user?.role === 'CASHIER'}
                  value={shopPhone}
                  onChange={(e) => setShopPhone(e.target.value)}
                />

                <div>
                  <label className="block text-xs font-medium text-[var(--pos-text)] mb-1">
                    Receipt Footer Note
                  </label>
                  <textarea
                    rows={2}
                    disabled={user?.role === 'CASHIER'}
                    value={receiptFooter}
                    onChange={(e) => setReceiptFooter(e.target.value)}
                    className="pos-input w-full py-1.5 px-3 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Input
                    label="Invoice Prefix"
                    disabled={user?.role === 'CASHIER'}
                    value={invoicePrefix}
                    onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    helperText={`Format: ${invoicePrefix}-000001`}
                    monospace
                  />
                  <Input
                    label="Return Prefix"
                    disabled={user?.role === 'CASHIER'}
                    value={returnPrefix}
                    onChange={(e) => setReturnPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    helperText={`Format: ${returnPrefix}-000001`}
                    monospace
                  />
                </div>

                <div className="pt-3 border-t border-[var(--pos-border)] flex justify-end">
                  {user?.role === 'CASHIER' ? (
                    <span className="text-xs text-[var(--pos-text-muted)]">
                      Cashier view: Settings are read-only.
                    </span>
                  ) : (
                    <Button type="submit" variant="primary">
                      Save Store Settings
                    </Button>
                  )}
                </div>
              </form>
            </div>

            {/* Live 80mm Receipt Preview */}
            <div className="col-span-5 pos-card p-4">
              <div className="text-xs font-bold uppercase tracking-wider text-[var(--pos-text-muted)] mb-3 pb-2 border-b border-[var(--pos-border)]">
                80mm Thermal Receipt Preview
              </div>

              <div className="bg-white text-black p-4 border border-[var(--pos-border)] rounded font-mono text-xs leading-normal select-text">
                <div className="text-center pb-2 border-b border-dashed border-black">
                  <div className="font-bold text-sm uppercase">{shopName || 'STORE NAME'}</div>
                  {shopAddress && <div className="text-[11px] text-gray-700">{shopAddress}</div>}
                  {shopPhone && <div className="text-[11px] text-gray-700">Tel: {shopPhone}</div>}
                </div>

                <div className="py-2 border-b border-dashed border-black text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>Receipt No:</span>
                    <span className="font-bold">{invoicePrefix || 'INV'}-000042</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Terminal / Cashier:</span>
                    <span>POS-01 / {user?.username || 'admin'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date:</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-black">
                  <div className="flex justify-between font-bold text-[10px] mb-1">
                    <span>ITEM</span>
                    <span>QTY x PRICE</span>
                    <span>AMOUNT</span>
                  </div>
                  <div className="space-y-0.5 text-[11px]">
                    <div className="flex justify-between">
                      <span>Sample Item A</span>
                      <span>2 x 150.00</span>
                      <span className="font-bold">300.00</span>
                    </div>
                  </div>
                </div>

                <div className="py-2 border-b border-dashed border-black text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span>SUBTOTAL:</span>
                    <span>Rs. 300.00</span>
                  </div>
                  <div className="flex justify-between font-bold text-xs pt-1">
                    <span>TOTAL:</span>
                    <span>Rs. 300.00</span>
                  </div>
                </div>

                <div className="pt-2 text-center text-[10px] text-gray-600">
                  <p>{receiptFooter || 'Thank you for shopping with us!'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Terminal Hardware & Database */}
        {activeTab === 'system' && (
          <div className="space-y-3 max-w-2xl">
            {isSuperAdmin && (
              <div className="pos-card p-4">
                <div className="mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--pos-text)]">
                    Active User Limit (MAX_USERS)
                  </h3>
                  <p className="text-xs text-[var(--pos-text-muted)] mt-0.5">
                    Terminal license restriction controlling maximum active cashier accounts
                  </p>
                </div>

                <form onSubmit={handleSaveSystemLimits} className="flex items-end gap-2 max-w-xs">
                  <div className="flex-1">
                    <Input
                      label="Max Permitted Users"
                      type="number"
                      min="1"
                      required
                      value={maxUsers}
                      onChange={(e) => setMaxUsers(e.target.value)}
                      monospace
                    />
                  </div>
                  <Button type="submit" variant="primary">
                    Update Limit
                  </Button>
                </form>
              </div>
            )}

            <div className="pos-card p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--pos-text)] border-b border-[var(--pos-border)] pb-2">
                Hardware & Local SQLite Engine
              </h3>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded">
                  <span className="text-[var(--pos-text-muted)] block">Device Identifier</span>
                  <div className="font-mono font-bold text-[var(--pos-text)] mt-1 flex items-center justify-between">
                    <span className="truncate">{deviceId || 'Detecting...'}</span>
                    <button
                      type="button"
                      onClick={copyDeviceId}
                      className="text-[var(--pos-accent)] hover:underline ml-2 cursor-pointer"
                    >
                      {copiedDevice ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded">
                  <span className="text-[var(--pos-text-muted)] block">Storage Engine</span>
                  <div className="font-mono font-bold text-[var(--pos-success)] mt-1">
                    better-sqlite3 (WAL Mode)
                  </div>
                </div>

                <div className="p-3 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded">
                  <span className="text-[var(--pos-text-muted)] block">Connection Status</span>
                  <div className="font-mono font-bold text-[var(--pos-text)] mt-1">
                    {dbStatus?.connected ? '✓ Synchronous Read/Write Ready' : 'Verifying...'}
                  </div>
                </div>

                <div className="p-3 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded">
                  <span className="text-[var(--pos-text-muted)] block">Schema Tables</span>
                  <div className="font-mono font-bold text-[var(--pos-text)] mt-1">
                    {dbStatus?.tables ? `${dbStatus.tables} Tables Active` : '12 Tables Active'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Security & Operational Audit Log */}
        {activeTab === 'audit' && (
          <div className="pos-card flex flex-col h-full overflow-hidden">
            <div className="p-3 border-b border-[var(--pos-border)] flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs font-bold text-[var(--pos-text)]">
                Audit Trail ({filteredLogs.length} events)
              </span>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search user or details..."
                  className="pos-input py-1 px-2 text-xs w-48"
                />

                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="pos-select py-1 px-2 text-xs w-36"
                >
                  <option value="">All Actions</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="USER_CREATED">USER_CREATED</option>
                  <option value="USER_UPDATED">USER_UPDATED</option>
                  <option value="STOCK_ADJUSTMENT">STOCK_ADJUSTMENT</option>
                  <option value="INVOICE_CANCELLED">INVOICE_CANCELLED</option>
                  <option value="SALES_RETURN">SALES_RETURN</option>
                  <option value="SETTING_CHANGED">SETTING_CHANGED</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-12 text-center text-[var(--pos-text-muted)]">
                        No audit records match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell monospace className="text-xs text-[var(--pos-text-muted)]">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-semibold text-xs text-[var(--pos-text)]">
                          {log.user_name || log.username || log.user_id || 'System'}
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] uppercase font-bold text-[var(--pos-accent)]">
                            {log.action}
                          </span>
                        </TableCell>
                        <TableCell monospace className="text-xs text-[var(--pos-text-muted)]">
                          {log.entity_type}
                        </TableCell>
                        <TableCell monospace className="text-xs text-[var(--pos-text)]">
                          {log.details}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
