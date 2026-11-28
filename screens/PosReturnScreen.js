import React, { useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, ScrollView, TouchableOpacity, Switch, Modal, KeyboardAvoidingView, useWindowDimensions, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { Button, Field, BranchField, s } from '../components/ui';
import { ProductImage, QtyStepper } from '../components/shop';
import { Catalogue } from '../components/Catalogue';
import { ItemTable } from '../components/ItemTable';
import { useScanToCart } from '../components/scan';
import { Segmented } from '../components/ui';
import { OfflineModeSwitch } from '../components/OfflineOrders';
import { SizePicker, panelWidth, SPLIT_MIN_WIDTH } from '../components/CartPanel';
import { useLineStore, LinesScope, useCart, lineKey, lineName } from '../components/CartContext';
import { useAuth } from '../components/AuthContext';
import { usePrintBill } from '../components/PrintBill';
import { newOrderRef, localTime, queueReturn, sendQueued } from '../services/offlineOrders';
import { confirmAction } from '../services/confirm';
import { api } from '../services/api';
import { money } from '../services/format';
import { round2 } from '../services/qty';
import { colors } from '../theme';

/*
  Return mode: pick the returned items from the shop like taking an order, then save the return.
  Good items go back into stock, damaged ones are counted as a loss. The refund is the shop's price now.
  Works on its own list of lines (LinesScope), so the order being taken in the cart is left as it is.
  In this list stock limits don't apply (an item that is out of stock can still come back).
*/
export default function PosReturnScreen({ navigation }) {
  const store = useLineStore();
  // restock: { [lineKey]: false } for damaged lines (good by default)
  const [restock, setRestock] = useState({});
  const value = useMemo(() => ({ ...store, returning: true, restock, setRestock }), [store, restock]);
  return (
    <LinesScope value={value}>
      <ReturnTaking navigation={navigation} />
    </LinesScope>
  );
}

function ReturnTaking({ navigation }) {
  const lines = useCart();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const split = width >= SPLIT_MIN_WIDTH;
  const sideW = split ? panelWidth(width) : 0;
  const [sizesOf, setSizesOf] = useState(null);
  const [review, setReview] = useState(false);

  const done = () => { setReview(false); navigation.goBack(); };
  // Same view as taking orders (shop screen's choice), and the barcode scanner adds to this return
  const [view, setViewState] = useState('grid');
  useEffect(() => { AsyncStorage.getItem('order_view').then((v) => { if (v === 'table') setViewState('table'); }).catch(() => {}); }, []);
  const setView = (v) => { setViewState(v); AsyncStorage.setItem('order_view', v).catch(() => {}); };
  useScanToCart({ onSizes: setSizesOf, enabled: view !== 'table' && (!review || split) });
  const toggle = (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 10 }}>
      <View style={{ width: 240 }}>
        <Segmented value={view} onChange={setView} options={[{ value: 'grid', label: 'Visual' }, { value: 'table', label: 'Table / list' }]} />
      </View>
      <OfflineModeSwitch />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[s.header, { paddingTop: 12 + insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10} style={{ marginRight: 10 }} testID="return-back">
          <Ionicons name="arrow-back" size={22} color={colors.onBrand} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle} numberOfLines={1}>Return items</Text>
          <Text style={s.headerSub} numberOfLines={1}>Tap the items the customer brought back</Text>
        </View>
      </View>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {view === 'table' ? (
          <ItemTable width={width - sideW} onSizes={setSizesOf} header={toggle} bottomPadding={(split ? 30 : 100) + insets.bottom} />
        ) : (
          <Catalogue width={width - sideW} onSizes={setSizesOf} header={() => toggle} bottomPadding={(split ? 30 : 100) + insets.bottom}
            onProductPress={(p) => (p.sizes?.length ? setSizesOf(p) : lines.add(p, p.qty_options?.length ? p.qty_options[0] : (p.min_qty || 1), ''))} />
        )}
        {split && <ReturnPanel width={sideW} onDone={done} />}
      </View>
      <SizePicker product={sizesOf} onClose={() => setSizesOf(null)} />

      {!split && lines.count > 0 && (
        <TouchableOpacity style={[st.bar, { bottom: 18 + insets.bottom }]} onPress={() => setReview(true)} testID="return-bar">
          <View style={st.barCount}><Text style={{ color: '#fff', fontWeight: '800' }}>{lines.count}</Text></View>
          <Text style={st.barText}>Review return</Text>
          <Text style={st.barText}>{money(lines.subtotal)}</Text>
        </TouchableOpacity>
      )}
      {!split && (
        <Modal visible={review} animationType="slide" onRequestClose={() => setReview(false)}>
          <View style={{ flex: 1, paddingTop: insets.top, backgroundColor: '#fff' }}>
            <ReturnPanel width={width} onDone={done} onBack={() => setReview(false)} />
          </View>
        </Modal>
      )}
    </View>
  );
}

