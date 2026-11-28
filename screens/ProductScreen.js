import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, useWindowDimensions, StyleSheet } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Footer, Button, Chip, Loading, ErrorBox, HeaderButton } from '../components/ui';
import { ProductImage, QtyStepper, offLabel } from '../components/shop';
import { useLoad } from '../components/useData';
import { useCart } from '../components/CartContext';
import { api } from '../services/api';
import { money, perUnit, qtyLabel } from '../services/format';
import { minOf, round2 } from '../services/qty';
import { colors } from '../theme';

export default function ProductScreen({ navigation, route }) {
  const cart = useCart();
  const { width } = useWindowDimensions();
  const { data: p, loading, error, reload } = useLoad(() => api.product(route.params.id).then((r) => r.product), [route.params.id]);
  const shown = p || route.params.product;
  const sizes = shown?.sizes || [];
  const sized = sizes.length > 0; // fast food: pick a size, each size has its own price
  const [size, setSize] = useState('');
  const inCart = cart.qtyOf(route.params.id, sized ? size : undefined);
  const [qty, setQty] = useState(0);
  const [img, setImg] = useState(0);

  // Start from what's in the cart, else the first preset / minimum (sized: a size already in the cart, else the first)
  useEffect(() => {
    if (!shown || qty) return;
    if (sized) {
      const pick = sizes.find((z) => cart.qtyOf(shown.id, z.name) > 0) || sizes[0];
      setSize(pick.name);
      setQty(cart.qtyOf(shown.id, pick.name) || 1);
      return;
    }
    setQty(inCart || (shown.qty_options?.length ? shown.qty_options[0] : minOf(shown)));
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  // A size the owner removed while this page was open → back to the first one
  useEffect(() => {
    if (sized && size && !sizes.some((z) => z.name === size)) { setSize(sizes[0].name); setQty(cart.qtyOf(shown.id, sizes[0].name) || 1); }
  }, [sizes.map((z) => z.name).join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  const chooseSize = (name) => { setSize(name); setQty(cart.qtyOf(shown.id, name) || 1); };

  if (!shown) return <Screen title="Product">{loading ? <Loading /> : <ErrorBox message={error} onRetry={reload} />}</Screen>;

  const images = shown.images?.length ? shown.images : [{ url: shown.image }];
  // Fixed discount shows as "Rs 50 OFF", a % one as "10% OFF"; sizes: the item's discount on every size
  const off = offLabel(shown);
  const unitPrice = sized ? (sizes.find((z) => z.name === size)?.price ?? shown.price) : shown.price;
  // Stock is for the item as a whole: other sizes already in the cart count too
  const otherSizes = sized ? cart.qtyOf(shown.id) - cart.qtyOf(shown.id, size) : 0;
  const overMax = shown.max_qty != null && qty + otherSizes > shown.max_qty + 1e-9;
  const imgW = Math.min(width, 700);

  const save = () => {
    cart.setQty(shown.id, qty, shown, sized ? size : '');
    Toast.show({ type: 'success', text1: inCart ? 'Cart updated' : 'Added to cart',
      text2: sized ? `${qty} × ${shown.name} (${size})` : `${qtyLabel(qty, shown.unit)} ${shown.name}` });
    navigation.goBack();
  };

  return (
    <Screen
      title={shown.name}
      subtitle={shown.category_name}
      padded={false}
      right={<HeaderButton icon="cart-outline" badge={cart.count} onPress={() => navigation.navigate('Cart')} />}
      footer={shown.in_stock ? (
        <Footer>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>{sized ? `${qty} × ${size}` : qtyLabel(qty, shown.unit)}</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.black }}>{money(round2(qty * unitPrice))}</Text>
            </View>
            <Button testID="add-to-cart" title={inCart ? 'Update cart' : 'Add to cart'} icon="cart" onPress={save} disabled={!qty || overMax || (sized && !size)} style={{ flex: 1.4 }} />
          </View>
        </Footer>
      ) : null}
    >
      <View style={{ alignItems: 'center', backgroundColor: '#fff' }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: imgW }}
          onMomentumScrollEnd={(e) => setImg(Math.round(e.nativeEvent.contentOffset.x / imgW))}>
          {images.map((im, i) => <ProductImage key={i} uri={im.url} style={{ width: imgW, height: Math.min(imgW, 420) }} iconSize={60} />)}
        </ScrollView>
        {images.length > 1 && (
          <View style={st.dots}>{images.map((_, i) => <View key={i} style={[st.dot, i === img && { backgroundColor: colors.primary, width: 18 }]} />)}</View>
        )}
      </View>

      <View style={{ padding: 16 }}>
        <Text style={st.name}>{shown.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <Text style={st.price}>{sized ? money(unitPrice) : perUnit(shown.price, shown.unit)}</Text>
          {sized && !!size && <Text style={{ color: colors.muted, fontWeight: '700' }}>{size}</Text>}
          {!!off && !sized && shown.compare_price > shown.price && <Text style={st.strike}>{money(shown.compare_price)}</Text>}
          {!!off && <Text style={st.off}>{off}</Text>}
        </View>

        {!shown.in_stock ? (
          <View style={st.outBox}><Text style={{ color: colors.danger, fontWeight: '700' }}>Out of stock — check again soon.</Text></View>
        ) : (
          <>
            {sized && sizes.length > 1 && (
              <>
                <Text style={st.label}>Choose size</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {sizes.map((z) => {
                    const on = z.name === size;
                    const n = cart.qtyOf(shown.id, z.name);
                    return (
                      <TouchableOpacity key={z.name} onPress={() => chooseSize(z.name)} style={[st.size, on && st.sizeOn]} testID={`size-${z.name}`}>
                        <Text style={[st.sizeName, on && { color: colors.primary }]}>{z.name}</Text>
                        <Text style={[st.sizePrice, on && { color: colors.primary }]}>{money(z.price)}</Text>
                        {n > 0 && <Text style={st.sizeInCart}>{n} in cart</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
            <Text style={st.label}>{sized ? 'How many?' : 'How much?'}</Text>
            {!sized && shown.qty_options?.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {shown.qty_options.map((o) => (
                  <Chip key={o} label={qtyLabel(o, shown.unit)} active={Math.abs(qty - o) < 1e-9} onPress={() => setQty(o)} />
                ))}
              </View>
            )}
            <View style={{ maxWidth: 260 }}>
              <QtyStepper product={shown} qty={qty} onChange={(q) => setQty(q || minOf(shown))} testID="qty" />
            </View>
            {overMax && <Text style={{ color: colors.danger, marginTop: 6 }}>Only {qtyLabel(shown.max_qty, shown.unit)} available{sized ? ' (all sizes together)' : ''}.</Text>}
            {!sized && shown.min_qty > shown.qty_step && <Text style={st.hint}>Minimum {qtyLabel(shown.min_qty, shown.unit)}</Text>}
          </>
        )}

        {!!shown.description && (
          <>
            <Text style={[st.label, { marginTop: 18 }]}>About this product</Text>
            <Text style={{ color: colors.text, lineHeight: 21 }}>{shown.description}</Text>
          </>
        )}
        {loading && !p && <Loading />}
      </View>
    </Screen>
  );
}

const st = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, paddingVertical: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  name: { fontSize: 21, fontWeight: '800', color: colors.black },
  price: { fontSize: 20, fontWeight: '800', color: colors.primary },
  strike: { fontSize: 14, color: colors.faint, textDecorationLine: 'line-through' },
  off: { fontSize: 12, fontWeight: '800', color: colors.sale },
  label: { fontSize: 14, fontWeight: '800', color: colors.text, marginTop: 16, marginBottom: 8 },
  hint: { fontSize: 12, color: colors.muted, marginTop: 6 },
  outBox: { backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 12, marginTop: 14 },
  size: { minWidth: 76, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center' },
  sizeOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  sizeName: { fontSize: 16, fontWeight: '800', color: colors.text },
  sizePrice: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 2 },
  sizeInCart: { fontSize: 11, color: colors.success, fontWeight: '700', marginTop: 2 },
});
