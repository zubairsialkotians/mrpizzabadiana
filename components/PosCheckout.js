import React, { useEffect, useRef, useState } from 'react';
import { useChordKeys, pendingKeys } from './keys';
import { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Card, KV, Field, Button, SectionTitle, Segmented, BranchField, s } from './ui';
import { useAuth } from './AuthContext';
import { useCart, lineName, linePayload, lineDiscount } from './CartContext';
import { DiscountNote } from './shop';
import { usePrintBill } from './PrintBill';
import { api } from '../services/api';
import { newOrderRef, localTime, queueOrder, sendQueued } from '../services/offlineOrders';
import { money, qtyLabel } from '../services/format';
import { round2, deliveryFee } from '../services/qty';
import { colors } from '../theme';

/*
  Staff checkout, shared by the checkout screen (PosOrderScreen) and the tablet order panel (PanelCheckout):
  takeaway/delivery, customer, discount, tax and service charge, and the money worked out the same way as the server.
  Money: discount on items + delivery; tax and service charge (fixed or %) on what is left.
*/
const DRAFT_KEYS = { name: 1, phone: 1, address: 1, note: 1, fulfilment: 1 };
// Only the details that were given (voice ordering leaves the rest as they are)
const draftFields = (d) => Object.fromEntries(Object.entries(d || {}).filter(([k, v]) => k in DRAFT_KEYS && v));

