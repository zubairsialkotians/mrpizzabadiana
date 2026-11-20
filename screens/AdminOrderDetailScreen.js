import React, { useState } from 'react';
import { View, Text, Modal, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { Screen, Card, KV, Loading, ErrorBox, SectionTitle, Button, Footer, Field, SelectField, s } from '../components/ui';
import { OrderItems, OrderTotals, StatusBadge } from '../components/orders';
import { PaymentCard } from '../components/payments';
import { ReviewView } from '../components/reviews';
import { useLoad } from '../components/useData';
import { useAuth } from '../components/AuthContext';
import { api } from '../services/api';
import { confirmAction } from '../services/confirm';
import { money, niceDate } from '../services/format';
import { colors } from '../theme';

const waNumber = (p) => (p || '').replace(/\D/g, '').replace(/^0/, '92');

export default function AdminOrderDetailScreen({ navigation, route }) {
  const { isOwner, branches } = useAuth();
  const { data: o, loading, error, reload, refresh, refreshing, setData } = useLoad(
    () => api.adminOrder(route.params.id).then((r) => r.order), [route.params.id],
  );
  const [busy, setBusy] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const run = async (key, fn) => {
    setBusy(key);
    try {
      const r = await fn();
      setData({ ...r.order, customer_orders: o.customer_orders });
      Toast.show({ type: 'success', text1: r.message });
      setCancelOpen(false);
      return true;
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not update the order', text2: e.message, visibilityTime: 7000 });
      return false;
    } finally {
      setBusy('');
    }
  };
  const setStatus = (status, why) => run(status, () => api.setOrderStatus(o.id, status, why));

  if (loading) return <Screen title="Order"><Loading /></Screen>;
  if (error) return <Screen title="Order"><ErrorBox message={error} onRetry={reload} /></Screen>;

  const confirm = async () => {
    if (await confirmAction('Confirm this order?', `Stock will be taken from ${o.branch_name} and ${o.name} will be notified.`, 'Confirm')) setStatus('confirmed');
  };

  const actions = [];
  const btn = (key, title, onPress, variant = 'success', icon) => (
    <Button key={key} testID={`act-${key}`} title={title} variant={variant} icon={icon} loading={busy === key} onPress={onPress} style={{ flex: 1 }} />
  );
  if (o.status === 'pending') actions.push(btn('confirmed', 'Confirm order', confirm, 'success', 'checkmark-circle-outline'));
  if (o.status === 'confirmed') {
    actions.push(o.fulfilment === 'pickup'
      ? btn('ready', 'Ready for pickup', () => setStatus('ready'), 'primary', 'bag-check-outline')
      : btn('out_for_delivery', 'Out for delivery', () => setStatus('out_for_delivery'), 'primary', 'bicycle-outline'));
  }
  if (['confirmed', 'out_for_delivery', 'ready'].includes(o.status)) {
    actions.push(btn('delivered', o.fulfilment === 'pickup' ? 'Picked up' : 'Delivered', () => setStatus('delivered'), 'success', 'checkmark-done-outline'));
  }
  if (o.status === 'delivered') {
    actions.push(btn('return', 'Record a return', () => navigation.navigate('ReturnForm', { order: o }), 'outline', 'return-down-back-outline'));
  }
  const canCancel = !['delivered', 'cancelled'].includes(o.status);

  return (
    <Screen
      title={o.order_no}
      subtitle={`${niceDate(o.created_at)} · ${o.branch_name}`}
      right={<StatusBadge status={o.status} />}
      onRefresh={refresh}
      refreshing={refreshing}
      footer={actions.length || canCancel ? (
        <Footer>
          <View style={{ flexDirection: 'row', gap: 10 }}>{actions}</View>
          {canCancel && <Button title="Cancel order" variant="outline" small onPress={() => setCancelOpen(true)} style={{ marginTop: actions.length ? 8 : 0 }} />}
        </Footer>
      ) : null}
    >
      <Card>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.black }}>{o.name}</Text>
        <Text style={s.itemSub}>{o.phone} · {o.email}</Text>
        <Text style={[s.itemSub, { color: colors.text, marginTop: 6 }]}>
          {o.fulfilment === 'pickup' ? 'Pickup from shop' : `Deliver to: ${o.address}`}
        </Text>
        {!!o.note && <Text style={[s.itemSub, { color: colors.warning, marginTop: 4 }]}>Note: {o.note}</Text>}
        <Text style={[s.itemMeta, { marginTop: 4 }]}>{o.customer_orders} order{o.customer_orders === 1 ? '' : 's'} from this customer</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button small variant="ghost" icon="call-outline" title="Call" onPress={() => Linking.openURL(`tel:${o.phone}`)} style={{ flex: 1 }} />
          <Button small variant="ghost" icon="logo-whatsapp" title="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${waNumber(o.phone)}`)} style={{ flex: 1 }} />
          <Button small variant="ghost" icon="share-social-outline" title="Bill" onPress={() => navigation.navigate('Bill', { id: o.id })} style={{ flex: 1 }} />
        </View>
      </Card>

      {isOwner && o.status === 'pending' && branches.length > 1 && (
        <SelectField
          label="Branch handling this order"
          value={o.branch_id}
          options={branches.filter((b) => b.status === 'active').map((b) => ({ value: b.id, label: `${b.name}${b.is_main ? ' (main)' : ''}`, sub: b.address }))}
          onChange={(bid) => bid !== o.branch_id && run('assign', () => api.assignOrder(o.id, bid))}
        />
      )}

      <SectionTitle>Payment</SectionTitle>
      <PaymentCard order={o} staff busy={busy}
        onVerify={() => run('verified', () => api.setPaymentStatus(o.id, 'verified'))}
        onReject={(why) => run('rejected', () => api.setPaymentStatus(o.id, 'rejected', why))} />

      {!!o.review && (
        <>
          <SectionTitle right={<Text style={s.itemMeta} onPress={() => navigation.navigate('Reviews')}>All reviews ›</Text>}>Customer review</SectionTitle>
          <ReviewView review={o.review} />
        </>
      )}

      <SectionTitle>Items</SectionTitle>
      <OrderItems order={o} showCost={o.status !== 'pending' && o.status !== 'cancelled'} />
      <OrderTotals order={o} showProfit />

      {o.returns?.length > 0 && (
        <>
          <SectionTitle>Returns</SectionTitle>
          <Card>
            {o.returns.map((r) => <KV key={r.id} label={`${niceDate(r.at)} · ${r.by}${r.note ? ` · ${r.note}` : ''}`} value={`-${money(r.refund)}`} tone="bad" />)}
          </Card>
        </>
      )}

      <SectionTitle>History</SectionTitle>
      <Card>
        {o.events.map((e, i) => (
          <View key={i} style={{ paddingVertical: 5 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>{e.label}{e.note && e.note !== 'Order placed' ? ` — ${e.note}` : ''}</Text>
            <Text style={s.itemMeta}>{niceDate(e.at)} · {e.by}</Text>
          </View>
        ))}
      </Card>

      <Modal visible={cancelOpen} transparent animationType="fade" onRequestClose={() => setCancelOpen(false)}>
        <View style={[s.modalBack, { justifyContent: 'center', padding: 24 }]}>
          <View style={[s.card, { padding: 18 }]}>
            <Text style={[s.sheetTitle, { marginBottom: 8 }]}>Cancel order?</Text>
            {o.status !== 'pending' && <Text style={{ color: colors.muted, marginBottom: 10 }}>The items go back into stock.</Text>}
            <Field label="Reason (sent to the customer)" value={reason} onChangeText={setReason} placeholder="e.g. Item not available" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button title="Keep" variant="outline" onPress={() => setCancelOpen(false)} style={{ flex: 1 }} />
              <Button title="Cancel order" variant="danger" loading={busy === 'cancelled'} onPress={() => setStatus('cancelled', reason)} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
