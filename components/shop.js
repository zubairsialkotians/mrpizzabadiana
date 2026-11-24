import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { money, perUnit, qtyLabel } from '../services/format';
import { nextQty, prevQty } from '../services/qty';
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

// − 500 g +   (steps by the product's qty_step; below the minimum removes)
export function QtyStepper({ product, qty, onChange, small, testID }) {
  const atMax = product.max_qty != null && nextQty(qty, product) > product.max_qty + 1e-9;
  return (
    <View style={[st.stepper, small && { height: 34 }]} testID={testID}>
      <TouchableOpacity style={st.stepBtn} onPress={() => onChange(prevQty(qty, product))} hitSlop={6} testID={testID && `${testID}-dec`}>
        <Ionicons name={prevQty(qty, product) === 0 ? 'trash-outline' : 'remove'} size={small ? 16 : 18} color={colors.brand} />
      </TouchableOpacity>
      <Text style={[st.stepText, small && { fontSize: 13 }]} numberOfLines={1}>{qtyLabel(qty, product.unit)}</Text>
      <TouchableOpacity style={[st.stepBtn, atMax && { opacity: 0.4 }]} disabled={atMax} onPress={() => onChange(nextQty(qty, product))} hitSlop={6} testID={testID && `${testID}-inc`}>
        <Ionicons name="add" size={small ? 16 : 18} color={colors.brand} />
      </TouchableOpacity>
    </View>
  );
}

// Grid card: tap → product page; "Add" puts the smallest amount in the cart
// onSizes (tablet order taking): "Choose size" opens a quick size picker instead of the product page
export function ProductCard({ p, onPress, width, onSizes }) {
  const cart = useCart();
  // Fast food with several sizes: size is chosen on the product page. One size only: add it straight away.
  const sized = p.sizes?.length > 1;
  const oneSize = p.sizes?.length === 1 ? p.sizes[0].name : '';
  const inCart = cart.qtyOf(p.id);
  const off = p.compare_price > p.price ? Math.round((1 - p.price / p.compare_price) * 100) : 0;
  const first = p.qty_options?.length ? p.qty_options[0] : p.min_qty;
  return (
    <TouchableOpacity style={[st.card, { width }]} onPress={onPress} activeOpacity={0.8} testID={`product-${p.id}`}>
      <View>
        <ProductImage uri={p.image} style={st.cardImg} />
        {off > 0 && <View style={st.offBadge}><Text style={st.offText}>{off}% OFF</Text></View>}
        {!p.in_stock && <View style={st.soldOut}><Text style={st.soldOutText}>Out of stock</Text></View>}
      </View>
      <View style={{ padding: 10, flex: 1 }}>
        <Text style={st.cardName} numberOfLines={2}>{p.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          <Text style={st.cardPrice}>{sized ? `from ${money(p.price)}` : oneSize ? money(p.sizes[0].price) : perUnit(p.price, p.unit)}</Text>
          {!!oneSize && <Text style={{ fontSize: 12, color: colors.muted, fontWeight: '700' }}>{oneSize}</Text>}
          {off > 0 && <Text style={st.strike}>{money(p.compare_price)}</Text>}
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
  bubble: {
    position: 'absolute', top: 0, right: 0, backgroundColor: colors.sale, borderRadius: 10, minWidth: 20, height: 20,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#fff',
  },
  bubbleText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