function ReturnPanel({ width, onDone, onBack }) {
  const lines = useCart();
  const { isOwner, shop, user, branches } = useAuth();
  const { print } = usePrintBill();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState('');
  const [branchId, setBranchId] = useState(0);
  const [busy, setBusy] = useState(false);
  // One ref per return being saved: a second press or a lost answer never saves it twice
  const [ref, setRef] = useState(newOrderRef);
  const good = (l) => lines.restock[lineKey(l.item_id, l.size)] !== false;
  const damaged = lines.lines.filter((l) => !good(l)).length;

  const clear = async () => {
    if (await confirmAction('Clear this return?', 'All items are removed.', 'Clear', true)) { lines.clear(); lines.setRestock({}); }
  };

  // The slip this device prints when the return can't reach the server (same shape as the server's)
  const localSlip = (payload) => {
    const branch = (branches || []).find((b) => Number(b.id) === Number(branchId)) || user?.branch;
    return {
      is_return: true, offline: true, id: 0, return_no: `OFFLINE-R-${ref.slice(-6)}`, created_at: localTime(), by: user?.name || '',
      note: note.trim(), branch_name: branch?.name || '', branch_address: branch?.address || '', branch_phone: branch?.phone || '',
      refund: lines.subtotal,
      items: lines.lines.map((l, i) => ({ name: lineName(l), unit: l.unit, qty: l.qty, price: l.price, line_total: round2(l.qty * l.price), restock: payload.items[i].restock })),
    };
  };

  const save = async () => {
    setBusy(true);
    const payload = {
      return_ref: ref, note, branch_id: branchId,
      // price: only used when this return is sent later (offline), so the server and the printed slip agree
      items: lines.lines.map((l) => ({ item_id: l.item_id, size: l.size || '', qty: l.qty, price: l.price, restock: good(l) })),
    };
    try {
      let slip;
      let message;
      let later = '';
      try {
        const r = await api.posReturn(payload);
        slip = r.return ? { ...r.return, is_return: true } : null;
        message = r.message;
        sendQueued().catch(() => {}); // the internet is here: send anything still waiting
      } catch (e) {
        if (!e.offline) throw e;
        // No internet: keep it on this device; it is sent (and stock updated) when the internet is back
        slip = localSlip(payload);
        await queueReturn({ payload, slip });
        message = e.forced ? 'Offline mode: return saved on this device' : 'No internet: return saved on this device';
        later = e.forced ? 'It is sent to the server in the background.' : 'Stock is updated when the internet is back.';
      }
      const info = later || 'Good items are back in stock.';
      // Print the return slip like a bill: at once, or (bill printing set to "manual") when the message is tapped
      if (slip && shop?.bill_print !== 'manual') {
        Toast.show({ type: later ? 'info' : 'success', text1: message, text2: info, visibilityTime: later ? 6000 : 4000 });
        print(slip);
      } else {
        Toast.show({ type: later ? 'info' : 'success', text1: message, text2: slip ? `${later ? `${later} ` : ''}Tap here to print the return slip` : info, visibilityTime: 7000,
          onPress: slip ? () => { Toast.hide(); print(slip); } : undefined });
      }
      lines.clear();
      lines.setRestock({});
      setNote('');
      setRef(newOrderRef());
      onDone();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save the return', text2: e.message, visibilityTime: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={[st.panel, onBack && { flex: 1, borderLeftWidth: 0 }, { width, paddingBottom: 12 + insets.bottom }]} testID="return-panel">
      <View style={st.head}>
        {onBack && (
          <TouchableOpacity onPress={onBack} hitSlop={10} style={{ marginRight: 10 }} testID="return-review-back">
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Return</Text>
          <Text style={st.sub}>{lines.count ? `${lines.count} item${lines.count === 1 ? '' : 's'}` : 'Tap items to add them'}</Text>
        </View>
        {lines.count > 0 && (
          <TouchableOpacity onPress={clear} hitSlop={8} style={st.clear} testID="return-clear">
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {!lines.count ? (
        <View style={st.empty}>
          <Ionicons name="return-down-back-outline" size={44} color={colors.primary} />
          <Text style={st.emptyText}>No items yet</Text>
          <Text style={[s.itemMeta, { textAlign: 'center' }]}>Items you tap appear here. Mark each one good (back to stock) or damaged.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 4 }} keyboardShouldPersistTaps="handled">
          {lines.lines.map((l, i) => {
            const k = lineKey(l.item_id, l.size);
            const ok = good(l);
            return (
              <View key={k} style={[st.line, i > 0 && st.lineBorder]} testID={`return-line-${l.item_id}${l.size ? `-${l.size}` : ''}`}>
                <ProductImage uri={l.image} style={st.img} iconSize={16} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                    <Text style={st.name} numberOfLines={2}>{lineName(l)}</Text>
                    <TouchableOpacity onPress={() => lines.remove(l.item_id, l.size)} hitSlop={8}>
                      <Ionicons name="close" size={18} color={colors.faint} />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 128 }}>
                      <QtyStepper small editable product={{ ...l, max_qty: null }} qty={l.qty} onChange={(q) => lines.setQty(l.item_id, q, undefined, l.size)} />
                    </View>
                    <Text style={st.amount}>{money(round2(l.qty * l.price))}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Text style={{ flex: 1, color: ok ? colors.success : colors.danger, fontWeight: '700', fontSize: 13 }}>
                      {ok ? 'Good — back to stock' : 'Damaged — not restocked'}
                    </Text>
                    <Switch value={ok} onValueChange={(v) => lines.setRestock({ ...lines.restock, [k]: v })} testID={`return-good-${l.item_id}`} />
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <View style={st.foot}>
        {isOwner && <BranchField value={branchId} onChange={setBranchId} label="Branch" />}
        <Field label="Reason (optional)" value={note} onChangeText={setNote} placeholder="e.g. Wrong size, expired" style={{ marginBottom: 10 }} />
        <View style={st.totalRow}>
          <Text style={st.totalLabel}>Refund to customer</Text>
          <Text style={st.total}>{money(lines.subtotal)}</Text>
        </View>
        <Text style={[s.itemMeta, { marginBottom: 10 }]}>
          {damaged ? `${damaged} damaged item${damaged === 1 ? '' : 's'} counted as a loss. ` : ''}Refund at today's prices.
        </Text>
        <Button testID="save-walkin-return" title={`Save return · refund ${money(lines.subtotal)}`} icon="return-down-back-outline"
          onPress={save} loading={busy} disabled={!lines.count} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  panel: { backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: colors.border, paddingHorizontal: 14, paddingTop: 14 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 19, fontWeight: '900', color: colors.black },
  sub: { color: colors.muted, fontSize: 13, marginTop: 1 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: colors.dangerSoft },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  emptyText: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 8, marginBottom: 2 },
  line: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  lineBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  img: { width: 46, height: 46, borderRadius: 10 },
  name: { flex: 1, fontWeight: '700', color: colors.text, fontSize: 14 },
  amount: { flex: 1, textAlign: 'right', fontWeight: '800', color: colors.text, marginTop: 8 },
  foot: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.text },
  total: { fontSize: 22, fontWeight: '900', color: colors.danger },
  bar: {
    position: 'absolute', left: 14, right: 14, height: 58, borderRadius: 29, backgroundColor: colors.danger,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  barCount: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 14, minWidth: 28, height: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  barText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
