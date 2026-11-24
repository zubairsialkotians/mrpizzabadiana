import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Card, KV, Footer, Button, Empty, s } from '../components/ui';
import { ProductImage, QtyStepper } from '../components/shop';
import { useCart, lineKey, lineName } from '../components/CartContext';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { money, perUnit } from '../services/format';
import { deliveryFee, shopCharges, round2 } from '../services/qty';
import { colors } from '../theme';

export default function CartScreen({ navigation }) {
  const cart = useCart();
  const { shop, isSeller } = useAuth();
  const [checking, setChecking] = useState(false);

  // Bring prices and stock up to date
  useEffect(() => {
    if (!cart.lines.length) return;
    setChecking(true);
    api.products({ ids: cart.lines.map((l) => l.item_id).join(','), per_page: 60 })
      .then((r) => cart.sync(r.products))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cart.lines.length) {
    return (
      <Screen title="Cart">
        <Empty icon="cart-outline" text={isSeller ? 'No items in this order yet' : 'Your cart is empty'} />
        <Button title={isSeller ? 'Add items' : 'Start shopping'} onPress={() => navigation.navigate('Home')} />
      </Screen>
    );
  }

  // Staff taking an order: delivery is chosen at their checkout; no minimum, opening hours or (main branch) stock limit here,
  // the server checks the branch's stock when the order is placed
  const fee = isSeller ? 0 : deliveryFee(shop, cart.subtotal);
  const charges = shopCharges(shop, cart.subtotal, fee);
  const free = Number(shop?.free_delivery_over) || 0;
  const belowMin = !isSeller && shop?.min_order > 0 && cart.subtotal < shop.min_order;
  // Stock is per item: sizes of the same item count together
  const overItem = (l) => !isSeller && l.max_qty != null && cart.qtyOf(l.item_id) > l.max_qty + 1e-9;
  const overStock = cart.lines.filter(overItem);
  const accounts = shop?.pay_accounts || [];
  const cashOk = shop?.cod !== false || !accounts.length;

  return (
    <Screen
      title="Cart"
      subtitle={`${cart.count} item${cart.count === 1 ? '' : 's'}${checking ? ' · checking prices…' : ''}`}
      footer={(
        <Footer>
          <Button testID="checkout" title={`${isSeller ? 'Customer & charges' : 'Checkout'} · ${money(isSeller ? cart.subtotal : charges.total)}`} icon="arrow-forward"
            disabled={belowMin || overStock.length > 0 || (!isSeller && !shop?.is_open)} onPress={() => navigation.navigate(isSeller ? 'PosOrder' : 'Checkout')} />
          {!isSeller && !shop?.is_open && <Text style={{ color: colors.danger, textAlign: 'center', marginTop: 6 }}>The shop is closed right now.</Text>}
        </Footer>
      )}
    >
      {cart.lines.map((l) => {
        const over = overItem(l);
        return (
          <Card key={lineKey(l.item_id, l.size)} style={{ flexDirection: 'row', gap: 12, padding: 10 }}>
            <TouchableOpacity onPress={() => navigation.navigate('Product', { id: l.item_id })}>
              <ProductImage uri={l.image} style={{ width: 70, height: 70, borderRadius: 10 }} iconSize={24} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <Text style={[s.itemTitle, { flex: 1 }]} numberOfLines={2}>{lineName(l)}</Text>
                <TouchableOpacity onPress={() => cart.remove(l.item_id, l.size)} hitSlop={8}><Ionicons name="close" size={18} color={colors.faint} /></TouchableOpacity>
              </View>
              <Text style={s.itemMeta}>{l.size ? `${money(l.price)} each` : perUnit(l.price, l.unit)}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 150 }}><QtyStepper small product={l} qty={l.qty} onChange={(q) => cart.setQty(l.item_id, q, undefined, l.size)} testID={`line-${l.item_id}${l.size ? `-${l.size}` : ''}`} /></View>
                <Text style={{ flex: 1, textAlign: 'right', fontWeight: '800', color: colors.text, marginTop: 8 }}>{money(round2(l.qty * l.price))}</Text>
              </View>
              {over && <Text style={{ color: colors.danger, fontSize: 12, marginTop: 4 }}>Only {l.max_qty} {l.unit} available{l.size ? ' (all sizes together)' : ''}</Text>}
            </View>
          </Card>
        );
      })}

      {isSeller ? (
        <Card>
          <KV label="Items" value={money(cart.subtotal)} bold />
          <Text style={s.itemMeta}>Next: takeaway or delivery, customer details, discount, tax and service charge.</Text>
        </Card>
      ) : (
      <Card>
        <KV label="Items" value={money(cart.subtotal)} />
        <KV label="Delivery" value={fee ? money(fee) : 'Free'} tone={fee ? undefined : 'good'} />
        {charges.tax.amount > 0 && <KV label={`Tax${charges.tax.label}`} value={`+${money(charges.tax.amount)}`} />}
        {charges.service.amount > 0 && <KV label={`Service charge${charges.service.label}`} value={`+${money(charges.service.amount)}`} />}
        <KV label="Total" value={money(charges.total)} bold />
        {free > 0 && fee > 0 && (
          <Text style={[s.itemMeta, { color: colors.success }]}>Add {money(round2(free - cart.subtotal))} more for free delivery</Text>
        )}
        {belowMin && <Text style={[s.itemMeta, { color: colors.danger }]}>Minimum order is {money(shop.min_order)}</Text>}
        <Text style={s.itemMeta}>
          {accounts.length
            ? `Pay ${cashOk ? 'cash or ' : ''}by ${accounts.map((a) => a.name).join(' / ')} — choose at checkout.`
            : `Pay cash on delivery${shop?.pickup ? ' or at pickup' : ''}.`}
        </Text>
      </Card>
      )}
    </Screen>
  );
}
