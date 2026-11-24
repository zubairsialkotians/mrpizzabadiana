import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, s } from './ui';
import { ProductImage, QtyStepper } from './shop';
import { useCart, lineKey, lineName } from './CartContext';
import { confirmAction } from '../services/confirm';
import { money } from '../services/format';
import { round2 } from '../services/qty';
import { colors } from '../theme';

/*
  Tablets: owner / branch admin / cashier see the order being taken on the right of the shop,
  so every item they tap shows up there at once. Phones keep the cart bar and cart screen.
*/
export const SPLIT_MIN_WIDTH = 700;
export const panelWidth = (width) => (width >= 1100 ? 400 : width >= 900 ? 360 : 320);
export const isSplit = (width, isSeller) => !!isSeller && width >= SPLIT_MIN_WIDTH;

// title / checkoutTitle / note: changing a placed order uses its own words; clearable: show "Clear"
export function CartPanel({ width, onCheckout, title = 'Current order', checkoutTitle = 'Customer & charges', checkoutIcon = 'arrow-forward',
  note = 'Customer, discount, tax and service charge on the next step.', clearable = true, bottomInset = true }) {
  const cart = useCart();
  const insets = useSafeAreaInsets();
  const d = cart.draft || {};
  const customer = [d.name, d.phone, d.fulfilment === 'delivery' ? 'Delivery' : d.fulfilment === 'pickup' ? 'Takeaway' : ''].filter(Boolean).join(' · ');

  const clear = async () => {
    if (await confirmAction('Clear this order?', 'All items and customer details are removed.', 'Clear', true)) cart.clear();
  };

  return (
    <View style={[st.panel, { width, paddingBottom: 12 + (bottomInset ? insets.bottom : 0) }]} testID="cart-panel">
      <View style={st.head}>
        <View style={{ flex: 1 }}>
          <Text style={st.title}>{title}</Text>
          <Text style={st.sub}>{cart.count ? `${cart.count} item${cart.count === 1 ? '' : 's'}` : 'Tap items to add them'}</Text>
        </View>
        {clearable && cart.count > 0 && (
          <TouchableOpacity onPress={clear} hitSlop={8} style={st.clear} testID="panel-clear">
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 13 }}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!customer && (
        <View style={st.customer}>
          <Ionicons name="person-outline" size={15} color={colors.primaryDark} />
          <Text style={st.customerText} numberOfLines={1}>{customer}</Text>
        </View>
      )}

      {!cart.count ? (
        <View style={st.empty}>
          <Ionicons name="receipt-outline" size={44} color={colors.primary} />
          <Text style={st.emptyText}>No items yet</Text>
          <Text style={[s.itemMeta, { textAlign: 'center' }]}>Items you add from the left appear here.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 4 }}>
          {cart.lines.map((l, i) => (
            <View key={lineKey(l.item_id, l.size)} style={[st.line, i > 0 && st.lineBorder]} testID={`panel-line-${l.item_id}${l.size ? `-${l.size}` : ''}`}>
              <ProductImage uri={l.image} style={st.img} iconSize={16} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                  <Text style={st.name} numberOfLines={2}>{lineName(l)}</Text>
                  <TouchableOpacity onPress={() => cart.remove(l.item_id, l.size)} hitSlop={8}>
                    <Ionicons name="close" size={18} color={colors.faint} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 128 }}>
                    <QtyStepper small product={l} qty={l.qty} onChange={(q) => cart.setQty(l.item_id, q, undefined, l.size)} />
                  </View>
                  <Text style={st.amount}>{money(round2(l.qty * l.price))}</Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={st.foot}>
        <View style={st.totalRow}>
          <Text style={st.totalLabel}>Items total</Text>
          <Text style={st.total}>{money(cart.subtotal)}</Text>
        </View>
        {!!note && <Text style={[s.itemMeta, { marginBottom: 10 }]}>{note}</Text>}
        <Button testID="panel-checkout" title={checkoutTitle} icon={checkoutIcon} onPress={onCheckout} disabled={!cart.count} />
      </View>
    </View>
  );
}

