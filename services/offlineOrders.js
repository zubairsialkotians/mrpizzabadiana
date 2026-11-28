import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, AuthError } from './api';
import { getShopKey } from '../config';

/*
  Orders (and walk-in returns, kind: 'return') taken with no internet (MasterPOS staff checkout / Return mode).
  The order is kept on this device, its bill printed from what the device knows, and it is sent to the
  server as soon as the internet is back (OfflineSync in App.js tries every 30 s and when the app opens).
  Each order has offline_ref, made on the device before the first try: the server makes one order per ref,
  so sending again (a lost answer, two tries at once) never makes a second order.
  Sent with offline=1 + offline_at, the server keeps the device's prices, delivery fee and time, and records
  the sale even when stock is short. One list per shop (shop key): it is sent when that shop's staff log in.
  An order the server refuses (e.g. monthly plan limit) is held with the reason until staff retry or discard it.
*/

const keyOf = (shopKey) => `offline_orders_${shopKey}`;

let memo = { key: null, list: [] };
let sending = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => { try { fn(); } catch (_) { /* ignore */ } });
export function onOfflineChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// A ref the server has never seen: time + random, e.g. "M3K9X1AB-7Q2ZP0LD"
export const newOrderRef = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();

// This device's clock as the server stores times (shop time, "Y-m-d H:i:s")
export function localTime(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

async function load() {
  const key = getShopKey();
  if (!key) return [];
  if (memo.key === key) return memo.list;
  let list = [];
  try {
    const raw = await AsyncStorage.getItem(keyOf(key));
    list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
  } catch (_) {
    list = [];
  }
  if (getShopKey() === key) { memo = { key, list }; emit(); }
  return list;
}

async function save(key, list) {
  if (memo.key === key) { memo = { key, list }; emit(); }
  await AsyncStorage.setItem(keyOf(key), JSON.stringify(list));
}

// UI status of the logged-in shop: { waiting, failed, sending, orders }
export function offlineStatus() {
  const list = memo.key === getShopKey() ? memo.list : [];
  return { waiting: list.filter((o) => !o.error).length, failed: list.filter((o) => o.error).length, sending: !!sending, orders: list };
}
export const loadOffline = load;

// Keep an order that could not reach the server. payload: what /pos/orders/place takes (with offline_ref); order: the bill
export async function queueOrder({ payload, order }) {
  const key = getShopKey();
  const list = await load();
  if (list.some((o) => o.ref === payload.offline_ref)) return;
  await save(key, [...list, { ref: payload.offline_ref, at: order.created_at, payload, order, error: '', tries: 0 }]);
}

// Keep a walk-in return that could not reach the server. payload: what /pos/returns/place takes (with return_ref); slip: what was printed
export async function queueReturn({ payload, slip }) {
  const key = getShopKey();
  const list = await load();
  if (list.some((o) => o.ref === payload.return_ref)) return;
  await save(key, [...list, { kind: 'return', ref: payload.return_ref, at: slip.created_at, payload, order: slip, error: '', tries: 0 }]);
}

// Send the waiting orders (and returns), oldest first. Stops at the first "no internet"; a refused order is held with its reason.
export function sendQueued() {
  if (sending) return sending;
  const key = getShopKey();
  sending = (async () => {
    let sent = 0;
    emit();
    try {
      const list = await load();
      for (const entry of list.filter((o) => !o.error)) {
        if (getShopKey() !== key) break; // logged in to another shop meanwhile
        try {
          if (entry.kind === 'return') await api.posReturn({ ...entry.payload, return_ref: entry.ref, offline: 1, offline_at: entry.at });
          else await api.posPlace({ ...entry.payload, offline_ref: entry.ref, offline: 1, offline_at: entry.at });
          await save(key, memo.list.filter((o) => o.ref !== entry.ref));
          sent += 1;
        } catch (e) {
          if (e.offline || e instanceof AuthError) break;
          // Server trouble (5xx): try again later. Anything else the server refused: hold it for staff
          const hold = !(e.status >= 500);
          await save(key, memo.list.map((o) => (o.ref === entry.ref
            ? { ...o, tries: (o.tries || 0) + 1, error: hold ? (e.message || 'The server did not accept this order') : '' } : o)));
          if (!hold) break;
        }
      }
    } finally {
      sending = null;
      emit();
    }
    return sent;
  })();
  return sending;
}

// Staff fixed the reason (e.g. upgraded the plan): send it again
export async function retryQueued(ref) {
  const key = getShopKey();
  await load();
  await save(key, memo.list.map((o) => (o.ref === ref ? { ...o, error: '' } : o)));
  return sendQueued();
}

// Staff decided this order should not go to the server (its bill was already printed)
export async function discardQueued(ref) {
  const key = getShopKey();
  await load();
  await save(key, memo.list.filter((o) => o.ref !== ref));
}
