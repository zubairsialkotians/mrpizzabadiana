import { API_BASE, SHOP_KEY } from '../config';
import { setCatalogueFetcher, savedCatalogue, refreshCatalogue, localCategories, localProducts, localProduct } from './catalogCache';

export class AuthError extends Error {}

const BASE = `${API_BASE}/wp-json/shop/v1`;

let sessionToken = null;
let onAuthError = null;
export function setSessionToken(token) { sessionToken = token; }
export function setAuthErrorHandler(fn) { onAuthError = fn; }

function query(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) q.set(k, String(v));
  });
  q.set('nocache', String(Date.now()));
  return q.toString();
}

// Every call names the shop (shop_key) and, when logged in, the session (Bearer + token param:
// some hosts strip the Authorization header). The shop key goes as a param, not a header,
// so browsers don't need a CORS preflight for it.
async function request(method, path, data = {}) {
  const headers = { Accept: 'application/json' };
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;
  const payload = { ...data, shop_key: SHOP_KEY, ...(sessionToken ? { token: sessionToken } : {}) };

  let res;
  try {
    if (method === 'GET') {
      res = await fetch(`${BASE}${path}?${query(payload)}`, { headers });
    } else {
      headers['Content-Type'] = 'application/json';
      res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(payload) });
    }
  } catch (e) {
    throw new Error('No internet connection. Please try again.');
  }

  const body = await res.json().catch(() => null);
  if (res.status === 401 && sessionToken && !['/login', '/password/reset'].includes(path)) {
    onAuthError?.(body?.message);
    throw new AuthError(body?.message || 'Please log in again');
  }
  if (!res.ok || body?.success === false) {
    const err = new Error(body?.message || `Request failed (${res.status})`);
    err.data = body;
    err.status = res.status;
    throw err;
  }
  return body;
}

const get = (path, params) => request('GET', path, params);
const post = (path, data) => request('POST', path, data);
setCatalogueFetcher(get);

// Staff: menu saved on this device (My account → Menu on this device) is served from there; otherwise the server as before
async function fromMenu(local, live) {
  const d = await savedCatalogue().catch(() => null);
  if (d) {
    const r = local(d);
    if (r) return r;
  }
  return live();
}
// Staff changed the catalogue or stock here: update the saved copy in the background
const changesMenu = (fn) => async (...args) => { const r = await fn(...args); refreshCatalogue(); return r; };

export const api = {
  // Storefront
  shop: () => get('/shop'),
  categories: () => fromMenu((d) => localCategories(d), () => get('/categories')),
  products: (p) => fromMenu((d) => localProducts(d, p), () => get('/products', p)),
  product: (id) => fromMenu((d) => localProduct(d, id), () => get('/products/view', { id })),
  placeOrder: (d) => post('/orders/place', d),
  trackOrder: (id, key) => get('/orders/track', { id, key }),
  sendPaymentProof: (id, image, key) => post('/orders/payment-proof', { id, image, key }),
  reviewOrder: (id, rating, comment, key) => post('/orders/review', { id, rating, comment, key }),

  // Account
  register: (d) => post('/register', d),
  login: (login, password) => post('/login', { login, password }),
  forgotPassword: (email) => post('/password/forgot', { email }),
  resetPassword: (email, code, password) => post('/password/reset', { email, code, password }),
  me: () => get('/me'),
  saveProfile: (d) => post('/me/save', d),
  deleteAccount: () => post('/me/delete'),
  changePassword: (current_password, new_password) => post('/change-password', { current_password, new_password }),
  logout: (push_token) => post('/logout', { push_token }),
  savePushToken: (push_token, remove = false) => post('/push-token', { push_token, remove }),
  registerDevice: (push_token, platform) => post('/devices/register', { push_token, platform }),

  // News
  news: (p) => get('/news', p),
  newsItem: (id) => get('/news/view', { id }),
  banners: () => get('/banners'),

  myOrders: (p) => get('/my/orders', p),
  myOrder: (id) => get('/my/orders/view', { id }),
  cancelMyOrder: (id, reason) => post('/my/orders/cancel', { id, reason }),

  // Staff
  dashboard: (p) => get('/admin/dashboard', p),
  adminOrders: (p) => get('/admin/orders', p),
  adminOrder: (id) => get('/admin/orders/view', { id }),
  setOrderStatus: (id, status, reason) => post('/admin/orders/status', { id, status, reason }),
  assignOrder: (id, branch_id) => post('/admin/orders/assign', { id, branch_id }),
  setPaymentStatus: (id, status, note) => post('/admin/orders/payment', { id, status, note }),
  returns: (p) => get('/admin/returns', p),
  saveReturn: (d) => post('/admin/returns/save', d),
  reviews: (p) => get('/admin/reviews', p),

  adminCategories: () => get('/admin/categories'),
  saveCategory: changesMenu((d) => post('/admin/categories/save', d)),
  adminItems: (p) => get('/admin/items', p),
  saveItem: changesMenu((d) => post('/admin/items/save', d)),
  uploadImage: (image, title) => post('/admin/media/upload', { image, title }),

  stock: (p) => get('/admin/stock', p),
  adjustStock: changesMenu((d) => post('/admin/stock/adjust', d)),
  stockMoves: (p) => get('/admin/stock/moves', p),

  customers: (p) => get('/admin/customers', p),
  branches: () => get('/admin/branches'),
  saveBranch: (d) => post('/admin/branches/save', d),
  settings: () => get('/admin/settings'),
  saveSettings: (d) => post('/admin/settings/save', d),

  expenses: (p) => get('/admin/expenses', p),
  saveExpense: (d) => post('/admin/expenses/save', d),
  deleteExpense: (id) => post('/admin/expenses/delete', { id }),
  expenseCategories: () => get('/admin/expenses/categories'),

  sellers: () => get('/admin/sellers'),
  salesReport: (p) => get('/admin/reports/sales', p),
  profitLoss: (p) => get('/admin/reports/profit-loss', p),

  adminNews: (p) => get('/admin/news', p),
  saveNews: (d) => post('/admin/news/save', d),
  deleteNews: (id) => post('/admin/news/delete', { id }),

  // Orders taken in the app (owner / branch admin / cashier)
  posPlace: (d) => post('/pos/orders/place', d),
  posUpdate: (d) => post('/pos/orders/update', d),

  // Kitchen & rider logins (owner)
  team: () => get('/admin/team'),
  saveTeamMember: (d) => post('/admin/team/save', d),

  // Kitchen & rider panels
  teamOrders: (p) => get('/team/orders', p),
  teamOrder: (id) => get('/team/orders/view', { id }),
  markReady: (id) => post('/team/orders/ready', { id }),
  riders: (id) => get('/team/riders', { id }),
  assignRider: (id, rider_id) => post('/team/orders/assign-rider', { id, rider_id }),
  acceptOrder: (id) => post('/team/orders/accept', { id }),
  markDelivered: (id) => post('/team/orders/delivered', { id }),

  adminBanners: () => get('/admin/banners'),
  saveBanner: (d) => post('/admin/banners/save', d),
  deleteBanner: (id) => post('/admin/banners/delete', { id }),
};