// lines: [{ item_id, size, qty, price }]; editing: the placed order being changed, or null for a new order
// lines' name already includes the size (lineName)
export function usePosForm({ lines, editing = null }) {
  const { shop, user, branches } = useAuth();
  const cart = useCart();
  // One ref per order being taken: trying again after a lost answer never makes a second order
  const [ref] = useState(newOrderRef);
  const [f, setF] = useState({
    fulfilment: editing?.fulfilment || 'pickup', name: '', phone: '', address: '', note: '', branch_id: 0, cash: '',
    // New order: customer details already given by voice
    ...(!editing ? draftFields(cart.draft) : {}),
    // Editing: the order's own values. New order: tax / service charge start from the shop's defaults (Shop settings)
    ...Object.fromEntries(['discount', 'tax', 'service'].flatMap((k) => {
      const from = editing || (k === 'discount' ? null : shop);
      return [
        [`${k}_type`, from?.[`${k}_type`] || ''],
        [`${k}_value`, Number(from?.[`${k}_value`]) > 0 ? String(from[`${k}_value`]) : ''],
      ];
    })),
  });
  const set = (k) => (v) => {
    setF((p) => ({ ...p, [k]: v }));
    // Keep voice ordering in step with what was typed here
    if (!editing && k in DRAFT_KEYS) cart.setDraft({ [k]: v }, true);
  };

  // Voice ordering changed the customer details (e.g. "number 0300... add kar do")
  useEffect(() => {
    if (!editing) setF((p) => ({ ...p, ...draftFields(cart.draft) }));
  }, [cart.draft]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = round2(lines.reduce((a, l) => a + round2(l.qty * l.price), 0));
  // What the items' own discounts (Items → Discount) take off; already in the items' prices
  const itemsDiscount = round2(lines.reduce((a, l) => a + (lineDiscount(l)?.off || 0), 0));
  const fee = editing ? Number(editing.delivery_fee) || 0 : deliveryFee(shop, subtotal, f.fulfilment);
  const base = round2(subtotal + fee);
  // The money for a set of fields (the form, or the form with the cash-short discount)
  const calc = (fx) => {
    const adj = (k, on) => {
      const type = fx[`${k}_type`];
      const value = Number(fx[`${k}_value`]) || 0;
      const amount = !type || value <= 0 ? 0 : round2(type === 'percent' ? on * Math.min(value, 100) / 100 : (k === 'discount' ? Math.min(value, on) : value));
      const error = type === 'percent' && value > 100 ? 'At most 100%' : k === 'discount' && type === 'fixed' && value > on ? `At most ${money(on)}` : null;
      return { type, value, amount, error, pct: type === 'percent' && amount > 0 ? ` (${value}%)` : '' };
    };
    const d = adj('discount', base);
    const after = round2(base - d.amount);
    const t = adj('tax', after);
    const sv = adj('service', after);
    return { disc: d, tax: t, service: sv, total: round2(after + t.amount + sv.amount) };
  };

  /*
    Cash the customer gives (optional; nothing typed = exactly the total).
    Less than the total: the difference becomes a fixed discount, so the total is what was received
    (e.g. total 170, cash 150 → discount 20). With a % tax / service charge the discount is worked out so the
    final total still comes to the cash given.
  */
  const cashTyped = !editing && String(f.cash).trim() !== '';
  const cashIn = round2(Number(f.cash) || 0);
  const plain = calc(f);
  let eff = f;
  let short = 0;
  if (cashTyped && cashIn > 0 && cashIn + 1e-9 < plain.total) {
    const withD = (D) => calc({ ...f, discount_type: 'fixed', discount_value: String(D) }).total;
    let lo = 0, hi = base;
    for (let i = 0; i < 50; i += 1) { const mid = (lo + hi) / 2; if (withD(mid) > cashIn) lo = mid; else hi = mid; }
    let D = round2(hi);
    if (withD(D) > cashIn + 1e-9 && D + 0.01 <= base) D = round2(D + 0.01);
    eff = { ...f, discount_type: 'fixed', discount_value: String(D) };
    short = round2(plain.total - cashIn);
  }
  const { disc, tax, service, total } = calc(eff);
  const received = cashTyped && cashIn > 0 ? cashIn : total;
  const change = round2(Math.max(0, received - total));
  const cashError = cashTyped && cashIn <= 0 ? 'Enter the cash received, or leave it empty'
    : cashTyped && cashIn + 0.005 < total ? `Can't come down to ${money(cashIn)} (lowest ${money(total)})` : null;
  const moneyError = disc.error || tax.error || service.error || cashError;
  const needsContact = !editing && f.fulfilment === 'delivery' && (!f.phone.trim() || !f.address.trim());

  // What the server takes: items + the charges that come to something.
  // price / delivery_fee only count for an order sent later from this device (offline), so its bill and the server agree
  const payload = () => ({
    items: lines.map(linePayload),
    ...Object.fromEntries([['discount', disc], ['tax', tax], ['service', service]].flatMap(([k, a]) => [
      [`${k}_type`, a.amount > 0 ? a.type : ''], [`${k}_value`, a.amount > 0 ? a.value : 0],
    ])),
  });
  const placePayload = () => ({
    ...payload(), fulfilment: f.fulfilment, name: f.name, phone: f.phone, address: f.address, note: f.note, branch_id: f.branch_id,
    delivery_fee: fee, offline_ref: ref, cash_received: received,
  });

  // The bill of an order kept on this device (no internet): same fields as the server's order
  const localOrder = () => {
    const branch = (branches || []).find((b) => Number(b.id) === Number(f.branch_id)) || user?.branch;
    const charge = (k, a) => ({ [`${k}_type`]: a.amount > 0 ? a.type : '', [`${k}_value`]: a.amount > 0 ? a.value : 0, [k]: a.amount });
    return {
      id: 0, order_no: `OFFLINE-${ref.slice(-6)}`, offline_ref: ref, offline: true, created_at: localTime(), status: 'confirmed',
      fulfilment: f.fulfilment, name: f.name.trim() || 'Walk-in customer', phone: f.phone, address: f.fulfilment === 'delivery' ? f.address : '', note: f.note,
      payment_method: 'cod', payment_status: '', branch_name: branch?.name || '',
      items: lines.map((l) => ({ name: l.name, size: l.size || '', unit: l.unit, qty: l.qty, price: l.price, line_total: round2(l.qty * l.price),
        list_price: Math.max(Number(l.was) || 0, Number(l.price) || 0), item_discount: lineDiscount(l)?.off || 0 })),
      subtotal, delivery_fee: fee, ...charge('discount', disc), ...charge('tax', tax), ...charge('service', service), total, refunded: 0,
      cash_received: received, change,
    };
  };

  return { f, eff, set, editing, subtotal, itemsDiscount, fee, disc, tax, service, total, received, change, short, cashError, moneyError, needsContact, payload, placePayload, localOrder };
}

/*
  Place a new staff order. No internet (or no answer in 20 s): it is kept on this device and sent when the
  internet is back; returns { order, message, offline: true } with the device's bill.
*/
export async function placeStaffOrder(form) {
  const payload = form.placePayload();
  try {
    const r = await api.posPlace(payload);
    sendQueued(); // online again: send any orders kept on this device too
    return { ...r, offline: false };
  } catch (e) {
    if (!e.offline) throw e;
    const order = form.localOrder();
    await queueOrder({ payload, order });
    return { order, offline: true, message: e.forced ? 'Offline mode: order saved on this device' : 'No internet: order saved on this device' };
  }
}

// Placing / saving failed. Plan limit reached: tap the message to see the plan and upgrade
export function orderErrorToast(e, navigation, editing) {
  const limit = e.data?.plan_limit;
  Toast.show({ type: 'error', text1: limit ? 'Monthly order limit reached' : editing ? 'Could not update the order' : 'Could not place the order', text2: e.message, visibilityTime: limit ? 10000 : 7000,
    onPress: limit ? () => { Toast.hide(); navigation.navigate('Plan'); } : undefined });
}

// Customer (new orders), tax, service charge, discount and the totals
// cashRef: the Cash received box (Ctrl+A A focuses it)
export function CheckoutFields({ form, cashRef }) {
  const { shop, isOwner } = useAuth();
  const { f, eff, set, editing, subtotal, itemsDiscount, fee, disc, tax, service, total, change, short, cashError } = form;
  return (
    <>
      {!editing && (
        <>
          <SectionTitle>Customer</SectionTitle>
          <Segmented value={f.fulfilment} onChange={set('fulfilment')}
            options={[{ value: 'pickup', label: 'Takeaway / counter' }, ...(shop?.delivery !== false ? [{ value: 'delivery', label: 'Delivery' }] : [])]} />
          <Field label="Name" value={f.name} onChangeText={set('name')} placeholder="Walk-in customer" />
          <Field label={f.fulfilment === 'delivery' ? 'Phone' : 'Phone (optional)'} value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad"
            hint="A customer with this phone sees the order in their account" />
          {f.fulfilment === 'delivery' && <Field label="Delivery address" value={f.address} onChangeText={set('address')} multiline />}
          <Field label="Note for the kitchen (optional)" value={f.note} onChangeText={set('note')} placeholder="e.g. extra spicy" />
          {isOwner && <BranchField value={f.branch_id} onChange={set('branch_id')} label="Branch" />}
        </>
      )}

      <AdjustField title="Tax" k="tax" f={f} set={set} a={tax} hint="Added on the total after the discount" />
      <AdjustField title="Service charge" k="service" f={f} set={set} a={service} hint="Added on the total after the discount" />
      {/* Last, just above the total: the discount still comes off items + delivery before tax / service charge */}
      <AdjustField title="Discount" k="discount" f={eff} set={set} a={disc}
        hint={short > 0 ? `Set from the cash received (${money(short)} short). Clear the cash to change it.` : 'Taken off the order total (items + delivery)'} />

      <Card>
        <KV label="Items" value={money(subtotal)} />
        {itemsDiscount > 0 && <KV label="Item discounts (included)" value={`-${money(itemsDiscount)}`} tone="good" />}
        {(f.fulfilment === 'delivery' || fee > 0) && <KV label="Delivery" value={fee ? money(fee) : 'Free'} />}
        {disc.amount > 0 && <KV label={`Discount${disc.pct}`} value={`-${money(disc.amount)}`} tone="bad" />}
        {tax.amount > 0 && <KV label={`Tax${tax.pct}`} value={`+${money(tax.amount)}`} />}
        {service.amount > 0 && <KV label={`Service charge${service.pct}`} value={`+${money(service.amount)}`} />}
        <KV label="Total" value={money(total)} bold />
      </Card>
      {/* Last: the cash the customer gives and the change to give back (optional; empty = the exact total) */}
      {!editing && (
        <Card>
          <Field ref={cashRef} label="Cash received (optional)" value={f.cash} onChangeText={(v) => set('cash')(v.replace(/[^0-9.]/g, ''))}
            placeholder={`${money(total)} (exact amount)`} keyboardType="decimal-pad" error={cashError} style={{ marginBottom: 8 }} testID="cash-received" />
          {short > 0 && !cashError && (
            <Text style={[s.itemMeta, { color: colors.warning, fontWeight: '700', marginBottom: 6 }]}>
              {money(short)} short: added to the discount, so the total is {money(total)}.
            </Text>
          )}
          <KV label="Change to return" value={money(change)} bold tone={change > 0 ? 'good' : undefined} />
        </Card>
      )}
    </>
  );
}

// None / fixed amount / % with its value (discount, tax, service charge — all 0 by default)
function AdjustField({ title, k, f, set, a, hint }) {
  const type = f[`${k}_type`];
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Segmented value={type} onChange={set(`${k}_type`)}
        options={[{ value: '', label: 'None' }, { value: 'fixed', label: 'Amount' }, { value: 'percent', label: '%' }]} />
      {!!type && (
        <Field label={type === 'percent' ? `${title} %` : `${title} amount`} value={f[`${k}_value`]} onChangeText={set(`${k}_value`)}
          keyboardType="decimal-pad" placeholder="0" error={a.error}
          hint={a.amount > 0 ? `${hint}: ${money(a.amount)}` : hint} testID={`${k}-value`} />
      )}
    </>
  );
}

