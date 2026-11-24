import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SHOP_KEY } from '../config';
import { round2, cleanQty } from '../services/qty';

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
export const lineName = (l) => (l.size ? `${l.name} (${l.size})` : l.name);
const sizeOf = (p, size) => (p.sizes || []).find((z) => z.name === size);

// Inside <LinesScope value={store}> (changing a placed order's items), useCart() works on that store instead of the cart
const ScopeContext = createContext(null);
export function LinesScope({ value, children }) {
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

const lineFrom = (p, qty, size = '') => ({
  item_id: p.id, size: size || '', name: p.name, unit: p.unit, price: size ? sizeOf(p, size)?.price ?? p.price : p.price, image: p.image,
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
  const clearLines = useCallback(() => setLines([]), []);

  // Fresh product data from the server: update prices/limits, drop what's gone (incl. removed sizes)
  const sync = useCallback((products) => {
    const byId = Object.fromEntries(products.map((p) => [p.id, p]));
    setLines((prev) => prev
      .filter((l) => {
        const p = byId[l.item_id];
        if (!p) return false;
        const sized = (p.sizes || []).length > 0;
        return sized ? !!sizeOf(p, l.size) : !l.size;
      })
      .map((l) => ({ ...lineFrom(byId[l.item_id], l.qty, l.size), qty: l.qty })));
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
    lines, setLines, add, setQty, remove, clear: clearLines, sync, applyRules,
    count: lines.length,
    // qtyOf(id): all sizes together; qtyOf(id, size): that size only
    qtyOf: (id, size) => lines.filter((l) => l.item_id === id && (size === undefined || (l.size || '') === (size || '')))
      .reduce((a, l) => a + l.qty, 0),
    subtotal: round2(lines.reduce((a, l) => a + round2(l.qty * l.price), 0)),
  }), [lines, add, setQty, remove, clearLines, sync, applyRules]);
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
