import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';
import { useCart } from './CartContext';
import { api } from '../services/api';
import { minOf, nextQty } from '../services/qty';

/*
  Barcode / QR scanners (USB or Bluetooth "keyboard" scanners, desktop and web):
  a scanner types the code a few milliseconds per key and then presses Enter.
  useBarcodeScanner watches every keystroke on the page, so a scan works even while another field
  (search, customer phone, cash…) has focus. What the scanner typed into that field is taken out again.
  Typing at human speed is left alone. Phones and tablets (no keyboard events) are not affected.
*/
const MAX_GAP_MS = 50; // longest pause between two scanner keystrokes
const MIN_LENGTH = 3; // shortest code taken as a scan

// Change a React-controlled input's value so React's state follows
function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
const isTextField = (el) => typeof HTMLElement !== 'undefined' && (el instanceof HTMLTextAreaElement
  || (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit'].includes(el.type)));

// onScan(code); enabled: false pauses it (e.g. while another screen is on top)
export function useBarcodeScanner(onScan, enabled = true) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return undefined;
    let buffer = '';
    let lastTime = 0;
    let target = null; // element focused when the burst started
    let startValue = null; // its value before the burst
    const reset = () => { buffer = ''; target = null; startValue = null; };

    function onKeyDown(e) {
      const el = document.activeElement;
      const now = Date.now();
      const fast = now - lastTime <= MAX_GAP_MS;

      if (e.key === 'Enter') {
        if (fast && buffer.length >= MIN_LENGTH) {
          // A scan: keep this Enter away from the field and the page's shortcuts, and undo what was typed into the field
          e.preventDefault();
          e.stopPropagation();
          const code = buffer;
          if (target && startValue !== null && isTextField(target)) setNativeValue(target, startValue);
          reset();
          lastTime = 0;
          onScanRef.current?.(code);
          return;
        }
        reset();
        lastTime = now;
        return;
      }
      if (['Shift', 'CapsLock'].includes(e.key)) return; // scanners use Shift for capitals
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) { reset(); lastTime = now; return; }
      if (!fast || el !== target) {
        // a new burst (keydown comes before the character is typed)
        buffer = '';
        target = el;
        startValue = isTextField(el) ? el.value : null;
      }
      buffer += e.key;
      lastTime = now;
    }

    // Capture phase: before the focused field and the page's own shortcuts
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled]);
}

// The item with this barcode / item code (SKU), from the saved menu or the server; null when there is none
export async function findByCode(code) {
  const c = String(code || '').trim();
  if (!c) return null;
  const r = await api.products({ search: c, per_page: 30 });
  const list = r.products || [];
  return list.find((p) => p.sku && String(p.sku).trim().toLowerCase() === c.toLowerCase()) || null;
}

/*
  Scanning adds the item to the order being taken (useCart: the cart, or a return's own list).
  Each scan adds one more (pieces) or one more step (kg / litre). Items with several sizes open the size picker (onSizes).
*/
export function useScanToCart({ onSizes, enabled = true } = {}) {
  const cart = useCart();
  const cartRef = useRef(cart);
  cartRef.current = cart;
  const busy = useRef(false);

  useBarcodeScanner(async (code) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const p = await findByCode(code);
      if (!p) { Toast.show({ type: 'error', text1: 'No item with this code', text2: code, visibilityTime: 3000 }); return; }
      const lines = cartRef.current;
      if (p.sizes?.length > 1) { if (onSizes) onSizes(p); else Toast.show({ type: 'info', text1: `${p.name}: choose a size` }); return; }
      if (!lines.returning && !p.in_stock) { Toast.show({ type: 'error', text1: `${p.name} is out of stock` }); return; }
      const size = p.sizes?.length === 1 ? p.sizes[0].name : '';
      const have = lines.qtyOf(p.id, size);
      const step = size ? 1 : (p.qty_options?.length ? p.qty_options[0] : minOf(p));
      const next = have ? (size ? have + 1 : nextQty(have, p)) : step;
      if (!lines.returning && p.max_qty != null && next > p.max_qty + 1e-9) {
        Toast.show({ type: 'error', text1: `Only ${p.max_qty} ${p.unit} of ${p.name} in stock` });
        return;
      }
      if (have) lines.setQty(p.id, next, p, size);
      else lines.add(p, step, size);
      Toast.show({ type: 'success', text1: `${p.name} added`, visibilityTime: 1200 });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not look up the code', text2: e.message });
    } finally {
      busy.current = false;
    }
  }, enabled);
}