// Tablet: pick sizes right on the shop screen. Tap a size to add it; − / + change it, − at 1 takes it out again.
export function SizePicker({ product: p, onClose }) {
  const cart = useCart();
  const insets = useSafeAreaInsets();
  if (!p) return null;
  const setN = (z, n) => cart.setQty(p.id, n, p, z.name);
  const total = p.sizes.reduce((a, z) => a + cart.qtyOf(p.id, z.name), 0);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} style={st.sizeBack} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[st.sizeCard, { marginBottom: insets.bottom }]}>
          <View style={s.sheetHead}>
            <Text style={s.sheetTitle} numberOfLines={1}>{p.name}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><Text style={{ color: colors.primary, fontWeight: '800', fontSize: 16 }}>Done</Text></TouchableOpacity>
          </View>
          <Text style={[s.itemMeta, { marginBottom: 12 }]}>Tap a size to add it. Use − to take one off.</Text>
          {p.sizes.map((z) => {
            const n = cart.qtyOf(p.id, z.name);
            const max = p.max_qty != null && total + 1 > p.max_qty + 1e-9;
            return (
              <TouchableOpacity key={z.name} activeOpacity={n ? 1 : 0.7} onPress={n ? undefined : () => setN(z, 1)} disabled={!n && max}
                style={[st.sizeRow, n > 0 && st.sizeOn, !n && max && { opacity: 0.4 }]} testID={`quick-size-${z.name}`}>
                <View style={{ flex: 1 }}>
                  <Text style={[st.sizeName, n > 0 && { color: colors.primary }]}>{z.name}</Text>
                  <Text style={st.sizePrice}>{money(z.price)}{n > 1 ? `  ·  ${money(round2(n * z.price))}` : ''}</Text>
                </View>
                {n > 0 ? (
                  <View style={st.step}>
                    <TouchableOpacity style={st.stepBtn} onPress={() => setN(z, n - 1)} hitSlop={6} testID={`quick-size-${z.name}-dec`}>
                      <Ionicons name={n === 1 ? 'trash-outline' : 'remove'} size={20} color={colors.brand} />
                    </TouchableOpacity>
                    <Text style={st.stepText}>{n}</Text>
                    <TouchableOpacity style={[st.stepBtn, max && { opacity: 0.4 }]} disabled={max} onPress={() => setN(z, n + 1)} hitSlop={6} testID={`quick-size-${z.name}-inc`}>
                      <Ionicons name="add" size={20} color={colors.brand} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={st.addPill}><Ionicons name="add" size={18} color={colors.onBrand} /><Text style={st.addPillText}>Add</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const st = StyleSheet.create({
  panel: {
    backgroundColor: '#fff', borderLeftWidth: 1, borderLeftColor: colors.border, paddingHorizontal: 14, paddingTop: 14,
    shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: -3, height: 0 }, elevation: 6,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 19, fontWeight: '900', color: colors.black },
  sub: { color: colors.muted, fontSize: 13, marginTop: 1 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, height: 32, borderRadius: 16, backgroundColor: colors.dangerSoft },
  customer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 6 },
  customerText: { flex: 1, color: colors.primaryDark, fontWeight: '700', fontSize: 13 },
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
  total: { fontSize: 22, fontWeight: '900', color: colors.black },
  sizeBack: { flex: 1, backgroundColor: 'rgba(12,35,22,0.35)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sizeCard: { width: '100%', maxWidth: 460, backgroundColor: '#fff', borderRadius: 22, padding: 18 },
  sizeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
  },
  sizeOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sizeName: { fontSize: 17, fontWeight: '800', color: colors.text },
  sizePrice: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 2 },
  step: { flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: 21, backgroundColor: colors.black, paddingHorizontal: 4 },
  stepBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontWeight: '800', fontSize: 16, minWidth: 28, textAlign: 'center' },
  addPill: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.brand },
  addPillText: { color: colors.onBrand, fontWeight: '800' },
});
