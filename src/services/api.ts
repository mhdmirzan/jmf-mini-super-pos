import { webApiInvoke } from './webApi';

/**
 * API service layer - wraps electronAPI.invoke calls or Web API adapter.
 * Works seamlessly in both Desktop (Electron offline SQLite) and Web (Cloudflare D1).
 */

function newEntityId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Write catalog / stock changes to local SQLite (Electron) and Cloudflare D1
 * with the same IDs so new products and stock are kept on the server.
 */
async function persistToServer(channel: string, payload: any) {
  let localResult: any = null;
  let cloudResult: any = null;

  if (window.electronAPI) {
    try {
      localResult = await window.electronAPI.invoke(channel, payload);
    } catch (err) {
      console.warn(`[Persist] Local ${channel} failed:`, err);
    }
  }

  try {
    cloudResult = await webApiInvoke(channel, payload);
  } catch (err) {
    console.warn(`[Persist] Cloud ${channel} failed:`, err);
  }

  if (localResult?.success) {
    return { ...localResult, syncedToServer: !!(cloudResult && cloudResult.success) };
  }
  if (cloudResult?.success) {
    return { ...cloudResult, syncedToServer: true };
  }
  return {
    success: false,
    error: cloudResult?.error || localResult?.error || 'Failed to save data to the server',
  };
}

const api = {
  invoke: (channel: string, ...args: any[]) => {
    if (window.electronAPI) {
      return window.electronAPI.invoke(channel, ...args);
    }
    // Web browser fallback to Cloudflare Worker REST API
    return webApiInvoke(channel, args[0]);
  },

  on: (channel: string, callback: (...args: any[]) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.on(channel, callback);
    }
    return () => {};
  },
};

// ─── AUTH ───
export const authService = {
  login: (username: string, password: string) =>
    api.invoke('auth:login', { username, password }),
  verify: (userId: string) =>
    api.invoke('auth:verify', { userId }),
  getActiveUsers: () =>
    api.invoke('auth:getActiveUsers'),
};

// ─── USERS ───
export const userService = {
  create: (data: any) => api.invoke('users:create', data),
  update: (data: any) => api.invoke('users:update', data),
  list: (requesterRole?: string) => api.invoke('users:list', requesterRole),
  get: (id: string) => api.invoke('users:get', { id }),
};

// ─── PRODUCTS ───
export const productService = {
  create: (data: any) => persistToServer('products:create', { ...data, id: data.id || newEntityId() }),
  update: (data: any) => persistToServer('products:update', data),
  delete: (id: string) => persistToServer('products:delete', { id }),
  list: (filters?: any) => api.invoke('products:list', filters),
  get: (id: string) => api.invoke('products:get', { id }),
  search: (query: string) => api.invoke('products:search', { query }),
  getByItemCode: (itemCode: string) => api.invoke('products:getByItemCode', { itemCode }),
};

// ─── CATEGORIES ───
export const categoryService = {
  create: (data: any) => persistToServer('categories:create', { ...data, id: data.id || newEntityId() }),
  update: (data: any) => persistToServer('categories:update', data),
  list: () => api.invoke('categories:list'),
};

export const subCategoryService = {
  create: (data: any) => persistToServer('subcategories:create', { ...data, id: data.id || newEntityId() }),
  update: (data: any) => persistToServer('subcategories:update', data),
  list: (categoryId?: string) => api.invoke('subcategories:list', { categoryId }),
};

// ─── INVOICES ───
export const invoiceService = {
  create: (data: any) => api.invoke('invoices:create', data),
  cancel: (data: any) => api.invoke('invoices:cancel', data),
  list: (filters?: any) => api.invoke('invoices:list', filters),
  get: (id: string) => api.invoke('invoices:get', { id }),
};

// ─── RETURNS ───
export const returnService = {
  create: (data: any) => api.invoke('returns:create', data),
  list: (filters?: any) => api.invoke('returns:list', filters),
  get: (id: string) => api.invoke('returns:get', { id }),
};

// ─── STOCK ───
export const stockService = {
  adjust: async (data: any) => {
    if (window.electronAPI) {
      const local = await window.electronAPI.invoke('stock:adjust', data);
      if (local?.success) {
        try {
          await webApiInvoke('stock:adjust', {
            ...data,
            newQuantity: local.newQuantity,
          });
        } catch (err) {
          console.warn('[Persist] Cloud stock adjust failed:', err);
        }
        return local;
      }
    }
    return webApiInvoke('stock:adjust', data);
  },
  movements: (filters?: any) => api.invoke('stock:movements', filters),
};

// ─── SETTINGS ───
export const settingsService = {
  get: (key?: string) => api.invoke('settings:get', { key }),
  set: (data: any) => persistToServer('settings:set', data),
};

// ─── SYSTEM ───
export const systemService = {
  getDeviceId: () => api.invoke('system:getDeviceId'),
  getDbStatus: () => api.invoke('system:getDbStatus'),
};

// ─── SYNC ───
export const syncService = {
  status: () => api.invoke('sync:status'),
  trigger: () => api.invoke('sync:trigger'),
};

