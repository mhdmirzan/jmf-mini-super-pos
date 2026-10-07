import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  productService,
  stockService,
} from '../services/api';
import type { Product, StockMovement } from '../types';
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
  ConfirmDialog,
  PageHeader,
  Toast,
  EmptyState,
} from '../components/common';
import { effectiveWholesalePrice } from '../utils/pricing';

type ItemCodeStatus = 'idle' | 'checking' | 'available' | 'exists';

export default function ProductsPage() {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const canManageProducts = isSuperAdmin || userRole === 'ADMIN';

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemCodeStatus, setItemCodeStatus] = useState<ItemCodeStatus>('idle');
  const itemCodeCheckSeq = useRef(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ALL' | 'INACTIVE'>('ACTIVE');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [productMovements, setProductMovements] = useState<StockMovement[]>([]);

  // Feedback
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const playFeedbackSound = (type: 'success' | 'warning' | 'error') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        // Pleasant rising two-tone chime
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.14, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.32);
        osc.start();
        osc.stop(ctx.currentTime + 0.32);
      } else if (type === 'warning') {
        // Soft double beep for duplicate / already exists
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(440, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // Audio blocked / unsupported
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
  };

  // Form State
  const [formData, setFormData] = useState({
    itemCode: '',
    itemName: '',
    unit: 'PCS' as 'PCS' | 'KG',
    quantity: 0,
    minimumQuantity: 5,
    cost: 0,
    retailPrice: 0,
    retailDiscount: 0,
    wholesalePrice: 0,
    isActive: 1,
  });

  const [adjustForm, setAdjustForm] = useState({
    quantityChange: 0,
    reason: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const pRes = await productService.list({
        search: searchQuery || undefined,
        lowStockOnly: lowStockOnly || undefined,
        isActive: statusFilter === 'ALL' ? undefined : (statusFilter === 'ACTIVE'),
      });
      if (pRes.success && pRes.products) {
        setProducts(pRes.products);
      }
    } catch (err: any) {
      showToast('Error loading stock: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, lowStockOnly, statusFilter]);

  // After scan/type: green if item code is free, red if it already exists
  useEffect(() => {
    const modalOpen = isAddModalOpen || editingProduct !== null;
    const code = formData.itemCode.trim().toUpperCase();

    if (!modalOpen || !code) {
      setItemCodeStatus('idle');
      return;
    }

    setItemCodeStatus('checking');
    const seq = ++itemCodeCheckSeq.current;
    const timer = window.setTimeout(async () => {
      try {
        const res = await productService.list({ search: code });
        if (seq !== itemCodeCheckSeq.current) return;

        const match = (res.success && res.products
          ? res.products.find((p) => (p.item_code || '').toUpperCase() === code)
          : null) || null;

        if (match && (!editingProduct || match.id !== editingProduct.id)) {
          setItemCodeStatus('exists');
        } else {
          setItemCodeStatus('available');
        }
      } catch {
        if (seq === itemCodeCheckSeq.current) {
          setItemCodeStatus('idle');
        }
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [formData.itemCode, isAddModalOpen, editingProduct]);

  const openAddModal = () => {
    setItemCodeStatus('idle');
    setFormData({
      itemCode: '',
      itemName: '',
      unit: 'PCS',
      quantity: 0,
      minimumQuantity: 5,
      cost: 0,
      retailPrice: 0,
      retailDiscount: 0,
      wholesalePrice: 0,
      isActive: 1,
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = async (product: Product) => {
    setItemCodeStatus('idle');
    setEditingProduct(product);
    setFormData({
      itemCode: product.item_code,
      itemName: product.item_name,
      unit: ((product.unit || '').toUpperCase() === 'KG' ? 'KG' : 'PCS') as 'PCS' | 'KG',
      quantity: product.quantity,
      minimumQuantity: product.minimum_quantity,
      cost: product.cost,
      retailPrice: product.retail_price,
      retailDiscount: product.retail_discount,
      wholesalePrice: product.wholesale_price,
      isActive: product.is_active,
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.itemCode.trim() || !formData.itemName.trim()) {
      showToast('Item code and product name are mandatory', 'error');
      return;
    }
    if (formData.retailPrice < 0) {
      showToast('Retail price must be a valid positive amount', 'error');
      return;
    }

    try {
      if (editingProduct) {
        const res = await productService.update({
          id: editingProduct.id,
          itemCode: formData.itemCode.trim().toUpperCase(),
          itemName: formData.itemName.trim(),
          unit: formData.unit || 'PCS',
          minimumQuantity: Number(formData.minimumQuantity),
          cost: isSuperAdmin ? Number(formData.cost) : Number(editingProduct.cost || 0),
          retailPrice: Number(formData.retailPrice),
          retailDiscount: Number(formData.retailDiscount),
          wholesalePrice: Number(formData.wholesalePrice),
          isActive: formData.isActive,
        });

        if (res.success) {
          showToast('Product updated successfully', 'success');
          setEditingProduct(null);
          loadData();
        } else {
          showToast(res.error || 'Failed to update product', 'error');
        }
      } else {
        const res = await productService.create({
          itemCode: formData.itemCode.trim().toUpperCase(),
          itemName: formData.itemName.trim(),
          unit: formData.unit || 'PCS',
          quantity: Number(formData.quantity) || 0,
          minimumQuantity: Number(formData.minimumQuantity) || 5,
          cost: isSuperAdmin ? (Number(formData.cost) || 0) : 0,
          retailPrice: Number(formData.retailPrice) || 0,
          retailDiscount: Number(formData.retailDiscount) || 0,
          wholesalePrice: Number(formData.wholesalePrice) || 0,
          createdBy: user?.id,
        });

        if (res.success) {
          playFeedbackSound('success');
          showToast('Product created successfully', 'success');
          setItemCodeStatus('idle');
          setFormData({
            itemCode: '',
            itemName: '',
            unit: formData.unit || 'PCS',
            quantity: 0,
            minimumQuantity: formData.minimumQuantity || 5,
            cost: 0,
            retailPrice: 0,
            retailDiscount: 0,
            wholesalePrice: 0,
            isActive: 1,
          });
          loadData();
        } else {
          const errMsg = res.error || 'Failed to create product';
          const isDuplicate = /already exists/i.test(errMsg);
          playFeedbackSound(isDuplicate ? 'warning' : 'error');
          showToast(errMsg, isDuplicate ? 'warning' : 'error');
        }
      }
    } catch (err: any) {
      playFeedbackSound('error');
      showToast(err.message || 'Error saving product', 'error');
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      const res = await productService.delete(deletingProduct.id);
      if (res.success) {
        showToast(res.message || 'Product deleted successfully', 'success');
        setDeletingProduct(null);
        if (editingProduct && editingProduct.id === deletingProduct.id) {
          setEditingProduct(null);
        }
        loadData();
      } else {
        showToast(res.error || 'Failed to delete product', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error deleting product', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Stock Adjustment
  const openAdjustModal = (product: Product) => {
    setAdjustingProduct(product);
    setAdjustForm({
      quantityChange: 0,
      reason: '',
    });
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    if (adjustForm.quantityChange === 0) {
      showToast('Adjustment quantity cannot be 0', 'error');
      return;
    }
    if (!adjustForm.reason.trim()) {
      showToast('Reason for adjustment is mandatory', 'error');
      return;
    }

    try {
      const res = await stockService.adjust({
        productId: adjustingProduct.id,
        quantity: Number(adjustForm.quantityChange),
        reason: adjustForm.reason.trim(),
        adjustedBy: user?.id,
      });

      if (res.success) {
        showToast('Stock adjusted successfully', 'success');
        setAdjustingProduct(null);
        loadData();
      } else {
        showToast(res.error || 'Failed to adjust stock', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error adjusting stock', 'error');
    }
  };

  // View Stock History
  const openHistoryModal = async (product: Product) => {
    setHistoryProduct(product);
    const res = await stockService.movements({ productId: product.id });
    if (res.success && res.movements) {
      setProductMovements(res.movements);
    }
  };

  const lowStockCount = products.filter((p) => p.quantity <= p.minimum_quantity).length;

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
        title="Stock"
        subtitle="Product inventory and price management"
        count={products.length}
        actions={
          <div className="flex items-center gap-2">
            {lowStockCount > 0 && (
              <Button
                variant={lowStockOnly ? 'danger' : 'secondary'}
                size="sm"
                onClick={() => setLowStockOnly(!lowStockOnly)}
              >
                {lowStockOnly ? 'Showing Low Stock' : `${lowStockCount} Low Stock`}
              </Button>
            )}

            {canManageProducts && (
              <Button
                variant="primary"
                size="sm"
                onClick={openAddModal}
              >
                + Add Product
              </Button>
            )}
          </div>
        }
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-wrap gap-2 items-center shrink-0 py-1">
        <div className="flex-1 min-w-[240px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product code or name..."
          />
        </div>

        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            options={[
              { value: 'ACTIVE', label: 'Active Products' },
              { value: 'ALL', label: 'All Products' },
              { value: 'INACTIVE', label: 'Archived / Inactive' },
            ]}
          />
        </div>

        {(searchQuery || lowStockOnly || statusFilter !== 'ACTIVE') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setLowStockOnly(false);
              setStatusFilter('ACTIVE');
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Products Data Table */}
      <div className="pos-card flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Product</TableHead>
              <TableHead align="center">Unit</TableHead>
              <TableHead align="right">Stock</TableHead>
              <TableHead align="right">Min Alert</TableHead>
              {isSuperAdmin && <TableHead align="right">Cost</TableHead>}
              <TableHead align="right">Retail</TableHead>
              <TableHead align="right">Wholesale</TableHead>
              <TableHead align="center">Status</TableHead>
              <TableHead align="right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 10 : 9} className="py-12 text-center text-[var(--pos-text-muted)]">
                  Loading stock data...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 10 : 9} className="py-12 text-center">
                  <EmptyState
                    title="No products found"
                    description="Try adjusting your search criteria or add a new product."
                  />
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const isLowStock = p.quantity <= p.minimum_quantity;
                const isKg = (p.unit || '').toUpperCase() === 'KG';
                return (
                  <TableRow key={p.id}>
                    <TableCell monospace className="font-semibold text-xs text-[var(--pos-text)]">
                      {p.item_code}
                    </TableCell>
                    <TableCell className="font-medium text-[var(--pos-text)]">
                      {p.item_name}
                    </TableCell>
                    <TableCell align="center">
                      {isKg ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          kg
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                          pcs
                        </span>
                      )}
                    </TableCell>
                    <TableCell align="right" monospace className="text-xs">
                      {isLowStock ? (
                        <span className="text-[var(--pos-danger)] font-bold">
                          {isKg ? `${Number(p.quantity).toFixed(3)}` : `${Math.floor(p.quantity)}`}
                        </span>
                      ) : (
                        <span className="font-semibold text-[var(--pos-text)]">
                          {isKg ? `${Number(p.quantity).toFixed(3)}` : `${Math.floor(p.quantity)}`}
                        </span>
                      )}
                    </TableCell>
                    <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                      {isKg ? `${Number(p.minimum_quantity).toFixed(3)}` : `${Math.floor(p.minimum_quantity)}`}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                        {p.cost.toFixed(2)}
                      </TableCell>
                    )}
                    <TableCell align="right" monospace className="text-xs font-semibold text-[var(--pos-text)]">
                      Rs. {p.retail_price.toFixed(2)}
                      {p.retail_discount > 0 && (
                        <div className="text-[10px] text-[var(--pos-danger)]">
                          -Rs. {p.retail_discount.toFixed(2)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell align="right" monospace className="text-xs text-[var(--pos-text-muted)]">
                      Rs. {effectiveWholesalePrice(p).toFixed(2)}
                    </TableCell>
                    <TableCell align="center">
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${p.is_active
                          ? 'bg-emerald-50 text-[var(--pos-success)] border border-emerald-200'
                          : 'bg-slate-100 text-[var(--pos-text-muted)] border border-slate-200'
                          }`}
                      >
                        {p.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canManageProducts && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditModal(p)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openAdjustModal(p)}
                            >
                              Adjust
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openHistoryModal(p)}
                          title="Audit Trail"
                        >
                          History
                        </Button>
                        {canManageProducts && (
                          <Button
                            variant="danger"
                            size="sm"
                            className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200"
                            onClick={() => setDeletingProduct(p)}
                            title="Delete Product"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Product Dialog (Clean Grouped Form per Section 18) */}
      <Dialog
        isOpen={isAddModalOpen || editingProduct !== null}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProduct(null);
          setItemCodeStatus('idle');
        }}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="lg"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {/* SECTION 1: PRODUCT INFORMATION */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--pos-text-muted)] mb-2 border-b border-[var(--pos-border)] pb-1">
              Product Information
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <Input
                label="Item Code *"
                required
                value={formData.itemCode}
                onChange={(e) =>
                  setFormData({ ...formData, itemCode: e.target.value.toUpperCase() })
                }
                monospace
                autoFocus={!editingProduct}
                error={itemCodeStatus === 'exists' ? 'Item code already exists' : undefined}
                helperText={
                  itemCodeStatus === 'available'
                    ? 'Item code is available'
                    : itemCodeStatus === 'checking'
                      ? 'Checking item code…'
                      : undefined
                }
                rightIcon={
                  itemCodeStatus === 'exists' ? (
                    <svg className="w-5 h-5 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-label="Item code already exists">
                      <circle cx="12" cy="12" r="9" strokeWidth="2" />
                      <path strokeLinecap="round" strokeWidth="2" d="M15 9l-6 6M9 9l6 6" />
                    </svg>
                  ) : itemCodeStatus === 'available' ? (
                    <svg className="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-label="Item code available">
                      <circle cx="12" cy="12" r="9" strokeWidth="2" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.5 12.5l2.5 2.5 4.5-5" />
                    </svg>
                  ) : itemCodeStatus === 'checking' ? (
                    <span className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-500 animate-spin" aria-label="Checking" />
                  ) : undefined
                }
              />
            </div>
            <div className="mt-3">
              <Input
                label="Product Name *"
                required
                value={formData.itemName}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, itemName: e.target.value }))
                }
              />
            </div>

            {/* Measurement Unit Selection (Prominent in Section 1) */}
            <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
                Measurement Unit *
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      unit: 'PCS',
                      quantity: Math.floor(prev.quantity),
                      minimumQuantity: Math.floor(prev.minimumQuantity),
                    }));
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${(formData.unit || '').toUpperCase() === 'PCS'
                    ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${(formData.unit || '').toUpperCase() === 'PCS' ? 'bg-blue-600' : 'bg-slate-300'}`}></span>
                  Pieces (Count / Pcs)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData((prev) => ({
                      ...prev,
                      unit: 'KG',
                    }));
                  }}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border text-xs font-bold transition-all cursor-pointer ${(formData.unit || '').toUpperCase() === 'KG'
                    ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-500/20 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${(formData.unit || '').toUpperCase() === 'KG' ? 'bg-amber-600' : 'bg-slate-300'}`}></span>
                  Kilograms (Weight / Kg)
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 2: PRICING */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--pos-text-muted)] mb-2 border-b border-[var(--pos-border)] pb-1">
              Pricing
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {isSuperAdmin && (
                <Input
                  label="Cost Price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, cost: parseFloat(e.target.value) || 0 }))
                  }
                  monospace
                />
              )}
              <Input
                label="Retail Price *"
                type="number"
                step="0.01"
                min="0"
                required
                value={formData.retailPrice}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    retailPrice: parseFloat(e.target.value) || 0,
                  }))
                }
                monospace
              />
              <Input
                label="Retail Discount"
                type="number"
                step="0.01"
                min="0"
                value={formData.retailDiscount}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    retailDiscount: parseFloat(e.target.value) || 0,
                  }))
                }
                monospace
              />
              <Input
                label="Wholesale Price"
                type="number"
                step="0.01"
                min="0"
                value={formData.wholesalePrice}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    wholesalePrice: parseFloat(e.target.value) || 0,
                  }))
                }
                monospace
              />
            </div>
          </div>

          {/* SECTION 3: INVENTORY */}
          <div className="pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--pos-text-muted)] mb-2 border-b border-[var(--pos-border)] pb-1">
              Inventory & Thresholds
            </h3>
            <div className={`grid ${editingProduct ? 'grid-cols-2' : 'grid-cols-2'} gap-3`}>
              {!editingProduct && (
                <Input
                  label={`Initial Stock (${(formData.unit || '').toUpperCase() === 'KG' ? 'Kilograms - e.g. 1.500' : 'Pieces - Integer Only'})`}
                  type="number"
                  step={(formData.unit || '').toUpperCase() === 'KG' ? 'any' : '1'}
                  min="0"
                  value={(formData.unit || '').toUpperCase() === 'KG' ? formData.quantity : (formData.quantity === 0 ? 0 : Math.floor(formData.quantity))}
                  onKeyDown={(e) => {
                    if ((formData.unit || '').toUpperCase() === 'PCS' && (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '+')) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    if ((formData.unit || '').toUpperCase() === 'PCS') {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      setFormData((prev) => ({
                        ...prev,
                        quantity: clean === '' ? 0 : parseInt(clean, 10),
                      }));
                    } else {
                      setFormData((prev) => ({
                        ...prev,
                        quantity: parseFloat(e.target.value) || 0,
                      }));
                    }
                  }}
                  monospace
                />
              )}
              <Input
                label={`Min Alert Stock (${(formData.unit || '').toUpperCase() === 'KG' ? 'Kilograms - e.g. 2.000' : 'Pieces - Integer Only'})`}
                type="number"
                step={(formData.unit || '').toUpperCase() === 'KG' ? 'any' : '1'}
                min="0"
                value={(formData.unit || '').toUpperCase() === 'KG' ? formData.minimumQuantity : (formData.minimumQuantity === 0 ? 0 : Math.floor(formData.minimumQuantity))}
                onKeyDown={(e) => {
                  if ((formData.unit || '').toUpperCase() === 'PCS' && (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '+')) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  if ((formData.unit || '').toUpperCase() === 'PCS') {
                    const clean = e.target.value.replace(/[^0-9]/g, '');
                    setFormData((prev) => ({
                      ...prev,
                      minimumQuantity: clean === '' ? 0 : parseInt(clean, 10),
                    }));
                  } else {
                    setFormData((prev) => ({
                      ...prev,
                      minimumQuantity: parseFloat(e.target.value) || 0,
                    }));
                  }
                }}
                monospace
              />
              {editingProduct && (
                <Select
                  label="Status"
                  value={formData.isActive}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isActive: parseInt(e.target.value, 10),
                    }))
                  }
                  options={[
                    { value: 1, label: 'Active' },
                    { value: 0, label: 'Inactive' },
                  ]}
                />
              )}
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-[var(--pos-border)] flex items-center justify-between gap-2">
            <div>
              {editingProduct && canManageProducts && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200"
                  onClick={() => setDeletingProduct(editingProduct)}
                >
                  Delete Product
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingProduct ? 'Save Product' : 'Create Product'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* Adjust Stock Dialog */}
      {adjustingProduct && (() => {
        const isAdjKg = (adjustingProduct.unit || '').toUpperCase() === 'KG';
        return (
          <Dialog
            isOpen={true}
            onClose={() => setAdjustingProduct(null)}
            title={`Adjust Stock: ${adjustingProduct.item_name}`}
            size="sm"
          >
            <form onSubmit={handleAdjustStock} className="space-y-3">
              <div className="text-xs text-[var(--pos-text-muted)]">
                Current Stock:{' '}
                <strong className="font-mono text-[var(--pos-text)]">
                  {isAdjKg
                    ? `${Number(adjustingProduct.quantity).toFixed(3)} Kilograms`
                    : `${Math.floor(adjustingProduct.quantity)} Pieces`}
                </strong>
              </div>

              <Input
                label={`Quantity Adjustment (+ restock, - reduce) [${isAdjKg ? 'Kilograms' : 'Pieces - Integer Only'}]`}
                type="number"
                step={isAdjKg ? 'any' : '1'}
                required
                value={adjustForm.quantityChange}
                onKeyDown={(e) => {
                  if (!isAdjKg && (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E')) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  if (!isAdjKg) {
                    const clean = e.target.value.replace(/[^0-9-]/g, '');
                    setAdjustForm({
                      ...adjustForm,
                      quantityChange: clean === '' || clean === '-' ? 0 : parseInt(clean, 10),
                    });
                  } else {
                    setAdjustForm({
                      ...adjustForm,
                      quantityChange: parseFloat(e.target.value) || 0,
                    });
                  }
                }}
                helperText={`Resulting stock will be: ${(adjustingProduct.quantity + adjustForm.quantityChange).toFixed(isAdjKg ? 3 : 0)} ${isAdjKg ? 'Kilograms' : 'Pieces'}`}
                monospace
              />

              <Input
                label="Reason for Adjustment *"
                required
                value={adjustForm.reason}
                onChange={(e) =>
                  setAdjustForm({ ...adjustForm, reason: e.target.value })
                }
                placeholder="e.g., Physical count adjustment, damaged item"
              />

              <div className="pt-3 border-t border-[var(--pos-border)] flex justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAdjustingProduct(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Record Adjustment
                </Button>
              </div>
            </form>
          </Dialog>
        );
      })()}

      {/* Stock History Audit Dialog */}
      {historyProduct && (() => {
        const isHistKg = (historyProduct.unit || '').toUpperCase() === 'KG';
        return (
          <Dialog
            isOpen={true}
            onClose={() => setHistoryProduct(null)}
            title={`Stock Movements: ${historyProduct.item_name}`}
            subtitle={`Item Code: ${historyProduct.item_code}`}
            size="lg"
          >
            <div className="max-h-80 overflow-y-auto">
              {productMovements.length === 0 ? (
                <div className="py-8 text-center text-xs text-[var(--pos-text-muted)]">
                  No stock movements recorded for this item.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date / Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead align="right">Qty</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Ref ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productMovements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell monospace className="text-xs text-[var(--pos-text-muted)]">
                          {new Date(m.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <span className="text-[10px] font-bold uppercase text-[var(--pos-primary)]">
                            {m.movement_type}
                          </span>
                        </TableCell>
                        <TableCell align="right" monospace className="text-xs font-bold">
                          <span className={m.quantity < 0 ? 'text-[var(--pos-danger)]' : 'text-[var(--pos-success)]'}>
                            {m.quantity > 0 ? '+' : ''}
                            {isHistKg ? `${Number(m.quantity).toFixed(3)} kg` : `${m.quantity} pcs`}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-[var(--pos-text)]">
                          {m.reason || '-'}
                        </TableCell>
                        <TableCell monospace className="text-[10px] text-[var(--pos-text-muted)]">
                          {m.reference_id ? m.reference_id.slice(0, 8) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Dialog>
        );
      })()}

      {/* Delete Product Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deletingProduct !== null}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleDeleteProduct}
        title="Delete Product"
        message={
          deletingProduct ? (
            <div>
              <p className="mb-2 text-slate-800">
                Are you sure you want to delete <strong className="text-slate-900 font-bold">{deletingProduct.item_name}</strong> (Item Code: <span className="font-mono font-semibold text-slate-900">{deletingProduct.item_code}</span>)?
              </p>
              <p className="text-xs text-slate-500">
                If this item has no prior sales records, it will be completely removed. If it has past sales records, it will be archived and removed from active inventory.
              </p>
            </div>
          ) : ''
        }
        confirmText="Delete Product"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
