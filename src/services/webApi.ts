/**
 * Web API Adapter for Standard Web Browsers (Chrome, Safari, Mobile, Cloudflare Pages)
 * When running outside of Electron (window.electronAPI is undefined),
 * this adapter routes all frontend requests directly to the Cloudflare Worker REST API.
 */

const BASE_URL = (import.meta.env.VITE_CLOUD_API_URL || 'https://jmf-mini-super-pos-worker.jmfminisuper.workers.dev').replace(/\/+$/, '');

async function fetchJson(url: string, options: RequestInit = {}): Promise<any> {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { success: false, error: data?.error || `HTTP ${res.status}` };
    }
    return data && typeof data === 'object' ? { success: true, ...data } : { success: true };
  } catch (err: any) {
    console.error(`[Web API] Network error for ${url}:`, err);
    return { success: false, error: err.message || 'Network request failed' };
  }
}

export async function webApiInvoke(channel: string, payload?: any): Promise<any> {
  const url = BASE_URL;

  switch (channel) {
    // ─── AUTH ───
    case 'auth:login':
      return fetchJson(`${url}/api/auth/login`, { method: 'POST', body: JSON.stringify(payload) });
    case 'auth:verify':
      return fetchJson(`${url}/api/auth/verify`, { method: 'POST', body: JSON.stringify(payload) });
    case 'auth:getActiveUsers':
      return fetchJson(`${url}/api/users?activeOnly=true`);

    // ─── USERS ───
    case 'users:create':
      return fetchJson(`${url}/api/users`, { method: 'POST', body: JSON.stringify(payload) });
    case 'users:update':
      return fetchJson(`${url}/api/users/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    case 'users:list':
      return fetchJson(`${url}/api/users`);
    case 'users:get':
      return fetchJson(`${url}/api/users/${payload.id}`);

    // ─── PRODUCTS ───
    case 'products:create':
      return fetchJson(`${url}/api/products`, { method: 'POST', body: JSON.stringify(payload) });
    case 'products:update':
      return fetchJson(`${url}/api/products/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    case 'products:delete':
      return fetchJson(`${url}/api/products/${payload.id}`, { method: 'DELETE' });
    case 'products:list': {
      const q = payload ? new URLSearchParams(payload).toString() : '';
      return fetchJson(`${url}/api/products${q ? `?${q}` : ''}`);
    }
    case 'products:get':
      return fetchJson(`${url}/api/products/${payload.id}`);
    case 'products:search':
      return fetchJson(`${url}/api/products/search?q=${encodeURIComponent(payload.query || '')}`);
    case 'products:getByBarcode':
      return fetchJson(`${url}/api/products/barcode/${encodeURIComponent(payload.barcode || '')}`);
    case 'products:getByItemCode':
      return fetchJson(`${url}/api/products/code/${encodeURIComponent(payload.itemCode || '')}`);

    // ─── CATEGORIES & SUB-CATEGORIES ───
    case 'categories:create':
      return fetchJson(`${url}/api/categories`, { method: 'POST', body: JSON.stringify(payload) });
    case 'categories:update':
      return fetchJson(`${url}/api/categories/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    case 'categories:list':
      return fetchJson(`${url}/api/categories`);
    case 'subcategories:create':
      return fetchJson(`${url}/api/subcategories`, { method: 'POST', body: JSON.stringify(payload) });
    case 'subcategories:update':
      return fetchJson(`${url}/api/subcategories/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    case 'subcategories:list': {
      const catId = payload?.categoryId ? `?categoryId=${encodeURIComponent(payload.categoryId)}` : '';
      return fetchJson(`${url}/api/subcategories${catId}`);
    }

    // ─── INVOICES ───
    case 'invoices:create':
      return fetchJson(`${url}/api/invoices`, { method: 'POST', body: JSON.stringify(payload) });
    case 'invoices:cancel':
      return fetchJson(`${url}/api/invoices/${payload.id}/cancel`, { method: 'POST', body: JSON.stringify(payload) });
    case 'invoices:list': {
      const q = payload ? new URLSearchParams(payload).toString() : '';
      return fetchJson(`${url}/api/invoices${q ? `?${q}` : ''}`);
    }
    case 'invoices:get':
      return fetchJson(`${url}/api/invoices/${payload.id}`);

    // ─── RETURNS ───
    case 'returns:create':
      return fetchJson(`${url}/api/returns`, { method: 'POST', body: JSON.stringify(payload) });
    case 'returns:list': {
      const q = payload ? new URLSearchParams(payload).toString() : '';
      return fetchJson(`${url}/api/returns${q ? `?${q}` : ''}`);
    }
    case 'returns:get':
      return fetchJson(`${url}/api/returns/${payload.id}`);

    // ─── STOCK ───
    case 'stock:adjust':
      return fetchJson(`${url}/api/stock/adjust`, { method: 'POST', body: JSON.stringify(payload) });
    case 'stock:movements': {
      const q = payload ? new URLSearchParams(payload).toString() : '';
      return fetchJson(`${url}/api/stock/movements${q ? `?${q}` : ''}`);
    }

    // ─── SETTINGS ───
    case 'settings:get':
      return fetchJson(`${url}/api/settings${payload?.key ? `?key=${encodeURIComponent(payload.key)}` : ''}`);
    case 'settings:set':
      return fetchJson(`${url}/api/settings`, { method: 'POST', body: JSON.stringify(payload) });

    // ─── SYSTEM & SYNC ───
    case 'system:getDeviceId':
      return { success: true, deviceId: 'WEB-TERMINAL' };
    case 'sync:status':
      return { success: true, pendingCount: 0, apiUrl: url };
    case 'sync:trigger':
      return { success: true, message: 'Directly connected to Cloudflare D1' };

    // ─── REPORTS ───
    case 'reports:dailySales':
      return fetchJson(`${url}/api/reports/daily?date=${payload?.date || ''}`);
    case 'reports:monthlySales':
      return fetchJson(`${url}/api/reports/monthly?yearMonth=${payload?.yearMonth || ''}`);
    case 'reports:topProducts':
      return fetchJson(`${url}/api/reports/top-products`);
    case 'reports:cashierSummary':
      return fetchJson(`${url}/api/reports/cashiers?date=${payload?.date || ''}`);
    case 'reports:stockValue':
      return fetchJson(`${url}/api/reports/stock-value`);

    // ─── APPROVALS (Wholesale Mode & Overrides) ───
    case 'approval:create':
      return fetchJson(`${url}/api/approvals`, { method: 'POST', body: JSON.stringify(payload) });
    case 'approval:getPending':
      return fetchJson(`${url}/api/approvals`);
    case 'approval:check':
      return fetchJson(`${url}/api/approvals/${payload.requestId}`);
    case 'approval:respond':
      return fetchJson(`${url}/api/approvals/${payload.requestId}`, { method: 'PUT', body: JSON.stringify(payload) });
    case 'approval:verifyAdmin':
      return fetchJson(`${url}/api/approvals/verify-admin`, { method: 'POST', body: JSON.stringify(payload) });

    default:
      console.warn(`[Web API] Unhandled channel: ${channel}`);
      return { success: false, error: `Channel ${channel} not supported in web mode` };
  }
}
