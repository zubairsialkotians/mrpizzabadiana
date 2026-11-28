import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/*
  Keyboard shortcuts for taking orders (desktop / web): hold Ctrl (Cmd on a Mac) and press the letter twice.
    Ctrl + C C  Checkout here (the order panel's checkout)
    Ctrl + A A  Cash received box
    Ctrl + S S  Place the order
  Pressing the letter once keeps its normal meaning (copy, select all), so only a quick second press is taken.
*/
export const SHORTCUTS_HINT = 'Ctrl+C C checkout · Ctrl+A A cash received · Ctrl+S S place order · F4 switch view';
const TWICE_MS = 700;

// Asked for on the shop screen before the checkout was open: the checkout does it when it opens
export const pendingKeys = { cash: false, place: false };

// map: { c: fn, a: fn, s: fn }; only the letters given are taken
export function useChordKeys(map, enabled = true) {
  const mapRef = useRef(map);
  mapRef.current = map;
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') return undefined;
    let last = { key: '', at: 0 };
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const k = String(e.key || '').toLowerCase();
      const fn = mapRef.current[k];
      if (!fn) { last = { key: '', at: 0 }; return; }
      // Ctrl+S has no normal meaning here: never let the browser's "save page" open
      if (k === 's') e.preventDefault();
      const now = Date.now();
      if (last.key === k && now - last.at <= TWICE_MS) {
        e.preventDefault();
        e.stopPropagation();
        last = { key: '', at: 0 };
        fn();
      } else {
        last = { key: k, at: now };
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}
