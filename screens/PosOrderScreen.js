import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useChordKeys, pendingKeys } from '../components/keys';
import { View, Text, Modal, FlatList, TouchableOpacity, ActivityIndicator, useWindowDimensions, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Screen, Card, Button, Footer, SectionTitle, SearchBar, Chip, Empty, s } from '../components/ui';
import { usePosForm, CheckoutFields, orderErrorToast, placeStaffOrder } from '../components/PosCheckout';
import { ProductImage, DiscountNote } from '../components/shop';
import { useAuth } from '../components/AuthContext';
import { useCart, useLineStore, LinesScope, lineName, customLine, catalogueIds, lineDiscount } from '../components/CartContext';
import { CustomItemButton } from '../components/CustomItem';
import { Catalogue } from '../components/Catalogue';
import { CartPanel, SizePicker, SPLIT_MIN_WIDTH, panelWidth } from '../components/CartPanel';
import { api } from '../services/api';
import { CategoryChips } from '../components/CategoryFilter';
import { money, qtyLabel } from '../services/format';
import { nextQty, prevQty, minOf, round2 } from '../services/qty';
import { confirmAction } from '../services/confirm';
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
  const { shop, homeRoute } = useAuth();
  const cart = useCart();
  const { print } = usePrintBill();
  // Editing: the order's items, with the same rules as the cart (the shop grid and order panel work on it on tablets)
  const edit = useLineStore();
  const lines = (editing ? edit.lines : cart.lines).map((l) => ({
    key: lineKey(l.item_id, l.size), item_id: l.item_id, custom: !!l.custom, size: l.size || '', name: lineName(l), unit: l.unit, price: l.price, qty: l.qty, rules: l,
    was: l.was, disc_label: l.disc_label,
  }));
  const [picker, setPicker] = useState(false);
  const { width } = useWindowDimensions();
  const tablet = width >= SPLIT_MIN_WIDTH;
  const form = usePosForm({ lines, editing });
  const { f } = form;
  const [saving, setSaving] = useState(false);

  // Editing: start from the order's lines, then take the catalogue's rules (steps, minimums) for − / +
  useEffect(() => {
    if (!editing) return;
    edit.setLines(editing.items.map((it) => (!Number(it.item_id)
      // A custom item on the order (no catalogue item)
      ? customLine({ name: it.name, price: it.price, qty: it.qty })
      : {
        item_id: it.item_id, size: it.size || '', name: it.name, unit: it.unit, price: it.price, image: it.image || '', qty: it.qty, was: it.list_price,
        min_qty: 1, qty_step: 1, max_qty: null, qty_options: [],
      })));
    const ids = catalogueIds(editing.items.filter((it) => Number(it.item_id)));
    if (ids) api.products({ ids, per_page: 60 }).then((r) => edit.applyRules(r.products || [])).catch(() => {});
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

  const { total, moneyError, needsContact } = form;

  // Keyboard (desktop): Ctrl+A A cash received, Ctrl+S S place / save
  const cashRef = useRef(null);
  const screenFocused = useIsFocused();
  const placeKey = () => {
    if (saving || !lines.length) return;
    if (needsContact) { Toast.show({ type: 'error', text1: 'Delivery needs the customer\'s phone and address' }); return; }
    if (moneyError) { Toast.show({ type: 'error', text1: moneyError }); return; }
    submit();
  };
  useChordKeys({ a: () => cashRef.current?.focus(), s: placeKey }, screenFocused);
  useEffect(() => {
    if (pendingKeys.cash) { pendingKeys.cash = false; setTimeout(() => cashRef.current?.focus(), 300); }
    if (pendingKeys.place) { pendingKeys.place = false; setTimeout(placeKey, 300); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setSaving(true);
    try {
      if (editing) {
        const r = await api.posUpdate({ id: editing.id, ...form.payload() });
        Toast.show({ type: 'success', text1: r.message });
        navigation.goBack();
      } else {
        const r = await placeStaffOrder(form);
        cart.clear();
        if (r.offline) {
          // No internet: kept on this device (sent later), so there is no order screen yet. Print now, or tap to print
          const manual = shop?.bill_print === 'manual';
          Toast.show({ type: 'info', text1: r.message, text2: `It is sent to the server when the internet is back.${manual ? ' Tap here to print the bill.' : ''}`, visibilityTime: 7000,
            onPress: manual ? () => { Toast.hide(); print(r.order); } : undefined });
          if (!manual) print(r.order);
          navigation.reset({ index: 0, routes: [{ name: homeRoute }] });
          return;
        }
        Toast.show({ type: 'success', text1: r.message });
        // Shop settings → Bill printing: print right away unless the shop prints only with the button
        if (shop?.bill_print !== 'manual') print(r.order);
        // Shop → cart → here: land on the new order, with this login's home behind it
        navigation.reset({ index: 1, routes: [{ name: homeRoute }, { name: 'AdminOrderDetail', params: { id: r.order.id } }] });
      }
    } catch (e) {
      orderErrorToast(e, navigation, editing);
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
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text }}><Text style={{ fontWeight: '800' }}>{qtyLabel(l.qty, l.unit)}</Text>  {l.name}</Text>
                <DiscountNote d={lineDiscount(l)} unit={l.size ? '' : l.unit} />
              </View>
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

      {!!editing && (
        <LinesScope value={edit}>
          <CustomItemButton title="Add a custom item" style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
        </LinesScope>
      )}

      <CheckoutFields form={form} cashRef={cashRef} />

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
          {cats.length > 1 && <CategoryChips cats={cats} value={cat} onChange={setCat} />}
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