// ─── AUDIT ───
export const auditService = {
  list: (filters?: any) => api.invoke('audit:list', filters),
};

// ─── REPORTS ───
export const reportService = {
  dailySales: (date: string) => api.invoke('reports:dailySales', { date }),
  monthlySales: (year: number, month: number) => api.invoke('reports:monthlySales', { year, month }),
  productSales: (filters?: any) => api.invoke('reports:productSales', filters),
  lowStock: () => api.invoke('reports:lowStock'),
  stockValue: () => api.invoke('reports:stockValue'),
};

// ─── APPROVALS (Hybrid Local SQLite + Cloudflare D1 Dual Sync) ───
export const approvalService = {
  create: async (data: { requestType?: string; cashierId?: string; cashierName?: string; deviceId?: string; details?: string }) => {
    // Generate identical unique ID for both local SQLite and Cloudflare D1
    const requestId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : (Date.now().toString(36) + Math.random().toString(36).substring(2));
    const payload = { ...data, id: requestId };

    let localResult: any = null;
    let cloudResult: any = null;

    if (window.electronAPI) {
      try {
        localResult = await window.electronAPI.invoke('approval:create', payload);
      } catch (err) {
        console.warn('[Approval] Local create error:', err);
      }
    }

    try {
      cloudResult = await webApiInvoke('approval:create', payload);
    } catch (err) {
      console.warn('[Approval] Cloud create error:', err);
    }

    if (localResult && localResult.success) return { success: true, requestId: localResult.requestId || requestId };
    if (cloudResult && cloudResult.success) return { success: true, requestId: cloudResult.requestId || requestId };
    return { success: false, error: cloudResult?.error || localResult?.error || 'Failed to create approval request' };
  },

  getPending: async () => {
    let localReqs: any[] = [];
    let cloudReqs: any[] = [];

    if (window.electronAPI) {
      try {
        const res = await window.electronAPI.invoke('approval:getPending');
        if (res && res.success && Array.isArray(res.requests)) {
          localReqs = res.requests;
        }
      } catch (err) {
        console.warn('[Approval] Local getPending error:', err);
      }
    }

    try {
      const res = await webApiInvoke('approval:getPending');
      if (res && res.success && Array.isArray(res.requests)) {
        cloudReqs = res.requests;
      }
    } catch (err) {
      console.warn('[Approval] Cloud getPending error:', err);
    }

    // Merge pending requests across local SQLite and cloud D1
    const mergedMap = new Map<string, any>();
    for (const r of localReqs) mergedMap.set(r.id, r);
    for (const r of cloudReqs) mergedMap.set(r.id, r);

    return {
      success: true,
      requests: Array.from(mergedMap.values()).filter((r) => r.status === 'PENDING'),
    };
  },

  check: async (requestId: string) => {
    let localReq: any = null;
    let cloudReq: any = null;

    if (window.electronAPI) {
      try {
        const res = await window.electronAPI.invoke('approval:check', { requestId });
        if (res && res.success && res.request) {
          localReq = res.request;
          if (localReq.status === 'APPROVED' || localReq.status === 'REJECTED') {
            return { success: true, request: localReq };
          }
        }
      } catch (err) {
        console.warn('[Approval] Local check error:', err);
      }
    }

    try {
      const res = await webApiInvoke('approval:check', { requestId });
      if (res && res.success && res.request) {
        cloudReq = res.request;
        if (cloudReq.status === 'APPROVED' || cloudReq.status === 'REJECTED') {
          // If approved on cloud, sync status down to local SQLite
          if (window.electronAPI) {
            window.electronAPI.invoke('approval:respond', {
              requestId,
              status: cloudReq.status,
              approvedBy: cloudReq.approved_by,
              approvedByName: cloudReq.approved_by_name,
            }).catch(() => {});
          }
          return { success: true, request: cloudReq };
        }
      }
    } catch (err) {
      console.warn('[Approval] Cloud check error:', err);
    }

    if (localReq) return { success: true, request: localReq };
    if (cloudReq) return { success: true, request: cloudReq };
    return { success: false, error: 'Request not found' };
  },

  respond: async (data: { requestId: string; status: 'APPROVED' | 'REJECTED'; approvedBy?: string; approvedByName?: string }) => {
    let localOk = false;
    let cloudOk = false;

    if (window.electronAPI) {
      try {
        const res = await window.electronAPI.invoke('approval:respond', data);
        if (res && res.success) localOk = true;
      } catch (err) {
        console.warn('[Approval] Local respond error:', err);
      }
    }

    try {
      const res = await webApiInvoke('approval:respond', data);
      if (res && res.success) cloudOk = true;
    } catch (err) {
      console.warn('[Approval] Cloud respond error:', err);
    }

    return { success: localOk || cloudOk };
  },

  verifyAdmin: async (credentials: { username: string; password: string }) => {
    if (window.electronAPI) {
      return window.electronAPI.invoke('approval:verifyAdmin', credentials);
    }
    return webApiInvoke('approval:verifyAdmin', credentials);
  },
};
