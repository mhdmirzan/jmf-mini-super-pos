import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { categoryService, subCategoryService } from '../services/api';
import type { Category, SubCategory } from '../types';
import {
  Button,
  Input,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Dialog,
  PageHeader,
  Toast,
  EmptyState,
} from '../components/common';

export default function CategoriesPage() {
  const { hasRole } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Modal / Form state
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');

  const [subCategoryModalOpen, setSubCategoryModalOpen] = useState(false);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  const [subCategoryName, setSubCategoryName] = useState('');

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await categoryService.list();
      if (res.success && res.categories) {
        setCategories(res.categories);
        if (!selectedCategory && res.categories.length > 0) {
          setSelectedCategory(res.categories[0]);
        }
      }
    } catch (err: any) {
      showToast('Error loading categories: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSubCategories = async (catId: string) => {
    try {
      const res = await subCategoryService.list(catId);
      if (res.success && res.subCategories) {
        setSubCategories(res.subCategories);
      }
    } catch (err: any) {
      showToast('Error loading sub-categories: ' + err.message, 'error');
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadSubCategories(selectedCategory.id);
    } else {
      setSubCategories([]);
    }
  }, [selectedCategory]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    try {
      if (editingCategory) {
        const res = await categoryService.update({
          id: editingCategory.id,
          name: categoryName.trim(),
        });
        if (res.success) {
          showToast('Category updated successfully', 'success');
          setCategoryModalOpen(false);
          setEditingCategory(null);
          loadCategories();
        } else {
          showToast(res.error || 'Failed to update category', 'error');
        }
      } else {
        const res = await categoryService.create({
          name: categoryName.trim(),
        });
        if (res.success) {
          showToast('Category created successfully', 'success');
          setCategoryModalOpen(false);
          loadCategories();
        } else {
          showToast(res.error || 'Failed to create category', 'error');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving category', 'error');
    }
  };

  const handleSaveSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subCategoryName.trim() || !selectedCategory) return;

    try {
      if (editingSubCategory) {
        const res = await subCategoryService.update({
          id: editingSubCategory.id,
          name: subCategoryName.trim(),
        });
        if (res.success) {
          showToast('Sub-category updated successfully', 'success');
          setSubCategoryModalOpen(false);
          setEditingSubCategory(null);
          loadSubCategories(selectedCategory.id);
        } else {
          showToast(res.error || 'Failed to update sub-category', 'error');
        }
      } else {
        const res = await subCategoryService.create({
          categoryId: selectedCategory.id,
          name: subCategoryName.trim(),
        });
        if (res.success) {
          showToast('Sub-category created successfully', 'success');
          setSubCategoryModalOpen(false);
          loadSubCategories(selectedCategory.id);
        } else {
          showToast(res.error || 'Failed to create sub-category', 'error');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error saving sub-category', 'error');
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

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

      {/* Header */}
      <PageHeader
        title="Categories"
        subtitle="Supermarket departments and product classifications"
        count={categories.length}
        actions={
          hasRole('ADMIN') && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingCategory(null);
                setCategoryName('');
                setCategoryModalOpen(true);
              }}
            >
              + Add Category
            </Button>
          )
        }
      />

      {/* Main Dual-Column Panel */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* Left: Categories Table (7 Cols) */}
        <div className="col-span-7 pos-card flex flex-col overflow-hidden">
          <div className="p-3 border-b border-[var(--pos-border)] flex items-center justify-between gap-3 shrink-0">
            <div className="flex-1">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search category name..."
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead align="center">Products</TableHead>
                  <TableHead align="center">Sub-Categories</TableHead>
                  {hasRole('ADMIN') && <TableHead align="right">Action</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center text-[var(--pos-text-muted)]">
                      Loading categories...
                    </TableCell>
                  </TableRow>
                ) : filteredCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-12 text-center">
                      <EmptyState
                        title="No categories found"
                        description="Add your first supermarket category or department."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCategories.map((c) => {
                    const isSelected = selectedCategory?.id === c.id;
                    return (
                      <TableRow
                        key={c.id}
                        selected={isSelected}
                        onClick={() => setSelectedCategory(c)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-semibold text-xs text-[var(--pos-text)]">
                          {c.name}
                        </TableCell>
                        <TableCell align="center" monospace className="text-xs text-[var(--pos-text-muted)]">
                          {c.product_count || 0}
                        </TableCell>
                        <TableCell align="center" monospace className="text-xs text-[var(--pos-text-muted)]">
                          {c.sub_category_count || 0}
                        </TableCell>
                        {hasRole('ADMIN') && (
                          <TableCell align="right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCategory(c);
                                setCategoryName(c.name);
                                setCategoryModalOpen(true);
                              }}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Right: Sub-Categories Context Panel (5 Cols) */}
        <div className="col-span-5 pos-card flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--pos-border)] bg-[var(--pos-bg-subtle)] flex items-center justify-between shrink-0">
            <div>
              <span className="text-xs font-bold text-[var(--pos-text)] uppercase tracking-wider">
                Sub-Categories
              </span>
              {selectedCategory && (
                <span className="text-xs text-[var(--pos-text-muted)] ml-2">
                  in {selectedCategory.name}
                </span>
              )}
            </div>
            {hasRole('ADMIN') && selectedCategory && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingSubCategory(null);
                  setSubCategoryName('');
                  setSubCategoryModalOpen(true);
                }}
              >
                + Add Sub-Cat
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {!selectedCategory ? (
              <div className="h-full flex items-center justify-center p-6 text-xs text-[var(--pos-text-muted)]">
                Select a category on the left to view sub-categories.
              </div>
            ) : subCategories.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-6">
                <EmptyState
                  title="No sub-categories"
                  description={`No sub-categories created under ${selectedCategory.name}.`}
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sub-Category Name</TableHead>
                    {hasRole('ADMIN') && <TableHead align="right">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subCategories.map((sc) => (
                    <TableRow key={sc.id}>
                      <TableCell className="font-medium text-xs text-[var(--pos-text)]">
                        {sc.name}
                      </TableCell>
                      {hasRole('ADMIN') && (
                        <TableCell align="right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingSubCategory(sc);
                              setSubCategoryName(sc.name);
                              setSubCategoryModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {/* Category Dialog */}
      {categoryModalOpen && (
        <Dialog
          isOpen={true}
          onClose={() => setCategoryModalOpen(false)}
          title={editingCategory ? 'Edit Category' : 'Create Category'}
          size="sm"
        >
          <form onSubmit={handleSaveCategory} className="space-y-3">
            <Input
              label="Category Name *"
              required
              autoFocus
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="e.g., Dairy, Beverages, Bakery"
            />
            <div className="pt-3 border-t border-[var(--pos-border)] flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCategoryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Sub-Category Dialog */}
      {subCategoryModalOpen && (
        <Dialog
          isOpen={true}
          onClose={() => setSubCategoryModalOpen(false)}
          title={editingSubCategory ? 'Edit Sub-Category' : 'Create Sub-Category'}
          subtitle={`Under category: ${selectedCategory?.name}`}
          size="sm"
        >
          <form onSubmit={handleSaveSubCategory} className="space-y-3">
            <Input
              label="Sub-Category Name *"
              required
              autoFocus
              value={subCategoryName}
              onChange={(e) => setSubCategoryName(e.target.value)}
              placeholder="e.g., Fresh Milk, Cheese, Yogurt"
            />
            <div className="pt-3 border-t border-[var(--pos-border)] flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSubCategoryModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {editingSubCategory ? 'Save Changes' : 'Create Sub-Category'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
