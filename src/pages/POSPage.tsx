import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  productService,
  categoryService,
  subCategoryService,
  invoiceService,
  settingsService,
  systemService,
  approvalService,
} from '../services/api';
import type { Product, Category, SubCategory, CartItem, Invoice } from '../types';
import ReceiptModal from '../components/ReceiptModal';
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
  PriceDisplay,
  QuantityControl,
  EmptyState,
  Toast,
} from '../components/common';

interface ParkedSale {
  id: string;
  timestamp: string;
  items: CartItem[];
  subtotal: number;
  isWholesale?: boolean;
  approvedByName?: string;
}

type EntryMode = 'BARCODE' | 'SEARCH';

export default function POSPage() {
  const { user } = useAuth();
  const roleUpper = (user?.role || '').toUpperCase().trim();
  const isAdminOrSuper = roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN' || roleUpper === 'MANAGER';

  // Entry Mode Selection: Barcode or Search
  const [entryMode, setEntryMode] = useState<EntryMode>('BARCODE');

  // Barcode Scanning State
  const [barcodeInput, setBarcodeInput] = useState('');
  const [autoAddOnScan, setAutoAddOnScan] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Search by Item Code, Category, Sub-Category State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSubCategory, setSelectedSubCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addToBillButtonRef = useRef<HTMLButtonElement>(null);

  // Active Selected Product & Price Configuration
  const [activeProduct, setActiveProduct] = useState<Product | null>(null);
  const [activePriceType, setActivePriceType] = useState<'RETAIL' | 'WHOLESALE'>('RETAIL');
  const [activeQty, setActiveQty] = useState<number>(1);
  const [activeRetailPrice, setActiveRetailPrice] = useState<number>(0);
  const [activeRetailDiscount, setActiveRetailDiscount] = useState<number>(0);
  const [activeWholesalePrice, setActiveWholesalePrice] = useState<number>(0);
  const [isUpdatingMasterPrice, setIsUpdatingMasterPrice] = useState(false);
  const [isCatalogPriceModalOpen, setIsCatalogPriceModalOpen] = useState(false);
  const [catalogEditRetailPrice, setCatalogEditRetailPrice] = useState(0);
  const [catalogEditRetailDiscount, setCatalogEditRetailDiscount] = useState(0);
  const [catalogEditWholesalePrice, setCatalogEditWholesalePrice] = useState(0);

  // Keep latest active product values in refs for async approval callbacks
  const activeProductRef = useRef(activeProduct);
  const activeQtyRef = useRef(activeQty);
  const activeWholesalePriceRef = useRef(activeWholesalePrice);
  useEffect(() => {
    activeProductRef.current = activeProduct;
    activeQtyRef.current = activeQty;
    activeWholesalePriceRef.current = activeWholesalePrice;
  }, [activeProduct, activeQty, activeWholesalePrice]);

  // Wholesale Approval State (For Cashier, strictly 1-bill authorization)
  const [isWholesaleApprovedForBill, setIsWholesaleApprovedForBill] = useState(false);
  const [approvedByName, setApprovedByName] = useState<string>('');
  const [wholesaleModalOpen, setWholesaleModalOpen] = useState(false);
  const [approvalRequestId, setApprovalRequestId] = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED'>('IDLE');
  const [approvalErrorMessage, setApprovalErrorMessage] = useState('');
  const [showCashierBillDetails, setShowCashierBillDetails] = useState(false);

  // Audio feedback toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Parked Sales (Hold / Recall)
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>([]);
  const [isParkedModalOpen, setIsParkedModalOpen] = useState(false);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // UI status toast
  const [toast, setToast] = useState<{
    message: string;
    variant: 'success' | 'error' | 'warning' | 'info';
  } | null>(null);

  // Cart discount popdown editor (Admin/Super Admin only)
  const [activeCartDiscountIndex, setActiveCartDiscountIndex] = useState<number | null>(null);

  // Receipt Modal
  const [completedInvoice, setCompletedInvoice] = useState<Invoice | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [shopSettings, setShopSettings] = useState<any>({});
  const [deviceId, setDeviceId] = useState<string>('');

  // Audio beep generator using Web Audio API
  const playSound = (type: 'scan' | 'success' | 'error' = 'scan') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'scan') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'success') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch {
      // Audio not supported or blocked
    }
  };

  const toastTimerRef = useRef<any>(null);

  const showStatus = (message: string, variant: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ message, variant });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Load initial settings, products, and categories
  const loadInitialData = async () => {
    try {
      const [sRes, dRes, cRes, pRes] = await Promise.all([
        settingsService.get(),
        systemService.getDeviceId(),
        categoryService.list(),
        productService.list({ isActive: true }),
      ]);

      if (sRes.success && sRes.settings) setShopSettings(sRes.settings);
      if (dRes.success) setDeviceId(dRes.deviceId);
      if (cRes.success && cRes.categories) setCategories(cRes.categories);
      if (pRes.success && pRes.products) {
        setAllProducts(pRes.products.filter((p: Product) => p.is_active !== 0));
      }
    } catch (err: any) {
      console.error('Failed to load initial POS data', err);
    }
  };

  useEffect(() => {
    loadInitialData();
    barcodeInputRef.current?.focus();
  }, []);

  // When selected category changes in Option 2, load sub-categories
  useEffect(() => {
    const fetchSubCategories = async () => {
      if (!selectedCategory) {
        setSubCategories([]);
        setSelectedSubCategory('');
        return;
      }
      try {
        const res = await subCategoryService.list(selectedCategory);
        if (res.success && res.subCategories) {
          setSubCategories(res.subCategories);
        } else {
          setSubCategories([]);
        }
      } catch {
        setSubCategories([]);
      }
      setSelectedSubCategory('');
    };

    fetchSubCategories();
  }, [selectedCategory]);

  // Set the selected active product and populate its prices
  const selectProduct = (prod: Product, autoAddImmediately = false, forceQty?: number) => {
    if (prod.is_active === 0) {
      playSound('error');
      showStatus(`Cannot add ${prod.item_name}: Product is inactive`, 'error');
      return;
    }

    const defaultMode = isWholesaleApprovedForBill ? 'WHOLESALE' : 'RETAIL';
    const masterProd = allProducts.find((p) => p.id === prod.id) || prod;

    // Check if this product is already in the cart
    const inCart = cart.find((it) => it.product.id === prod.id);
    const resolvedWholesale = (inCart && inCart.priceType === 'WHOLESALE' && inCart.unitPrice > 0)
      ? inCart.unitPrice
      : ((masterProd.wholesale_price && masterProd.wholesale_price > 0)
        ? masterProd.wholesale_price
        : (prod.wholesale_price && prod.wholesale_price > 0
          ? prod.wholesale_price
          : Math.round(prod.retail_price * 0.9)));

    setActiveProduct(prod);
    // If forceQty is passed (e.g. clicked an item from the invoice), use that quantity;
    // Otherwise default to 1 so adding it increments the existing invoice line by that quantity!
    const initialQty = forceQty !== undefined ? forceQty : 1;
    setActiveQty(initialQty);
    setActivePriceType(defaultMode);
    setActiveRetailPrice(prod.retail_price || 0);
    setActiveRetailDiscount(prod.retail_discount || 0);
    setActiveWholesalePrice(resolvedWholesale);

    playSound('scan');

    if (autoAddImmediately) {
      const unitP = defaultMode === 'WHOLESALE' ? resolvedWholesale : (prod.retail_price || 0);
      const unitD = defaultMode === 'WHOLESALE' ? 0 : (prod.retail_discount || 0);
      addItemToCartWithValues(
        prod,
        1,
        defaultMode,
        unitP,
        unitD,
        true // increment on scan
      );
    } else {
      setTimeout(() => {
        addToBillButtonRef.current?.focus();
      }, 50);
    }
  };

  // Add item to cart with given values
  const addItemToCartWithValues = (
    prod: Product,
    qty: number,
    priceType: 'RETAIL' | 'WHOLESALE',
    unitPrice: number,
    unitDiscount: number,
    isIncrement: boolean = false
  ) => {
    if (!prod.is_active) {
      playSound('error');
      showStatus(`Product ${prod.item_name} is inactive`, 'error');
      return;
    }

    if (qty <= 0) {
      showStatus('Quantity must be greater than 0', 'error');
      return;
    }

    // Strictly enforce that wholesale rates are only permitted when the bill is verified
    const enforcedPriceType: 'RETAIL' | 'WHOLESALE' = isWholesaleApprovedForBill ? 'WHOLESALE' : 'RETAIL';
    const effectiveUnitPrice = enforcedPriceType === 'WHOLESALE' ? unitPrice : (prod.retail_price || 0);
    const safeDiscount = enforcedPriceType === 'WHOLESALE' ? 0 : Math.max(0, Math.min(effectiveUnitPrice, unitDiscount));

    setCart((prevCart) => {
      // Find existing item by product ID so each product has exactly ONE row in the bill
      const existingIndex = prevCart.findIndex(
        (item) => item.product.id === prod.id
      );

      if (existingIndex > -1) {
        const currentItem = prevCart[existingIndex];
        const newQty = isIncrement ? currentItem.quantity + qty : qty;

        if (newQty <= 0) {
          showStatus('Quantity must be greater than 0', 'error');
          return prevCart;
        }

        if (newQty > prod.quantity) {
          playSound('error');
          showStatus(
            `Insufficient stock for ${prod.item_name}. Available: ${(prod.unit || '').toUpperCase() === 'KG' ? Number(prod.quantity).toFixed(3) + ' kg' : Math.floor(prod.quantity) + ' pcs'}`,
            'error'
          );
          return prevCart;
        }

        const updated = [...prevCart];
        const discount = Math.round(safeDiscount * newQty * 100) / 100;
        const amount = Math.round((effectiveUnitPrice * newQty - discount) * 100) / 100;

        // Update the existing invoice line in-place from left to right without creating a duplicate row
        updated[existingIndex] = {
          ...currentItem,
          priceType: enforcedPriceType,
          quantity: newQty,
          unitPrice: effectiveUnitPrice,
          unitDiscount: safeDiscount,
          discount,
          amount,
        };
        playSound('scan');
        return updated;
      } else {
        if (qty > prod.quantity) {
          playSound('error');
          showStatus(
            `Insufficient stock for ${prod.item_name}. Available: ${(prod.unit || '').toUpperCase() === 'KG' ? Number(prod.quantity).toFixed(3) + ' kg' : Math.floor(prod.quantity) + ' pcs'}`,
            'error'
          );
          return prevCart;
        }

        const discount = Math.round(safeDiscount * qty * 100) / 100;
        const amount = Math.round((effectiveUnitPrice * qty - discount) * 100) / 100;

        playSound('scan');
        return [
          ...prevCart,
          {
            product: prod,
            quantity: qty,
            priceType: enforcedPriceType,
            unitPrice: effectiveUnitPrice,
            unitDiscount: safeDiscount,
            discount,
            amount,
          },
        ];
      }
    });
  };

  // Add currently active product to bill
  const handleAddActiveProductToCart = (isIncrement: boolean = true) => {
    if (!activeProduct) return;

    if (activeProduct.quantity <= 0) {
      playSound('error');
      showStatus(`Cannot add ${activeProduct.item_name}: Out of stock`, 'error');
      return;
    }

    const effectivePriceType: 'RETAIL' | 'WHOLESALE' = isWholesaleApprovedForBill ? 'WHOLESALE' : 'RETAIL';
    const unitPrice = effectivePriceType === 'WHOLESALE' ? activeWholesalePrice : activeRetailPrice;
    const unitDiscount = effectivePriceType === 'WHOLESALE' ? 0 : activeRetailDiscount;

    addItemToCartWithValues(activeProduct, activeQty, effectivePriceType, unitPrice, unitDiscount, isIncrement);

    // Reset active product state after item enters the cart
    setActiveProduct(null);
    setActiveQty(1);
    setBarcodeInput('');

    // Automatically return focus to barcode input for next item scan
    setTimeout(() => {
      if (entryMode === 'BARCODE') {
        barcodeInputRef.current?.focus();
      } else {
        searchInputRef.current?.focus();
      }
    }, 50);
  };

  // ─── Wholesale Approval Handlers (Cashier requires Admin / Super Admin authorization) ───
  const applyWholesaleToItem = (approverName: string = 'Admin', targetProd: Product, approvedRate?: number) => {
    const masterProd = allProducts.find((p) => p.id === targetProd.id) || targetProd;
    const finalPrice = (approvedRate && approvedRate > 0)
      ? approvedRate
      : (activeWholesalePriceRef.current > 0
        ? activeWholesalePriceRef.current
        : (masterProd.wholesale_price && masterProd.wholesale_price > 0
          ? masterProd.wholesale_price
          : (targetProd.wholesale_price && targetProd.wholesale_price > 0
            ? targetProd.wholesale_price
            : Math.round(targetProd.retail_price * 0.9))));

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex((it) => it.product.id === targetProd.id);
      if (existingIdx > -1) {
        // Item is already in the cart: update unit price in-place and recalculate amount without duplicating qty
        const updated = [...prevCart];
        const it = updated[existingIdx];
        updated[existingIdx] = {
          ...it,
          priceType: 'WHOLESALE',
          unitPrice: finalPrice,
          unitDiscount: 0,
          discount: 0,
          amount: finalPrice * it.quantity,
        };
        return updated;
      } else {
        // Item was only in the active pane: add it to the cart now at the approved wholesale rate
        const qtyToAdd = (activeProductRef.current && activeProductRef.current.id === targetProd.id)
          ? activeQtyRef.current
          : 1;
        return [
          ...prevCart,
          {
            product: targetProd,
            quantity: qtyToAdd,
            priceType: 'WHOLESALE',
            unitPrice: finalPrice,
            unitDiscount: 0,
            discount: 0,
            amount: finalPrice * qtyToAdd,
          },
        ];
      }
    });

    // If target product was the active product, reset active pane so cashier can scan next item
    if (activeProductRef.current && activeProductRef.current.id === targetProd.id) {
      setActiveProduct(null);
      setActiveQty(1);
      setBarcodeInput('');
    }

    playSound('success');
    showStatus(`Wholesale rate (Rs. ${Number(finalPrice).toFixed(2)}) applied for "${targetProd.item_name}" by ${approverName}!`, 'success');

    setTimeout(() => {
      if (entryMode === 'BARCODE') {
        barcodeInputRef.current?.focus();
      } else {
        searchInputRef.current?.focus();
      }
    }, 50);
  };

  const applyWholesaleToEntireBill = (approverName: string = 'Admin') => {
    // 1. Authorize Wholesale mode for this transaction bill
    setIsWholesaleApprovedForBill(true);
    setApprovedByName(approverName);
    setActivePriceType('WHOLESALE');

    // Step A: Convert and recalculate ALL items currently in the cart to wholesale unit pricing
    setCart((prevCart) => {
      return prevCart.map((item) => {
        const masterProd = allProducts.find((p) => p.id === item.product.id) || item.product;
        let wPrice = masterProd.wholesale_price;
        if (!wPrice || wPrice <= 0) {
          wPrice = item.priceType === 'WHOLESALE' && item.unitPrice > 0
            ? item.unitPrice
            : (item.product.wholesale_price && item.product.wholesale_price > 0
              ? item.product.wholesale_price
              : Math.round(masterProd.retail_price * 0.9));
        }

        const numericPrice = Number(wPrice);
        const amount = Math.round(numericPrice * item.quantity * 100) / 100;
        return {
          ...item,
          priceType: 'WHOLESALE' as const,
          unitPrice: numericPrice,
          unitDiscount: 0,
          discount: 0,
          amount,
        };
      });
    });

    // Step B: If there is an active product in the pane, switch it to wholesale price and keep it active
    const pendingProd = activeProductRef.current;
    if (pendingProd) {
      const masterProd = allProducts.find((p) => p.id === pendingProd.id) || pendingProd;
      const inCart = cart.find((it) => it.product.id === pendingProd.id);
      const wPrice = (inCart && inCart.priceType === 'WHOLESALE' && inCart.unitPrice > 0)
        ? inCart.unitPrice
        : ((masterProd.wholesale_price && masterProd.wholesale_price > 0)
          ? masterProd.wholesale_price
          : (pendingProd.wholesale_price && pendingProd.wholesale_price > 0
            ? pendingProd.wholesale_price
            : Math.round(pendingProd.retail_price * 0.9)));

      setActivePriceType('WHOLESALE');
      setActiveWholesalePrice(wPrice);
      setTimeout(() => {
        addToBillButtonRef.current?.focus();
      }, 100);
    } else {
      setTimeout(() => {
        if (entryMode === 'BARCODE') {
          barcodeInputRef.current?.focus();
        } else {
          searchInputRef.current?.focus();
        }
      }, 50);
    }

    playSound('success');
    showStatus('Approved', 'success');
  };

  const handleWholesaleBillClick = () => {
    if (isWholesaleApprovedForBill) {
      showStatus('Wholesale rate is already active for this bill', 'info');
      return;
    }

    setWholesaleModalOpen(true);
    setApprovalErrorMessage('');
    sendWholesaleRequest();
  };

  const sendWholesaleRequest = async () => {
    try {
      setApprovalStatus('PENDING');
      setApprovalErrorMessage('');

      const billSummary = {
        itemCount: cart.length,
        total: totalAmount,
        items: cart.map((it) => ({
          code: it.product.item_code,
          name: it.product.item_name,
          qty: it.quantity,
          unit: it.product.unit || 'PCS',
          rate: it.unitPrice,
          amount: it.amount,
        })),
      };

      const res = await approvalService.create({
        requestType: 'WHOLESALE_BILL',
        cashierId: user?.id,
        cashierName: user?.fullName || user?.username,
        deviceId,
        details: JSON.stringify(billSummary),
      });

      if (res.success && res.requestId) {
        setApprovalRequestId(res.requestId);
      } else {
        setApprovalStatus('IDLE');
        setApprovalErrorMessage(res.error || 'Could not send request');
      }
    } catch (err: any) {
      setApprovalStatus('IDLE');
      setApprovalErrorMessage(err.message || 'Failed to send request');
    }
  };

  // Poll for Admin Approval (runs continuously in background until resolved)
  useEffect(() => {
    if (!approvalRequestId || approvalStatus !== 'PENDING') return;

    const interval = setInterval(async () => {
      try {
        const res = await approvalService.check(approvalRequestId);
        if (res.success && res.request) {
          if (res.request.status === 'APPROVED') {
            clearInterval(interval);
            setApprovalStatus('APPROVED');
            setWholesaleModalOpen(false);
            setShowCashierBillDetails(false);
            const approver = res.request.approved_by_name || 'Admin';
            applyWholesaleToEntireBill(approver);
          } else if (res.request.status === 'REJECTED') {
            clearInterval(interval);
            setApprovalStatus('REJECTED');
            setApprovalErrorMessage('Rejected');
            playSound('error');
            showStatus('Rejected', 'error');
          }
        }
      } catch {
        // ignore network error
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [approvalRequestId, approvalStatus]);

  // Item code scan / Enter handler
  const handleBarcodeSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) {
      // If scan input is empty and an active product is loaded, pressing Enter immediately adds it to the cart
      if (activeProduct && activeProduct.quantity > 0) {
        handleAddActiveProductToCart(true);
      }
      return;
    }

    // Lookup by item code (scanners type into this field)
    let res = await productService.getByItemCode(query);
    if (res.success && res.product) {
      if (res.product.is_active === 0) {
        playSound('error');
        showStatus(`Product "${res.product.item_name}" is inactive`, 'error');
        return;
      }
      selectProduct(res.product, autoAddOnScan);
      setBarcodeInput('');
      return;
    }

    // Fallback: search query
    const searchRes = await productService.search(query);
    if (searchRes.success && searchRes.products && searchRes.products.length > 0) {
      const activeProducts = searchRes.products.filter((p: Product) => p.is_active !== 0);
      if (activeProducts.length > 0) {
        selectProduct(activeProducts[0], autoAddOnScan);
        setBarcodeInput('');
        return;
      }
    }

    playSound('error');
    showStatus(`Product not found: "${query}"`, 'error');
  };

  const openCatalogPriceModal = () => {
    if (!isAdminOrSuper || !activeProduct) return;
    setCatalogEditRetailPrice(activeRetailPrice);
    setCatalogEditRetailDiscount(activeRetailDiscount);
    setCatalogEditWholesalePrice(activeWholesalePrice);
    setIsCatalogPriceModalOpen(true);
  };

  // Admin Only: Save updated prices to SQLite master catalog (via modal)
  const handleSaveMasterPrice = async () => {
    if (!isAdminOrSuper || !activeProduct) return;

    setIsUpdatingMasterPrice(true);
    try {
      const res = await productService.update({
        id: activeProduct.id,
        retailPrice: catalogEditRetailPrice,
        retailDiscount: catalogEditRetailDiscount,
        wholesalePrice: catalogEditWholesalePrice,
        updatedBy: user?.id,
      });

      if (res.success) {
        playSound('success');
        showStatus('Product prices updated in catalog', 'success');
        setActiveRetailPrice(catalogEditRetailPrice);
        setActiveRetailDiscount(catalogEditRetailDiscount);
        setActiveWholesalePrice(catalogEditWholesalePrice);
        const updatedProd: Product = {
          ...activeProduct,
          retail_price: catalogEditRetailPrice,
          retail_discount: catalogEditRetailDiscount,
          wholesale_price: catalogEditWholesalePrice,
        };
        setActiveProduct(updatedProd);
        setAllProducts((prev) =>
          prev.map((p) => (p.id === activeProduct.id ? updatedProd : p))
        );
        setIsCatalogPriceModalOpen(false);
      } else {
        playSound('error');
        showStatus(res.error || 'Failed to update catalog prices', 'error');
      }
    } catch (err: any) {
      playSound('error');
      showStatus(err.message || 'Error updating prices', 'error');
    } finally {
      setIsUpdatingMasterPrice(false);
    }
  };

  // Filtered Search Results
  const filteredSearchResults = useMemo(() => {
    let list = allProducts.filter((p) => p.is_active !== 0);

    if (selectedCategory) {
      list = list.filter((p) => p.category_id === selectedCategory);
    }

    if (selectedSubCategory) {
      list = list.filter((p) => p.sub_category_id === selectedSubCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.item_name.toLowerCase().includes(q) ||
          p.item_code.toLowerCase().includes(q)
      );
    }

    return list.slice(0, 30);
  }, [allProducts, selectedCategory, selectedSubCategory, searchQuery]);

  // Calculate cart totals
  const subtotal = Math.round(cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0) * 100) / 100;
  const totalDiscount = Math.round(cart.reduce((sum, item) => sum + item.discount, 0) * 100) / 100;
  const totalAmount = Math.max(0, Math.round((subtotal - totalDiscount) * 100) / 100);

  const numCashReceived = parseFloat(cashReceived) || 0;
  const cashChange =
    paymentMethod === 'CASH' && numCashReceived >= totalAmount
      ? numCashReceived - totalAmount
      : 0;
  const isCashInsufficient =
    paymentMethod === 'CASH' && cart.length > 0 && numCashReceived < totalAmount;

  // Cart operations
  const updateCartQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      if (!isAdminOrSuper) {
        playSound('error');
        showStatus('Only Admin or Super Admin can remove items from the bill', 'error');
        return;
      }
      removeCartItem(index);
      return;
    }

    const item = cart[index];
    if (newQty > item.product.quantity) {
      playSound('error');
      showStatus(
        `Insufficient stock. Max available: ${(item.product.unit || '').toUpperCase() === 'KG' ? Number(item.product.quantity).toFixed(3) + ' kg' : Math.floor(item.product.quantity) + ' pcs'}`,
        'error'
      );
      return;
    }

    const updated = [...cart];
    const discount = item.unitDiscount * newQty;
    const amount = item.unitPrice * newQty - discount;

    updated[index] = {
      ...item,
      quantity: newQty,
      discount,
      amount,
    };
    setCart(updated);
  };

  const updateCartUnitDiscount = (index: number, discountValue: number) => {
    if (!isAdminOrSuper) return;

    const item = cart[index];
    const safeDiscount = Math.max(0, Math.min(item.unitPrice, discountValue));
    const discount = safeDiscount * item.quantity;
    const amount = item.unitPrice * item.quantity - discount;

    const updated = [...cart];
    updated[index] = {
      ...item,
      unitDiscount: safeDiscount,
      discount,
      amount,
    };
    setCart(updated);
  };

  const removeCartItem = (index: number) => {
    if (!isAdminOrSuper) {
      playSound('error');
      showStatus('Only Admin or Super Admin can remove items from the bill', 'error');
      return;
    }
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (!isAdminOrSuper) {
      playSound('error');
      showStatus('Only Admin or Super Admin can clear the bill', 'error');
      return;
    }
    if (window.confirm('Clear all items from current bill?')) {
      setCart([]);
      setCashReceived('');
      setIsWholesaleApprovedForBill(false);
      setApprovedByName('');
      setActivePriceType('RETAIL');
      if (entryMode === 'BARCODE') {
        barcodeInputRef.current?.focus();
      } else {
        searchInputRef.current?.focus();
      }
    }
  };

  // Hold Sale (Park)
  const handleHoldSale = () => {
    if (cart.length === 0) {
      showStatus('Cannot hold an empty bill', 'info');
      return;
    }
    const newParked: ParkedSale = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      items: [...cart],
      subtotal: totalAmount,
      isWholesale: isWholesaleApprovedForBill,
      approvedByName,
    };
    setParkedSales((prev) => [newParked, ...prev]);
    setCart([]);
    setCashReceived('');
    setIsWholesaleApprovedForBill(false);
    setApprovedByName('');
    setActivePriceType('RETAIL');
    showStatus('Bill held on park queue', 'info');
  };

  // Recall Sale
  const handleRecallSale = (parked: ParkedSale) => {
    if (cart.length > 0) {
      if (!window.confirm('Current bill items will be replaced by the held bill. Continue?')) {
        return;
      }
    }
    setCart(parked.items);
    setIsWholesaleApprovedForBill(!!parked.isWholesale);
    setApprovedByName(parked.approvedByName || '');
    setActivePriceType(parked.isWholesale ? 'WHOLESALE' : 'RETAIL');
    setParkedSales((prev) => prev.filter((p) => p.id !== parked.id));
    setIsParkedModalOpen(false);
    showStatus('Held bill restored', 'success');
  };

  // Complete Sale & Print
  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      playSound('error');
      showStatus('Bill is empty. Scan or search items first.', 'error');
      return;
    }

    if (paymentMethod === 'CASH') {
      if (!cashReceived || numCashReceived < totalAmount) {
        playSound('error');
        showStatus('Cash tendered is less than total amount', 'error');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        cashierId: user?.id,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitDiscount: item.unitDiscount,
          priceType: item.priceType || 'RETAIL',
        })),
        paymentMethod,
        cashReceived: paymentMethod === 'CASH' ? numCashReceived : null,
        deviceId,
      };

      const result = await invoiceService.create(payload);

      if (result.success && result.invoice) {
        playSound('success');
        const fullInvoice: Invoice = {
          id: result.invoice.id,
          invoice_number: result.invoice.invoiceNumber,
          cashier_id: user?.id || '',
          cashier_name: user?.fullName || user?.username,
          subtotal: result.invoice.subtotal,
          total_discount: result.invoice.totalDiscount,
          total_amount: result.invoice.totalAmount,
          payment_method: result.invoice.paymentMethod,
          cash_received: result.invoice.cashReceived,
          cash_change: result.invoice.cashChange,
          status: 'COMPLETED',
          price_type: isWholesaleApprovedForBill ? 'WHOLESALE' : 'RETAIL',
          sync_status: 'PENDING',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          items: result.invoice.items.map((it: any) => {
            const originalCartItem = cart.find((c) => c.product.id === it.productId);
            const itemPriceType = (originalCartItem?.priceType || (isWholesaleApprovedForBill ? 'WHOLESALE' : 'RETAIL')) as 'RETAIL' | 'WHOLESALE';
            return {
              id: it.productId,
              invoice_id: result.invoice.id,
              product_id: it.productId,
              item_code: it.itemCode,
              item_name: it.itemName,
              unit_price: it.unitPrice,
              quantity: it.quantity,
              unit_discount: it.unitDiscount,
              discount: it.discount,
              amount: it.amount,
              price_type: itemPriceType,
              created_at: new Date().toISOString(),
            };
          }),
        };

        setCompletedInvoice(fullInvoice);
        setIsReceiptOpen(true);
        setCart([]);
        setCashReceived('');
        setIsWholesaleApprovedForBill(false);
        setApprovedByName('');
        setActivePriceType('RETAIL');
        showStatus(`Sale completed: #${result.invoice.invoiceNumber}`, 'success');
        loadInitialData();
      } else {
        playSound('error');
        showStatus(result.error || 'Failed to complete transaction', 'error');
      }
    } catch (err: any) {
      playSound('error');
      showStatus(err.message || 'Error processing transaction', 'error');
    } finally {
      setIsSubmitting(false);
      if (entryMode === 'BARCODE') {
        barcodeInputRef.current?.focus();
      }
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Enter: If active product is loaded, add to bill immediately
      if (e.key === 'Enter') {
        if (isReceiptOpen || isParkedModalOpen) return;
        const target = e.target as HTMLElement;

        // If in barcode input with query typed, let form submit search for it
        if (target === barcodeInputRef.current && barcodeInput.trim()) {
          return;
        }
        // If in search input with query typed, let search input handle it
        if (target === searchInputRef.current && searchQuery.trim()) {
          return;
        }
        // If inside a textarea or cash tender input, don't intercept
        if (target?.tagName === 'TEXTAREA') {
          return;
        }

        if (activeProduct && activeProduct.quantity > 0) {
          e.preventDefault();
          handleAddActiveProductToCart();
          return;
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        setEntryMode('BARCODE');
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
      } else if (e.key === 'F3') {
        e.preventDefault();
        setEntryMode('SEARCH');
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleHoldSale();
      } else if (e.key === 'F8') {
        e.preventDefault();
        setPaymentMethod((prev) => (prev === 'CASH' ? 'CARD' : 'CASH'));
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !isCashInsufficient && !isSubmitting) {
          handleCompleteSale();
        }
      } else if (e.key === 'Escape') {
        if (isParkedModalOpen) {
          setIsParkedModalOpen(false);
        } else if (activeProduct) {
          setActiveProduct(null);
          barcodeInputRef.current?.focus();
        } else if (cart.length > 0 && isAdminOrSuper) {
          clearCart();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeProduct,
    barcodeInput,
    searchQuery,
    activeQty,
    activePriceType,
    activeRetailPrice,
    activeRetailDiscount,
    activeWholesalePrice,
    entryMode,
    cart,
    isCashInsufficient,
    isSubmitting,
    totalAmount,
    paymentMethod,
    cashReceived,
    isParkedModalOpen,
    isReceiptOpen,
  ]);

  // Net prices calculation for active product
  const isWholesaleActive = isWholesaleApprovedForBill;
  const netRetailPrice = Math.max(0, activeRetailPrice - activeRetailDiscount);
  const netWholesalePrice = activeWholesalePrice;
  const selectedNetUnitPrice = isWholesaleActive ? netWholesalePrice : netRetailPrice;
  const lineItemTotal = Math.round(selectedNetUnitPrice * activeQty * 100) / 100;

  return (
    <div className="h-full flex flex-col p-4 select-none overflow-hidden gap-3 bg-[var(--pos-bg)]">
      {/* Toast Alert Banner */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.variant}
          onClose={() => setToast(null)}
        />
      )}

      {/* POS Action Bar */}
      <div className="pos-card px-4 py-2.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {/* Mode switch buttons */}
          <div className="inline-flex rounded border border-[var(--pos-border)] p-0.5 bg-[var(--pos-bg-subtle)]">
            <button
              type="button"
              onClick={() => {
                setEntryMode('BARCODE');
                setTimeout(() => barcodeInputRef.current?.focus(), 50);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${entryMode === 'BARCODE'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Barcode Scan
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode('SEARCH');
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded cursor-pointer transition-colors ${entryMode === 'SEARCH'
                ? 'bg-white text-slate-900 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Item Search
            </button>
          </div>

          {entryMode === 'BARCODE' && (
            <label className="flex items-center gap-1.5 text-xs text-[var(--pos-text-muted)] ml-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoAddOnScan}
                onChange={(e) => setAutoAddOnScan(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-[var(--pos-border)] text-[var(--pos-accent)] cursor-pointer"
              />
              <span>Auto-add on scan</span>
            </label>
          )}
        </div>

        {/* Right side operational actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={`Audio feedback: ${soundEnabled ? 'On' : 'Muted'}`}
          >
            {soundEnabled ? '🔔 Sound' : '🔕 Mute'}
          </Button>

          {parkedSales.length > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsParkedModalOpen(true)}
            >
              Held Bills ({parkedSales.length})
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleHoldSale}
            disabled={cart.length === 0}
            shortcut="F4"
          >
            Hold Bill
          </Button>

          {isAdminOrSuper && cart.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={clearCart}
              shortcut="Esc"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Main Workspace Layout (2 Columns) */}
      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        {/* LEFT / CENTER ZONE: Search/Scan + Product Details Panel (7 Cols) */}
        <div className="col-span-7 flex flex-col gap-3 overflow-hidden min-h-0">
          {/* SEARCH / SCAN PANEL */}
          {entryMode === 'BARCODE' ? (
            /* Option 1: Barcode Scan Input */
            <div className="pos-card p-4 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[var(--pos-text)]">
                  Scan / Enter Item Code
                </span>
                <span className="text-[11px] text-[var(--pos-text-muted)]">
                  USB / Laser Scanner Ready
                </span>
              </div>
              <form onSubmit={handleBarcodeSubmit} className="flex gap-2 items-stretch">
                <div className="relative flex-1 flex">
                  <input
                    ref={barcodeInputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full h-[42px] px-3 pr-8 text-sm font-semibold font-mono text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    autoFocus
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => setBarcodeInput('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--pos-text-muted)] hover:text-[var(--pos-text)] text-sm cursor-pointer p-0.5"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <Button type="submit" variant="primary" size="md" className="h-[42px] px-5 shrink-0">
                  Find
                </Button>
              </form>
            </div>
          ) : (
            /* Option 2: Search Filters & Product Results Table */
            <div className="pos-card p-4 flex flex-col gap-3 flex-[1.3] min-h-0 overflow-hidden">
              <div className="grid grid-cols-12 gap-2 shrink-0">
                <div className="col-span-5">
                  <Input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name or code..."
                    autoFocus
                  />
                </div>
                <div className="col-span-4">
                  <Select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    options={[
                      { value: '', label: `All Categories (${categories.length})` },
                      ...categories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    value={selectedSubCategory}
                    disabled={!selectedCategory || subCategories.length === 0}
                    onChange={(e) => setSelectedSubCategory(e.target.value)}
                    options={[
                      { value: '', label: 'All Sub-Cats' },
                      ...subCategories.map((sc) => ({ value: sc.id, label: sc.name })),
                    ]}
                  />
                </div>
              </div>

              {/* Search results table — ~130% taller than previous max-h-48 (12rem → 15.6rem) */}
              <div className="border border-[var(--pos-border)] rounded flex-1 min-h-[15.6rem] overflow-y-auto bg-white">
                {filteredSearchResults.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--pos-text-muted)]">
                    No products match the search criteria.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead align="right">Retail</TableHead>
                        <TableHead align="right">Wholesale</TableHead>
                        <TableHead align="center">Stock</TableHead>
                        <TableHead align="center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSearchResults.map((prod) => {
                        const isSelected = activeProduct?.id === prod.id;
                        return (
                          <TableRow
                            key={prod.id}
                            selected={isSelected}
                            onClick={() => selectProduct(prod)}
                            className="cursor-pointer"
                          >
                            <TableCell monospace className="font-semibold text-xs text-[var(--pos-text-muted)]">
                              {prod.item_code}
                            </TableCell>
                            <TableCell className="font-semibold text-[var(--pos-text)] truncate max-w-[160px]">
                              {prod.item_name}
                            </TableCell>
                            <TableCell className="text-[var(--pos-text-muted)] text-xs truncate max-w-[120px]">
                              {prod.category_name || '-'}
                            </TableCell>
                            <TableCell align="right" monospace className="font-semibold">
                              Rs. {prod.retail_price.toFixed(2)}
                            </TableCell>
                            <TableCell align="right" monospace className="text-[var(--pos-text-muted)]">
                              {prod.wholesale_price ? `Rs. ${prod.wholesale_price.toFixed(2)}` : '-'}
                            </TableCell>
                            <TableCell align="center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span
                                  className={`text-xs font-mono font-bold ${prod.quantity <= 0
                                    ? 'text-[var(--pos-danger)]'
                                    : prod.quantity <= prod.minimum_quantity
                                      ? 'text-amber-700'
                                      : 'text-[var(--pos-text)]'
                                    }`}
                                >
                                  {(prod.unit || '').toUpperCase() === 'KG'
                                    ? Number(prod.quantity).toFixed(3)
                                    : Math.floor(prod.quantity)}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border font-mono uppercase ${(prod.unit || '').toUpperCase() === 'KG'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-blue-100 text-blue-900 border-blue-300'
                                  }`}>
                                  {(prod.unit || '').toUpperCase() === 'KG' ? 'kg' : 'pcs'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="sm"
                                variant={isSelected ? 'accent' : 'secondary'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectProduct(prod);
                                }}
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          )}

          {/* PRODUCT DETAILS & PRICING PANEL */}
          <div className="pos-card p-4 flex-1 min-h-0 flex flex-col justify-between overflow-y-auto">
            {!activeProduct ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <EmptyState
                  title="No Product Selected"
                  description="Scan or search an item code to load pricing, inventory, and billing options."
                />
              </div>
            ) : (
              <div className="flex flex-col h-full justify-between gap-4">
                {/* Header Information */}
                <div>
                  <div className="flex items-start justify-between gap-3 border-b border-[var(--pos-border)] pb-4">
                    <div className="flex flex-col gap-3 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-xl font-bold text-[var(--pos-text)] tracking-tight">
                          {activeProduct.item_name}
                        </h2>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase font-mono border ${(activeProduct.unit || '').toUpperCase() === 'KG'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-blue-100 text-blue-900 border-blue-300'
                          }`}>
                          {(activeProduct.unit || '').toUpperCase() === 'KG' ? 'Kilograms' : 'Pieces'}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--pos-text-muted)] flex items-center gap-3 flex-wrap">
                        <span>Code: <strong className="font-mono text-[var(--pos-text)]">{activeProduct.item_code}</strong></span>
                        <span>Category: <strong className="text-[var(--pos-text)]">{activeProduct.category_name || 'General'}</strong>{activeProduct.sub_category_name ? ` / ${activeProduct.sub_category_name}` : ''}</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col gap-2">
                      <div className="text-xs text-[var(--pos-text-muted)]">Current Stock</div>
                      <div className={`text-base font-mono font-bold ${activeProduct.quantity <= 0
                        ? 'text-[var(--pos-danger)]'
                        : activeProduct.quantity <= activeProduct.minimum_quantity
                          ? 'text-[var(--pos-warning)]'
                          : 'text-[var(--pos-success)]'
                        }`}>
                        {activeProduct.quantity <= 0
                          ? 'Out of Stock'
                          : (activeProduct.unit || '').toUpperCase() === 'KG'
                            ? `${Number(activeProduct.quantity).toFixed(3)} Kilograms`
                            : `${Math.floor(activeProduct.quantity)} Pieces`}
                      </div>
                    </div>
                  </div>

                  {/* Pricing Matrix */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-[var(--pos-text-muted)] uppercase tracking-wider">
                        Pricing Details
                      </span>
                      {isAdminOrSuper && (
                        <button
                          type="button"
                          onClick={openCatalogPriceModal}
                          disabled={isUpdatingMasterPrice}
                          className="text-xs text-[var(--pos-accent)] hover:underline font-semibold cursor-pointer"
                        >
                          Update Catalog Price
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-5">
                      {/* Retail Price — same visual weight for cashier / admin / super admin */}
                      <div className="p-4 bg-[var(--pos-bg-subtle)] rounded-lg border border-[var(--pos-border)] min-h-[108px] flex flex-col justify-between">
                        <span className="text-[11px] text-[var(--pos-text-muted)] block mb-2">Retail Price</span>
                        <div className="w-full px-3 py-3 min-h-[48px] flex items-center text-base font-mono font-bold border border-[var(--pos-border)] rounded-lg bg-white text-[var(--pos-text)]">
                          Rs. {activeRetailPrice.toFixed(2)}
                        </div>
                      </div>

                      {/* Retail Discount */}
                      <div className="p-4 bg-[var(--pos-bg-subtle)] rounded-lg border border-[var(--pos-border)] min-h-[108px] flex flex-col justify-between">
                        <span className="text-[11px] text-[var(--pos-text-muted)] block mb-2">Retail Discount</span>
                        <div className="w-full px-3 py-3 min-h-[48px] flex items-center text-base font-mono font-bold border border-[var(--pos-border)] rounded-lg bg-white text-[var(--pos-danger)]">
                          Rs. {activeRetailDiscount.toFixed(2)}
                        </div>
                      </div>

                      {/* Wholesale Price */}
                      <div className="p-4 bg-[var(--pos-bg-subtle)] rounded-lg border border-[var(--pos-border)] min-h-[108px] flex flex-col justify-between">
                        <div className="flex justify-between items-center gap-2 mb-2">
                          <span className="text-[11px] text-[var(--pos-text-muted)] block">Wholesale Price</span>
                          {!isWholesaleApprovedForBill ? (
                            <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded shrink-0">Requires Verification</span>
                          ) : (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded shrink-0">Verified Wholesale</span>
                          )}
                        </div>
                        <div
                          className={`w-full px-3 py-3 min-h-[48px] flex items-center text-base font-mono font-bold border rounded-lg bg-white ${
                            isWholesaleApprovedForBill
                              ? 'border-emerald-300 text-emerald-700'
                              : 'border-emerald-300 text-slate-400'
                          }`}
                        >
                          Rs. {activeWholesalePrice.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Already In Bill Alert Banner */}
                {activeProduct && cart.some((it) => it.product.id === activeProduct.id) && (() => {
                  const existingItem = cart.find((it) => it.product.id === activeProduct.id)!;
                  const lineIdx = cart.findIndex((it) => it.product.id === activeProduct.id);
                  return (
                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between text-xs text-blue-950 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">ℹ</span>
                        <div>
                          <span className="font-bold">Already in Bill: </span>
                          <span className="font-mono font-bold text-blue-800">
                            {(activeProduct.unit || '').toUpperCase() === 'KG'
                              ? `${Number(existingItem.quantity).toFixed(3)} kg`
                              : `${Math.floor(existingItem.quantity)} pcs`}
                          </span>
                          <span className="text-blue-700 ml-1.5 font-medium">
                            (Line Amount: Rs. {existingItem.amount.toFixed(2)})
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                        Invoice Line #{lineIdx + 1}
                      </span>
                    </div>
                  );
                })()}

                {/* Add to Bill Action */}
                <div className="p-3 bg-[var(--pos-bg-subtle)] rounded border border-[var(--pos-border)] flex items-center justify-between gap-4">
                  {/* Unit Price Display */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[var(--pos-text-muted)] uppercase">
                      {isWholesaleApprovedForBill ? 'Wholesale Price' : 'Retail Price'}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-mono font-bold text-[var(--pos-text)]">
                        Rs. {selectedNetUnitPrice.toFixed(2)}
                      </span>
                      {isWholesaleApprovedForBill && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">WHOLESALE</span>
                      )}
                    </div>
                  </div>

                  {/* Quantity Control */}
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[var(--pos-text-muted)] uppercase">
                      Quantity ({(activeProduct.unit || '').toUpperCase() === 'KG' ? 'Kilograms' : 'Pieces'})
                    </span>
                    <QuantityControl
                      value={activeQty}
                      min={(activeProduct.unit || '').toUpperCase() === 'KG' ? 0.001 : 1}
                      max={activeProduct.quantity}
                      step={(activeProduct.unit || '').toUpperCase() === 'KG' ? 0.25 : 1}
                      unit={activeProduct.unit}
                      onChange={setActiveQty}
                      onEnter={() => handleAddActiveProductToCart(true)}
                    />
                  </div>

                  {/* Line Total & Add / Update Buttons */}
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[11px] text-[var(--pos-text-muted)] block">
                        {cart.some((it) => it.product.id === activeProduct.id) ? 'Selected Qty Total' : 'Item Total'}
                      </span>
                      <PriceDisplay amount={lineItemTotal} size="lg" className="font-bold text-[var(--pos-text)]" />
                    </div>

                    <div className="flex items-center gap-2">
                      {cart.some((it) => it.product.id === activeProduct.id) ? (
                        <>
                          <Button
                            ref={addToBillButtonRef}
                            variant="primary"
                            size="lg"
                            onClick={() => handleAddActiveProductToCart(true)}
                            disabled={activeProduct.quantity <= 0}
                            shortcut="Enter"
                            title="Add this quantity to the existing invoice line"
                          >
                            Add to Bill
                          </Button>
                        </>
                      ) : (
                        <Button
                          ref={addToBillButtonRef}
                          variant="primary"
                          size="lg"
                          onClick={() => handleAddActiveProductToCart(false)}
                          disabled={activeProduct.quantity <= 0}
                          shortcut="Enter"
                        >
                          Add to Bill
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT ZONE: Cart & Checkout (5 Cols - ALWAYS VISIBLE) */}
        <div className="col-span-5 flex flex-col gap-3 overflow-hidden min-h-0">
          {/* Cart Table Container */}
          <div className="pos-card flex-1 flex flex-col overflow-hidden">
            {/* Cart Header */}
            <div className="px-4 py-2 bg-[var(--pos-bg-subtle)] border-b border-[var(--pos-border)] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--pos-text)] uppercase tracking-wider">
                  Current Bill
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase tracking-wide border ${
                  isWholesaleApprovedForBill
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-blue-100 text-blue-900 border-blue-300'
                }`}>
                  {isWholesaleApprovedForBill ? 'WHOLESALE BILL' : 'RETAIL BILL'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--pos-border)] text-[var(--pos-text-muted)] font-mono font-semibold">
                  {cart.reduce((s, it) => s + it.quantity, 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} items
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {!isWholesaleApprovedForBill ? (
                  <button
                    type="button"
                    onClick={handleWholesaleBillClick}
                    className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs ${approvalStatus === 'PENDING'
                      ? 'bg-amber-100 text-amber-900 border border-amber-400 animate-pulse'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                      }`}
                    title={approvalStatus === 'PENDING' ? 'Waiting for Admin approval...' : (!isAdminOrSuper ? 'Request Wholesale Rate Approval for this bill' : 'Wholesale Mode')}
                  >
                    {approvalStatus === 'PENDING' ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                        <span>Waiting Approval...</span>
                      </>
                    ) : (
                      <>
                        {!isAdminOrSuper && <span className="text-[10px]">🔒</span>}
                        <span>Wholesale</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 font-mono">
                    <span>✓</span> Wholesale
                  </span>
                )}
                <span className="text-xs text-[var(--pos-text-muted)] font-medium">
                  {cart.length} line item{cart.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>

            {isWholesaleApprovedForBill && (
              <div className="px-4 py-2 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-b border-emerald-200 flex items-center justify-between text-xs text-emerald-950 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">✓</span>
                  <span className="font-semibold">Wholesale Pricing Authorized by {approvedByName || 'Admin'}</span>
                </div>
                <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 uppercase">
                  This Bill Only
                </span>
              </div>
            )}

            {/* Cart Items Table Body */}
            <div className="flex-1 overflow-y-auto bg-white">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6">
                  <EmptyState
                    title="Cart is empty"
                    description="Scan an item code or select an item from the left to start this bill."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead align="center" className="w-24">Qty & Unit</TableHead>
                      <TableHead align="right">Unit Price</TableHead>
                      <TableHead align="right">Amount</TableHead>
                      <TableHead align="center" className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map((item, index) => (
                      <TableRow
                        key={item.product.id}
                        onClick={() => selectProduct(item.product, false, item.quantity)}
                        className="hover:bg-[var(--pos-bg-subtle)] cursor-pointer select-none"
                        title="Click to view details / adjust quantity in left product panel"
                      >
                        {/* Read-Only Product Details */}
                        <TableCell>
                          <div className="font-semibold text-xs text-[var(--pos-text)] leading-tight">
                            {item.product.item_name}
                          </div>
                          <div className="text-[11px] text-[var(--pos-text-muted)] font-mono mt-0.5 flex items-center gap-2">
                            <span>{item.product.item_code}</span>
                            <span className={`uppercase text-[10px] font-bold px-1.5 py-0.5 rounded font-mono border ${
                              item.priceType === 'WHOLESALE'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}>
                              {item.priceType === 'WHOLESALE' ? 'Wholesale' : 'Retail'}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase font-mono ${(item.product.unit || '').toUpperCase() === 'KG'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                              {(item.product.unit || '').toUpperCase() === 'KG' ? 'Kilograms' : 'Pieces'}
                            </span>
                            {item.unitDiscount > 0 && (
                              <span className="text-[var(--pos-danger)] font-semibold">
                                -Rs. {item.unitDiscount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Read-Only Qty & Unit Display */}
                        <TableCell align="center">
                          <div className="flex flex-col items-center justify-center">
                            <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded border shadow-2xs ${(item.product.unit || '').toUpperCase() === 'KG'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-blue-50 text-blue-900 border-blue-300'
                              }`}>
                              {(item.product.unit || '').toUpperCase() === 'KG'
                                ? `${Number(item.quantity).toFixed(3)} kg`
                                : `${Math.floor(item.quantity)} pcs`}
                            </span>
                          </div>
                        </TableCell>

                        {/* Read-Only Unit Price Display */}
                        <TableCell align="right" monospace className="text-xs font-medium text-[var(--pos-text-muted)]">
                          Rs. {item.unitPrice.toFixed(2)}
                        </TableCell>

                        {/* Read-Only Amount Display */}
                        <TableCell align="right" monospace className="text-xs font-bold text-[var(--pos-text)]">
                          Rs. {item.amount.toFixed(2)}
                        </TableCell>

                        {/* Line Item Deletion: Restricted strictly to Admin/Super Admin */}
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          {isAdminOrSuper ? (
                            <button
                              type="button"
                              onClick={() => removeCartItem(index)}
                              className="text-[var(--pos-text-muted)] hover:text-[var(--pos-danger)] font-bold text-sm cursor-pointer transition-colors p-1"
                              title="Remove item (Admin only)"
                            >
                              ✕
                            </button>
                          ) : (
                            <span
                              className="text-[11px] text-slate-300 select-none"
                              title="Invoice items are read-only. Quantity changes must be made through the left-side product selection workflow."
                            >
                              🔒
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Bill Summary Breakdown */}
            <div className="p-3 bg-[var(--pos-bg-subtle)] border-t border-[var(--pos-border)] space-y-1 text-xs text-[var(--pos-text-muted)] shrink-0">
              <div className="flex justify-between items-center">
                <span>Billing Mode</span>
                <span className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded border uppercase ${
                  isWholesaleApprovedForBill
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : 'bg-blue-100 text-blue-900 border-blue-300'
                }`}>
                  {isWholesaleApprovedForBill ? 'WHOLESALE' : 'RETAIL'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Subtotal</span>
                <PriceDisplay amount={subtotal} size="sm" />
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-[var(--pos-danger)]">
                  <span>Discount</span>
                  <span className="font-mono">-Rs. {totalDiscount.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>

          {/* TOTAL & PAYMENT PANEL */}
          <div className="pos-card p-4 flex flex-col gap-3 shrink-0">
            {/* TOTAL AREA - Strong, prominent, visible from distance */}
            <div className="bg-[var(--pos-bg-subtle)] p-3 rounded border border-[var(--pos-border)] text-center">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--pos-text-muted)]">
                Total Payable
              </div>
              <PriceDisplay amount={totalAmount} size="hero" className="text-[var(--pos-text)] font-extrabold mt-0.5" />
            </div>

            {/* Payment Method Switcher */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`py-2 px-3 text-xs font-bold rounded-lg uppercase tracking-wider border cursor-pointer transition-colors ${paymentMethod === 'CASH'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CARD')}
                className={`py-2 px-3 text-xs font-bold rounded-lg uppercase tracking-wider border cursor-pointer transition-colors ${paymentMethod === 'CARD'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
              >
                Card
              </button>
            </div>

            {/* Cash Tender Area */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-2 pt-1 border-t border-[var(--pos-border)]">
                <div className="flex items-stretch gap-2">
                  <div className="relative flex-1 flex">
                    {!cashReceived && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-normal text-slate-400 pointer-events-none select-none">
                        Cash received
                      </span>
                    )}
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="w-full h-[42px] px-3 pr-3 text-base font-bold font-mono text-slate-900 bg-white border border-slate-300 rounded-lg transition-colors focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                    {cashReceived && (
                      <button
                        type="button"
                        onClick={() => setCashReceived('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--pos-text-muted)] hover:text-[var(--pos-text)] text-sm cursor-pointer p-0.5"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="h-[42px] px-4 shrink-0 font-semibold"
                    onClick={() => setCashReceived(totalAmount.toString())}
                  >
                    Exact
                  </Button>
                </div>


                {/* Change or Short Indicator */}
                <div
                  className={`px-3 py-2 rounded text-xs flex justify-between items-center ${isCashInsufficient
                    ? 'bg-rose-50 text-[var(--pos-danger)] border border-rose-200'
                    : 'bg-emerald-50 text-[var(--pos-success)] border border-emerald-200'
                    }`}
                >
                  <span className="font-semibold">
                    {isCashInsufficient ? 'Amount Short:' : 'Change:'}
                  </span>
                  <span className="font-mono font-bold text-sm">
                    Rs.{' '}
                    {isCashInsufficient
                      ? (totalAmount - numCashReceived).toFixed(2)
                      : cashChange.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Complete Sale Action Button */}
            <Button
              variant="success"
              size="lg"
              fullWidth
              disabled={cart.length === 0 || isCashInsufficient || isSubmitting}
              onClick={handleCompleteSale}
              shortcut="F9"
              className="py-3 text-base font-bold"
            >
              {isSubmitting ? 'Processing Sale...' : 'Complete Sale'}
            </Button>
          </div>
        </div>
      </div>

      {/* Admin: edit catalog prices without changing the on-screen product layout */}
      <Dialog
        isOpen={isCatalogPriceModalOpen}
        onClose={() => setIsCatalogPriceModalOpen(false)}
        title="Update Catalog Price"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--pos-text-muted)]">
            {activeProduct?.item_name} ({activeProduct?.item_code})
          </p>
          <Input
            label="Retail Price"
            type="number"
            min={0}
            step={0.5}
            value={catalogEditRetailPrice}
            onChange={(e) => setCatalogEditRetailPrice(parseFloat(e.target.value) || 0)}
            monospace
          />
          <Input
            label="Retail Discount"
            type="number"
            min={0}
            step={0.5}
            value={catalogEditRetailDiscount}
            onChange={(e) => setCatalogEditRetailDiscount(parseFloat(e.target.value) || 0)}
            monospace
          />
          <Input
            label="Wholesale Price"
            type="number"
            min={0}
            step={0.01}
            value={catalogEditWholesalePrice}
            onChange={(e) => setCatalogEditWholesalePrice(Math.max(0, parseFloat(e.target.value) || 0))}
            monospace
          />
          <div className="flex gap-2 pt-2">
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSaveMasterPrice}
              disabled={isUpdatingMasterPrice}
            >
              {isUpdatingMasterPrice ? 'Saving...' : 'Save to Catalog'}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIsCatalogPriceModalOpen(false)}
              disabled={isUpdatingMasterPrice}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Held / Parked Sales Dialog */}
      <Dialog
        isOpen={isParkedModalOpen}
        onClose={() => setIsParkedModalOpen(false)}
        title="Held Bills (Parked)"
        size="sm"
      >
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {parkedSales.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--pos-text-muted)]">
              No bills currently on hold.
            </div>
          ) : (
            parkedSales.map((p) => (
              <div
                key={p.id}
                className="p-3 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-xs text-[var(--pos-text)]">
                    Time: {p.timestamp} ({p.items.length} items)
                  </div>
                  <div className="text-[11px] text-[var(--pos-text-muted)] mt-0.5">
                    {p.items.map((it) => it.product.item_name).slice(0, 2).join(', ')}
                    {p.items.length > 2 ? '...' : ''}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PriceDisplay amount={p.subtotal} size="sm" className="font-bold" />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleRecallSale(p)}
                  >
                    Resume
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Dialog>

      {/* Wholesale Request Modal */}
      {wholesaleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-base">🔒</span>
                <h3 className="font-bold text-sm">Wholesale Request</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setApprovalStatus('IDLE');
                  setWholesaleModalOpen(false);
                }}
                className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer w-7 h-7 rounded-full flex items-center justify-center hover:bg-slate-800 transition-colors"
                title="Cancel and close"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {/* Bill Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-slate-600">Bill Items</span>
                  <span className="font-bold font-mono text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {cart.length} item{cart.length === 1 ? '' : 's'}
                  </span>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCashierBillDetails(!showCashierBillDetails)}
                    className="w-full text-center py-0.5 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer underline"
                  >
                    {showCashierBillDetails ? 'Hide Bill' : 'View Bill'}
                  </button>
                )}
                {showCashierBillDetails && cart.length > 0 && (
                  <div className="max-h-36 overflow-y-auto bg-white border border-slate-200 rounded p-2 text-[11px] space-y-1">
                    <div className="flex justify-between font-bold text-slate-700 border-b border-slate-200 pb-1">
                      <span>Product</span>
                      <span>Qty × Rate</span>
                    </div>
                    {cart.map((it, idx) => (
                      <div key={idx} className="flex justify-between items-center text-slate-600 py-0.5">
                        <span className="truncate max-w-[130px] font-medium">{it.product.item_name}</span>
                        <span className="font-mono text-slate-800 text-[10px]">
                          {(it.product.unit || '').toUpperCase() === 'KG' ? Number(it.quantity).toFixed(3) + ' kg' : Math.floor(it.quantity) + ' pcs'} × Rs.{Number(it.unitPrice).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 mt-1">
                      <span>Total</span>
                      <span className="font-mono">Rs. {Number(totalAmount).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Status Area */}
              {isAdminOrSuper ? (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-950 flex flex-col gap-1">
                    <span className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <span>🛡️</span> Admin Verification
                    </span>
                    <span className="text-slate-600">
                      Logged in as <strong>{user?.fullName || user?.username}</strong> ({user?.role}). Click below to verify and unlock wholesale rates for this bill.
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setWholesaleModalOpen(false);
                        applyWholesaleToEntireBill(user?.fullName || user?.username || 'Admin');
                      }}
                      className="flex-1 py-2.5 px-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      Verify & Authorize Wholesale
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setApprovalStatus('IDLE');
                        setWholesaleModalOpen(false);
                      }}
                      className="py-2.5 px-3 text-xs text-slate-600 hover:bg-slate-100 rounded border border-slate-300 font-medium cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : approvalStatus === 'PENDING' ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-center gap-2.5 py-4 px-3 text-xs font-semibold text-amber-900 bg-amber-50 rounded-lg border border-amber-200">
                    <svg className="animate-spin h-5 w-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Waiting for Admin verification...</span>
                  </div>
                  <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                    A notification has been sent to the Admin screen. Please wait until approved. The bill remains on retail rates until verified.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setApprovalStatus('IDLE');
                      setWholesaleModalOpen(false);
                    }}
                    className="w-full py-2 px-3 text-xs text-rose-600 hover:bg-rose-50 rounded border border-rose-200 font-semibold cursor-pointer transition-colors text-center"
                  >
                    Cancel Request
                  </button>
                </div>
              ) : approvalStatus === 'REJECTED' ? (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-semibold flex items-center gap-2">
                    <span>✕</span>
                    <span>{approvalErrorMessage || 'Rejected'}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setWholesaleModalOpen(false)}
                      className="flex-1 py-2 px-3 text-xs text-slate-600 hover:bg-slate-100 rounded border border-slate-300 font-medium cursor-pointer"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => sendWholesaleRequest()}
                      className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => sendWholesaleRequest()}
                    className="w-full py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                  >
                    Submit Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setWholesaleModalOpen(false)}
                    className="w-full py-2 px-3 text-xs text-slate-600 hover:bg-slate-100 rounded border border-slate-300 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable 80mm Receipt Modal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          if (entryMode === 'BARCODE') {
            barcodeInputRef.current?.focus();
          } else {
            searchInputRef.current?.focus();
          }
        }}
        invoice={completedInvoice}
        shopSettings={shopSettings}
      />
    </div>
  );
}
