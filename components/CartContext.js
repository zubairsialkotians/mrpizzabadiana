import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHOP_KEY } from '../config';
import { round2, cleanQty } from '../services/qty';
import { money } from '../services/format';

const CartContext = createContext(null);
const CART_KEY = `cart_${SHOP_KEY}`;

export function useCart() {
  const scoped = useContext(ScopeContext);
  const ctx = useContext(CartContext);
  if (scoped) return scoped;
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}

/*
  Cart lines: { item_id, size, name, unit, price, image, qty, min_qty, qty_step, max_qty, qty_options }
  size: '' for normal items; for fast food the size name (S, M, L…) — each size is its own line
  at that size's price. Kept on the phone (works for guests). Prices are refreshed from the
  server on the cart screen, and the server prices the order again when it's placed.
*/
export const lineKey = (itemId, size) => `${itemId}|${size || ''}`;
/*
  Custom item: typed at the counter (name + price), not in the catalogue, no stock (staff only).
  In the app its item_id is a made-up text id ("c…") so each one is its own line; the server gets custom: 1 + name + price.
*/
export const isCustomLine = (l) => !!l.custom;
export const newCustomId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const customLine = ({ id, name, price, qty = 1 }) => ({
  item_id: id || newCustomId(), custom: true, size: '', name: String(name).trim(), unit: 'pcs', price: Number(price) || 0, image: '',
  qty: Number(qty) || 1, min_qty: 1, qty_step: 1, max_qty: null, qty_options: [],
});
// What the server takes for a line (shared by orders, offline orders and order changes)
export const linePayload = (l) => (l.custom
  ? { custom: 1, name: l.name, qty: l.qty, price: l.price }
  : { item_id: l.item_id, size: l.size || '', qty: l.qty, price: l.price, list_price: Math.max(Number(l.was) || 0, Number(l.price) || 0) });
// Catalogue item ids only (custom items aren't on the server's list)
export const catalogueIds = (lines) => [...new Set(lines.filter((l) => !l.custom).map((l) => l.item_id))].join(',');
export const lineName = (l) => (l.size ? `${l.name} (${l.size})` : l.name);
const sizeOf = (p, size) => (p.sizes || []).find((z) => z.name === size);

// Inside <LinesScope value={store}> (changing a placed order's items), useCart() works on that store instead of the cart
const ScopeContext = createContext(null);
export function LinesScope({ value, children }) {
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

// The item's own discount (Items → Discount): its normal price ("was") and how it is shown ("10% off")
const wasOf = (p, size) => Number(size ? sizeOf(p, size)?.was : (p.discount_type ? p.compare_price : 0)) || 0;
const discLabel = (p) => (p.discount_type === 'percent' ? `${Number(p.discount_value)}% off` : p.discount_type === 'fixed' ? `${money(p.discount_value)} off` : '');
// { was, off, label } of a cart / order line with an item discount, or null
export function lineDiscount(l) {
  const was = Number(l.was ?? l.list_price) || 0;
  const price = Number(l.price) || 0;
  if (!(was > price + 0.001)) return null;
  return { was, off: round2((was - price) * (Number(l.qty) || 0)), label: l.disc_label || '' };
}
const lineFrom = (p, qty, size = '') => ({
  item_id: p.id, size: size || '', name: p.name, unit: p.unit, price: size ? sizeOf(p, size)?.price ?? p.price : p.price, image: p.image,
  was: wasOf(p, size), disc_label: discLabel(p),
  min_qty: p.min_qty, qty_step: p.qty_step, max_qty: p.max_qty, qty_options: p.qty_options || [], qty: cleanQty(qty),
});
const same = (l, itemId, size) => l.item_id === itemId && (l.size || '') === (size || '');

/*
  Lines with the cart's rules (add, set, remove, sizes as their own lines). The cart uses it, and so does
  changing the items of an order already placed (PosOrderScreen), so the shop grid and order panel work for both.
*/
export function useLineStore(initial = []) {
  const [lines, setLines] = useState(initial);

  // Adds to what's already there
  const add = useCallback((p, qty, size = '') => {
    setLines((prev) => {
      const cur = prev.find((l) => same(l, p.id, size));
      if (!cur) return [...prev, lineFrom(p, qty, size)];
      return prev.map((l) => (same(l, p.id, size) ? { ...lineFrom(p, l.qty + qty, size), price: l.price } : l));
    });
  }, []);

  // Sets the exact quantity (0 removes)
  const setQty = useCallback((itemId, qty, product, size = '') => {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => !same(l, itemId, size));
      const cur = prev.find((l) => same(l, itemId, size));
      if (!cur) return product ? [...prev, lineFrom(product, qty, size)] : prev;
      return prev.map((l) => (same(l, itemId, size) ? { ...l, qty: cleanQty(qty) } : l));
    });
  }, []);

  const remove = useCallback((itemId, size = '') => setLines((prev) => prev.filter((l) => !same(l, itemId, size))), []);
  // A custom item (name + price) as its own line
  const addCustom = useCallback((c) => setLines((prev) => [...prev, customLine(c)]), []);
  const clearLines = useCallback(() => setLines([]), []);

  // Fresh product data from the server: update prices/limits, drop what's gone (incl. removed sizes)
  const sync = useCallback((products) => {
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    setLines((prev) => prev
      .filter((l) => {
        if (l.custom) return true;
        const p = byId[l.item_id];
        if (!p) return false;
        const sized = (p.sizes || []).length > 0;
        return sized ? !!sizeOf(p, l.size) : !l.size;
      })
      .map((l) => (l.custom ? l : { ...lineFrom(byId[l.item_id], l.qty, l.size), qty: l.qty })));
  }, []);

  // Only the quantity rules and photo (keeps prices and lines no longer in the catalogue: placed orders)
  const applyRules = useCallback((products) => {
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    setLines((prev) => prev.map((l) => {
      const p = byId[l.item_id];
      return p ? { ...l, min_qty: p.min_qty, qty_step: p.qty_step, qty_options: p.qty_options || [], image: l.image || p.image } : l;
    }));
  }, []);

  return useMemo(() => ({
    lines, setLines, add, addCustom, setQty, remove, clear: clearLines, sync, applyRules,
    count: lines.length,
    // qtyOf(id): all sizes together; qtyOf(id, size): that size only
    qtyOf: (id, size) => lines.filter((l) => l.item_id === id && (size === undefined || (l.size || '') === (size || '')))
      .reduce((a, l) => a + l.qty, 0),
    subtotal: round2(lines.reduce((a, l) => a + round2(l.qty * l.price), 0)),
  }), [lines, add, addCustom, setQty, remove, clearLines, sync, applyRules]);
}

export function CartProvider({ children }) {
  const store = useLineStore();
  const { lines, setLines } = store;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CART_KEY)
      .then((raw) => { if (raw) setLines(JSON.parse(raw) || []); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(CART_KEY, JSON.stringify(lines)).catch(() => {});
  }, [lines, loaded]);

  const value = useMemo(() => ({ ...store, loaded }), [store, loaded]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