/*
  Tablet: the checkout in the order panel, in place of the cart items, so the order is finished on the shop screen.
  Placing it prints the bill (Shop settings → Bill printing) and empties the panel for the next order.
*/
export function PanelCheckout({ width, onBack, bottomInset = true }) {
  const cart = useCart();
  const { shop } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { print } = usePrintBill();
  const form = usePosForm({ lines: cart.lines.map((l) => ({ ...l, name: lineName(l) })) });
  const [saving, setSaving] = useState(false);
  const cashRef = useRef(null);

  const submit = async () => {
    setSaving(true);
    try {
      const r = await placeStaffOrder(form);
      cart.clear();
      onBack();
      const later = r.offline ? 'It is sent to the server when the internet is back.' : '';
      if (shop?.bill_print !== 'manual') {
        Toast.show({ type: r.offline ? 'info' : 'success', text1: r.message, text2: later || undefined, visibilityTime: r.offline ? 6000 : 4000 });
        print(r.order);
      } else {
        // The shop prints only with the button: offer it here, as there is no order screen to press it on
        Toast.show({ type: r.offline ? 'info' : 'success', text1: r.message, text2: `${later ? `${later} ` : ''}Tap here to print the bill`, visibilityTime: 7000,
          onPress: () => { Toast.hide(); print(r.order); } });
      }
    } catch (e) {
      orderErrorToast(e, navigation, false);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard: Ctrl+A A cash received, Ctrl+S S place the order (also when asked for on the shop screen just before)
  const place = () => {
    if (saving) return;
    if (form.needsContact) { Toast.show({ type: 'error', text1: 'Delivery needs the customer\'s phone and address' }); return; }
    if (form.moneyError) { Toast.show({ type: 'error', text1: form.moneyError }); return; }
    if (cart.count) submit();
  };
  const focusCash = () => { cashRef.current?.focus(); };
  useChordKeys({ a: focusCash, s: place });
  useEffect(() => {
    if (pendingKeys.cash) { pendingKeys.cash = false; setTimeout(focusCash, 50); }
    if (pendingKeys.place) { pendingKeys.place = false; setTimeout(place, 50); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <KeyboardAvoidingView behavior="padding" style={[st.panel, { width, paddingBottom: 12 + (bottomInset ? insets.bottom : 0) }]} testID="panel-checkout-form">
      <View style={st.head}>
        <TouchableOpacity onPress={onBack} hitSlop={10} style={st.back} testID="panel-checkout-back">
          <Ionicons name="arrow-back" size={18} color={colors.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>Checkout</Text>
          <Text style={st.sub}>{cart.count} item{cart.count === 1 ? '' : 's'} · tap back to change them</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 12 }}>
        <Card style={{ paddingVertical: 4 }}>
          {cart.lines.map((l, i) => (
            <View key={`${l.item_id}|${l.size || ''}`} style={{ flexDirection: 'row', gap: 8, paddingVertical: 7, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text }}><Text style={{ fontWeight: '800' }}>{qtyLabel(l.qty, l.unit)}</Text>  {lineName(l)}</Text>
                <DiscountNote d={lineDiscount(l)} unit={l.size ? '' : l.unit} />
              </View>
              <Text style={{ fontWeight: '700', color: colors.text }}>{money(round2(l.qty * l.price))}</Text>
            </View>
          ))}
        </Card>
        <CheckoutFields form={form} cashRef={cashRef} />
      </ScrollView>

      <View style={st.foot}>
        {form.needsContact && <Text style={[s.itemMeta, { marginBottom: 8, color: colors.danger }]}>Delivery needs the customer's phone and address.</Text>}
        <Button testID="panel-place" title={`Place order · ${money(form.total)}`} icon="checkmark-circle-outline"
          onPress={submit} loading={saving} disabled={!cart.count || !!form.moneyError || form.needsContact} />
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  panel: {
    backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: colors.border, paddingHorizontal: 14, paddingTop: 14,
    shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: -3, height: 0 }, elevation: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  back: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  title: { fontSize: 19, fontWeight: '900', color: colors.black },
  sub: { color: colors.muted, fontSize: 13, marginTop: 1 },
  foot: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
});
