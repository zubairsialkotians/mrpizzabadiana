import React, { useState } from 'react';
import { View, Text, TextInput, Image, TouchableOpacity, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { money, perUnit, qtyLabel } from '../services/format';
import { nextQty, prevQty, validQty, stepOf, minOf, cleanQty } from '../services/qty';
import { useCart } from './CartContext';

// Product photo, or a soft placeholder when there is none
export function ProductImage({ uri, style, iconSize = 34 }) {
  if (uri) return <Image source={{ uri }} style={[{ backgroundColor: '#f1f3f5' }, style]} resizeMode="cover" />;
  return (
    <View style={[{ backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ionicons name="image-outline" size={iconSize} color={colors.primary} />
    </View>
  );
}

export const LOOSE_UNITS = ['kg', 'g', 'litre', 'ml'];

// The offer badge: the item's own discount as set (fixed "Rs 50 OFF" or "10% OFF"), else from the "Was" price ("20% OFF")
export function offLabel(p) {
  if (p.discount_type === 'fixed' && Number(p.discount_value) > 0) return `${money(p.discount_value)} OFF`;
  if (p.discount_type === 'percent' && Number(p.discount_value) > 0) return `${Number(p.discount_value)}% OFF`;
  const pct = p.compare_price > p.price ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  return pct > 0 ? `${pct}% OFF` : '';
}

// Under a cart / order / bill line with an item discount: normal price struck through, and what comes off
// d: lineDiscount(line); unit: the line's unit (price per kg …)
export function DiscountNote({ d, unit, style }) {
  if (!d) return null;
  return (
    <Text style={[{ fontSize: 12, marginTop: 2, color: colors.success, fontWeight: '700' }, style]} numberOfLines={1}>
      <Text style={{ color: colors.faint, textDecorationLine: 'line-through', fontWeight: '600' }}>{unit ? perUnit(d.was, unit) : money(d.was)}</Text>
      {`  ${d.label ? `${d.label} · ` : ''}−${money(d.off)}`}
    </Text>
  );
}

// − 500 g +   (steps by the product's qty_step; below the minimum removes)
// editable (staff): the amount can also be typed. Custom items and items sold by weight / volume take any amount
// (0.9 kg of rice); other items the amounts the server accepts (the item's steps / options), within the stock left.
export function QtyStepper({ product, qty, onChange, small, testID, editable }) {
  const atMax = product.max_qty != null && nextQty(qty, product) > product.max_qty + 1e-9;
  const [text, setText] = useState(null); // null: not typing, the label shows
  const commit = () => {
    if (text === null) return;
    const n = cleanQty(Number(String(text).replace(',', '.')));
    setText(null);
    if (!(n >= 0) || n === qty) return;
    if (n === 0) { onChange(0); return; }
    // Sold by weight / volume (kg, g, litre, ml): any amount, e.g. 0.9 kg
    if (!product.custom && !LOOSE_UNITS.includes(product.unit) && !validQty(n, product)) {
      Toast.show({ type: 'error', text1: `${product.name || 'This item'}: ${qtyLabel(n, product.unit)} can't be sold`, text2: `Use steps of ${qtyLabel(stepOf(product), product.unit)}${minOf(product) !== stepOf(product) ? `, at least ${qtyLabel(minOf(product), product.unit)}` : ''}.` });
      return;
    }
    if (product.max_qty != null && n > product.max_qty + 1e-9) {
      Toast.show({ type: 'error', text1: `Only ${qtyLabel(product.max_qty, product.unit)} in stock` });
      return;
    }
    onChange(n);
  };
  return (
    <View style={[st.stepper, small && { height: 34 }]} testID={testID}>
      <TouchableOpacity style={st.stepBtn} onPress={() => onChange(prevQty(qty, product))} hitSlop={6} testID={testID && `${testID}-dec`}>
        <Ionicons name={prevQty(qty, product) === 0 ? 'trash-outline' : 'remove'} size={small ? 16 : 18} color={colors.onBlack} />
      </TouchableOpacity>
      {editable ? (
        <TextInput
          value={text === null ? qtyLabel(qty, product.unit) : text}
          onFocus={() => setText(String(qty))}
          onChangeText={(v) => setText(v.replace(/[^0-9.,]/g, ''))}
          onBlur={commit}
          onSubmitEditing={commit}
          selectTextOnFocus
          keyboardType="decimal-pad"
          returnKeyType="done"
          style={[st.stepText, st.stepInput, small && { fontSize: 13 }]}
          testID={testID && `${testID}-qty`}
        />
      ) : (
        <Text style={[st.stepText, small && { fontSize: 13 }]} numberOfLines={1}>{qtyLabel(qty, product.unit)}</Text>
      )}
      <TouchableOpacity style={[st.stepBtn, atMax && { opacity: 0.4 }]} disabled={atMax} onPress={() => onChange(nextQty(qty, product))} hitSlop={6} testID={testID && `${testID}-inc`}>
        <Ionicons name="add" size={small ? 16 : 18} color={colors.onBlack} />
      </TouchableOpacity>
    </View>
  );
}

// Grid card: tap → product page; "Add" puts the smallest amount in the cart
// onSizes (tablet order taking): "Choose size" opens a quick size picker instead of the product page
export function ProductCard({ p: item, onPress, width, onSizes }) {
  const cart = useCart();
  // Return mode: anything can come back, even when it is out of stock
  const p = cart.returning ? { ...item, in_stock: true, max_qty: null } : item;
  // Fast food with several sizes: size is chosen on the product page. One size only: add it straight away.
  const sized = p.sizes?.length > 1;
  const oneSize = p.sizes?.length === 1 ? p.sizes[0].name : '';
  const inCart = cart.qtyOf(p.id);
  const off = offLabel(p);
  const first = p.qty_options?.length ? p.qty_options[0] : p.min_qty;
  return (
    <TouchableOpacity style={[st.card, { width }]} onPress={onPress} activeOpacity={0.8} testID={`product-${p.id}`}>
      <View>
        <ProductImage uri={p.image} style={st.cardImg} />
        {!!off && <View style={st.offBadge}><Text style={st.offText}>{off}</Text></View>}
        {!p.in_stock && <View style={st.soldOut}><Text style={st.soldOutText}>Out of stock</Text></View>}
      </View>
      <View style={{ padding: 10, flex: 1 }}>
        <Text style={st.cardName} numberOfLines={2}>{p.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          <Text style={st.cardPrice}>{sized ? `from ${money(p.price)}` : oneSize ? money(p.sizes[0].price) : perUnit(p.price, p.unit)}</Text>
          {!!oneSize && <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>{oneSize}</Text>}
          {!!off && p.compare_price > p.price && <Text style={st.strike}>{money(p.compare_price)}</Text>}
        </View>
        <View style={{ flex: 1 }} />
        {sized && p.in_stock && (
          <TouchableOpacity style={st.addBtn} onPress={onSizes ? () => onSizes(p) : onPress} testID={`sizes-${p.id}`}>
            <Ionicons name={inCart > 0 ? 'checkmark' : 'resize-outline'} size={16} color={colors.onBrand} />
            <Text style={st.addText}>{inCart > 0 ? `${inCart} in cart · add more` : 'Choose size'}</Text>
          </TouchableOpacity>
        )}
        {!sized && p.in_stock && (inCart > 0
          ? <QtyStepper small product={p} qty={inCart} onChange={(q) => cart.setQty(p.id, q, p, oneSize)} testID={`card-${p.id}`} />
          : (
            <TouchableOpacity style={st.addBtn} onPress={() => cart.add(p, oneSize ? 1 : first, oneSize)} testID={`add-${p.id}`}>
              <Ionicons name="add" size={16} color={colors.onBrand} />
              <Text style={st.addText}>{oneSize ? 'Add to cart' : `Add ${qtyLabel(first, p.unit)}`}</Text>
            </TouchableOpacity>
          ))}
      </View>
    </TouchableOpacity>
  );
}

// Header icon with a count bubble (cart)
// dot: a plain unread dot instead of a number
export function IconBadge({ icon, count, dot, onPress, testID }) {
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 6 }} hitSlop={6} testID={testID}>
      <Ionicons name={icon} size={24} color={colors.onBrand} />
      {count > 0 && <View style={st.bubble}><Text style={st.bubbleText}>{count > 99 ? '99+' : count}</Text></View>}
      {dot && !(count > 0) && <View style={st.dot} />}
    </TouchableOpacity>
  );
}

const st = StyleSheet.create({
  dot: { position: 'absolute', top: 5, right: 5, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.sale, borderWidth: 1.5, borderColor: '#fff' },
  card: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3,
  },
  cardImg: { width: '100%', aspectRatio: 1 },
  cardName: { fontSize: 14, fontWeight: '700', color: colors.text, minHeight: 36 },
  cardPrice: { fontSize: 15, fontWeight: '800', color: colors.primary },
  strike: { fontSize: 12, color: colors.faint, textDecorationLine: 'line-through' },
  offBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: colors.sale, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  offText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  soldOut: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(17,24,39,0.7)', paddingVertical: 4 },
  soldOutText: { color: '#fff', textAlign: 'center', fontWeight: '700', fontSize: 12 },
  addBtn: {
    marginTop: 8, height: 36, borderRadius: 18, backgroundColor: colors.brand, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  addText: { color: colors.onBrand, fontWeight: '800', fontSize: 13 },
  stepper: {
    marginTop: 8, height: 40, borderRadius: 20, backgroundColor: colors.black, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 4,
  },
  stepBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: '#fff', fontWeight: '800', fontSize: 15, flexShrink: 1 },
  // typed amount: a light box in the middle of the stepper
  stepInput: { flex: 1, minWidth: 0, textAlign: 'center', paddingVertical: 0, paddingHorizontal: 2, height: '80%', borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.14)', outlineStyle: 'none' },
  bubble: {
    position: 'absolute', top: 0, right: 0, backgroundColor: colors.sale, borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff',
  },
  bubbleText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
