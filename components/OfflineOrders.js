import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, AppState, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Card, Button, s } from './ui';
import { useAuth } from './AuthContext';
import { usePrintBill } from './PrintBill';
import { offlineStatus, onOfflineChange, loadOffline, sendQueued, retryQueued, discardQueued } from '../services/offlineOrders';
import { confirmAction } from '../services/confirm';
import { useOfflineMode, setOfflineMode } from '../services/offlineMode';
import { catalogueStatus, savedCatalogue, syncCatalogue } from '../services/catalogCache';
import { money } from '../services/format';
import { colors } from '../theme';

// { waiting, failed, sending, orders } of the logged-in shop, kept up to date
export function useOfflineStatus() {
  const { shop } = useAuth();
  const [st, setSt] = useState(offlineStatus());
  useEffect(() => {
    const off = onOfflineChange(() => setSt(offlineStatus()));
    loadOffline().then(() => setSt(offlineStatus())).catch(() => {});
    return off;
  }, [shop?.id]);
  return st;
}

// "2 offline orders" / "1 offline return" / "3 offline orders and returns"
const what = (list, n) => {
  const r = list.filter((o) => o.kind === 'return').length;
  const kind = r === 0 ? 'order' : r === list.length ? 'return' : null;
  return kind ? `${n} offline ${kind}${n > 1 ? 's' : ''}` : `${n} offline orders and returns`;
};

