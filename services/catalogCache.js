import * as FileSystem from 'expo-file-system';
import { SHOP_KEY } from '../config';

const getShopKey = () => SHOP_KEY;

/*
  Menu on this device (staff): the shop's categories and items saved in a file, so taking orders
  doesn't ask the server for the catalogue each time. Used only while a staff login is in the app
  (customers on the same phone always see the live menu). Off until staff press "Save menu on this device";
  "Use live menu" deletes the file and everything goes back to the server.
  One file per shop (the shop key), so logging in to another shop never mixes menus.
  Stock and prices on the device are as of the last sync; the server still checks both when an order is placed.
*/

// Server calls without the cache (set by api.js, so this file doesn't import it)
let liveFetch = null;
export function setCatalogueFetcher(fn) { liveFetch = fn; }

const fileOf = (key) => `${FileSystem.documentDirectory}menu_${String(key).replace(/[^a-zA-Z0-9]/g, '')}.json`;

let memo = { key: null, data: undefined }; // data: null = no saved menu for this shop
let syncing = null;
let again = false;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(); } catch (_) { /* ignore */ } });

// UI status: { saved, syncing, synced_at, products, categories, error }
let lastError = '';
export function catalogueStatus() {
  const d = allowed && memo.key === getShopKey() ? memo.data : null;
  return {
    saved: !!d, syncing: !!syncing, synced_at: d?.synced_at || null,
    products: d?.products?.length || 0, categories: d?.categories?.length || 0, error: lastError,
  };
}
export function onCatalogueChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// Only staff use the saved menu (set by AuthContext)
let allowed = false;
export function setCatalogueAllowed(on) {
  if (allowed === !!on) return;
  allowed = !!on;
  emit();
}

// The saved menu of the logged-in shop, or null (read from the file once per shop)
export async function savedCatalogue() {
  const key = getShopKey();
  if (!key || !allowed) return null;
  if (memo.key === key && memo.data !== undefined) return memo.data;
  let data = null;
  try {
    const raw = await FileSystem.readAsStringAsync(fileOf(key));
    data = JSON.parse(raw);
    if (!data || !Array.isArray(data.products) || !Array.isArray(data.categories)) data = null;
  } catch (_) {
    data = null; // no file yet
  }
  if (getShopKey() === key) { memo = { key, data }; emit(); }
  return data;
}

// Downloads every category and item and saves them (replaces the old copy only when all of it arrived)
export function syncCatalogue() {
  if (syncing) { again = true; return syncing; }
  const key = getShopKey();
  syncing = (async () => {
    lastError = '';
    emit();
    try {
      if (!liveFetch) throw new Error('Not ready');
      const cats = await liveFetch('/categories');
      const products = [];
      for (let page = 1; page < 500; page += 1) {
        const r = await liveFetch('/products', { page, per_page: 60 });
        products.push(...(r.products || []));
        if (!r.has_more) break;
      }
      const data = { synced_at: new Date().toISOString(), categories: cats.categories || [], products };
      if (getShopKey() !== key) return; // logged in to another shop meanwhile
      await FileSystem.writeAsStringAsync(fileOf(key), JSON.stringify(data));
      memo = { key, data };
    } catch (e) {
      lastError = e.message || 'Could not save the menu';
      throw e;
    } finally {
      syncing = null;
      emit();
      if (again) { again = false; refreshCatalogue(); }
    }
  })();
  return syncing;
}

// After staff change items / categories / stock in the app: bring the saved copy up to date (only if there is one)
export function refreshCatalogue() {
  savedCatalogue().then((d) => { if (d) syncCatalogue().catch(() => {}); }).catch(() => {});
}

export async function clearCatalogue() {
  const key = getShopKey();
  if (!key) return;
  try { await FileSystem.deleteAsync(fileOf(key), { idempotent: true }); } catch (_) { /* already gone */ }
  memo = { key, data: null };
  lastError = '';
  emit();
}

/* ---- Answers in the same shape as the server, from the saved menu ---- */

export function localCategories(d) {
  return { success: true, categories: d.categories };
}

// /products: category_id, featured, search (name), ids, page, per_page — same order as the server (featured first, then name)
export function localProducts(d, p = {}) {
  let list = d.products;
  const cat = Number(p.category_id) || 0;
  if (cat) list = list.filter((x) => x.category_id === cat);
  if (p.featured) list = list.filter((x) => x.featured);
  const q = String(p.search || '').trim().toLowerCase();
  if (q) list = list.filter((x) => x.name.toLowerCase().includes(q));
  if (p.ids) {
    const ids = new Set(String(p.ids).split(',').map(Number).filter(Boolean));
    list = list.filter((x) => ids.has(x.id));
  }
  const per = Math.min(60, Math.max(1, Number(p.per_page) || 30));
  const page = Math.max(1, Number(p.page) || 1);
  const items = list.slice((page - 1) * per, page * per);
  return { success: true, products: items, page, has_more: list.length > page * per };
}

export function localProduct(d, id) {
  const x = d.products.find((p) => p.id === Number(id));
  if (!x) return null;
  const cat = d.categories.find((c) => c.id === x.category_id);
  return { success: true, product: { ...x, category_name: cat?.name || '' } };
}
