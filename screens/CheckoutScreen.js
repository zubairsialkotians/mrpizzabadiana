import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen, Card, KV, Field, Footer, Button, Segmented, SectionTitle, s } from '../components/ui';
import { useCart, lineKey, lineName } from '../components/CartContext';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { money, qtyLabel } from '../services/format';
import { deliveryFee, shopCharges, round2 } from '../services/qty';
import { pickImage } from '../services/images';
import { PAY_TYPES, AccountBox, cashLabel } from '../components/payments';
import { SHOP_KEY } from '../config';
import { colors } from '../theme';

export const GUEST_ORDERS_KEY = `guest_orders_${SHOP_KEY}`;

// Guests fill in their details; the server makes them an account (or links an existing one)
export default function CheckoutScreen({ navigation }) {
  const cart = useCart();
  const { shop, user, isCustomer, startSession } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || '', phone: user?.phone || '', email: user?.email || '', address: user?.address || '', note: '',
  });
  const [fulfilment, setFulfilment] = useState('delivery');
  const accounts = shop?.pay_accounts || [];
  const codOn = shop?.cod !== false || !accounts.length;
  const [payKey, setPayKey] = useState(codOn ? 'cod' : accounts[0]?.key);
  // Picked account gone, or cash switched off meanwhile → first account
  const payAcc = accounts.find((a) => a.key === payKey) || (codOn ? null : accounts[0]);
  const [proof, setProof] = useState(null); // { uri, base64 } picked, sent with the order
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => { setForm({ ...form, [k]: v }); setErrors({ ...errors, [k]: '' }); };

  const fee = deliveryFee(shop, cart.subtotal, fulfilment);
  const charges = shopCharges(shop, cart.subtotal, fee);
  const total = charges.total;

  const place = async () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Enter your name';
    if (form.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number';
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'Enter a valid email';
    if (fulfilment === 'delivery' && !form.address.trim()) e.address = 'Enter your delivery address';
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const r = await api.placeOrder({
        ...form, fulfilment,
        payment_method: payAcc ? payAcc.key : 'cod',
        payment_proof: payAcc && proof ? proof.base64 : undefined,
        items: cart.lines.map((l) => ({ item_id: l.item_id, qty: l.qty, size: l.size || '' })),
      });
      if (r.proof_error) Toast.show({ type: 'error', text1: 'Screenshot not added', text2: r.proof_error, visibilityTime: 8000 });
      cart.clear();
      if (r.token) await startSession(r); // new account → logged in
      if (!r.token && !isCustomer) {
        // Guest using an existing account's details: keep a link to this order on the phone
        const raw = await AsyncStorage.getItem(GUEST_ORDERS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        list.unshift({ id: r.order.id, key: r.order.access_key, order_no: r.order.order_no });
        await AsyncStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(list.slice(0, 20)));
      }
      navigation.reset({ index: 1, routes: [{ name: 'Home' }, { name: 'OrderPlaced', params: { order: r.order, accountExists: !!r.account_exists, newAccount: !!r.token } }] });
    } catch (err) {
      Toast.show({ type: 'error', text1: 'Could not place the order', text2: err.message, visibilityTime: 7000 });
    } finally {
      setBusy(false);
    }
  };

  const pickProof = async () => {
    try {
      const img = await pickImage({ maxWidth: 1400 });
      if (img) setProof(img);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not add the screenshot', text2: e.message });
    }
  };

  const payOptions = [
    ...(codOn ? [{ key: 'cod', name: cashLabel(fulfilment), icon: 'cash-outline', sub: 'Pay when you get your order' }] : []),
    ...accounts.map((a) => ({ key: a.key, name: a.name, icon: PAY_TYPES[a.type]?.icon || 'wallet-outline', sub: `Send money to ${a.number}` })),
  ];

  return (
    <Screen
      title="Checkout"
      footer={(
        <Footer>
          <Button testID="place-order" title={`Place order · ${money(total)}`} icon="checkmark-circle" loading={busy} onPress={place} />
        </Footer>
      )}
    >
      {shop?.pickup && (
        <Segmented value={fulfilment} onChange={setFulfilment}
          options={[{ value: 'delivery', label: 'Home delivery' }, { value: 'pickup', label: 'Pick up from shop' }]} />
      )}

      <SectionTitle>Your details</SectionTitle>
      <Field label="Full name" value={form.name} onChangeText={set('name')} error={errors.name} testID="co-name" />
      <Field label="Phone number" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" error={errors.phone} testID="co-phone" />
      <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" error={errors.email} testID="co-email" />
      <Field label={fulfilment === 'delivery' ? 'Delivery address' : 'Address (optional)'} value={form.address} onChangeText={set('address')}
        multiline error={errors.address} placeholder="House, street, area, city" testID="co-address" />
      <Field label="Note for the shop (optional)" value={form.note} onChangeText={set('note')} placeholder="e.g. call before coming" />
      {fulfilment === 'pickup' && !!shop?.address && <Text style={[s.itemMeta, { marginTop: -6, marginBottom: 12 }]}>Pick up from: {shop.address}</Text>}

      {payOptions.length > 1 || payAcc ? (
        <>
          <SectionTitle>Payment</SectionTitle>
          <Card style={{ paddingVertical: 4 }}>
            {payOptions.map((m, i) => {
              const on = (payAcc ? payAcc.key : 'cod') === m.key;
              return (
                <TouchableOpacity key={m.key} onPress={() => setPayKey(m.key)} testID={`pay-${m.key}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                  <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.primary : colors.faint} />
                  <Ionicons name={m.icon} size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>{m.name}</Text>
                    <Text style={s.itemMeta}>{m.sub}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Card>
          {payAcc && (
            <Card style={{ gap: 10 }}>
              <AccountBox title={payAcc.title} number={payAcc.number} note={payAcc.note} amount={total} />
              <Text style={s.itemMeta}>Send the money, then add a screenshot of the payment. You can also add it later from your order page.</Text>
              {proof ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Image source={{ uri: proof.uri }} style={{ width: 56, height: 56, borderRadius: 8 }} />
                  <Text style={{ flex: 1, fontWeight: '700', color: colors.success }}>Screenshot added</Text>
                  <Button small variant="outline" title="Change" onPress={pickProof} />
                  <Button small variant="ghost" title="Remove" onPress={() => setProof(null)} />
                </View>
              ) : (
                <Button small variant="ghost" icon="image-outline" title="Add payment screenshot" onPress={pickProof} testID="co-proof" />
              )}
            </Card>
          )}
        </>
      ) : null}

      <SectionTitle>Order summary</SectionTitle>
      <Card>
        {cart.lines.map((l) => (
          <View key={lineKey(l.item_id, l.size)} style={{ flexDirection: 'row', paddingVertical: 4 }}>
            <Text style={{ flex: 1, color: colors.text }} numberOfLines={1}>{lineName(l)} <Text style={{ color: colors.muted }}>× {qtyLabel(l.qty, l.unit)}</Text></Text>
            <Text style={{ fontWeight: '700', color: colors.text }}>{money(round2(l.qty * l.price))}</Text>
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
        <KV label="Items" value={money(cart.subtotal)} />
        <KV label={fulfilment === 'pickup' ? 'Pickup' : 'Delivery'} value={fee ? money(fee) : 'Free'} tone={fee ? undefined : 'good'} />
        {charges.tax.amount > 0 && <KV label={`Tax${charges.tax.label}`} value={`+${money(charges.tax.amount)}`} />}
        {charges.service.amount > 0 && <KV label={`Service charge${charges.service.label}`} value={`+${money(charges.service.amount)}`} />}
        <KV label="Total to pay" value={money(total)} bold />
        <Text style={s.itemMeta}>Payment: {payAcc ? payAcc.name : cashLabel(fulfilment).toLowerCase()}</Text>
      </Card>

      {!user && (
        <Text style={[s.itemMeta, { textAlign: 'center' }]}>
          We'll create an account with these details so you can track your order. Already have one?{' '}
          <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => navigation.navigate('Login')}>Log in</Text>
        </Text>
      )}
    </Screen>
  );
}
