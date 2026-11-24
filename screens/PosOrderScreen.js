import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Screen, Card, KV, Field, Button, Footer, SectionTitle, Segmented, SearchBar, ChipRow, Chip, Empty, BranchField, s } from '../components/ui';
import { ProductImage } from '../components/shop';
import { useAuth } from '../components/AuthContext';
import { useCart, useLineStore, LinesScope, lineName } from '../components/CartContext';
import { Catalogue } from '../components/Catalogue';
import { CartPanel, SizePicker, SPLIT_MIN_WIDTH, panelWidth } from '../components/CartPanel';
import { api } from '../services/api';
import { money, qtyLabel } from '../services/format';
import { nextQty, prevQty, minOf, round2, deliveryFee } from '../services/qty';
import { usePrintBill } from '../components/PrintBill';
import { colors } from '../theme';

/*
  Staff checkout. New order: items come from the cart (staff add them in the shop like a customer);
  here they enter takeaway/delivery, customer, discount, tax and service charge, and the order is confirmed straight away.
  Editing (route.params.order): change the items, discount and charges of an order taken in the app, until it is completed.
  Money: discount on items + delivery; tax and service charge (fixed or %) on what is left. Same as the server.
  Prices come from the catalogue; the server prices and checks stock again.
*/
const lineKey = (itemId, size) => `${itemId}|${(size || '').toLowerCase()}`;

