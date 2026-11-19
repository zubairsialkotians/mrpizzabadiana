import React, { useState } from 'react';
import { View, Text, Switch } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Card, KV, Field, Footer, Button, s } from '../components/ui';
import { ProductImage, QtyStepper } from '../components/shop';
import { api } from '../services/api';
import { money, qtyLabel } from '../services/format';
import { round2, cleanQty } from '../services/qty';
import { colors } from '../theme';

// Return items from a delivered order: good ones go back to stock, damaged ones are a loss
export default function ReturnFormScreen({ navigation, route }) {
  const { order } = route.params;
  const lines = order.items.map((it) => ({ ...it, left: cleanQty(it.qty - it.returned_qty) })).filter((it) => it.left > 0);
  const [qty, setQty] = useState({});
  const [restock, setRestock] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Return steps follow how it was sold: whole units for pcs, 0.25 for kg/litre
  const stepFor = (it) => (['kg', 'litre'].includes(it.unit) ? 0.25 : ['g', 'ml'].includes(it.unit) ? 50 : 1);
  const asProduct = (it) => ({ unit: it.unit, qty_step: Math.min(stepFor(it), it.left), min_qty: Math.min(stepFor(it), it.left), max_qty: it.left });

  const refund = round2(lines.reduce((a, it) => a + round2((qty[it.id] || 0) * it.price), 0));
  const chosen = lines.filter((it) => qty[it.id] > 0);

  const save = async () => {
    setBusy(true);
    try {
      const r = await api.saveReturn({
        order_id: order.id, note,
        items: chosen.map((it) => ({ order_item_id: it.id, qty: qty[it.id], restock: restock[it.id] !== false })),
      });
      Toast.show({ type: 'success', text1: r.message });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not save the return', text2: e.message, visibilityTime: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Record a return"
      subtitle={`${order.order_no} · ${order.name}`}
      footer={<Footer><Button testID="save-return" title={`Save return · refund ${money(refund)}`} onPress={save} loading={busy} disabled={!chosen.length} /></Footer>}
    >
      {!lines.length && <Text style={{ color: colors.muted }}>Everything on this order has already been returned.</Text>}
      {lines.map((it) => {
        const q = qty[it.id] || 0;
        const good = restock[it.id] !== false;
        return (
          <Card key={it.id}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ProductImage uri={it.image} style={{ width: 44, height: 44, borderRadius: 8 }} iconSize={18} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle}>{it.name}</Text>
                <Text style={s.itemMeta}>Sold {qtyLabel(it.qty, it.unit)} × {money(it.price)} · can return {qtyLabel(it.left, it.unit)}</Text>
              </View>
            </View>
            {q > 0 ? (
              <>
                <View style={{ width: 180 }}><QtyStepper small product={asProduct(it)} qty={q} onChange={(n) => setQty({ ...qty, [it.id]: n })} /></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <Text style={{ flex: 1, color: good ? colors.success : colors.danger, fontWeight: '700' }}>
                    {good ? 'Good condition — back to stock' : 'Damaged / expired — not restocked'}
                  </Text>
                  <Switch value={good} onValueChange={(v) => setRestock({ ...restock, [it.id]: v })} />
                </View>
                <Text style={s.itemMeta}>Refund {money(round2(q * it.price))}</Text>
              </>
            ) : (
              <Button small variant="ghost" title="Return this item" icon="return-down-back-outline" style={{ marginTop: 8, alignSelf: 'flex-start' }}
                onPress={() => setQty({ ...qty, [it.id]: it.left })} testID={`ret-${it.id}`} />
            )}
          </Card>
        );
      })}
      {chosen.length > 0 && (
        <Card>
          <KV label="Items returned" value={String(chosen.length)} />
          <KV label="Refund to customer" value={money(refund)} bold tone="bad" />
        </Card>
      )}
      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. Leaking pack" />
    </Screen>
  );
}
