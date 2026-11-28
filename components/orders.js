import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, KV, Badge, s } from './ui';
import { ProductImage, DiscountNote } from './shop';
import { lineDiscount } from './CartContext';
import { round2 } from '../services/qty';
import { money, qtyLabel, niceDate, STATUS_LABELS, paymentLabel } from '../services/format';
import { colors } from '../theme';

export function StatusBadge({ status }) {
  return <Badge status={status} label={STATUS_LABELS[status] || status} />;
}

// Progress steps for the customer; cancelled shows a single red step
export function OrderProgress({ order }) {
  if (order.status === 'cancelled') {
    return (
      <Card style={{ backgroundColor: colors.dangerSoft, borderColor: colors.dangerSoft }}>
        <Text style={{ color: colors.danger, fontWeight: '800' }}>This order was cancelled</Text>
        {!!order.cancel_reason && <Text style={{ color: colors.danger, marginTop: 2 }}>{order.cancel_reason}</Text>}
      </Card>
    );
  }
  const pickup = order.fulfilment === 'pickup';
  const steps = pickup
    ? ['pending', 'confirmed', 'ready', 'delivered']
    : ['pending', 'confirmed', 'ready_for_delivery', 'out_for_delivery', 'delivered'];
  const labels = {
    pending: 'Order placed', confirmed: 'Confirmed · being prepared', ready_for_delivery: 'Ready · waiting for the rider',
    out_for_delivery: order.rider_name ? `On the way with ${order.rider_name}` : 'On the way', ready: 'Ready for pickup',
    delivered: pickup ? 'Picked up' : 'Delivered',
  };
  // A skipped step (e.g. straight to delivered) still shows as done
  // (a status from the other flow, set by the shop by hand, counts as confirmed)
  const at = order.status === 'completed' ? steps.length - 1 : steps.includes(order.status) ? steps.indexOf(order.status) : 1;
  const reached = (st) => at >= steps.indexOf(st);
  const when = (st) => (order.events || []).filter((e) => e.status === st).slice(-1)[0]?.at;
  return (
    <Card>
      {steps.map((st, i) => {
        const done = reached(st);
        return (
          <View key={st} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: done ? colors.success : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                {done && <Ionicons name="checkmark" size={16} color="#fff" />}
              </View>
              {i < steps.length - 1 && <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: reached(steps[i + 1]) ? colors.success : colors.border }} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Text style={{ fontWeight: '700', color: done ? colors.text : colors.faint }}>{labels[st]}</Text>
              {done && when(st) && <Text style={s.itemMeta}>{niceDate(when(st))}</Text>}
            </View>
          </View>
        );
      })}
    </Card>
  );
}

export function OrderItems({ order, showCost }) {
  return (
    <Card style={{ paddingVertical: 6 }}>
      {order.items.map((it, i) => (
        <View key={it.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
          <ProductImage uri={it.image} style={{ width: 44, height: 44, borderRadius: 8 }} iconSize={18} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{it.name}</Text>
            <Text style={s.itemMeta}>
              {qtyLabel(it.qty, it.unit)} × {money(it.price)}{showCost && it.cost ? ` · cost ${money(it.cost)}` : ''}
            </Text>
            <DiscountNote d={lineDiscount(it)} unit={it.size ? '' : it.unit} />
            {it.returned_qty > 0 && <Text style={[s.itemMeta, { color: colors.warning }]}>Returned {qtyLabel(it.returned_qty, it.unit)}</Text>}
          </View>
          <Text style={{ fontWeight: '700', color: colors.text }}>{money(it.line_total)}</Text>
        </View>
      ))}
    </Card>
  );
}

// What the items' own discounts took off (lines keep their normal price as list_price)
export const itemsDiscount = (items = []) => round2(items.reduce((a, it) => a + (lineDiscount(it)?.off || 0), 0));

export function OrderTotals({ order, showProfit }) {
  return (
    <Card>
      <KV label="Items" value={money(order.subtotal)} />
      {itemsDiscount(order.items) > 0 && <KV label="Item discounts (included)" value={`-${money(itemsDiscount(order.items))}`} tone="good" />}
      <KV label={order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'} value={order.delivery_fee ? money(order.delivery_fee) : 'Free'} />
      {order.discount > 0 && (
        <KV label={`Discount${order.discount_type === 'percent' ? ` (${Number(order.discount_value)}%)` : ''}`} value={`-${money(order.discount)}`} tone="bad" />
      )}
      {order.tax > 0 && <KV label={`Tax${order.tax_type === 'percent' ? ` (${Number(order.tax_value)}%)` : ''}`} value={`+${money(order.tax)}`} />}
      {order.service > 0 && <KV label={`Service charge${order.service_type === 'percent' ? ` (${Number(order.service_value)}%)` : ''}`} value={`+${money(order.service)}`} />}
      <KV label="Total" value={money(order.total)} bold />
      {order.cash_received > 0 && (
        <>
          <KV label="Cash received" value={money(order.cash_received)} />
          <KV label="Change given" value={money(order.change)} />
        </>
      )}
      {order.refunded > 0 && <KV label="Refunded (returns)" value={`-${money(order.refunded)}`} tone="bad" />}
      {showProfit && order.profit != null && <KV label="Profit on items" value={money(order.profit)} tone={order.profit >= 0 ? 'good' : 'bad'} />}
      <Text style={s.itemMeta}>Payment: {paymentLabel(order)}</Text>
    </Card>
  );
}
