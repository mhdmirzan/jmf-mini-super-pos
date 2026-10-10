import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { syncService, approvalService, billDeletionService, settingsService } from '../services/api';
import type { BillItemDeletion } from '../types';
import { StatusIndicator } from './common/StatusIndicator';

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shopName, setShopName] = useState('');

  // Real-time Wholesale Approvals (For Admin & Super Admin)
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const prevCountRef = useRef(0);
  const roleUpper = (user?.role || '').toUpperCase().trim();
  const isAdminOrSuper = roleUpper === 'ADMIN' || roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN' || roleUpper === 'MANAGER';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await settingsService.get('SHOP_NAME');
        if (cancelled) return;
        const raw =
          res?.setting?.setting_value ??
          res?.value ??
          (typeof res?.setting === 'string' ? res.setting : '');
        if (raw) setShopName(String(raw).trim());
      } catch {
        // keep empty; header falls back to Buyra
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  const checkApprovals = async () => {
    if (!isAdminOrSuper) return;
    try {
      const res = await approvalService.getPending();
      if (res && res.success && Array.isArray(res.requests)) {
        if (res.requests.length > prevCountRef.current) {
          playNotificationChime();
        }
        prevCountRef.current = res.requests.length;
        setPendingApprovals(res.requests);
      }
    } catch (err) {
      console.warn('[Layout] Approvals poll error:', err);
    }
  };

  useEffect(() => {
    if (!isAdminOrSuper) return;
    checkApprovals();
    const interval = setInterval(checkApprovals, 2500);
    return () => clearInterval(interval);
  }, [isAdminOrSuper, user]);

  useEffect(() => {
    const brand = shopName ? `${shopName} · Buyra` : 'Buyra';
    if (isAdminOrSuper && pendingApprovals.length > 0) {
      document.title = `🔔 (${pendingApprovals.length}) Wholesale Approval Request - ${brand}`;
    } else {
      document.title = brand;
    }
  }, [isAdminOrSuper, pendingApprovals.length, shopName]);

  const handleRespondApproval = async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await approvalService.respond({
        requestId,
        status,
        approvedBy: user?.id,
        approvedByName: user?.fullName || user?.username,
      });
      setPendingApprovals((prev) => prev.filter((r) => r.id !== requestId));
      prevCountRef.current = Math.max(0, prevCountRef.current - 1);
    } catch (e: any) {
      alert(`Error responding to request: ${e.message}`);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check sync queue status
  const checkSync = async () => {
    try {
      const result = await syncService.status();
      if (result.success) {
        setPendingSync(result.pendingCount);
      }
    } catch {
      // offline status failure
    }
  };

  useEffect(() => {
    checkSync();
    const interval = setInterval(checkSync, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncService.trigger();
      await checkSync();
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isMenuPage = location.pathname === '/' || location.pathname === '/menu';

  const [viewBillRequestId, setViewBillRequestId] = useState<string | null>(null);

  // Bill item deletion notifications
  const [billDeletionAlerts, setBillDeletionAlerts] = useState<BillItemDeletion[]>([]);
  const [unseenDeletionCount, setUnseenDeletionCount] = useState(0);
  const [deletionPanelOpen, setDeletionPanelOpen] = useState(false);
  const [latestDeletionBanner, setLatestDeletionBanner] = useState<string | null>(null);
  const deletionPrevCountRef = useRef(0);
  const deletionBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshBillDeletions = async () => {
    try {
      const listRes = await billDeletionService.list({
        limit: 15,
        cashierId: isAdminOrSuper ? undefined : user?.id,
        unseenByAdminOnly: isAdminOrSuper ? false : undefined,
      });
      if (listRes.success && Array.isArray(listRes.deletions)) {
        setBillDeletionAlerts(listRes.deletions as BillItemDeletion[]);
      }

      if (isAdminOrSuper) {
        const countRes = await billDeletionService.countUnseenAdmin();
        if (countRes.success) {
          const count = countRes.count || 0;
          if (count > deletionPrevCountRef.current) {
            playNotificationChime();
          }
          deletionPrevCountRef.current = count;
          setUnseenDeletionCount(count);
        }
      }
    } catch (err) {
      console.warn('[Layout] Bill deletion poll error:', err);
    }
  };

  useEffect(() => {
    refreshBillDeletions();
    const interval = setInterval(refreshBillDeletions, 3000);
    const onDeleted = (ev: Event) => {
      const detail = (ev as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) {
        setLatestDeletionBanner(detail.message);
        if (deletionBannerTimerRef.current) clearTimeout(deletionBannerTimerRef.current);
        deletionBannerTimerRef.current = setTimeout(() => setLatestDeletionBanner(null), 12000);
      }
      refreshBillDeletions();
    };
    window.addEventListener('pos:bill-item-deleted', onDeleted);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pos:bill-item-deleted', onDeleted);
      if (deletionBannerTimerRef.current) clearTimeout(deletionBannerTimerRef.current);
    };
  }, [isAdminOrSuper, user?.id]);

  const openDeletionHistory = async () => {
    if (isAdminOrSuper) {
      await billDeletionService.markAdminSeen();
      setUnseenDeletionCount(0);
      deletionPrevCountRef.current = 0;
      navigate('/bill-deletions');
      return;
    }
    setDeletionPanelOpen((v) => !v);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--pos-bg)] select-none">
      {/* Top Operational Bar (Full Width across all users) */}
      <header className="h-11 px-4 bg-white border-b border-[var(--pos-border)] flex items-center justify-between shrink-0 select-none text-xs">
        {/* Left: Back to Menu / Menu Button & Terminal Context */}
        <div className="flex items-center gap-2.5">
          {!isMenuPage ? (
            <button
              type="button"
              onClick={() => navigate('/menu')}
              className="px-2.5 py-1 text-xs font-semibold rounded bg-[var(--pos-bg-subtle)] hover:bg-[var(--pos-border)] text-[var(--pos-text)] border border-[var(--pos-border)] flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Return to Main Menu"
            >
              <span>←</span>
              <span>Main Menu</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--pos-accent)] shrink-0" />
              <span className="font-bold text-[var(--pos-text)] tracking-wider uppercase text-xs">
                {shopName || 'Buyra'}
              </span>
            </div>
          )}

          <span className="text-slate-300">|</span>
          <StatusIndicator
            isOnline={isOnline}
            pendingCount={pendingSync}
            onSync={handleManualSync}
            isSyncing={isSyncing}
          />
          <span className="text-slate-300">|</span>
          <span className="text-[var(--pos-text-muted)]">
            Cashier: <strong className="text-[var(--pos-text)] font-semibold">{user?.fullName || user?.username}</strong>
            <span className="ml-1.5 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[var(--pos-bg-subtle)] text-[var(--pos-text-muted)] border border-[var(--pos-border)]">
              {user?.role}
            </span>
          </span>
        </div>

        {/* Right: Operational shortcuts, Pending Approvals Pill & System Logout Button */}
        <div className="flex items-center gap-3 text-[var(--pos-text-muted)]">
          {/* Pulsing Pending Approvals Badge for Admin */}
          {isAdminOrSuper && pendingApprovals.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-xs rounded-full shadow-md animate-pulse">
              <span className="text-sm">🔔</span>
              <span>{pendingApprovals.length} Approval{pendingApprovals.length > 1 ? 's' : ''} Pending</span>
            </div>
          )}

          {location.pathname === '/pos' && (
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono">
              <span className="px-1.5 py-0.5 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded text-[var(--pos-text)]">F2 Scan</span>
              <span className="px-1.5 py-0.5 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded text-[var(--pos-text)]">F3 Search</span>
              <span className="px-1.5 py-0.5 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded text-[var(--pos-text)]">F8 Pay</span>
              <span className="px-1.5 py-0.5 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded text-[var(--pos-text)]">F9 Complete</span>
              <span className="px-1.5 py-0.5 bg-[var(--pos-bg-subtle)] border border-[var(--pos-border)] rounded text-[var(--pos-text)]">Esc Clear</span>
            </div>
          )}

          {latestDeletionBanner && (
            <div
              className="hidden md:flex max-w-xs lg:max-w-md items-center px-2.5 py-1 rounded border border-amber-200 bg-amber-50 text-[11px] text-amber-950 font-medium leading-snug truncate"
              title={latestDeletionBanner}
            >
              {latestDeletionBanner}
            </div>
          )}

          {/* Bill item deletion notifications (left of Sign Out) */}
          <div className="relative">
            <button
              type="button"
              onClick={openDeletionHistory}
              className="relative text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-2.5 py-1 rounded border border-slate-200 cursor-pointer transition-colors flex items-center gap-1.5"
              title={
                isAdminOrSuper
                  ? 'View bill item deletion notifications'
                  : 'Recent bill item removals'
              }
            >
              <span className="text-sm">🔔</span>
              <span className="hidden sm:inline">Alerts</span>
              {isAdminOrSuper && unseenDeletionCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unseenDeletionCount > 99 ? '99+' : unseenDeletionCount}
                </span>
              )}
            </button>

            {deletionPanelOpen && !isAdminOrSuper && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[9998] cursor-default"
                  aria-label="Close alerts"
                  onClick={() => setDeletionPanelOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-[9999] w-[min(22rem,calc(100vw-2rem))] bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                  <div className="px-3 py-2 bg-slate-900 text-white text-xs font-bold flex justify-between items-center">
                    <span>Bill item alerts</span>
                    <button
                      type="button"
                      className="text-slate-300 hover:text-white cursor-pointer"
                      onClick={() => setDeletionPanelOpen(false)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {billDeletionAlerts.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 text-center">No recent alerts</p>
                    ) : (
                      billDeletionAlerts.slice(0, 8).map((row) => (
                        <div key={row.id} className="p-3 text-xs text-slate-700 leading-snug">
                          {row.message}
                          <div className="text-[10px] text-slate-400 font-mono mt-1">
                            {new Date(row.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* System Logout Button (Visible for all users) */}
          <button
            type="button"
            onClick={handleLogout}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded border border-rose-200 cursor-pointer transition-colors flex items-center gap-1.5"
            title="Sign out of POS terminal"
          >
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Page Viewport (Full width, no left sidebar) */}
      <main className="flex-1 overflow-auto bg-[var(--pos-bg)] flex flex-col min-h-0">
        <Outlet />
      </main>

      {/* Admin Real-Time Wholesale Approval Notification Modal */}
      {isAdminOrSuper && pendingApprovals.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-base">🔔</span>
                <span className="font-bold text-sm">Wholesale Request</span>
              </div>
              <span className="text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded font-mono font-bold">
                Pending
              </span>
            </div>

            <div className="p-4 flex flex-col gap-3">
              {pendingApprovals.slice(0, 1).map((req) => {
                let parsedBill: any = null;
                try {
                  if (req.details && req.details.startsWith('{')) {
                    parsedBill = JSON.parse(req.details);
                  }
                } catch {}

                const isViewBillOpen = viewBillRequestId === req.id;

                return (
                  <div key={req.id} className="flex flex-col gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col gap-1.5 text-xs">
                      <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                        <span className="text-slate-500 font-medium">Cashier</span>
                        <strong className="text-slate-900 font-bold">{req.cashier_name || 'Cashier'}</strong>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                        <span className="text-slate-500 font-medium">Terminal</span>
                        <span className="font-mono font-bold text-slate-800">
                          {req.device_id || 'POS-TERMINAL'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                        <span className="text-slate-500 font-medium">Time</span>
                        <span className="text-slate-600 font-mono">{new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      {parsedBill ? (
                        <div className="pt-1 flex flex-col gap-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-500 font-medium">Bill Items</span>
                            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                              {parsedBill.itemCount || (parsedBill.items ? parsedBill.items.length : 0)} items
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewBillRequestId(isViewBillOpen ? null : req.id)}
                            className="w-full py-1 text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer text-center underline"
                          >
                            {isViewBillOpen ? 'Hide Bill' : 'View Bill'}
                          </button>
                          {isViewBillOpen && parsedBill.items && (
                            <div className="max-h-36 overflow-y-auto bg-white border border-slate-200 rounded p-2 text-[11px] space-y-1">
                              <div className="flex justify-between font-bold text-slate-700 border-b border-slate-200 pb-1">
                                <span>Product</span>
                                <span>Qty × Rate</span>
                              </div>
                              {parsedBill.items.map((it: any, idx: number) => (
                                <div key={idx} className="flex justify-between items-center text-slate-600 py-0.5">
                                  <span className="truncate max-w-[130px] font-medium">{it.name}</span>
                                  <span className="font-mono text-slate-800 text-[10px]">
                                    {(it.unit || '').toUpperCase() === 'KG' ? Number(it.qty).toFixed(3) + ' kg' : Math.floor(it.qty) + ' pcs'} × Rs.{Number(it.rate).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                              {parsedBill.total !== undefined && (
                                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1 mt-1">
                                  <span>Total</span>
                                  <span className="font-mono">Rs. {Number(parsedBill.total).toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : req.details ? (
                        <div className="flex justify-between items-center py-0.5">
                          <span className="text-slate-500 font-medium">Details</span>
                          <span className="font-bold text-amber-700">{req.details}</span>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRespondApproval(req.id, 'REJECTED')}
                        className="flex-1 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg border border-slate-300 cursor-pointer transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRespondApproval(req.id, 'APPROVED')}
                        className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
