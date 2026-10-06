import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  productService,
  categoryService,
  subCategoryService,
  stockService,
} from '../services/api';
import type { Product, Category, SubCategory, StockMovement } from '../types';
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

export default function ProductsPage() {
  const { user } = useAuth();
  const userRole = (user?.role || '').toUpperCase();
  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  const canManageProducts = isSuperAdmin || userRole === 'ADMIN';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
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

  // Form State
  const [formData, setFormData] = useState({
    itemCode: '',
    categoryId: '',
    subCategoryId: '',
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
        categoryId: selectedCategory || undefined,
        lowStockOnly: lowStockOnly || undefined,
        isActive: statusFilter === 'ALL' ? undefined : (statusFilter === 'ACTIVE'),
      });
      if (pRes.success && pRes.products) {
        setProducts(pRes.products);
      }

      const cRes = await categoryService.list();
      if (cRes.success && cRes.categories) {
        setCategories(cRes.categories);
      }
    } catch (err: any) {
      showToast('Error loading stock: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery, selectedCategory, lowStockOnly, statusFilter]);

  const handleCategorySelect = async (catId: string) => {
    setFormData((prev) => ({ ...prev, categoryId: catId, subCategoryId: '' }));
    if (catId) {
      const res = await subCategoryService.list(catId);
      if (res.success && res.subCategories) {
        setSubCategories(res.subCategories);
      }
    } else {
      setSubCategories([]);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const openAddModal = () => {
    setFormData({
      itemCode: '',
      categoryId: '',
      subCategoryId: '',
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
    setSubCategories([]);
    setIsAddModalOpen(true);
  };

  const openEditModal = async (product: Product) => {
    setEditingProduct(product);
    setFormData({
      itemCode: product.item_code,
      categoryId: product.category_id || '',
      subCategoryId: product.sub_category_id || '',
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

    if (product.category_id) {
      const res = await subCategoryService.list(product.category_id);
      if (res.success && res.subCategories) {
        setSubCategories(res.subCategories);
      }
    } else {
      setSubCategories([]);
    }
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
          categoryId: formData.categoryId || null,
          subCategoryId: formData.subCategoryId || null,
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
          categoryId: formData.categoryId || undefined,
          subCategoryId: formData.subCategoryId || undefined,
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
          showToast('Product created successfully', 'success');
          setFormData({
            itemCode: '',
            categoryId: formData.categoryId,
            subCategoryId: formData.subCategoryId,
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
          showToast(res.error || 'Failed to create product', 'error');
        }
      }
    } catch (err: any) {
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
      <div className="pos-card p-3 flex flex-wrap gap-2 items-center shrink-0">
        <div className="flex-1 min-w-[240px]">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search product code or name..."
          />
        </div>

        <div className="w-56">
          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            options={[
              { value: '', label: `All Categories (${categories.length})` },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
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

        {(searchQuery || selectedCategory || lowStockOnly || statusFilter !== 'ACTIVE') && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('');
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
              <TableHead>Category</TableHead>
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
                <TableCell colSpan={isSuperAdmin ? 11 : 10} className="py-12 text-center text-[var(--pos-text-muted)]">
                  Loading stock data...
                </TableCell>
              </TableRow>
            ) : products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isSuperAdmin ? 11 : 10} className="py-12 text-center">
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
                    <TableCell className="text-xs text-[var(--pos-text-muted)]">
                      {p.category_name || '-'}
                      {p.sub_category_name && ` / ${p.sub_category_name}`}
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
                      {p.wholesale_price ? `Rs. ${p.wholesale_price.toFixed(2)}` : '-'}
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

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Select
                label="Category"
                value={formData.categoryId}
                onChange={(e) => handleCategorySelect(e.target.value)}
                options={[
                  { value: '', label: 'Select Category' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
              <Select
                label="Sub Category"
                value={formData.subCategoryId}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, subCategoryId: e.target.value }))
                }
                disabled={!formData.categoryId}
                options={[
                  { value: '', label: 'Select Sub Category' },
                  ...subCategories.map((sc) => ({ value: sc.id, label: sc.name })),
                ]}
              />
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