// App.js: sends the orders kept on this device when the app opens, comes to the front, and every 30 s while some wait
export function OfflineSync() {
  const { session, isSeller, shop } = useAuth();
  const on = !!session && !!isSeller;
  useEffect(() => {
    if (!on) return undefined;
    const tick = async () => {
      await loadOffline();
      if (offlineStatus().waiting) {
        const before = offlineStatus().orders.filter((o) => !o.error);
        const n = await sendQueued().catch(() => 0);
        if (n) Toast.show({ type: 'success', text1: `${what(before, n)} sent to the server` });
      }
    };
    tick();
    const timer = setInterval(tick, 30000);
    const sub = AppState.addEventListener('change', (a) => { if (a === 'active') tick(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [on, shop?.id]);
  return null;
}

const send = async () => {
  const before = offlineStatus().orders.filter((o) => !o.error);
  const n = await sendQueued().catch(() => 0);
  const st = offlineStatus();
  if (n) Toast.show({ type: 'success', text1: `${what(before, n)} sent to the server` });
  else if (st.waiting) Toast.show({ type: 'error', text1: 'Still no internet', text2: 'They are sent by themselves when it is back.' });
};

// Shop screen: shows while orders taken offline wait to be sent (tap → My account, where they are listed)
export function OfflineStrip({ onOpen }) {
  const st = useOfflineStatus();
  if (!st.waiting && !st.failed) return null;
  const bad = st.failed > 0;
  const fg = bad ? colors.danger : colors.warning;
  return (
    <TouchableOpacity style={[st2.strip, { backgroundColor: bad ? colors.dangerSoft : colors.warningSoft }]} onPress={onOpen} testID="offline-strip">
      <Ionicons name={bad ? 'alert-circle-outline' : st.sending ? 'sync-outline' : 'cloud-offline-outline'} size={16} color={fg} />
      <Text style={[st2.stripText, { color: fg }]}>
        {st.sending ? 'Sending offline orders…'
          : [st.waiting ? `${what(st.orders.filter((o) => !o.error), st.waiting)} waiting to be sent` : '', bad ? `${st.failed} not accepted` : ''].filter(Boolean).join(' · ')}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={fg} />
    </TouchableOpacity>
  );
}

// My account: the orders kept on this device, with send / retry / print / discard
export function OfflineOrdersCard() {
  const st = useOfflineStatus();
  const { print } = usePrintBill();
  const discard = async (o) => {
    const ret = o.kind === 'return';
    if (await confirmAction(ret ? 'Discard this return?' : 'Discard this order?', ret
      ? `${o.order.return_no} · refund ${money(o.order.refund)} is removed from this device and never reaches the server. Its stock and refund will not be recorded.`
      : `${o.order.order_no} · ${money(o.order.total)} is removed from this device and never reaches the server. Its sale will not be in reports or stock.`, 'Discard', true)) {
      await discardQueued(o.ref);
    }
  };
  const retry = async (o) => {
    await retryQueued(o.ref).catch(() => 0);
    const now = offlineStatus().orders.find((x) => x.ref === o.ref);
    if (!now) Toast.show({ type: 'success', text1: `${o.kind === 'return' ? 'Return' : 'Order'} sent to the server` });
    else if (now.error) Toast.show({ type: 'error', text1: 'Not accepted', text2: now.error, visibilityTime: 7000 });
    else Toast.show({ type: 'error', text1: 'Still no internet', text2: 'It is sent by itself when the internet is back.' });
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={[st2.icon, { backgroundColor: st.orders.length ? colors.warningSoft : colors.successSoft }]}>
          <Ionicons name={st.orders.length ? 'cloud-offline-outline' : 'cloud-done-outline'} size={22} color={st.orders.length ? colors.warning : colors.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st2.title}>{st.orders.length ? `${what(st.orders, st.orders.length).replace('offline ', '')} not sent yet` : 'All orders sent'}</Text>
          <Text style={s.itemMeta}>
            {st.sending ? 'Sending…' : 'Orders and returns taken with no internet are kept here and sent to the server by themselves when it is back.'}
          </Text>
        </View>
      </View>
      {st.orders.map((o) => {
        const ret = o.kind === 'return';
        return (
        <View key={o.ref} style={st2.row} testID={`offline-${o.ref}`}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={{ flex: 1, fontWeight: '800', color: colors.text }} numberOfLines={1}>{ret ? `${o.order.return_no} · Return` : `${o.order.order_no} · ${o.order.name}`}</Text>
            <Text style={{ fontWeight: '800', color: ret ? colors.danger : colors.text }}>{ret ? `-${money(o.order.refund)}` : money(o.order.total)}</Text>
          </View>
          <Text style={s.itemMeta}>{o.at} · {o.order.items.length} item{o.order.items.length > 1 ? 's' : ''} · {ret ? 'Refund' : o.order.fulfilment === 'delivery' ? 'Delivery' : 'Takeaway'}</Text>
          {!!o.error && <Text style={{ color: colors.danger, marginTop: 4 }}>Not accepted: {o.error}</Text>}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {!!o.error && <Button small title="Try again" icon="refresh-outline" onPress={() => retry(o)} disabled={st.sending} style={{ flex: 1 }} />}
            <Button small variant="ghost" title={ret ? 'Print slip' : 'Print bill'} icon="print-outline" onPress={() => print(o.order)} style={{ flex: 1 }} />
            <Button small variant="outline" title="Discard" icon="trash-outline" onPress={() => discard(o)} disabled={st.sending} style={{ flex: 1 }} />
          </View>
        </View>
        );
      })}
      {st.waiting > 0 && <Button testID="offline-send" title="Send now" icon="cloud-upload-outline" onPress={send} loading={st.sending} style={{ marginTop: 12 }} />}
    </Card>
  );
}

/*
  Offline mode switch (shop and Return screens): for slow internet. On: orders and returns are kept on this device
  and printed at once, then sent in the background. Needs the menu saved on this device (saved first if it isn't).
*/
export function OfflineModeSwitch() {
  const on = useOfflineMode();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (on) {
      await setOfflineMode(false);
      Toast.show({ type: 'success', text1: 'Offline mode off', text2: 'Orders go to the server straight away again.' });
      sendQueued().catch(() => {});
      return;
    }
    setBusy(true);
    try {
      // Items must come from this device: save the menu first if needed
      if (!(await savedCatalogue())) {
        Toast.show({ type: 'info', text1: 'Saving the menu on this device…' });
        await syncCatalogue();
      }
      await setOfflineMode(true);
      Toast.show({ type: 'info', text1: 'Offline mode on', text2: `Orders and returns are saved here and sent in the background. Menu: ${catalogueStatus().products} items.`, visibilityTime: 5000 });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save the menu', text2: `Offline mode needs the menu on this device. ${e.message || ''}`, visibilityTime: 7000 });
    } finally {
      setBusy(false);
    }
  };
  return (
    <TouchableOpacity onPress={busy ? undefined : toggle} style={[st2.mode, on && st2.modeOn]} testID="offline-mode">
      <Ionicons name={busy ? 'sync-outline' : on ? 'cloud-offline' : 'cloud-outline'} size={16} color={on ? '#fff' : colors.text} />
      <Text style={[st2.modeText, on && { color: '#fff' }]}>{busy ? 'Saving menu…' : on ? 'Offline mode ON' : 'Offline mode'}</Text>
    </TouchableOpacity>
  );
}

const st2 = StyleSheet.create({
  mode: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' },
  modeOn: { backgroundColor: colors.warning, borderColor: colors.warning },
  modeText: { fontWeight: '800', fontSize: 13, color: colors.text },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800', color: colors.black },
  row: { borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12, paddingTop: 10 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 10 },
  stripText: { flex: 1, fontWeight: '700', fontSize: 13 },
});
