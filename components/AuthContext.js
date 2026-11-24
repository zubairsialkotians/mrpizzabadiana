import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { api, setSessionToken, setAuthErrorHandler } from '../services/api';
import { registerPush, registerDevice } from '../services/push';
import { setCurrency } from '../services/format';
import { SHOP_KEY } from '../config';
import { setCatalogueAllowed } from '../services/catalogCache';

// Keys include the shop key so two shops' apps on one test device never mix
const SESSION_KEY = `session_${SHOP_KEY}`;
const SHOP_CACHE = `shop_${SHOP_KEY}`;
const PUSH_KEY = `push_${SHOP_KEY}`;

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

/*
  shop    — the store's public info (name, logo, delivery fee, open/closed …)
  session — { token, user } where user.kind is 'customer' or 'staff' (role owner|branch|kitchen|rider|cashier).
            isStaff = owner or branch admin (the shop admin); isTeam = kitchen or rider (their own panel).
            No session = guest shopper.
*/
export function AuthProvider({ children }) {
  const [shop, setShop] = useState(null);
  const [shopError, setShopError] = useState(null);
  const [session, setSession] = useState(null);
  const [ready, setReady] = useState(false);
  const [branches, setBranches] = useState([]);
  const pushToken = useRef(null);

  const applyShop = useCallback((s) => {
    if (!s) return;
    setCurrency(s.currency);
    setShop(s);
    AsyncStorage.setItem(SHOP_CACHE, JSON.stringify(s)).catch(() => {});
  }, []);

  const applySession = useCallback(async (s) => {
    setSessionToken(s?.token || null);
    setSession(s);
    if (s) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const clearLocal = useCallback(async (message) => {
    await applySession(null);
    setBranches([]);
    if (message) Toast.show({ type: 'error', text1: 'Signed out', text2: message });
  }, [applySession]);

  useEffect(() => {
    setAuthErrorHandler((msg) => clearLocal(msg || 'Please log in again'));
  }, [clearLocal]);

  const loadBranches = useCallback(async () => {
    try { setBranches((await api.branches()).branches || []); } catch (_) {}
  }, []);

  const afterLogin = useCallback((s) => {
    if (s.user.kind === 'staff' && ['owner', 'branch'].includes(s.user.role)) loadBranches();
    registerPush().then(async (t) => {
      if (t) { pushToken.current = t; await AsyncStorage.setItem(PUSH_KEY, t); }
    });
  }, [loadBranches]);

  const loadShop = useCallback(async () => {
    try {
      const r = await api.shop();
      applyShop(r.shop);
      setShopError(null);
    } catch (e) {
      setShopError(e.message);
    }
  }, [applyShop]);

  // Start: cached shop + session right away (works offline), then refresh both
  useEffect(() => {
    (async () => {
      try {
        const [rawShop, raw, push] = await Promise.all([
          AsyncStorage.getItem(SHOP_CACHE), AsyncStorage.getItem(SESSION_KEY), AsyncStorage.getItem(PUSH_KEY),
        ]);
        pushToken.current = push;
        if (rawShop) applyShop(JSON.parse(rawShop));
        const fresh = loadShop();
        if (!rawShop) await fresh; // first launch: need the shop before showing anything
        registerDevice(); // news notifications reach guests too
        if (raw) {
          const saved = JSON.parse(raw);
          await applySession(saved);
          api.me()
            .then((r) => { const s = { ...saved, user: r.user }; applySession(s); applyShop(r.shop); afterLogin(s); })
            .catch(() => {});
        }
      } finally {
        setReady(true);
      }
    })();
  }, [applySession, afterLogin, applyShop, loadShop]);

  // Login / register / checkout all hand back { token, user }
  const startSession = useCallback(async ({ token, user }) => {
    const s = { token, user };
    await applySession(s);
    afterLogin(s);
  }, [applySession, afterLogin]);

  const login = useCallback(async (loginId, password) => {
    const res = await api.login(loginId.trim(), password);
    await startSession(res);
    return res.user;
  }, [startSession]);

  const updateUser = useCallback(async (user) => {
    if (session) await applySession({ ...session, user });
  }, [session, applySession]);

  const refreshUser = useCallback(async () => {
    if (!session) return;
    try {
      const r = await api.me();
      applyShop(r.shop);
      await applySession({ ...session, user: r.user });
    } catch (_) {}
  }, [session, applySession, applyShop]);

  const logout = useCallback(async () => {
    try { await api.logout(pushToken.current); } catch (_) {}
    await AsyncStorage.removeItem(PUSH_KEY);
    pushToken.current = null;
    await clearLocal();
  }, [clearLocal]);

  // Customer deletes their account: the server marks it deleted and ends every session
  const deleteAccount = useCallback(async () => {
    await api.deleteAccount(); // throws on failure, so the caller can show the error
    await AsyncStorage.removeItem(PUSH_KEY);
    pushToken.current = null;
    await clearLocal();
  }, [clearLocal]);

  const value = useMemo(() => {
    const user = session?.user || null;
    const role = user?.kind === 'staff' ? user.role : '';
    const isStaff = role === 'owner' || role === 'branch';
    const isTeam = role === 'kitchen' || role === 'rider';
    const isCashier = role === 'cashier';
    return {
      shop, shopError, reloadShop: loadShop, setShop: applyShop,
      session, user, ready,
      login, logout, deleteAccount, startSession, updateUser, refreshUser,
      isCustomer: user?.kind === 'customer',
      isStaff,
      isOwner: role === 'owner',
      isBranchAdmin: role === 'branch',
      isTeam,
      isKitchen: role === 'kitchen',
      isRider: role === 'rider',
      isCashier,
      // Owner, branch admin and cashier take orders in the app
      isSeller: isStaff || isCashier,
      // Where this login starts: shop admin, kitchen/rider panel, cashier's orders, or the shop
      homeRoute: isStaff ? 'AdminHome' : isTeam ? 'TeamHome' : isCashier ? 'AdminOrders' : 'Home',
      branches, reloadBranches: loadBranches,
    };
  }, [shop, shopError, loadShop, applyShop, session, ready, login, logout, deleteAccount, startSession, updateUser, refreshUser, branches, loadBranches]);

  // Staff may use the menu saved on this device; customers always get the live menu
  const seller = value.isSeller;
  useEffect(() => { setCatalogueAllowed(seller); }, [seller]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