export default function PosOrderScreen({ navigation, route }) {
  const editing = route.params?.order || null;
  const { shop, isOwner, homeRoute } = useAuth();
  const cart = useCart();
  const { print } = usePrintBill();
  // Editing: the order's items, with the same rules as the cart (the shop grid and order panel work on it on tablets)
  const edit = useLineStore();
  const lines = (editing ? edit.lines : cart.lines).map((l) => ({
    key: lineKey(l.item_id, l.size), item_id: l.item_id, size: l.size || '', name: lineName(l), unit: l.unit, price: l.price, qty: l.qty, rules: l,
  }));
  const [picker, setPicker] = useState(false);
  const { width } = useWindowDimensions();
  const tablet = width >= SPLIT_MIN_WIDTH;
  const [f, setF] = useState({
    fulfilment: editing?.fulfilment || 'pickup', name: '', phone: '', address: '', note: '', branch_id: 0,
    // Editing: the order's own values. New order: tax / service charge start from the shop's defaults (Shop settings)
    ...Object.fromEntries(['discount', 'tax', 'service'].flatMap((k) => {
      const from = editing || (k === 'discount' ? null : shop);
      return [
        [`${k}_type`, from?.[`${k}_type`] || ''],
        [`${k}_value`, Number(from?.[`${k}_value`]) > 0 ? String(from[`${k}_value`]) : ''],
      ];
    })),
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (v) => setF((p) => ({ ...p, [k]: v }));

  // Editing: start from the order's lines, then take the catalogue's rules (steps, minimums) for − / +
  useEffect(() => {
    if (!editing) return;
    edit.setLines(editing.items.map((it) => ({
      item_id: it.item_id, size: it.size || '', name: it.name, unit: it.unit, price: it.price, image: it.image || '', qty: it.qty,
      min_qty: 1, qty_step: 1, max_qty: null, qty_options: [],
    })));
    const ids = [...new Set(editing.items.map((it) => it.item_id))].join(',');
    api.products({ ids, per_page: 60 }).then((r) => edit.applyRules(r.products || [])).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phone picker: tap adds the item's first amount, or one more step when it's already there
  const add = (p, size) => {
    const name = size?.name || '';
    const have = edit.qtyOf(p.id, name);
    if (have) edit.setQty(p.id, nextQty(have, p), p, name);
    else edit.add(p, size ? 1 : minOf(p), name);
    Toast.show({ type: 'success', text1: `Added ${size ? `${p.name} (${size.name})` : p.name}`, visibilityTime: 1200 });
  };
  const step = (key, dir) => {
    const l = lines.find((x) => x.key === key);
    if (!l) return;
    const rules = { qty_step: 1, min_qty: 1, ...l.rules };
    edit.setQty(l.item_id, dir > 0 ? nextQty(l.qty, rules) : prevQty(l.qty, rules), undefined, l.size);
  };
  const remove = (key) => {
    const l = lines.find((x) => x.key === key);
    if (l) edit.remove(l.item_id, l.size);
  };

  const subtotal = round2(lines.reduce((a, l) => a + round2(l.qty * l.price), 0));
  const fee = editing ? Number(editing.delivery_fee) || 0 : deliveryFee(shop, subtotal, f.fulfilment);
  const base = round2(subtotal + fee);
  const adj = (k, on) => {
    const type = f[`${k}_type`];
    const value = Number(f[`${k}_value`]) || 0;
    const amount = !type || value <= 0 ? 0 : round2(type === 'percent' ? on * Math.min(value, 100) / 100 : (k === 'discount' ? Math.min(value, on) : value));
    const error = type === 'percent' && value > 100 ? 'At most 100%' : k === 'discount' && type === 'fixed' && value > on ? `At most ${money(on)}` : null;
    return { type, value, amount, error, pct: type === 'percent' && amount > 0 ? ` (${value}%)` : '' };
  };
  const disc = adj('discount', base);
  const after = round2(base - disc.amount);
  const tax = adj('tax', after);
  const service = adj('service', after);
  const total = round2(after + tax.amount + service.amount);
  const moneyError = disc.error || tax.error || service.error;
  const needsContact = !editing && f.fulfilment === 'delivery' && (!f.phone.trim() || !f.address.trim());

  const submit = async () => {
    setSaving(true);
    const payload = {
      items: lines.map((l) => ({ item_id: l.item_id, size: l.size, qty: l.qty })),
      ...Object.fromEntries([['discount', disc], ['tax', tax], ['service', service]].flatMap(([k, a]) => [
        [`${k}_type`, a.amount > 0 ? a.type : ''], [`${k}_value`, a.amount > 0 ? a.value : 0],
      ])),
    };
    try {
      if (editing) {
        const r = await api.posUpdate({ id: editing.id, ...payload });
        Toast.show({ type: 'success', text1: r.message });
        navigation.goBack();
      } else {
        const r = await api.posPlace({ ...payload, fulfilment: f.fulfilment, name: f.name, phone: f.phone, address: f.address, note: f.note, branch_id: f.branch_id });
        Toast.show({ type: 'success', text1: r.message });
        cart.clear();
        // Shop settings → Bill printing: print right away unless the shop prints only with the button
        if (shop?.bill_print !== 'manual') print(r.order);
        // Shop → cart → here: land on the new order, with this login's home behind it
        navigation.reset({ index: 1, routes: [{ name: homeRoute }, { name: 'AdminOrderDetail', params: { id: r.order.id } }] });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: editing ? 'Could not update the order' : 'Could not place the order', text2: e.message, visibilityTime: 7000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      title={editing ? `Change ${editing.order_no}` : 'New order'}
      subtitle={editing ? `${editing.name} · ${editing.fulfilment === 'pickup' ? 'Takeaway' : 'Delivery'}` : 'Confirmed as soon as you place it'}
      footer={(
        <Footer>
          <Button testID="pos-submit" title={`${editing ? 'Save changes' : 'Place order'} · ${money(total)}`} icon={editing ? 'save-outline' : 'checkmark-circle-outline'}
            onPress={submit} loading={saving} disabled={!lines.length || !!moneyError || needsContact} />
        </Footer>
      )}
    >
      <SectionTitle right={editing
        ? <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => setPicker(true)}>+ Add items</Text>
        : <Text style={{ color: colors.primary, fontWeight: '700' }} onPress={() => navigation.goBack()}>Change in cart</Text>}>
        Items
      </SectionTitle>
      {!editing ? (
        <Card style={{ paddingVertical: 4 }}>
          {!lines.length && <Text style={[s.itemMeta, { paddingVertical: 10 }]}>No items. Add them in the shop.</Text>}
          {lines.map((l, i) => (
            <View key={l.key} style={{ flexDirection: 'row', gap: 8, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <Text style={{ flex: 1, color: colors.text }}><Text style={{ fontWeight: '800' }}>{qtyLabel(l.qty, l.unit)}</Text>  {l.name}</Text>
              <Text style={{ fontWeight: '700', color: colors.text }}>{money(round2(l.qty * l.price))}</Text>
            </View>
          ))}
        </Card>
      ) : !lines.length ? (
        <Card onPress={() => setPicker(true)} style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Ionicons name="add-circle-outline" size={30} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 6 }}>Add items</Text>
        </Card>
      ) : (
        <Card style={{ paddingVertical: 4 }}>
          {lines.map((l, i) => (
            <View key={l.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>{l.name}</Text>
                <Text style={s.itemMeta}>{money(l.price)} · {money(round2(l.qty * l.price))}</Text>
              </View>
              <TouchableOpacity onPress={() => step(l.key, -1)} hitSlop={8} testID={`minus-${l.key}`}><Ionicons name="remove-circle-outline" size={26} color={colors.primary} /></TouchableOpacity>
              <Text style={{ minWidth: 48, textAlign: 'center', fontWeight: '800', color: colors.text }}>{qtyLabel(l.qty, l.unit)}</Text>
              <TouchableOpacity onPress={() => step(l.key, 1)} hitSlop={8} testID={`plus-${l.key}`}><Ionicons name="add-circle" size={26} color={colors.primary} /></TouchableOpacity>
              <TouchableOpacity onPress={() => remove(l.key)} hitSlop={8} style={{ marginLeft: 4 }}><Ionicons name="trash-outline" size={20} color={colors.danger} /></TouchableOpacity>
            </View>
          ))}
        </Card>
      )}

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

      <AdjustField title="Discount" k="discount" f={f} set={set} a={disc} hint="Taken off the order total (items + delivery)" />
      <AdjustField title="Tax" k="tax" f={f} set={set} a={tax} hint="Added on the total after the discount" />
      <AdjustField title="Service charge" k="service" f={f} set={set} a={service} hint="Added on the total after the discount" />

      <Card>
        <KV label="Items" value={money(subtotal)} />
        {(f.fulfilment === 'delivery' || fee > 0) && <KV label="Delivery" value={fee ? money(fee) : 'Free'} />}
        {disc.amount > 0 && <KV label={`Discount${disc.pct}`} value={`-${money(disc.amount)}`} tone="bad" />}
        {tax.amount > 0 && <KV label={`Tax${tax.pct}`} value={`+${money(tax.amount)}`} />}
        {service.amount > 0 && <KV label={`Service charge${service.pct}`} value={`+${money(service.amount)}`} />}
        <KV label="Total" value={money(total)} bold />
      </Card>

      {!!editing && !tablet && <ProductPicker visible={picker} onClose={() => setPicker(false)} onAdd={add} lines={lines} />}
      {!!editing && tablet && (
        <LinesScope value={edit}>
          <EditItems visible={picker} order={editing} onClose={() => setPicker(false)} />
        </LinesScope>
      )}
    </Screen>
  );
}

/*
  Tablet: change a placed order's items like taking a new one — the shop's items on the left, the order's items
  on the right (works on the order's own lines through LinesScope, not on the cart).
*/
function EditItems({ visible, order, onClose }) {
  const lines = useCart();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [sizesOf, setSizesOf] = useState(null);
  const sideW = panelWidth(width);
  const tap = (p) => {
    if (p.sizes?.length > 1) { setSizesOf(p); return; }
    if (!p.in_stock) { Toast.show({ type: 'error', text1: `${p.name} is out of stock` }); return; }
    const size = p.sizes?.length === 1 ? p.sizes[0].name : '';
    const have = lines.qtyOf(p.id, size);
    if (have) lines.setQty(p.id, size ? have + 1 : nextQty(have, p), p, size);
    else lines.add(p, size ? 1 : (p.qty_options?.length ? p.qty_options[0] : minOf(p)), size);
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[s.header, { paddingTop: 12 + insets.top }]}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle} numberOfLines={1}>Change items · {order.order_no}</Text>
            <Text style={s.headerSub} numberOfLines={1}>Tap items to add them; change or remove them on the right</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10} testID="edit-items-done">
            <Text style={{ color: colors.onBrand, fontWeight: '900', fontSize: 16 }}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <Catalogue width={width - sideW} onSizes={setSizesOf} onProductPress={tap} bottomPadding={30 + insets.bottom} />
          <CartPanel width={sideW} title="Order items" clearable={false} checkoutTitle="Done" checkoutIcon="checkmark"
            note="Save changes on the next screen to update the order." onCheckout={onClose} />
        </View>
        <SizePicker product={sizesOf} onClose={() => setSizesOf(null)} />
      </View>
    </Modal>
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

// Search the catalogue and tap to add (items with sizes: tap the size)
function ProductPicker({ visible, onClose, onAdd, lines }) {
  const insets = useSafeAreaInsets();
  const [cats, setCats] = useState([]);
  const [cat, setCat] = useState(0);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { if (visible && !cats.length) api.categories().then((r) => setCats(r.categories || [])).catch(() => {}); }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!visible) return;
    let live = true;
    setProducts(null);
    setError(null);
    api.products({ search: q, category_id: cat, per_page: 60 })
      .then((r) => live && setProducts(r.products || []))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [visible, q, cat]);
  const inOrder = useMemo(() => {
    const m = {};
    lines.forEach((l) => { m[l.item_id] = (m[l.item_id] || 0) + Number(l.qty); });
    return m;
  }, [lines]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={s.modalBack}>
        <View style={[s.sheet, { height: '90%', paddingBottom: 12 + insets.bottom }]}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle}>Add items</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>Done</Text></TouchableOpacity>
          </View>
          <SearchBar value={search} onChangeText={setSearch} placeholder="Search items" />
          {cats.length > 1 && (
            <ChipRow>
              <Chip label="All" active={!cat} onPress={() => setCat(0)} />
              {cats.map((c) => <Chip key={c.id} label={c.name} active={cat === c.id} onPress={() => setCat(c.id)} />)}
            </ChipRow>
          )}
          {error ? <Text style={{ color: colors.danger, padding: 12 }}>{error}</Text> : !products ? <ActivityIndicator color={colors.primary} style={{ margin: 24 }} /> : (
            <FlatList
              data={products}
              keyExtractor={(p) => String(p.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Empty text="No items found" />}
              renderItem={({ item: p }) => (
                <TouchableOpacity activeOpacity={p.sizes.length ? 1 : 0.6} onPress={p.sizes.length ? undefined : () => onAdd(p)}
                  style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <ProductImage uri={p.image} style={{ width: 44, height: 44, borderRadius: 8 }} iconSize={18} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>{p.name}</Text>
                    <Text style={s.itemMeta}>
                      {p.sizes.length ? 'Choose a size' : money(p.price)}
                      {!p.in_stock ? ' · out of stock' : ''}{inOrder[p.id] ? ` · ${qtyLabel(inOrder[p.id], p.unit)} in order` : ''}
                    </Text>
                    {p.sizes.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                        {p.sizes.map((z) => <Chip key={z.name} label={`${z.name} · ${money(z.price)}`} onPress={() => onAdd(p, z)} />)}
                      </View>
                    )}
                  </View>
                  {!p.sizes.length && <Ionicons name="add-circle" size={28} color={colors.primary} />}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
