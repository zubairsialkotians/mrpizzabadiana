import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/*
  Offline mode (switch on the shop screen): for slow internet. While it is on, staff orders and returns
  don't wait for the server at all: they are kept on this device and printed at once, and sent in the background
  (OfflineSync) like orders taken with no internet. Items come from the menu saved on this device.
  Kept per device. api.js reads it (no other imports here, so there is no import loop).
*/
const KEY = 'offline_mode';
let on = false;
const listeners = new Set();

export const isOfflineMode = () => on;

export async function loadOfflineMode() {
  try { on = (await AsyncStorage.getItem(KEY)) === '1'; } catch (_) { on = false; }
  listeners.forEach((fn) => fn(on));
  return on;
}

export async function setOfflineMode(v) {
  on = !!v;
  listeners.forEach((fn) => fn(on));
  try { await AsyncStorage.setItem(KEY, on ? '1' : '0'); } catch (_) { /* stays on for this session */ }
}

export function useOfflineMode() {
  const [v, setV] = useState(on);
  useEffect(() => {
    const fn = (x) => setV(x);
    listeners.add(fn);
    setV(on);
    return () => listeners.delete(fn);
  }, []);
  return v;
}

// Called at start-up (App.js)
loadOfflineMode();
